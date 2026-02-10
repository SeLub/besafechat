/**
 * @jest-environment node
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { RedisService } from '../../src/domains/redis/redis.service';
import { NotificationService } from '../../src/domains/notification/services/notification.service';

describe('Notification Integration Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let notificationService: NotificationService;
  const testHandleId = 'test-handle-123';

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    notificationService = moduleRef.get(NotificationService);

    const redisService = moduleRef.get(RedisService);
    const client = redisService.getClient();
    await client.flushdb();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('NotificationService', () => {
    it('should create and retrieve notification', async () => {
      const notification = await notificationService.createNotification(
        testHandleId,
        'contact_request',
        { fromHandle: { id: 'from-123', value: 'user1', displayName: 'User One' } }
      );

      expect(notification).toHaveProperty('id');
      expect(notification.type).toBe('contact_request');

      const notifications = await notificationService.getUnreadNotifications(testHandleId, 10, 0);
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should track unread count', async () => {
      await notificationService.createNotification(
        testHandleId,
        'contact_accepted',
        { fromHandle: { id: 'from-456', value: 'user2', displayName: 'User Two' } }
      );

      const count = await notificationService.getUnreadCount(testHandleId);
      expect(count).toBeGreaterThan(0);
    });

    it('should mark notification as read', async () => {
      const notification = await notificationService.createNotification(
        testHandleId,
        'new_chat',
        { fromHandle: { id: 'from-789', value: 'user3', displayName: 'User Three' } }
      );

      const countBefore = await notificationService.getUnreadCount(testHandleId);
      
      await notificationService.markAsRead(testHandleId, notification.id);
      
      const countAfter = await notificationService.getUnreadCount(testHandleId);
      expect(countAfter).toBeLessThan(countBefore);
    });

    it('should mark all notifications as read', async () => {
      await notificationService.createNotification(
        testHandleId,
        'team_invite',
        { fromHandle: { id: 'from-111', value: 'user4', displayName: 'User Four' } }
      );

      await notificationService.markAllAsRead(testHandleId);
      
      const count = await notificationService.getUnreadCount(testHandleId);
      expect(count).toBe(0);
    });
  });
});
