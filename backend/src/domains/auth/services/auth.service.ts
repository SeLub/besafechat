// /home/selub/Documents/progs/besafechat/backend/src/domains/auth/services/auth.service.ts
import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { IdentityService } from '../../identity/services/identity.service';
import { SessionService } from '../../session/services/session.service';
import { HandleService } from '../../handle/services/handle.service';
import { ProfileService } from '../../profile/services/profile.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private identityService: IdentityService,
    private sessionService: SessionService,
    private handleService: HandleService,
    private profileService: ProfileService
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

  async registerWithHandle(
    publicKeyBase64: string,
    handleValue: string,
    displayName: string,
    deviceName: string,
    deviceType?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Проверяем, существует ли уже идентичность с этим публичным ключом
    const existingIdentity = await this.identityService.findByIdentityPublicKey(publicKeyBase64);
    
    if (existingIdentity) {
      // Если идентичность уже существует, проверяем, есть ли у нее уже primary handle
      const existingHandles = await this.handleService.getHandlesByIdentity(existingIdentity.id);
      const hasPrimaryHandle = existingHandles.some(h => h.isPrimary);
      
      if (hasPrimaryHandle) {
        // Если у идентичности уже есть primary handle, возвращаем ошибку
        throw new BadRequestException('Identity already registered with a handle');
      }
    }

    // Регистрируем Identity (создаст новую или вернет существующую)
    const identity = await this.identityService.registerIdentity(publicKeyBase64);

    // Определяем handle - если handle начинается с "user_", используем генерацию из публичного ключа
    let finalHandleValue = handleValue;
    
    // Если handle начинается с "user_", используем генерацию из публичного ключа
    if (handleValue.startsWith('user_')) {
      // Проверяем, совпадает ли предоставленный handle с тем, который будет сгенерирован
      const generatedHandle = this.generateHandleFromPublicKey(publicKeyBase64);
      
      // Используем генерируемый handle вместо предоставленного
      finalHandleValue = generatedHandle;
    } else {
      // Если handle не начинается с "user_", проверяем, совпадает ли он с генерируемым
      const generatedHandle = this.generateHandleFromPublicKey(publicKeyBase64);
      
      // Если предоставленный handle не совпадает с генерируемым, используем генерируемый
      if (handleValue !== generatedHandle) {
        finalHandleValue = generatedHandle;
      }
    }

    // Создаем Handle (будет primary)
    const handle = await this.handleService.createHandle({
      value: finalHandleValue,
      type: 'account',
      ownerIdentityId: identity.id,
      isSearchable: true,
      isPrimary: true,
    });

    // Создаем Profile для Handle
    const profile = await this.profileService.createProfile({
      handleId: handle.id,
      displayName,
    });

    // Создаем сессию с активным Handle
    const sessionResult = await this.sessionService.createSession(
      identity.id,
      deviceName,
      deviceType,
      ipAddress,
      userAgent,
      handle.id // Устанавливаем активный Handle
    );

    return {
      session: sessionResult.session,
      tokens: sessionResult.tokens,
      identity,
      handle,
      profile,
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
    }

    // Создаем сессию
    const sessionResult = await this.sessionService.createSession(
      identity.id,
      deviceName,
      deviceType,
      ipAddress,
      userAgent
      // Handle будет установлен автоматически (primary или из сессии)
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
        avatarUrl: profile.avatarUrl,
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
