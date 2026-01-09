// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/services/handle.service.ts
import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Identity } from '../../identity/identity.entity';
import { Handle, HandleType } from '../handle.entity';

@Injectable()
export class HandleService {
  constructor(
    @InjectRepository(Handle)
    private handleRepository: Repository<Handle>,
    @InjectRepository(Identity)
    private identityRepository: Repository<Identity>,
    private dataSource: DataSource
  ) {}

  // Существующие методы
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
        displayName: handle.profile?.displayName || null,
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

  // Новые методы для работы с Handle

  async findById(id: string): Promise<Handle> {
    const handle = await this.handleRepository.findOne({
      where: { id },
      relations: ['ownerIdentity'],
    });

    if (!handle) {
      throw new NotFoundException(`Handle with id ${id} not found`);
    }

    return handle;
  }

  async findByValue(value: string): Promise<Handle | null> {
    return this.handleRepository.findOne({
      where: { value },
      relations: ['ownerIdentity'],
    });
  }

  async getPrimaryHandle(identityId: string): Promise<Handle> {
    const handle = await this.handleRepository.findOne({
      where: {
        ownerIdentityId: identityId,
        type: 'account',
        isPrimary: true,
      },
      relations: ['ownerIdentity'],
    });

    if (!handle) {
      throw new NotFoundException(`Primary handle not found for identity ${identityId}`);
    }

    return handle;
  }

  async getHandlesByIdentity(identityId: string): Promise<Handle[]> {
    return this.handleRepository.find({
      where: {
        ownerIdentityId: identityId,
        type: 'account',
      },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async createHandle(data: {
    value: string;
    type: HandleType;
    ownerIdentityId: string;
    alias?: string;
    isSearchable?: boolean;
    isPrimary?: boolean;
  }): Promise<Handle> {
    return this.dataSource.transaction(async (manager) => {
      // Проверка уникальности value
      const existing = await manager.findOne(Handle, {
        where: { value: data.value },
      });

      if (existing) {
        throw new ConflictException(`Handle value "${data.value}" is already taken`);
      }

      // Если создается primary handle, снимаем primary с других
      if (data.isPrimary && data.type === 'account') {
        await manager.update(
          Handle,
          {
            ownerIdentityId: data.ownerIdentityId,
            type: 'account',
            isPrimary: true,
          },
          { isPrimary: false }
        );
      }

      // Создание handle
      const handle = manager.create(Handle, {
        value: data.value,
        type: data.type,
        alias: data.alias,
        isSearchable: data.isSearchable ?? false,
        isPrimary: data.isPrimary ?? false,
        ownerIdentityId: data.ownerIdentityId,
      });

      return await manager.save(handle);
    });
  }

  async updateHandle(id: string, data: Partial<Handle>): Promise<Handle> {
    const handle = await this.findById(id);

    // Запрет изменения value
    if (data.value && data.value !== handle.value) {
      throw new BadRequestException('Handle value cannot be changed');
    }

    // Запрет изменения типа
    if (data.type && data.type !== handle.type) {
      throw new BadRequestException('Handle type cannot be changed');
    }

    // Если устанавливается isPrimary=true, снимаем primary с других handle этого identity
    if (data.isPrimary === true && handle.type === 'account') {
      await this.handleRepository.update(
        {
          ownerIdentityId: handle.ownerIdentityId,
          type: 'account',
          isPrimary: true,
          id: handle.id, // Исключаем текущий handle
        },
        { isPrimary: false }
      );
    }

    // Обновление остальных полей
    Object.assign(handle, data);

    return this.handleRepository.save(handle);
  }

  async deleteHandle(id: string): Promise<void> {
    const handle = await this.findById(id);

    // Нельзя удалить primary handle
    if (handle.isPrimary && handle.type === 'account') {
      throw new BadRequestException('Cannot delete primary handle');
    }

    await this.handleRepository.remove(handle);
  }

  async saveHandle(handle: Handle): Promise<Handle> {
    return this.handleRepository.save(handle);
  }

  async setAlias(handleId: string, alias: string | null | undefined): Promise<Handle> {
    const handle = await this.findById(handleId);

    if (alias !== null) {
      // Проверка уникальности alias
      const existing = await this.handleRepository.findOne({
        where: { alias },
      });

      if (existing && existing.id !== handleId) {
        throw new ConflictException(`Alias "${alias}" is already taken`);
      }
    }

    handle.alias = alias;
    return this.handleRepository.save(handle);
  }

  async setSearchable(handleId: string, isSearchable: boolean): Promise<Handle> {
    const handle = await this.findById(handleId);

    if (handle.type !== 'account') {
      throw new BadRequestException('Only account handles can be searchable');
    }

    handle.isSearchable = isSearchable;
    return this.handleRepository.save(handle);
  }

  async switchPrimaryHandle(identityId: string, newPrimaryHandleId: string): Promise<Handle> {
    return this.dataSource.transaction(async (manager) => {
      // Проверяем что новый handle принадлежит identity
      const newPrimary = await manager.findOne(Handle, {
        where: {
          id: newPrimaryHandleId,
          ownerIdentityId: identityId,
          type: 'account',
        },
      });

      if (!newPrimary) {
        throw new NotFoundException('Handle not found or not an account handle');
      }

      // Снимаем primary со всех handle этого identity
      await manager.update(
        Handle,
        {
          ownerIdentityId: identityId,
          type: 'account',
          isPrimary: true,
        },
        { isPrimary: false }
      );

      // Устанавливаем новый primary
      newPrimary.isPrimary = true;
      return await manager.save(newPrimary);
    });
  }

  async searchHandles(query: string, limit: number = 20): Promise<Handle[]> {
    return this.handleRepository
      .createQueryBuilder('handle')
      .where('handle.isSearchable = :isSearchable', { isSearchable: true })
      .andWhere('handle.type = :type', { type: 'account' })
      .andWhere('(handle.value ILIKE :query OR handle.alias ILIKE :query)', {
        query: `%${query}%`,
      })
      .leftJoinAndSelect('handle.ownerIdentity', 'ownerIdentity')
      .orderBy('handle.isPrimary', 'DESC')
      .addOrderBy('LENGTH(handle.value)', 'ASC')
      .limit(limit)
      .getMany();
  }

  async checkAliasAvailability(alias: string) {
    // Check if alias already exists
    const existingHandle = await this.handleRepository.findOne({
      where: { alias },
    });

    if (existingHandle) {
      return {
        available: false,
        conflict: {
          handleId: existingHandle.id,
          type: existingHandle.type,
          ownerIdentityId: existingHandle.ownerIdentityId
        }
      };
    }

    return {
      available: true
    };
  }
}
