// /home/selub/Documents/progs/besafechat/backend/src/domains/session/services/session.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Session } from '../session.entity';
import { HandleService } from '../../handle/services/handle.service';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private handleService: HandleService
  ) {}

  async createSession(
    identityId: string,
    deviceName: string,
    deviceType?: string,
    ipAddress?: string,
    userAgent?: string,
    activeHandleId?: string // Добавили параметр активного Handle
  ) {
    console.log('[Session Service] createSession called:', {
      identityId,
      deviceName,
      activeHandleId,
    });

    // Ограничение: макс. 50 сессий
    const activeSessions = await this.sessionRepository.count({
      where: { identityId, revoked: false },
    });

    if (activeSessions >= 50) {
      throw new UnauthorizedException('Maximum number of active sessions reached (5)');
    }

    // Если activeHandleId не указан, найти primary handle
    let handleId = activeHandleId;
    if (!handleId) {
      console.log(
        `[Session Service] No activeHandleId provided, fetching primary handle for identity ${identityId}`
      );
      const primaryHandle = await this.handleService.getPrimaryHandle(identityId);
      handleId = primaryHandle?.id;
      console.log(`[Session Service] Primary handle:`, {
        id: handleId,
        value: primaryHandle?.value,
      });
    } else {
      console.log(`[Session Service] Using provided activeHandleId: ${handleId}`);
    }

    // Генерируем токены
    const refreshToken = randomBytes(64).toString('hex');
    const accessToken = randomBytes(32).toString('hex');

    const now = new Date();
    const session = this.sessionRepository.create({
      identityId,
      activeHandleId: handleId,
      deviceName,
      deviceType:
        deviceType && ['mobile', 'desktop', 'web'].includes(deviceType)
          ? (deviceType as 'mobile' | 'desktop' | 'web')
          : undefined,
      ipAddress,
      userAgent,
      accessTokenHash: this.hashToken(accessToken),
      refreshToken,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 дней
      lastActiveAt: now,
      isActive: true,
      revoked: false,
    });

    console.log('[Session Service] Created session object:', {
      id: session.id,
      activeHandleId: session.activeHandleId,
    });

    const savedSession = await this.sessionRepository.save(session);

    console.log('[Session Service] Saved session:', {
      id: savedSession.id,
      activeHandleId: savedSession.activeHandleId,
    });

    return {
      session: savedSession,
      tokens: { accessToken, refreshToken },
    };
  }

  async revokeSession(identityId: string, sessionId: string) {
    const result = await this.sessionRepository.update(
      { id: sessionId, identityId },
      { revoked: true }
    );

    if (result.affected === 0) {
      throw new UnauthorizedException('Session not found');
    }
  }

  async revokeAllSessions(identityId: string, excludeSessionId?: string) {
    const query = this.sessionRepository
      .createQueryBuilder()
      .update(Session)
      .set({ revoked: true })
      .where('identityId = :identityId', { identityId });

    if (excludeSessionId) {
      query.andWhere('id != :excludeId', { excludeId: excludeSessionId });
    }

    await query.execute();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async validateAccessToken(accessToken: string): Promise<Session | null> {
    const hash = this.hashToken(accessToken);
    const session = await this.sessionRepository.findOne({
      where: { accessTokenHash: hash, revoked: false },
      relations: ['identity', 'activeHandle'],
    });

    // Update lastActiveAt if session is found and not updated in the last minute
    if (session && (!session.lastActiveAt || Date.now() - session.lastActiveAt.getTime() > 60000)) {
      session.lastActiveAt = new Date();
      await this.sessionRepository.save(session);
    }

    return session;
  }

  async validateRefreshToken(refreshToken: string): Promise<Session | null> {
    const session = await this.sessionRepository.findOne({
      where: { refreshToken, revoked: false },
      relations: ['identity', 'activeHandle'],
    });

    // Update lastActiveAt if session is found and not updated in the last minute
    if (session && (!session.lastActiveAt || Date.now() - session.lastActiveAt.getTime() > 60000)) {
      session.lastActiveAt = new Date();
      await this.sessionRepository.save(session);
    }

    return session;
  }

  async findActiveSessionsByIdentityId(identityId: string, currentSessionId: string) {
    const sessions = await this.sessionRepository.find({
      where: { identityId, revoked: false },
      order: { lastActiveAt: 'DESC' },
      select: [
        'id',
        'deviceName',
        'deviceType',
        'ipAddress',
        'lastActiveAt',
        'createdAt',
        'activeHandleId',
      ],
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      deviceType: session.deviceType || 'Unknown device',
      ipAddress: session.ipAddress || '0.0.0.0',
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      activeHandleId: session.activeHandleId,
      current: session.id === currentSessionId,
    }));
  }

  async revokeSessionById(identityId: string, sessionIdToRevoke: string, currentSessionId: string) {
    if (sessionIdToRevoke === currentSessionId) {
      throw new UnauthorizedException('Cannot revoke current session via this endpoint');
    }

    const result = await this.sessionRepository.update(
      { id: sessionIdToRevoke, identityId, revoked: false },
      { revoked: true }
    );

    if (result.affected === 0) {
      throw new UnauthorizedException('Session not found or already revoked');
    }
  }

  async refreshSession(refreshToken: string, ipAddress?: string) {
    const session = await this.sessionRepository.findOne({
      where: { refreshToken, revoked: false },
      relations: ['identity', 'activeHandle'],
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Генерируем новые токены
    const newAccessToken = randomBytes(32).toString('hex');
    const newRefreshToken = randomBytes(64).toString('hex');

    const now = new Date();
    // Обновляем сессию
    session.accessTokenHash = this.hashToken(newAccessToken);
    session.refreshToken = newRefreshToken;
    session.lastActiveAt = now;
    if (ipAddress) session.ipAddress = ipAddress;

    await this.sessionRepository.save(session);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      identity: session.identity,
      activeHandle: session.activeHandle,
    };
  }

  async getSessionById(sessionId: string): Promise<Session | null> {
    return this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ['identity', 'activeHandle'],
    });
  }

  async saveSession(session: Session): Promise<Session> {
    return this.sessionRepository.save(session);
  }
}
