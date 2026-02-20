import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { randomBytes } from 'crypto';

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid'),
}));

import { AuthService } from '../../src/domains/auth/services/auth.service';
import { HandleService } from '../../src/domains/handle/services/handle.service';
import { IdentityService } from '../../src/domains/identity/services/identity.service';
import { MediaService } from '../../src/domains/media/media.service';
import { SessionService } from '../../src/domains/session/services/session.service';

describe('AuthService Minimal Tests', () => {
  let authService: AuthService;
  let identityService: IdentityService;
  let handleService: HandleService;
  let sessionService: SessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: IdentityService,
          useValue: {
            findByIdentityPublicKey: jest.fn(),
            findByIdentityId: jest.fn(),
            registerIdentity: jest.fn(),
          },
        },
        {
          provide: HandleService,
          useValue: {
            getPrimaryHandle: jest.fn(),
            createHandle: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn(),
          },
        },
        {
          provide: MediaService,
          useValue: {
            getAvatarUrlIfExists: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    identityService = module.get<IdentityService>(IdentityService);
    handleService = module.get<HandleService>(HandleService);
    sessionService = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('loginWithPublicKey', () => {
    it('should create new identity and handle if not exists', async () => {
      const publicKey = randomBytes(32).toString('base64');

      // Setup mocks for new identity flow
      const mockIdentity = {
        id: 'new-identity-id',
        masterPublicKey: Buffer.from(publicKey, 'base64'),
      };

      const mockHandle = {
        id: 'new-handle-id',
        value: 'user_abc123',
        type: 'account',
        profile: {
          displayName: 'Anonym User',
        },
      };

      const mockSession = {
        id: 'session-id',
        activeHandleId: 'new-handle-id',
      };

      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      // Mock identity service
      jest.spyOn(identityService, 'findByIdentityPublicKey').mockResolvedValue(null as any);
      jest.spyOn(identityService, 'registerIdentity').mockResolvedValue(mockIdentity as any);

      // Mock handle service
      jest.spyOn(handleService, 'createHandle').mockResolvedValue(mockHandle as any);
      jest.spyOn(handleService, 'getPrimaryHandle').mockResolvedValue(mockHandle as any);

      // Mock session service
      jest.spyOn(sessionService, 'createSession').mockResolvedValue({
        session: mockSession,
        tokens: mockTokens,
      } as any);

      // Act
      const result = await authService.loginWithPublicKey(
        publicKey,
        'Chrome on macOS',
        'web',
        '192.168.1.1',
        'Mozilla/5.0...'
      );

      // Assert
      expect(result.identity.id).toBe('new-identity-id');
      expect(result.session.id).toBe('session-id');
      expect(result.tokens.accessToken).toBe('new-access-token');
      expect(identityService.registerIdentity).toHaveBeenCalledWith(publicKey);
      expect(handleService.createHandle).toHaveBeenCalled();
    });

    it('should return existing identity and create session if identity exists', async () => {
      const publicKey = randomBytes(32).toString('base64');

      // Setup mocks for existing identity flow
      const existingIdentity = {
        id: 'existing-identity-id',
        masterPublicKey: Buffer.from(publicKey, 'base64'),
      };

      const mockHandle = {
        id: 'existing-handle-id',
        value: 'user_existing',
        type: 'account',
        profile: {
          displayName: 'Existing User',
        },
      };

      const mockSession = {
        id: 'new-session-id',
        activeHandleId: 'existing-handle-id',
      };

      const mockTokens = {
        accessToken: 'access-token-2',
        refreshToken: 'refresh-token-2',
      };

      // Mock identity service
      jest.spyOn(identityService, 'findByIdentityPublicKey').mockResolvedValue(existingIdentity as any);

      // Mock handle service
      jest.spyOn(handleService, 'getPrimaryHandle').mockResolvedValue(mockHandle as any);

      // Mock session service
      jest.spyOn(sessionService, 'createSession').mockResolvedValue({
        session: mockSession,
        tokens: mockTokens,
      } as any);

      // Act
      const result = await authService.loginWithPublicKey(
        publicKey,
        'Firefox on Windows',
        'web',
        '10.0.0.1',
        'Mozilla/5.0...'
      );

      // Assert
      expect(result.identity.id).toBe('existing-identity-id');
      expect(result.session.id).toBe('new-session-id');
      expect(identityService.registerIdentity).not.toHaveBeenCalled();
      expect(handleService.getPrimaryHandle).toHaveBeenCalledWith('existing-identity-id');
    });
  });

  describe('getIdentityProfile', () => {
    it('should return profile with activeHandleId', async () => {
      const identityId = 'identity-123';
      const handleId = 'handle-456';

      const mockIdentity = {
        id: identityId,
        masterPublicKey: Buffer.from('public-key-data'),
        createdAt: new Date(),
      };

      const mockHandle = {
        id: handleId,
        value: '@workprofile',
        ownerIdentityId: identityId,
        type: 'account',
        profile: {
          displayName: 'Work Profile',
          bio: 'My work profile',
        },
      };

      // Mock services
      jest.spyOn(identityService, 'findByIdentityId').mockResolvedValue(mockIdentity as any);
      jest.spyOn(handleService, 'findById').mockResolvedValue(mockHandle as any);
      jest.spyOn(handleService, 'getPrimaryHandle').mockResolvedValue(mockHandle as any);

      // Mock media service
      const mediaService = authService['mediaService'];
      jest.spyOn(mediaService, 'getAvatarUrlIfExists').mockResolvedValue(null);

      // Act
      const result = await authService.getIdentityProfile(identityId, handleId);

      // Assert
      expect(result.handle.id).toBe(handleId);
      expect(result.handle.value).toBe('@workprofile');
      expect(result.profile.displayName).toBe('Work Profile');
      expect(handleService.findById).toHaveBeenCalledWith(handleId);
    });

    it('should fallback to primary handle if activeHandleId invalid', async () => {
      const identityId = 'identity-123';
      const invalidHandleId = 'invalid-handle';

      const mockIdentity = {
        id: identityId,
        masterPublicKey: Buffer.from('public-key-data'),
        createdAt: new Date(),
      };

      const mockPrimaryHandle = {
        id: 'primary-handle-id',
        value: '@primary',
        ownerIdentityId: identityId,
        type: 'account',
        profile: {
          displayName: 'Primary Profile',
        },
      };

      // Mock services
      jest.spyOn(identityService, 'findByIdentityId').mockResolvedValue(mockIdentity as any);
      jest.spyOn(handleService, 'findById').mockResolvedValue(null as any);
      jest.spyOn(handleService, 'getPrimaryHandle').mockResolvedValue(mockPrimaryHandle as any);

      // Mock media service
      const mediaService = authService['mediaService'];
      jest.spyOn(mediaService, 'getAvatarUrlIfExists').mockResolvedValue(null);

      // Act
      const result = await authService.getIdentityProfile(identityId, invalidHandleId);

      // Assert
      expect(result.handle.id).toBe('primary-handle-id');
      expect(result.handle.value).toBe('@primary');
      expect(handleService.getPrimaryHandle).toHaveBeenCalledWith(identityId);
    });
  });

  describe('createSessionWithHandle', () => {
    it('should create new session with specified handle', async () => {
      const identityId = 'identity-123';
      const handleId = 'handle-456';

      const mockHandle = {
        id: handleId,
        value: '@personal',
        ownerIdentityId: identityId,
        type: 'account',
      };

      const mockSession = {
        id: 'new-session-id',
        activeHandleId: handleId,
      };

      const mockTokens = {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      };

      // Mock services
      jest.spyOn(handleService, 'findById').mockResolvedValue(mockHandle as any);
      jest.spyOn(sessionService, 'createSession').mockResolvedValue({
        session: mockSession,
        tokens: mockTokens,
      } as any);

      // Act
      const result = await authService.createSessionWithHandle(
        identityId,
        handleId,
        'Safari on iPhone',
        '203.0.113.1'
      );

      // Assert
      expect(result.session.id).toBe('new-session-id');
      expect(result.tokens.accessToken).toBe('new-access');
      expect(handleService.findById).toHaveBeenCalledWith(handleId);
      expect(sessionService.createSession).toHaveBeenCalledWith(
        identityId,
        'Safari on iPhone',
        undefined,
        '203.0.113.1',
        undefined,
        handleId
      );
    });

    it('should throw error if handle not found', async () => {
      const identityId = 'identity-123';
      const handleId = 'invalid-handle';

      jest.spyOn(handleService, 'findById').mockResolvedValue(null as any);

      await expect(
        authService.createSessionWithHandle(identityId, handleId, 'Device', '192.168.1.1')
      ).rejects.toThrow('Handle not found or does not belong to this identity');
    });

    it('should throw error if handle belongs to different identity', async () => {
      const identityId = 'identity-123';
      const handleId = 'handle-456';

      const mockHandle = {
        id: handleId,
        value: '@other',
        ownerIdentityId: 'different-identity',
        type: 'account',
      };

      jest.spyOn(handleService, 'findById').mockResolvedValue(mockHandle as any);

      await expect(
        authService.createSessionWithHandle(identityId, handleId, 'Device', '192.168.1.1')
      ).rejects.toThrow('Handle not found or does not belong to this identity');
    });
  });
});
