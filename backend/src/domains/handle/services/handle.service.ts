// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/services/handle.service.ts
import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Identity } from '../../identity/identity.entity';
import { Handle, HandleType } from '../handle.entity';
import { Profile } from '../../profile/profile.entity';
import { MediaService } from '../../media/media.service';

@Injectable()
export class HandleService {
  constructor(
    @InjectRepository(Handle)
    private handleRepository: Repository<Handle>,
    @InjectRepository(Identity)
    private identityRepository: Repository<Identity>,
    private dataSource: DataSource,
    private mediaService: MediaService
  ) {}

  /**
   * Генерирует уникальное значение handle в формате user_{uuid_prefix}
   * @returns строка handle в формате user_{16_символов_uuid}
   */
  generateHandleValue(): string {
    const handleId = uuidv4();
    // Берем первые 16 символов UUID (без дефисов для компактности)
    const uuidWithoutDashes = handleId.replace(/-/g, '');
    const hashPrefix = uuidWithoutDashes.substring(0, 16);
    return `user_${hashPrefix}`;
  }

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
      relations: ['ownerIdentity', 'profile'],
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

  async findByValueOrAlias(
    query: string
  ): Promise<{ handle: Handle; matchedBy: 'value' | 'alias' } | null> {
    const byValue = await this.handleRepository.findOne({
      where: { value: query },
      relations: ['ownerIdentity', 'profile'],
    });

    if (byValue) {
      return { handle: byValue, matchedBy: 'value' };
    }

    const byAlias = await this.handleRepository.findOne({
      where: { alias: query },
      relations: ['ownerIdentity', 'profile'],
    });

    if (byAlias) {
      return { handle: byAlias, matchedBy: 'alias' };
    }

    return null;
  }

  async getPrimaryHandle(identityId: string): Promise<Handle> {
    const handle = await this.handleRepository.findOne({
      where: {
        ownerIdentityId: identityId,
        type: 'account',
        isPrimary: true,
      },
      relations: ['ownerIdentity', 'profile'],
    });

    if (!handle) {
      throw new NotFoundException(`Primary handle not found for identity ${identityId}`);
    }

    return handle;
  }

  async getHandlesByIdentity(identityId: string): Promise<Handle[]> {
    const handles = await this.handleRepository.find({
      where: {
        ownerIdentityId: identityId,
        type: 'account',
      },
      relations: ['profile'],
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });

    // Enrich each handle with avatarUrl
    const enrichedHandles = await Promise.all(
      handles.map(async (handle) => {
        if (handle.profile) {
          const avatarUrl = await this.mediaService.getAvatarUrlIfExists(handle.id);
          return {
            ...handle,
            profile: {
              ...handle.profile,
              avatarUrl,
            },
          };
        }
        return handle;
      })
    );

    return enrichedHandles;
  }

  async createHandle(data: {
    value: string;
    type: HandleType;
    ownerIdentityId: string;
    alias?: string | null;
    isSearchable?: boolean;
    isPrimary?: boolean;
    profileData?: {
      displayName?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      bio?: string;
      settings?: Record<string, any>;
    };
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

      const savedHandle = await manager.save(handle);

      // Автоматическое создание профиля для account-типов
      if (data.type === 'account') {
        const profileData = data.profileData || {};
        
        // Default settings for new profiles
        const defaultSettings = {
          ui: {
            theme: 'besafe',
            language: 'en',
            mode: 'dark',
          },
          storage: {
            messageRetentionDays: 'forever',
          },
          notifications: true,
          sound: true,
        };
        
        const profile = manager.create(Profile, {
          handleId: savedHandle.id,
          displayName: profileData.displayName || 'Anonym User',
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          email: profileData.email,
          phone: profileData.phone,
          bio: profileData.bio,
          settings: profileData.settings || defaultSettings,
        });

        const savedProfile = await manager.save(profile);
        // Attach the profile to the handle before returning
        savedHandle.profile = savedProfile;
      }

      return savedHandle;
    });
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
    // Check if alias exists in either alias field or value field
    // This is the unified check for both handle.value and handle.alias uniqueness
    const existingHandle = await this.handleRepository
      .createQueryBuilder('handle')
      .where('handle.alias = :alias OR handle.value = :alias', { alias })
      .getOne();

    if (existingHandle) {
      return {
        available: false,
      };
    }

    return {
      available: true,
    };
  }
}
