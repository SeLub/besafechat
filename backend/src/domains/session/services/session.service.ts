import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { Session } from '../session.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private dataSource: DataSource
  ) {}

  async createSession(
    identityId: string,
    deviceName: string,
    deviceType?: string,
    ipAddress?: string
  ) {
    // Ограничение: макс. 5 сессий
    const activeSessions = await this.sessionRepository.count({
      where: { identity: { id: identityId }, revoked: false },
    });

    if (activeSessions >= 5) {
      throw new UnauthorizedException('Maximum number of active sessions reached (5)');
    }

    // Генерируем токены
    const refreshToken = randomBytes(64).toString('hex');
    const accessToken = randomBytes(32).toString('hex');

    const now = new Date();
    const session = new Session();
    session.identityId = identityId;
    session.deviceName = deviceName;
    if (deviceType && ['mobile', 'desktop', 'web'].includes(deviceType)) {
      session.deviceType = deviceType as 'mobile' | 'desktop' | 'web';
    }
    session.ipAddress = ipAddress;
    session.accessTokenHash = this.hashToken(accessToken);
    session.refreshToken = refreshToken;
    session.expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 1000); // 30 дней
    session.lastActiveAt = now;

    return {
      session: await this.sessionRepository.save(session),
      tokens: { accessToken, refreshToken },
    };
  }

  async revokeSession(identityId: string, sessionId: string) {
    const result = await this.sessionRepository.update(
      { id: sessionId, identity: { id: identityId } },
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
      relations: ['identity'],
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
      relations: ['identity'],
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
      where: { identity: { id: identityId }, revoked: false },
      order: { lastActiveAt: 'DESC' },
      select: ['id', 'deviceName', 'deviceType', 'ipAddress', 'lastActiveAt', 'createdAt'],
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      deviceType: session.deviceType || 'Unknown device',
      ipAddress: session.ipAddress || '0.0.0.0',
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      current: session.id === currentSessionId,
    }));
  }

  async revokeSessionById(identityId: string, sessionIdToRevoke: string, currentSessionId: string) {
    if (sessionIdToRevoke === currentSessionId) {
      throw new UnauthorizedException('Cannot revoke current session via this endpoint');
    }

    const result = await this.sessionRepository.update(
      { id: sessionIdToRevoke, identity: { id: identityId }, revoked: false },
      { revoked: true }
    );

    if (result.affected === 0) {
      throw new UnauthorizedException('Session not found or already revoked');
    }
  }

  private async isCurrentSession(identityId: string, sessionId: string): Promise<boolean> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, identity: { id: identityId } },
    });
    return session?.revoked === false;
  }

  async refreshSession(refreshToken: string, ipAddress?: string) {
    const session = await this.sessionRepository.findOne({
      where: { refreshToken, revoked: false },
      relations: ['identity'],
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
    };
  }
}
