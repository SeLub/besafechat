// /home/selub/Documents/progs/besafechat/backend/src/domains/auth/services/auth.service.ts
import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { IdentityService } from '../../identity/services/identity.service';
import { SessionService } from '../../session/services/session.service';
import { HandleService } from '../../handle/services/handle.service';
import { ProfileService } from '../../profile/services/profile.service';
import { MediaService } from '../../media/media.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private identityService: IdentityService,
    private sessionService: SessionService,
    private handleService: HandleService,
    private profileService: ProfileService,
    private mediaService: MediaService
  ) {}

 /**
   * Генерирует handle на основе хэша публичного ключа
   * @param publicKeyBase64 - публичный ключ в формате base64
   * @returns строка handle в формате user_{hash}
   */
  generateHandleFromPublicKey(publicKeyBase64: string): string {
    // Декодируем base64 публичный ключ в байты
    const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
    
    // Создаем хэш из публичного ключа
    const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest('hex');
    
    // Берем первые 16 символов хэша для краткости
    const hashPrefix = hash.substring(0, 12);
    
    // Формируем handle в формате user_{hash}
    return `user_${hashPrefix}`;
  }

  async registerIdentity(
    publicKeyBase64: string,
    deviceName: string,
    deviceType?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Регистрируем Identity
    const identity = await this.identityService.registerIdentity(publicKeyBase64);

    // Создаем сессию (без активного Handle, он будет установлен позже)
    const sessionResult = await this.sessionService.createSession(
      identity.id,
      deviceName,
      deviceType,
      ipAddress,
      userAgent
    );

    return {
      session: sessionResult.session,
      tokens: sessionResult.tokens,
      identity,
    };
  }


  async loginWithPublicKey(
    publicKeyBase64: string,
    deviceName: string,
    deviceType?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Ищем Identity по публичному ключу
    let identity = await this.identityService.findByIdentityPublicKey(publicKeyBase64);

    if (!identity) {
      // Если Identity не существует, регистрируем его (первый вход)
      identity = await this.identityService.registerIdentity(publicKeyBase64);

      // Создаем дефолтный handle и профиль для новой идентичности
      const generatedHandle = this.generateHandleFromPublicKey(publicKeyBase64);

      const handle = await this.handleService.createHandle({
        value: generatedHandle,
        type: 'account',
        ownerIdentityId: identity.id,
        isSearchable: true, // Make searchable by default
        isPrimary: true,
      });

      // Создаем дефолтный профиль
      await this.profileService.createProfile({
        handleId: handle.id,
        displayName: 'Anonym User', // Default display name
      });
    }

    // Получаем primary handle
    let activeHandle;
    try {
      activeHandle = await this.handleService.getPrimaryHandle(identity.id);
    } catch (error) {
      // If no primary handle exists (edge case), create default one
      const generatedHandle = this.generateHandleFromPublicKey(publicKeyBase64);

      const handle = await this.handleService.createHandle({
        value: generatedHandle,
        type: 'account',
        ownerIdentityId: identity.id,
        isSearchable: true, // Make searchable by default
        isPrimary: true,
      });

      activeHandle = handle;

      // Создаем дефолтный профиль если его нет
      try {
        await this.profileService.getProfileByHandle(handle.id);
      } catch {
        await this.profileService.createProfile({
          handleId: handle.id,
          displayName: 'Anonym User', // Default display name
        });
      }
    }

    // Создаем сессию с активным Handle
    const sessionResult = await this.sessionService.createSession(
      identity.id,
      deviceName,
      deviceType,
      ipAddress,
      userAgent,
      activeHandle.id // Устанавливаем активный Handle
    );

    return {
      session: sessionResult.session,
      tokens: sessionResult.tokens,
      identity,
    };
  }

  async logout(identityId: string, sessionId: string) {
    await this.sessionService.revokeSession(identityId, sessionId);
  }

  async refreshTokens(refreshToken: string, ipAddress?: string) {
    return await this.sessionService.refreshSession(refreshToken, ipAddress);
  }

  async getIdentityProfile(identityId: string) {
    const identity = await this.identityService.findByIdentityId(identityId);
    if (!identity) {
      throw new UnauthorizedException('Identity not found');
    }

    // Получаем primary handle
    let primaryHandle;
    try {
      primaryHandle = await this.handleService.getPrimaryHandle(identityId);
    } catch (error) {
      // Если нет handle, возвращаем только identity
      return {
        identity: {
          id: identity.id,
          publicKey: identity.masterPublicKey?.toString('base64') || null,
          createdAt: identity.createdAt,
        },
        hasHandle: false,
      };
    }

    // Получаем profile для handle
    const profile = await this.profileService.getProfileByHandle(primaryHandle.id);

    return {
      identity: {
        id: identity.id,
        publicKey: identity.masterPublicKey?.toString('base64') || null,
        createdAt: identity.createdAt,
      },
      handle: {
        id: primaryHandle.id,
        value: primaryHandle.value,
        alias: primaryHandle.alias,
        isSearchable: primaryHandle.isSearchable,
        isPrimary: primaryHandle.isPrimary,
        createdAt: primaryHandle.createdAt,
      },
      profile: {
        displayName: profile.displayName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: this.mediaService.getAvatarUrl(primaryHandle.id),
        bio: profile.bio,
        settings: profile.settings,
      },
      hasHandle: true,
    };
  }

  async getIdentitySessions(identityId: string, currentSessionId: string) {
    return await this.sessionService.findActiveSessionsByIdentityId(identityId, currentSessionId);
  }

  async revokeSessionById(identityId: string, sessionIdToRevoke: string, currentSessionId: string) {
    await this.sessionService.revokeSessionById(identityId, sessionIdToRevoke, currentSessionId);
  }

  async revokeAllSessions(identityId: string, excludeSessionId?: string) {
    await this.sessionService.revokeAllSessions(identityId, excludeSessionId);
  }

  async switchActiveHandle(identityId: string, sessionId: string, handleId: string) {
    return await this.sessionService.switchActiveHandle(sessionId, handleId, identityId);
  }
}
