import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
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

  async getIdentityProfile(identityId: string, activeHandleId?: string) {
    console.log('[Auth Service] getIdentityProfile called:', { identityId, activeHandleId });
    
    const identity = await this.identityService.findByIdentityId(identityId);
    if (!identity) {
      throw new UnauthorizedException('Identity not found');
    }

    // If activeHandleId is provided (from session), use it; otherwise use primary handle
    let handle: any;
    if (activeHandleId) {
      console.log(`[Auth Service] Fetching handle by activeHandleId: ${activeHandleId}`);
      try {
        handle = await this.handleService.findById(activeHandleId);
        console.log(`[Auth Service] Fetched handle:`, {
          found: !!handle,
          id: handle?.id,
          value: handle?.value,
          ownerIdentityId: handle?.ownerIdentityId,
        });
        
        // Validate that handle belongs to this identity
        if (!handle.ownerIdentityId) {
          console.warn(`[Auth Service] Active handle ${activeHandleId} has no ownerIdentityId, reloading...`);
          // Reload with explicit select
          handle = await this.handleService.findById(activeHandleId);
        }
        
        if (!handle || handle.ownerIdentityId !== identityId) {
          console.warn(`[Auth Service] Active handle ${activeHandleId} not found or doesn't belong to identity ${identityId}, falling back to primary`);
          // Fallback to primary handle if active handle not found or doesn't match
          handle = await this.handleService.getPrimaryHandle(identityId);
          console.log(`[Auth Service] Fallback to primary handle:`, {
            id: handle?.id,
            value: handle?.value,
          });
        }
      } catch (error) {
        console.error(`[Auth Service] Error fetching active handle ${activeHandleId}:`, error);
        // Fallback to primary handle on error
        handle = await this.handleService.getPrimaryHandle(identityId);
        console.log(`[Auth Service] Error fallback to primary handle:`, {
          id: handle?.id,
          value: handle?.value,
        });
      }
    } else {
      // Fallback to primary handle (always guaranteed to exist from loginWithPublicKey)
      console.log(`[Auth Service] No activeHandleId provided, using primary handle for identity ${identityId}`);
      handle = await this.handleService.getPrimaryHandle(identityId);
      console.log(`[Auth Service] Primary handle:`, {
        id: handle?.id,
        value: handle?.value,
      });
    }
    
    if (!handle) {
      throw new UnauthorizedException('No valid handle found for identity');
    }
    
    console.log(`[Auth Service] Final handle to return:`, {
      id: handle?.id,
      value: handle?.value,
    });

    // Получаем profile для handle из handle relation
    const profile = handle.profile;
    if (!profile) {
      throw new UnauthorizedException('Profile not found for handle');
    }
    const avatarUrl = await this.mediaService.getAvatarUrlIfExists(handle.id);

    return {
      identity: {
        id: identity.id,
        publicKey: identity.masterPublicKey?.toString('base64') || null,
        createdAt: identity.createdAt,
      },
      handle: {
        id: handle.id,
        value: handle.value,
        alias: handle.alias,
        isSearchable: handle.isSearchable,
        isPrimary: handle.isPrimary,
        createdAt: handle.createdAt,
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

  async createSessionWithHandle(
    identityId: string,
    handleId: string,
    deviceName: string,
    ipAddress: string
  ) {
    // Verify handle belongs to this identity
    const handle = await this.handleService.findById(handleId);
    if (!handle || handle.ownerIdentityId !== identityId) {
      throw new BadRequestException('Handle not found or does not belong to this identity');
    }

    // Create new session with this handle as activeHandle
    const result = await this.sessionService.createSession(
      identityId,
      deviceName,
      undefined, // deviceType
      ipAddress,
      undefined, // userAgent
      handleId // activeHandleId
    );

    return {
      session: result.session,
      tokens: result.tokens,
    };
  }
}
