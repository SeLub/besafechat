import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Identity } from '../../identity/identity.entity';
import { Handle } from '../handle.entity';

@Injectable()
export class HandleService {
  constructor(
    @InjectRepository(Handle)
    private handleRepository: Repository<Handle>,
    @InjectRepository(Identity)
    private identityRepository: Repository<Identity>,
    private dataSource: DataSource
  ) {}

  async searchByUsername(username: string) {
    // Look for a handle with the given username that is searchable
    const handle = await this.handleRepository.findOne({
      where: {
        value: username,
        type: 'account' as const,
        isSearchable: true,
      },
      relations: ['ownerIdentity'],
    });

    if (!handle) {
      // Username not found and available
      return { available: true };
    }

    // Username exists and is not available
    // Return user information
    return {
      available: false,
      user: {
        id: handle.ownerIdentity.id,
        publicKey: handle.ownerIdentity.masterPublicKey?.toString('base64') || null,
        displayName: handle.ownerIdentity.profiles?.[0]?.displayName || null,
        createdAt: handle.ownerIdentity.createdAt,
      },
      username: handle.value,
    };
  }

  async setUsername(userId: string, username: string, isSearchable: boolean) {
    return this.dataSource.transaction(async (manager) => {
      // 1. Check if username already exists
      const existing = await manager.findOne(Handle, {
        where: {
          value: username,
          type: 'account' as const,
        },
      });

      if (existing && existing.ownerIdentityId !== userId) {
        throw new ConflictException('Username is already taken');
      }

      // 2. Check if the user already has a username handle
      const existingUserHandle = await manager.findOne(Handle, {
        where: {
          ownerIdentityId: userId,
          type: 'account' as const,
        },
      });

      if (existingUserHandle) {
        // Update existing handle
        existingUserHandle.value = username;
        existingUserHandle.isSearchable = isSearchable;
        existingUserHandle.isPrimary = true;
        return await manager.save(existingUserHandle);
      } else {
        // Create new handle
        const handle = manager.create(Handle);
        handle.value = username;
        handle.type = 'account' as const;
        handle.isSearchable = isSearchable;
        handle.isPrimary = true;
        handle.ownerIdentityId = userId;

        return await manager.save(handle);
      }
    });
  }
}
