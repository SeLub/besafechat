import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeService } from '../../src/domains/auth/services/challenge.service';
import { RedisService } from '../../src/domains/redis/redis.service';

describe('ChallengeService Minimal Tests', () => {
  let service: ChallengeService;
  let mockRedisClient: any;

  beforeEach(async () => {
    // Create a mock Redis client
    mockRedisClient = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengeService,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile();

    service = module.get<ChallengeService>(ChallengeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createChallenge', () => {
    it('should create a challenge with TTL', async () => {
      const publicKey = 'test-public-key';
      const action: 'login' | 'register' = 'login';
      const ip = '127.0.0.1';

      const result = await service.createChallenge(publicKey, action, ip);

      expect(result).toHaveProperty('challengeId');
      expect(result).toHaveProperty('challenge');
      expect(result).toHaveProperty('expiresAt');
      expect(typeof result.challengeId).toBe('string');
      expect(typeof result.challenge).toBe('string');
      expect(typeof result.expiresAt).toBe('number');

      // Verify Redis was called with TTL
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });
  });

  describe('validateChallenge', () => {
    it('should validate correct signature', async () => {
      // Create a challenge first
      const publicKey = 'dHdvIHN0cmF3cyBzaHVsbCBuZXZlciBiZSBvbmUgc3RyYXcgbWF0dGVy';
      const action: 'login' | 'register' = 'login';
      const ip = '127.0.0.1';

      const challengeResult = await service.createChallenge(publicKey, action, ip);
      const { challengeId, challenge } = challengeResult;

      // Create a mock signature (we'll use a fake one for testing)
      // In a real test, we'd properly sign the challenge
      const signature = 'fake-signature-for-testing';

      // Mock Redis to return the challenge data
      const challengeData = {
        publicKey,
        challenge,
        action,
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000, // 2 minutes from now
        attempts: 0,
        ip,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(challengeData));

      // Mock the verifySignature method to return true for this test
      const verifySpy = jest.spyOn(service as any, 'verifySignature');
      verifySpy.mockResolvedValue(true);

      const isValid = await service.validateChallenge(challengeId, publicKey, signature, ip);

      expect(isValid).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`challenge:${challengeId}`);
    });

    it('should reject invalid signature', async () => {
      // Create a challenge first
      const publicKey = 'dHdvIHN0cmF3cyBzaHVsbCBuZXZlciBiZSBvbmUgc3RyYXcgbWF0dGVy';
      const action: 'login' | 'register' = 'login';
      const ip = '127.0.0.1';

      const challengeResult = await service.createChallenge(publicKey, action, ip);
      const { challengeId, challenge } = challengeResult;

      // Create an invalid signature
      const signature = 'invalid-signature';

      // Mock Redis to return the challenge data
      const challengeData = {
        publicKey,
        challenge,
        action,
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000, // 2 minutes from now
        attempts: 0,
        ip,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(challengeData));

      // Mock the verifySignature method to return false
      const verifySpy = jest.spyOn(service as any, 'verifySignature');
      verifySpy.mockResolvedValue(false);

      await expect(
        service.validateChallenge(challengeId, publicKey, signature, ip)
      ).rejects.toThrow('Invalid signature');
    });
  });
});
