import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { HandleService } from '../../src/domains/handle/services/handle.service';
import { SessionService } from '../../src/domains/session/services/session.service';
import { Session } from '../../src/domains/session/session.entity';

describe('SessionService Token Refresh Minimal Tests', () => {
  let service: SessionService;
  let mockSessionRepo: any;

  beforeEach(async () => {
    mockSessionRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: HandleService,
          useValue: {
            getPrimaryHandle: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Session),
          useValue: mockSessionRepo,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('refreshSession', () => {
    it('should refresh valid refresh token', async () => {
      // Create a mock session with a valid refresh token
      const refreshToken = randomBytes(64).toString('hex');
      const mockSession = {
        id: 'session-id',
        refreshToken,
        identity: { id: 'identity-id' },
        activeHandle: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        lastActiveAt: new Date(),
        ipAddress: '127.0.0.1',
      };

      // Mock repository to return the session
      mockSessionRepo.findOne.mockResolvedValue(mockSession);
      mockSessionRepo.save.mockResolvedValue(mockSession);

      // Call refreshSession
      const result = await service.refreshSession(refreshToken, '127.0.0.1');

      // Verify that new tokens were generated
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toHaveLength(64); // 32 bytes hex = 64 chars
      expect(result.refreshToken).toHaveLength(128); // 64 bytes hex = 128 chars

      // Verify that the session was updated
      expect(mockSessionRepo.save).toHaveBeenCalled();
    });

    it('should reject expired refresh token', async () => {
      // Create a mock session with an expired refresh token
      const refreshToken = randomBytes(64).toString('hex');
      const mockSession = {
        id: 'session-id',
        refreshToken,
        identity: { id: 'identity-id' },
        activeHandle: null,
        expiresAt: new Date(Date.now() - 1), // Expired
        lastActiveAt: new Date(),
        ipAddress: '127.0.0.1',
      };

      // Mock repository to return the expired session
      mockSessionRepo.findOne.mockResolvedValue(mockSession);

      // Expect refreshSession to throw an error
      await expect(service.refreshSession(refreshToken, '127.0.0.1')).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });

    it('should reject invalid refresh token', async () => {
      // Mock repository to return null (invalid token)
      mockSessionRepo.findOne.mockResolvedValue(null);

      // Expect refreshSession to throw an error
      await expect(service.refreshSession('invalid-token', '127.0.0.1')).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });
  });
});
