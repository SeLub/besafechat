import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaimedRecoveryPassword } from '../entities/claimed-recovery-password.entity';

export interface ClaimResult {
  success: boolean;
  reason?: 'already_claimed' | 'database_error';
  ttl?: number | null;
}

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    @InjectRepository(ClaimedRecoveryPassword)
    private readonly claimedPasswordsRepository: Repository<ClaimedRecoveryPassword>
  ) {}

  async isPasswordHashAvailable(passwordHash: string): Promise<boolean> {
    const record = await this.claimedPasswordsRepository.findOne({
      where: { password_hash: passwordHash },
      select: ['password_hash'],
    });

    return !record;
  }

  async claimPasswordHash(passwordHash: string): Promise<ClaimResult> {
    try {
      await this.claimedPasswordsRepository
        .createQueryBuilder()
        .insert()
        .into(ClaimedRecoveryPassword)
        .values({
          password_hash: passwordHash,
          claimed_at: new Date(),
        })
        .execute();

      this.logger.log({
        event: 'password_hash_claimed',
        hashPrefix: passwordHash.substring(0, 8),
        timestamp: new Date().toISOString(),
      });

      return { success: true, ttl: null };
    } catch (error: any) {
      // Check if it's a unique constraint violation (password already claimed)
      if (error.code === '23505') {
        // PostgreSQL unique violation
        this.logger.log({
          event: 'password_hash_already_claimed',
          hashPrefix: passwordHash.substring(0, 8),
          timestamp: new Date().toISOString(),
        });
        return { success: false, reason: 'already_claimed' };
      }

      // Other database error
      this.logger.error('Database error during password claim:', error);
      return { success: false, reason: 'database_error' };
    }
  }
}
