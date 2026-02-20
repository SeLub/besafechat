import { beforeEach, describe, expect, it, jest, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeService } from '../../src/domains/auth/services/challenge.service';
import { RedisService } from '../../src/domains/redis/redis.service';

describe('ChallengeService Minimal Tests', () => {
  let service: ChallengeService;
  let mockRedisService: any;
  let mockRedisClient: any;

  beforeEach(async () => {
    // Create a mock Redis client with all required methods
    mockRedisClient = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    } as any;

    // Setup default mock return values
    mockRedisClient.setex.mockResolvedValue('OK');
    mockRedisClient.del.mockResolvedValue(1);

    // Create a mock RedisService
    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengeService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<ChallengeService>(ChallengeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      // Verify response structure and types
      expect(result).toHaveProperty('challengeId');
      expect(result).toHaveProperty('challenge');
      expect(result).toHaveProperty('expiresAt');
      expect(typeof result.challengeId).toBe('string');
      expect(typeof result.challenge).toBe('string');
      expect(typeof result.expiresAt).toBe('number');

      // Verify challenge format (base64)
      expect(result.challenge).toMatch(/^[A-Za-z0-9+/=]+$/);

      // Verify expiresAt is in the future
      expect(result.expiresAt).toBeGreaterThan(Date.now());

      // Verify Redis setex was called with correct parameters
      expect(mockRedisClient.setex).toHaveBeenCalled();
      const setexCall = mockRedisClient.setex.mock.calls[0];
      expect(setexCall[0]).toBe(`challenge:${result.challengeId}`);
      expect(setexCall[1]).toBe(120); // TTL in seconds
      expect(setexCall[2]).toContain(publicKey);
      expect(setexCall[2]).toContain(result.challenge);
    });

    it('should generate unique challengeIds', async () => {
      const publicKey = 'test-public-key';
      const action: 'login' | 'register' = 'login';
      const ip = '127.0.0.1';

      const result1 = await service.createChallenge(publicKey, action, ip);
      const result2 = await service.createChallenge(publicKey, action, ip);

      expect(result1.challengeId).not.toBe(result2.challengeId);
      expect(result1.challenge).not.toBe(result2.challenge);
    });
  });

  describe('validateChallenge', () => {
    it('should validate correct signature', async () => {
      const publicKey = 'dHdvIHN0cmF3cyBzaHVsbCBuZXZlciBiZSBvbmUgc3RyYXcgbWF0dGVy';
      const action: 'login' | 'register' = 'login';
      const ip = '127.0.0.1';
      const signature = 'fake-signature-for-testing';

      // Create a challenge first
      const challengeResult = await service.createChallenge(publicKey, action, ip);
      const { challengeId, challenge } = challengeResult;

      // Mock challenge data that would be returned from Redis
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

      // Mock the verifySignature method to return true
      const verifySpy = jest.spyOn(service as any, 'verifySignature');
      verifySpy.mockResolvedValue(true);

      // Act
      const isValid = await service.validateChallenge(challengeId, publicKey, signature, ip);

      // Assert
      expect(isValid).toBe(true);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`challenge:${challengeId}`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`challenge:${challengeId}`);
      verifySpy.mockRestore();
    });

    it('should reject invalid signature', async () => {
      const publicKey = 'dHdvIHN0cmF3cyBzaHVsbCBuZXZlciBiZSBvbmUgc3RyYXcgbWF0dGVy';
      const action: 'login' | 'register' = 'login';
      const ip = '127.0.0.1';
      const signature = 'invalid-signature';

      // Create a challenge first
      const challengeResult = await service.createChallenge(publicKey, action, ip);
      const { challengeId, challenge } = challengeResult;

      // Mock challenge data that would be returned from Redis
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

      // Act & Assert
      await expect(
        service.validateChallenge(challengeId, publicKey, signature, ip)
      ).rejects.toThrow('Invalid signature');

      verifySpy.mockRestore();
    });

    it('should reject expired challenge', async () => {
      const publicKey = 'test-public-key';
      const challengeId = 'expired-challenge-id';
      const ip = '127.0.0.1';
      const signature = 'any-signature';

      // Mock challenge data with expiration in the past
      const challengeData = {
        publicKey,
        challenge: 'test-challenge',
        action: 'login' as const,
        createdAt: Date.now() - 200000, // 200 seconds ago
        expiresAt: Date.now() - 80000, // 80 seconds ago (expired)
        attempts: 0,
        ip,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(challengeData));

      // Act & Assert
      await expect(
        service.validateChallenge(challengeId, publicKey, signature, ip)
      ).rejects.toThrow('Challenge has expired');

      expect(mockRedisClient.del).toHaveBeenCalledWith(`challenge:${challengeId}`);
    });

    it('should reject challenge not found', async () => {
      const publicKey = 'test-public-key';
      const challengeId = 'nonexistent-challenge-id';
      const ip = '127.0.0.1';
      const signature = 'any-signature';

      mockRedisClient.get.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.validateChallenge(challengeId, publicKey, signature, ip)
      ).rejects.toThrow('Challenge not found or expired');
    });

    it('should reject if IP mismatch', async () => {
      const publicKey = 'test-public-key';
      const challengeId = 'challenge-id';
      const correctIp = '127.0.0.1';
      const wrongIp = '192.168.1.1';
      const signature = 'any-signature';

      // Mock challenge data with different IP
      const challengeData = {
        publicKey,
        challenge: 'test-challenge',
        action: 'login' as const,
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000,
        attempts: 0,
        ip: correctIp,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(challengeData));

      // Act & Assert
      await expect(
        service.validateChallenge(challengeId, publicKey, signature, wrongIp)
      ).rejects.toThrow('IP mismatch for this challenge');

      // Verify attempts were incremented
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should reject if public key mismatch', async () => {
      const correctPublicKey = 'correct-public-key';
      const wrongPublicKey = 'wrong-public-key';
      const challengeId = 'challenge-id';
      const ip = '127.0.0.1';
      const signature = 'any-signature';

      // Mock challenge data with different public key
      const challengeData = {
        publicKey: correctPublicKey,
        challenge: 'test-challenge',
        action: 'login' as const,
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000,
        attempts: 0,
        ip,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(challengeData));

      // Act & Assert
      await expect(
        service.validateChallenge(challengeId, wrongPublicKey, signature, ip)
      ).rejects.toThrow('Public key mismatch');

      // Verify attempts were incremented
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should increment attempts on failed validation', async () => {
      const publicKey = 'test-public-key';
      const challengeId = 'challenge-id';
      const ip = '127.0.0.1';
      const signature = 'invalid-signature';

      // Mock challenge data with 1 failed attempt already
      const challengeData = {
        publicKey,
        challenge: 'test-challenge',
        action: 'login' as const,
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000,
        attempts: 1,
        ip,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(challengeData));

      // Mock verifySignature to return false
      const verifySpy = jest.spyOn(service as any, 'verifySignature');
      verifySpy.mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.validateChallenge(challengeId, publicKey, signature, ip)
      ).rejects.toThrow('Invalid signature');

      // Verify setex was called to update attempts
      expect(mockRedisClient.setex).toHaveBeenCalled();
      const setexCall = mockRedisClient.setex.mock.calls.find((call: any[]) =>
        call[0].includes(challengeId)
      );
      if (setexCall) {
        const storedData = JSON.parse(setexCall[2]);
        expect(storedData.attempts).toBe(2);
      }

      verifySpy.mockRestore();
    });

    it('should delete challenge after max failed attempts', async () => {
      const publicKey = 'test-public-key';
      const challengeId = 'challenge-id';
      const ip = '127.0.0.1';
      const signature = 'invalid-signature';

      // Mock challenge data with max attempts already reached
      const challengeData = {
        publicKey,
        challenge: 'test-challenge',
        action: 'login' as const,
        createdAt: Date.now(),
        expiresAt: Date.now() + 120000,
        attempts: 5, // MAX_ATTEMPTS = 5
        ip,
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(challengeData));

      // Mock verifySignature to return false
      const verifySpy = jest.spyOn(service as any, 'verifySignature');
      verifySpy.mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.validateChallenge(challengeId, publicKey, signature, ip)
      ).rejects.toThrow('Invalid signature');

      // Verify del was called to remove challenge after max attempts
      expect(mockRedisClient.del).toHaveBeenCalledWith(`challenge:${challengeId}`);

      verifySpy.mockRestore();
    });
  });
});
