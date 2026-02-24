// /home/selub/Documents/progs/besafechat/backend/src/domains/profile/services/profile.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HandleService } from '../../handle/services/handle.service';
import { MediaService } from '../../media/media.service';
import { Profile, ProfileSettings } from '../profile.entity';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    private handleService: HandleService,
    private dataSource: DataSource,
    private mediaService: MediaService
  ) {}

  /**
   * Internal method to create profile (should only be called from HandleService)
   * @internal
   */
  async createProfile(data: {
    handleId: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    bio?: string;
    settings?: ProfileSettings;
  }): Promise<Profile> {
    // Проверяем что Handle существует и имеет тип 'account'
    const handle = await this.handleService.findById(data.handleId);

    if (handle.type !== 'account') {
      throw new BadRequestException('Profile can only be created for account handles');
    }

    // Проверяем что у Handle еще нет Profile
    if (handle.profile) {
      throw new BadRequestException('Profile already exists for this handle');
    }

    // Default settings for new profiles
    const defaultSettings: ProfileSettings = {
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

    // Создаем Profile
    const profile = this.profileRepository.create({
      handleId: data.handleId,
      displayName: data.displayName,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      bio: data.bio,
      settings: (data.settings || defaultSettings) as ProfileSettings,
    });

    // Сохраняем Profile
    const savedProfile = await this.profileRepository.save(profile);

    // С cascade: true связь установится автоматически при следующем сохранении Handle
    // Но мы можем сразу обновить handle для consistency
    handle.profile = savedProfile;
    await this.handleService.saveHandle(handle);

    return savedProfile;
  }

  async getProfileByHandle(handleId: string): Promise<Profile> {
    const profile = await this.profileRepository.findOne({
      where: { handleId },
      relations: ['handle'],
    });

    if (!profile) {
      throw new NotFoundException(`Profile not found for handle ${handleId}`);
    }

    // Always generate avatarUrl dynamically if avatar exists
    const avatarUrl = await this.mediaService.getAvatarUrlIfExists(handleId);
    return {
      ...profile,
      avatarUrl: avatarUrl,
    } as Profile & { avatarUrl: string | null };
  }

  async getProfileByHandleValue(handleValue: string): Promise<Profile> {
    const handle = await this.handleService.findByValue(handleValue);

    if (!handle) {
      throw new NotFoundException(`Handle ${handleValue} not found`);
    }

    return this.getProfileByHandle(handle.id);
  }

  async getProfileByAlias(alias: string): Promise<Profile> {
    const handle = await this.dataSource.getRepository('Handle').findOne({
      where: { alias },
    });

    if (!handle) {
      throw new NotFoundException(`Handle with alias ${alias} not found`);
    }

    return this.getProfileByHandle(handle.id);
  }

  async updateProfile(handleId: string, updates: Partial<Profile>): Promise<Profile> {
    const profile = await this.getProfileByHandle(handleId);

    // Запрещаем изменение handleId
    if (updates.handleId && updates.handleId !== profile.handleId) {
      throw new BadRequestException('Cannot change handle association');
    }

    Object.assign(profile, updates);
    profile.updatedAt = new Date();

    return this.profileRepository.save(profile);
  }

  async deleteProfile(handleId: string): Promise<void> {
    const profile = await this.getProfileByHandle(handleId);
    await this.profileRepository.remove(profile);
  }

  async searchProfiles(query: string, limit: number = 20): Promise<Profile[]> {
    return this.profileRepository
      .createQueryBuilder('profile')
      .innerJoinAndSelect('profile.handle', 'handle')
      .where('handle.isSearchable = :isSearchable', { isSearchable: true })
      .andWhere('handle.type = :type', { type: 'account' })
      .andWhere(
        '(profile.displayName ILIKE :query OR handle.value ILIKE :query OR handle.alias ILIKE :query)',
        {
          query: `%${query}%`,
        }
      )
      .orderBy('handle.isPrimary', 'DESC')
      .addOrderBy('profile.updatedAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getPublicProfile(handleQuery: string): Promise<{
    handle: { id: string; value: string; alias: string | null | undefined; matchedBy: string };
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    bio: string | null | undefined;
    createdAt: Date;
  }> {
    const result = await this.handleService.findByValueOrAlias(handleQuery);

    if (!result) {
      throw new NotFoundException(`Handle "${handleQuery}" not found`);
    }

    const { handle, matchedBy } = result;
    const profile = await this.getProfileByHandle(handle.id);
    const avatarUrl = await this.mediaService.getAvatarUrlIfExists(handle.id);

    const publicProfile = {
      handle: {
        id: handle.id,
        value: handle.value,
        alias: handle.alias,
        matchedBy,
      },
      displayName: profile.displayName,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      avatarUrl,
      bio: profile.bio || null,
      createdAt: profile.createdAt,
    };

    // Privacy settings (showEmail, showPhone, etc.) removed - not used in new settings structure

    return publicProfile;
  }

  async updateSettings(handleId: string, updates: Partial<ProfileSettings>): Promise<Profile> {
    const profile = await this.getProfileByHandle(handleId);

    // Deep merge new settings with existing ones
    profile.settings = {
      ...profile.settings,

      // Merge ui settings (nested object)
      ...(updates.ui && {
        ui: {
          ...(profile.settings.ui || {}),
          ...updates.ui,
        },
      }),

      // Merge storage settings (nested object)
      ...(updates.storage && {
        storage: {
          ...(profile.settings.storage || {}),
          ...updates.storage,
        },
      }),

      // Simple boolean fields
      ...(updates.notifications !== undefined && {
        notifications: updates.notifications,
      }),
      ...(updates.sound !== undefined && {
        sound: updates.sound,
      }),
    };

    profile.updatedAt = new Date();
    return this.profileRepository.save(profile);
  }

  async updateBio(handleId: string, bio: string): Promise<Profile> {
    const profile = await this.getProfileByHandle(handleId);
    profile.bio = bio;
    profile.updatedAt = new Date();

    return this.profileRepository.save(profile);
  }
}
