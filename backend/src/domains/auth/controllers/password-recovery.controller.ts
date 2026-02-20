import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { RecoveryRateLimitGuard } from '../../../common/guards/recovery-rate-limit.guard';
import { CheckPasswordAvailabilityDto, ClaimPasswordDto } from '../dto/password-recovery.dto';
import { PasswordRecoveryService } from '../services/password-recovery.service';

@Controller('password-recovery')
@UseGuards(RecoveryRateLimitGuard) // Rate limiting for security
export class PasswordRecoveryController {
  constructor(private readonly recoveryService: PasswordRecoveryService) {}

  @Post('check-availability')
  @HttpCode(HttpStatus.OK)
  async checkAvailability(@Body() body: CheckPasswordAvailabilityDto) {
    if (!body.password_hash || body.password_hash.length !== 64) {
      // SHA-256 hex
      throw new BadRequestException('Invalid password hash format');
    }

    try {
      const isAvailable = await this.recoveryService.isPasswordHashAvailable(body.password_hash);

      // Add slight delay to prevent timing attacks
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100 + 50));

      return {
        available: isAvailable,
        reason: isAvailable ? null : 'password_already_in_use',
      };
    } catch {
      throw new ServiceUnavailableException('Recovery service temporarily unavailable');
    }
  }

  @Post('claim')
  @HttpCode(HttpStatus.OK)
  async claimPassword(@Body() body: ClaimPasswordDto) {
    if (!body.password_hash || body.password_hash.length !== 64) {
      throw new BadRequestException('Invalid password hash format');
    }

    try {
      const result = await this.recoveryService.claimPasswordHash(body.password_hash);

      if (!result.success) {
        if (result.reason === 'already_claimed') {
          throw new ConflictException({
            message: 'Password already claimed by another user',
            code: 'PASSWORD_CLAIMED',
          });
        } else {
          throw new ServiceUnavailableException('Failed to claim password');
        }
      }

      return {
        success: true,
        message: 'Password claimed successfully',
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Failed to claim password');
    }
  }

  // Endpoint to look up identity by password hash during recovery
  @Post('lookup-identity')
  async lookupIdentity(@Body('password_hash') passwordHash: string) {
    if (!passwordHash || passwordHash.length !== 64) {
      throw new BadRequestException('Invalid password hash format');
    }

    // In the current architecture, we don't store the identity link in the password hash table
    // So we need a different approach for recovery - the identity would need to be looked up
    // through the existing cloud backup mechanisms
    // This is a placeholder that would need to be implemented based on the existing architecture
    throw new Error('Identity lookup by password hash not implemented yet');
  }
}
