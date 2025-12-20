import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Session } from '../session.entity';
import { User } from '../user.entity';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private dataSource: DataSource
  ) {}

  async createSession(userId: string, deviceId: string, deviceModel?: string, ipAddress?: string) {
    // Ограничение: макс. 5 сессий
    const activeSessions = await this.sessionRepository.count({
      where: { user: { id: userId }, revoked: false },
    });

    if (activeSessions >= 5) {
      throw new UnauthorizedException('Maximum number of active sessions reached (5)');
    }

    // Генерируем токены
    const refreshToken = randomBytes(64).toString('hex');
    const accessToken = randomBytes(32).toString('hex');

    const session = this.sessionRepository.create({
      user: { id: userId } as User,
      deviceId,
      deviceModel,
      ipAddress,
      accessTokenHash: this.hashToken(accessToken),
      refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 дней
    });

    return {
      session: await this.sessionRepository.save(session),
      tokens: { accessToken, refreshToken },
    };
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.sessionRepository.update(
      { id: sessionId, user: { id: userId } },
      { revoked: true }
    );
    if (result.affected === 0) {
      throw new UnauthorizedException('Session not found');
    }
  }

  async revokeAllSessions(userId: string, excludeSessionId?: string) {
    const query = this.sessionRepository
      .createQueryBuilder()
      .update(Session)
      .set({ revoked: true })
      .where('user_id = :userId', { userId });

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
    return this.sessionRepository.findOne({
      where: { accessTokenHash: hash, revoked: false },
      relations: ['user'],
    });
  }

  async validateRefreshToken(refreshToken: string): Promise<Session | null> {
    return this.sessionRepository.findOne({
      where: { refreshToken, revoked: false },
      relations: ['user'],
    });
  }

  async findActiveSessionsByUserId(userId: string, currentSessionId: string) {
    const sessions = await this.sessionRepository.find({
      where: { user: { id: userId }, revoked: false },
      order: { lastActiveAt: 'DESC' },
      select: ['id', 'deviceId', 'deviceModel', 'ipAddress', 'lastActiveAt', 'createdAt'],
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceId: session.deviceId,
      deviceModel: session.deviceModel || 'Unknown device',
      ipAddress: session.ipAddress || '0.0.0.0',
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      current: session.id === currentSessionId,
    }));
  }

  async revokeSessionById(userId: string, sessionIdToRevoke: string, currentSessionId: string) {
    if (sessionIdToRevoke === currentSessionId) {
      throw new UnauthorizedException('Cannot revoke current session via this endpoint');
    }

    const result = await this.sessionRepository.update(
      { id: sessionIdToRevoke, user: { id: userId }, revoked: false },
      { revoked: true }
    );

    if (result.affected === 0) {
      throw new UnauthorizedException('Session not found or already revoked');
    }
  }

  private async isCurrentSession(userId: string, sessionId: string): Promise<boolean> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, user: { id: userId } },
    });
    return session?.revoked === false;
  }

  async refreshSession(refreshToken: string, ipAddress?: string) {
    const session = await this.sessionRepository.findOne({
      where: { refreshToken, revoked: false },
      relations: ['user'],
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Генерируем новые токены
    const newAccessToken = randomBytes(32).toString('hex');
    const newRefreshToken = randomBytes(64).toString('hex');

    // Обновляем сессию
    session.accessTokenHash = this.hashToken(newAccessToken);
    session.refreshToken = newRefreshToken;
    session.lastActiveAt = new Date();
    if (ipAddress) session.ipAddress = ipAddress;

    await this.sessionRepository.save(session);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: session.user,
    };
  }
}
