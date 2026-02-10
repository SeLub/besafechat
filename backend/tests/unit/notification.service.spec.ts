declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../../src/domains/notification/services/notification.service';
import { RedisService } from '../../src/domains/redis/redis.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let mockRedisService: any;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      zadd: jest.fn(),
      zrange: jest.fn(),
      zrevrange: jest.fn(),
      zcard: jest.fn(),
      zrem: jest.fn(),
      expire: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
      sadd: jest.fn(),
      sismember: jest.fn(),
      del: jest.fn(),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  describe('createNotification', () => {
    it('should create notification and increment unread count', async () => {
      const handleId = 'handle-123';
      const type = 'contact_request';
      const data = { fromHandle: { id: 'from-123', value: 'user1', displayName: 'User One' } };

      mockRedisClient.zadd.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(1);
      mockRedisClient.incr.mockResolvedValue(1);

      const result = await service.createNotification(handleId, type, data);

      expect(result).toHaveProperty('id');
      expect(result.type).toBe(type);
      expect(result.read).toBe(false);
      expect(mockRedisClient.zadd).toHaveBeenCalled();
      expect(mockRedisClient.incr).toHaveBeenCalledWith(`unread_count:${handleId}`);
    });
  });

  describe('getUnreadNotifications', () => {
    it('should return unread notifications', async () => {
      const handleId = 'handle-123';
      const mockNotifications = [
        JSON.stringify({ id: '1', type: 'contact_request', read: false }),
        JSON.stringify({ id: '2', type: 'contact_accepted', read: false }),
      ];

      mockRedisClient.zrevrange.mockResolvedValue(mockNotifications);
      mockRedisClient.sismember.mockResolvedValue(0);

      const result = await service.getUnreadNotifications(handleId, 10, 0);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(mockRedisClient.zrevrange).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read and decrement counter', async () => {
      const handleId = 'handle-123';
      const notificationId = 'notif-123';

      mockRedisClient.zrange.mockResolvedValue([
        JSON.stringify({ id: notificationId, read: false }),
      ]);
      mockRedisClient.sadd.mockResolvedValue(1);
      mockRedisClient.decr.mockResolvedValue(0);

      await service.markAsRead(handleId, notificationId);

      expect(mockRedisClient.sadd).toHaveBeenCalledWith(
        `notification_read:${handleId}`,
        notificationId
      );
      expect(mockRedisClient.decr).toHaveBeenCalledWith(`unread_count:${handleId}`);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const handleId = 'handle-123';
      mockRedisClient.get.mockResolvedValue('5');

      const result = await service.getUnreadCount(handleId);

      expect(result).toBe(5);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`unread_count:${handleId}`);
    });

    it('should return 0 when no unread count exists', async () => {
      const handleId = 'handle-123';
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getUnreadCount(handleId);

      expect(result).toBe(0);
    });
  });
});
