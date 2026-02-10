import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { Notification, NotificationData, NotificationType } from '../notification.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationService {
  private readonly TTL_DAYS = 30;

  constructor(private redisService: RedisService) {}

  async createNotification(
    toHandleId: string,
    type: NotificationType,
    data: NotificationData
  ): Promise<Notification> {
    const redis = this.redisService.getClient();
    const notification: Notification = {
      id: uuidv4(),
      type,
      timestamp: new Date().toISOString(),
      read: false,
      data,
    };

    const score = Date.now();
    const key = `notifications:${toHandleId}`;

    await redis.zadd(key, score, JSON.stringify(notification));
    await redis.expire(key, this.TTL_DAYS * 24 * 60 * 60);
    await redis.incr(`unread_count:${toHandleId}`);

    return notification;
  }

  async getUnreadNotifications(
    handleId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    const redis = this.redisService.getClient();
    const key = `notifications:${handleId}`;

    const results = await redis.zrevrange(key, offset, offset + limit - 1);
    const notifications: Notification[] = results.map((item) => JSON.parse(item));

    return notifications.filter((n) => !n.read);
  }

  async markAsRead(handleId: string, notificationId: string): Promise<void> {
    const redis = this.redisService.getClient();
    const key = `notifications:${handleId}`;

    const results = await redis.zrange(key, 0, -1);
    const notifications: Notification[] = results.map((item) => JSON.parse(item));

    const notification = notifications.find((n) => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      await redis.zrem(key, JSON.stringify({ ...notification, read: false }));
      await redis.zadd(key, Date.parse(notification.timestamp), JSON.stringify(notification));
      await redis.decr(`unread_count:${handleId}`);
      await redis.sadd(`notification_read:${handleId}`, notificationId);
    }
  }

  async markAllAsRead(handleId: string): Promise<void> {
    const redis = this.redisService.getClient();
    const key = `notifications:${handleId}`;

    const results = await redis.zrange(key, 0, -1);
    const notifications: Notification[] = results.map((item) => JSON.parse(item));

    for (const notification of notifications) {
      if (!notification.read) {
        notification.read = true;
        await redis.zrem(key, JSON.stringify({ ...notification, read: false }));
        await redis.zadd(key, Date.parse(notification.timestamp), JSON.stringify(notification));
        await redis.sadd(`notification_read:${handleId}`, notification.id);
      }
    }

    await redis.set(`unread_count:${handleId}`, 0);
  }

  async getUnreadCount(handleId: string): Promise<number> {
    const redis = this.redisService.getClient();
    const count = await redis.get(`unread_count:${handleId}`);
    return count ? parseInt(count, 10) : 0;
  }

  async cleanupExpiredNotifications(): Promise<void> {
    // TTL handled automatically by Redis
  }
}
