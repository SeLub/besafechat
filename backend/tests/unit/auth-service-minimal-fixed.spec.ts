import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AuthService } from '../../src/domains/auth/services/auth.service';
import { Handle } from '../../src/domains/handle/handle.entity';
import { HandleService } from '../../src/domains/handle/services/handle.service';
import { Identity } from '../../src/domains/identity/identity.entity';
import { IdentityService } from '../../src/domains/identity/services/identity.service';
import { MediaService } from '../../src/domains/media/media.service';
import { Profile } from '../../src/domains/profile/profile.entity';
import { ProfileService } from '../../src/domains/profile/services/profile.service';
import { SessionService } from '../../src/domains/session/services/session.service';
import { Session } from '../../src/domains/session/session.entity';

describe('AuthService Minimal Tests', () => {
  let service: AuthService;
  let identityService: IdentityService;
  let sessionService: SessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        IdentityService,
        SessionService,
        {
          provide: HandleService,
          useValue: {
            getPrimaryHandle: jest
              .fn()
              .mockImplementation(() =>
                Promise.resolve({ id: 'mock-handle-id', value: 'mock-value', type: 'account' })
              ),
            createHandle: jest
              .fn()
              .mockImplementation(() =>
                Promise.resolve({ id: 'mock-handle-id', value: 'mock-value', type: 'account' })
              ),
            findById: jest
              .fn()
              .mockImplementation((id) =>
                Promise.resolve({ id, value: 'mock-value', type: 'account' })
              ),
            saveHandle: jest.fn().mockImplementation((handle) => Promise.resolve(handle)),
          },
        },
        ProfileService,
        {
          provide: MediaService,
          useValue: {
            getAvatarUrlIfExists: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Identity),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Session),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Handle),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Profile),
          useValue: {
            create: jest
              .fn()
              .mockImplementation((dto) => Object.assign({ id: 'mock-profile-id' }, dto)),
            save: jest.fn().mockImplementation((profile) => Promise.resolve(profile)),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
            getRepository: jest.fn(), // Add this to make it more realistic
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    identityService = module.get<IdentityService>(IdentityService);
    sessionService = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('loginWithPublicKey', () => {
    it('should create new identity if not exists', async () => {
      const publicKey = randomBytes(32).toString('base64');

      // Mock identity service to return null for non-existent identity
      jest.spyOn(identityService, 'findByIdentityPublicKey').mockResolvedValue(null);

      // Mock identity service to create a new identity
      const mockIdentity = { id: 'test-id', masterPublicKey: Buffer.from(publicKey, 'base64') };
      jest.spyOn(identityService, 'registerIdentity').mockResolvedValue(mockIdentity as any);

      // Mock session service to create a session
      const mockSession = {
        session: { id: 'session-id' },
        tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      };
      jest.spyOn(sessionService, 'createSession').mockResolvedValue(mockSession as any);

      const result = await service.loginWithPublicKey(
        publicKey,
        'test-device',
        'web',
        '127.0.0.1',
        'test-agent'
      );

      expect(result.identity.id).toBe('test-id');
      expect(result.session.id).toBe('session-id');
    });

    it('should return existing identity if already exists', async () => {
      const publicKey = randomBytes(32).toString('base64');
      const existingIdentity = {
        id: 'existing-id',
        masterPublicKey: Buffer.from(publicKey, 'base64'),
      };

      // Mock identity service to return existing identity
      jest
        .spyOn(identityService, 'findByIdentityPublicKey')
        .mockResolvedValue(existingIdentity as any);

      // Mock session service to create a session
      const mockSession = {
        session: { id: 'session-id' },
        tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      };
      jest.spyOn(sessionService, 'createSession').mockResolvedValue(mockSession as any);

      const result = await service.loginWithPublicKey(
        publicKey,
        'test-device',
        'web',
        '127.0.0.1',
        'test-agent'
      );

      expect(result.identity.id).toBe('existing-id');
      expect(result.session.id).toBe('session-id');
    });
  });
});
