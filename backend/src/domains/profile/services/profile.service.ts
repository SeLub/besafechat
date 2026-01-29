// /home/selub/Documents/progs/besafechat/backend/src/domains/profile/services/profile.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { HandleService } from '../../handle/services/handle.service';
import { MediaService } from '../../media/media.service';
import { Profile } from '../profile.entity';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    private handleService: HandleService,
    private dataSource: DataSource,
    private mediaService: MediaService
  ) {}

  async createProfile(data: {
    handleId: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    bio?: string;
    settings?: Record<string, any>;
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

    // Создаем Profile
    const profile = this.profileRepository.create({
      handleId: data.handleId,
      displayName: data.displayName,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      bio: data.bio,
      settings: data.settings || {},
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
    } as any;
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

  async getPublicProfile(handleValue: string): Promise<any> {
    const profile = await this.getProfileByHandleValue(handleValue);
    const avatarUrl = await this.mediaService.getAvatarUrlIfExists(profile.handleId);

    // Фильтруем приватные данные согласно настройкам
    const publicProfile: any = {
      handle: {
        value: profile.handle.value,
        alias: profile.handle.alias,
        isSearchable: profile.handle.isSearchable,
      },
      displayName: profile.displayName,
      avatarUrl: avatarUrl, // Always generate dynamically if avatar exists
      bio: profile.bio,
      metadata: profile.metadata,
      createdAt: profile.createdAt,
    };

    // Добавляем приватные данные только если разрешено в настройках
    if (profile.settings.showEmail && profile.email) {
      publicProfile.email = profile.email;
    }

    if (profile.settings.showPhone && profile.phone) {
      publicProfile.phone = profile.phone;
    }

    if (profile.settings.showLastSeen && profile.metadata.lastActive) {
      publicProfile.lastActive = profile.metadata.lastActive;
    }

    return publicProfile;
  }

  async updateSettings(handleId: string, settings: Record<string, any>): Promise<Profile> {
    const profile = await this.getProfileByHandle(handleId);

    // Обновляем только settings
    profile.settings = { ...profile.settings, ...settings };
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
