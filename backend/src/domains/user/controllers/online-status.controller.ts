import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtSessionGuard } from '../guards/jwt-session.guard';
import { RedisService } from '../../../common/redis.service';

@Controller('users')
@UseGuards(JwtSessionGuard)
export class OnlineStatusController {
  constructor(private redisService: RedisService) {}

  @Get('online-status/:userId')
  async getUserOnlineStatus(@Param('userId') userId: string) {
    const redis = this.redisService.getClient();
    const isOnline = await redis.exists(`online:${userId}`);
    return { userId, isOnline: !!isOnline };
  }

  @Post('bulk-online-status')
  async getBulkOnlineStatus(@Body() body: { userIds: string[] }) {
    const redis = this.redisService.getClient();
    const keys = body.userIds.map((id) => `online:${id}`);

    if (keys.length === 0) {
      return { statuses: {} };
    }

    const results = await redis.mget(...keys);
    const statuses: Record<string, boolean> = {};

    body.userIds.forEach((userId, index) => {
      statuses[userId] = !!results[index];
    });

    return { statuses };
  }
}
