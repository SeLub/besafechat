import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { HandleService } from '../../handle/services/handle.service';
import { IdentityService } from '../../identity/services/identity.service';
import { MediaService } from '../../media/media.service';
import { SessionService } from '../../session/services/session.service';

@Injectable()
export class AuthService {
  constructor(
    private identityService: IdentityService,
    private sessionService: SessionService,
    private handleService: HandleService,
    private mediaService: MediaService,
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
    userAgent?: string,
  ) {
    // Регистрируем Identity
    const identity = await this.identityService.registerIdentity(publicKeyBase64);

    // Создаем сессию (без активного Handle, он будет установлен позже)
    const sessionResult = await this.sessionService.createSession(
      identity.id,
      deviceName,
      deviceType,
      ipAddress,
      userAgent,
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
    userAgent?: string,
  ) {
    // Ищем Identity по публичному ключу
    let identity = await this.identityService.findByIdentityPublicKey(publicKeyBase64);

    if (!identity) {
      // Если Identity не существует, регистрируем его (первый вход)
      identity = await this.identityService.registerIdentity(publicKeyBase64);

      // Создаем дефолтный handle и профиль для новой идентичности
      // Profile создается автоматически в handleService.createHandle()
      const generatedHandle = this.generateHandleFromPublicKey(publicKeyBase64);

      await this.handleService.createHandle({
        value: generatedHandle,
        type: 'account',
        ownerIdentityId: identity.id,
        isSearchable: true,
        isPrimary: true,
        profileData: {
          displayName: 'Anonym User',
        },
      });
    }

    // Получаем primary handle
    let activeHandle;
    try {
      activeHandle = await this.handleService.getPrimaryHandle(identity.id);
    } catch {
      // If no primary handle exists (edge case), create default one
      // Profile создается автоматически в handleService.createHandle()
      const generatedHandle = this.generateHandleFromPublicKey(publicKeyBase64);

      activeHandle = await this.handleService.createHandle({
        value: generatedHandle,
        type: 'account',
        ownerIdentityId: identity.id,
        isSearchable: true,
        isPrimary: true,
        profileData: {
          displayName: 'Anonym User',
        },
      });
    }

    // Создаем сессию с активным Handle
    const sessionResult = await this.sessionService.createSession(
      identity.id,
      deviceName,
      deviceType,
      ipAddress,
      userAgent,
      activeHandle.id, // Устанавливаем активный Handle
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

    // Получаем primary handle (always guaranteed to exist from loginWithPublicKey)
    const primaryHandle = await this.handleService.getPrimaryHandle(identityId);

    // Получаем profile для handle из handle relation
    const profile = primaryHandle.profile;
    if (!profile) {
      throw new UnauthorizedException('Profile not found for handle');
    }
    const avatarUrl = await this.mediaService.getAvatarUrlIfExists(primaryHandle.id);

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
        avatarUrl: avatarUrl,
        bio: profile.bio,
        settings: profile.settings,
      },
    };
  }

  async getIdentitySessions(identityId: string, currentSessionId: string) {
    return await this.sessionService.findActiveSessionsByIdentityId(identityId, currentSessionId);
  }

  async revokeSessionById(
    identityId: string,
    sessionIdToRevoke: string,
    currentSessionId: string,
  ) {
    await this.sessionService.revokeSessionById(identityId, sessionIdToRevoke, currentSessionId);
  }

  async revokeAllSessions(identityId: string, excludeSessionId?: string) {
    await this.sessionService.revokeAllSessions(identityId, excludeSessionId);
  }

  async switchActiveHandle(identityId: string, sessionId: string, handleId: string) {
    return await this.sessionService.switchActiveHandle(sessionId, handleId, identityId);
  }
}
