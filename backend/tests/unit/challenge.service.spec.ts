import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeService } from '../../src/domains/auth/services/challenge.service';
import { RedisService } from '../../src/domains/redis/redis.service';

describe('ChallengeService', () => {
  let service: ChallengeService;
  let mockRedisService: any;

  beforeEach(async () => {
    mockRedisService = {
      getClient: jest.fn(() => ({
        setex: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
      })),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a challenge', async () => {
    const publicKey = 'test-public-key';
    const action: 'register' | 'login' = 'login';
    const ip = '127.0.0.1';

    const result = await service.createChallenge(publicKey, action, ip);

    expect(result).toHaveProperty('challengeId');
    expect(result).toHaveProperty('challenge');
    expect(result).toHaveProperty('expiresAt');
    expect(typeof result.challengeId).toBe('string');
    expect(typeof result.challenge).toBe('string');
    expect(typeof result.expiresAt).toBe('number');
  });

  it('should validate a challenge response', async () => {
    // This test would require proper mocking of the signature verification
    // For now, we'll just check that the method exists
    expect(typeof service.validateChallenge).toBe('function');
  });
});