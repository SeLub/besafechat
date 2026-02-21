// /home/selub/Documents/progs/besafechat/backend/src/domains/auth/services/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { HandleService } from '../../handle/services/handle.service';
import { IdentityService } from '../../identity/services/identity.service';
import { MediaService } from '../../media/media.service';
import { SessionService } from '../../session/services/session.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private identityService: IdentityService,
    private sessionService: SessionService,
    private handleService: HandleService,
    private mediaService: MediaService
  ) {}

  generateHandleFromPublicKey(publicKeyBase64: string): string {
    const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
    const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest('hex');
    const hashPrefix = hash.substring(0, 12);
    return `user_${hashPrefix}`;
  }

  async registerIdentity(
    publicKeyBase64: string,
    deviceName: string,
    deviceType?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const identity = await this.identityService.registerIdentity(publicKeyBase64);

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
    let isRecovered = false;

    // 1. Пробуем найти АКТИВНУЮ identity
    let identity = await this.identityService.findByIdentityPublicKey(publicKeyBase64);

    if (!identity) {
      // 2. Если не активна, проверяем, не была ли она мягко удалена
      const deletedIdentity = await this.identityService.findDeletedByPublicKey(publicKeyBase64);

      if (!deletedIdentity) {
        // Совсем не найден -> Новый пользователь (регистрируем)
        this.logger.log(`[Login] New identity detected, registering...`);
        identity = await this.identityService.registerIdentity(publicKeyBase64);

        // Создаем дефолтный handle и профиль для новой идентичности
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
      } else {
        // 3. Найден soft-deleted аккаунт -> Проверяем окно восстановления
        const now = new Date();
        const deletedAt = new Date(deletedIdentity.deletedAt!);
        const diffTime = Math.abs(now.getTime() - deletedAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 90) {
          // Окно истекло -> Ошибка
          this.logger.warn(
            `[Login] Recovery window expired for ${deletedIdentity.id} (${diffDays} days)`
          );
          throw new ForbiddenException(
            `Account recovery window expired (${diffDays} days ago). Data has been permanently deleted. Please create a new account.`
          );
        }

        // 4. Восстанавливаем аккаунт
        this.logger.log(`[Login] Recovering deleted account: ${deletedIdentity.id}`);
        identity = await this.identityService.recoverIdentity(deletedIdentity.id);
        isRecovered = true;
      }
    }

    // Получаем primary handle (он должен восстановиться вместе с аккаунтом)
    let activeHandle;
    try {
      activeHandle = await this.handleService.getPrimaryHandle(identity.id);
    } catch {
      // Edge case: если хендл не нашелся (например, ошибка БД), создаем новый
      this.logger.warn(`[Login] Primary handle missing for ${identity.id}, creating default...`);
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

    // Создаем сессию
    const sessionResult = await this.sessionService.createSession(
      identity.id,
      deviceName,
      deviceType,
      ipAddress,
      userAgent,
      activeHandle.id
    );

    return {
      session: sessionResult.session,
      tokens: sessionResult.tokens,
      identity,
      recovered: isRecovered, // Флаг для фронтенда
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

    let handle: any;
    if (activeHandleId) {
      console.log(`[Auth Service] Fetching handle by activeHandleId: ${activeHandleId}`);
      try {
        handle = await this.handleService.findById(activeHandleId);

        if (!handle || handle.ownerIdentityId !== identityId) {
          console.warn(`[Auth Service] Active handle mismatch, falling back to primary`);
          handle = await this.handleService.getPrimaryHandle(identityId);
        }
      } catch (error) {
        console.error(`[Auth Service] Error fetching active handle:`, error);
        handle = await this.handleService.getPrimaryHandle(identityId);
      }
    } else {
      handle = await this.handleService.getPrimaryHandle(identityId);
    }

    if (!handle) {
      throw new UnauthorizedException('No valid handle found for identity');
    }

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

  async revokeSessionById(identityId: string, sessionIdToRevoke: string, currentSessionId: string) {
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
    const handle = await this.handleService.findById(handleId);
    if (!handle || handle.ownerIdentityId !== identityId) {
      throw new BadRequestException('Handle not found or does not belong to this identity');
    }

    const result = await this.sessionService.createSession(
      identityId,
      deviceName,
      undefined,
      ipAddress,
      undefined,
      handleId
    );

    return {
      session: result.session,
      tokens: result.tokens,
    };
  }
}
