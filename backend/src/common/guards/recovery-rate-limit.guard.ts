import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RedisService } from '../../domains/redis/redis.service';

@Injectable()
export class RecoveryRateLimitGuard implements CanActivate {
  constructor(private redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clientIp = request.ip;
    const endpoint = request.url;

    // Different limits for different endpoints
    const config: Record<string, { windowMs: number; maxRequests: number; message: string }> = {
      '/password-recovery/check-availability': {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 20, // 20 checks
        message: 'Too many password checks, please try again later.',
      },
      '/password-recovery/claim': {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 5, // 5 claim attempts
        message: 'Too many password claims, please try again later.',
      },
    };

    const rateLimitConfig = config[endpoint];
    if (!rateLimitConfig) {
      return true; // No rate limit for other endpoints
    }

    const key = `${clientIp}:${endpoint}`;

    // Get current count
    const client = this.redisService.getClient();
    const current = await client.get(key);

    if (current && parseInt(current) >= rateLimitConfig.maxRequests) {
      throw new ForbiddenException(rateLimitConfig.message);
    }

    // Increment counter
    await client.incr(key);
    await client.expire(key, Math.floor(rateLimitConfig.windowMs / 1000));

    return true;
  }
}
