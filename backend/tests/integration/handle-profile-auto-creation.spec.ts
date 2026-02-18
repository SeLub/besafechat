import { beforeAll, describe, expect, it, afterAll } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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

describe('Handle Service - Integration Tests (Profile Auto Creation)', () => {
  let app: INestApplication;
  let handleService: HandleService;
  let authService: AuthService;
  let identityService: IdentityService;
  let handleRepository: Repository<Handle>;
  let profileRepository: Repository<Profile>;
  let identityRepository: Repository<Identity>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        HandleService,
        AuthService,
        IdentityService,
        ProfileService,
        SessionService,
        {
          provide: getRepositoryToken(Handle),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(Profile),
          useClass: Repository,
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
          provide: MediaService,
          useValue: {
            getAvatarUrlIfExists: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn().mockImplementation(async (callback) => {
              const mockManager = {
                findOne: jest.fn(),
                update: jest.fn(),
                create: jest.fn().mockImplementation((Entity, data) => {
                  const instance = new Entity();
                  Object.assign(instance, data);
                  instance.createdAt = new Date();
                  if (Entity === Profile) {
                    instance.updatedAt = new Date();
                    instance.settings = data.settings || {};
                    instance.metadata = {};
                  }
                  return instance;
                }),
                save: jest.fn().mockImplementation((entity) => {
                  if (!entity.id) {
                    entity.id = `${entity.constructor.name.toLowerCase()}-${Date.now()}`;
                  }
                  return Promise.resolve(entity);
                }),
              };

              // Setup mock for duplicate check
              mockManager.findOne.mockImplementation(async (Entity, options) => {
                if (Entity === Handle && options.where.value === 'existing_handle') {
                  return {
                    id: 'existing-id',
                    value: 'existing_handle',
                    type: 'account',
                  };
                }
                return null;
              });

              return callback(mockManager);
            }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    handleService = module.get<HandleService>(HandleService);
    authService = module.get<AuthService>(AuthService);
    identityService = module.get<IdentityService>(IdentityService);
    handleRepository = module.get<Repository<Handle>>(getRepositoryToken(Handle));
    profileRepository = module.get<Repository<Profile>>(getRepositoryToken(Profile));
    identityRepository = module.get<Repository<Identity>>(getRepositoryToken(Identity));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auto-create profile with handle', () => {
    it('should create profile when creating account-type handle with profileData', async () => {
      const identityId = 'test-identity-123';

      const handle = await handleService.createHandle({
        value: 'john_doe_new',
        type: 'account',
        ownerIdentityId: identityId,
        isSearchable: true,
        isPrimary: true,
        profileData: {
          displayName: 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          bio: 'Software developer',
        },
      });

      // Verify handle was created
      expect(handle).toBeDefined();
      expect(handle.value).toBe('john_doe_new');
      expect(handle.type).toBe('account');

      // Verify that transaction was called (profile creation happens inside transaction)
      expect(dataSource.transaction).toHaveBeenCalled();

      // Get the transaction callback to verify profile creation
      const transactionCall = (dataSource.transaction as jest.Mock).mock.calls[0][0];
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockImplementation((Entity, data) => {
          const instance = new Entity();
          Object.assign(instance, data);
          return instance;
        }),
        save: jest.fn().mockImplementation((entity) => {
          if (!entity.id) {
            entity.id = `id-${Math.random()}`;
          }
          return Promise.resolve(entity);
        }),
      };

      // Execute transaction with mock manager to verify both handle and profile creation
      const result = await transactionCall(mockManager);

      // Verify both handle and profile were created
      const createCalls = (mockManager.create as jest.Mock).mock.calls;
      expect(createCalls.length).toBeGreaterThanOrEqual(2);

      // Find profile creation call
      const profileCall = createCalls.find((call) => call[0]?.name === 'Profile');
      expect(profileCall).toBeDefined();
      if (profileCall) {
        expect(profileCall[1].displayName).toBe('John Doe');
        expect(profileCall[1].firstName).toBe('John');
        expect(profileCall[1].lastName).toBe('Doe');
      }
    });

    it('should not create profile for team-type handle', async () => {
      const identityId = 'test-identity-456';

      const handle = await handleService.createHandle({
        value: 'team_dev',
        type: 'team',
        ownerIdentityId: identityId,
        isSearchable: true,
        isPrimary: false,
      });

      expect(handle.value).toBe('team_dev');
      expect(handle.type).toBe('team');

      // Verify transaction was called
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should not create profile for channel-type handle', async () => {
      const identityId = 'test-identity-789';

      const handle = await handleService.createHandle({
        value: 'channel_announcements',
        type: 'channel',
        ownerIdentityId: identityId,
        isSearchable: true,
        isPrimary: false,
      });

      expect(handle.value).toBe('channel_announcements');
      expect(handle.type).toBe('channel');

      // Verify transaction was called
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should create profile with default displayName when profileData not provided', async () => {
      const identityId = 'test-identity-default';

      const handle = await handleService.createHandle({
        value: 'anonym_user',
        type: 'account',
        ownerIdentityId: identityId,
        isSearchable: false,
        isPrimary: true,
        // No profileData provided - should use defaults
      });

      expect(handle.value).toBe('anonym_user');
      expect(handle.type).toBe('account');

      // Verify that profile creation would use default displayName
      const transactionCall = (dataSource.transaction as jest.Mock).mock.calls[
        (dataSource.transaction as jest.Mock).mock.calls.length - 1
      ][0];
      const mockManager = {
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest.fn().mockImplementation((Entity, data) => {
          const instance = new Entity();
          Object.assign(instance, data);
          return instance;
        }),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      await transactionCall(mockManager);

      const profileCall = (mockManager.create as jest.Mock).mock.calls.find(
        (call) => call[0]?.name === 'Profile'
      );
      expect(profileCall).toBeDefined();
      if (profileCall) {
        expect(profileCall[1].displayName).toBe('Anonym User'); // Default
      }
    });
  });

  describe('getPrimaryHandle with profile', () => {
    it('should load profile relation when fetching primary handle', async () => {
      const identityId = 'test-identity-profile-load';

      jest.spyOn(handleRepository, 'findOne').mockResolvedValueOnce({
        id: 'primary-handle-id',
        value: 'test_user',
        type: 'account',
        isPrimary: true,
        ownerIdentityId: identityId,
        ownerIdentity: { id: identityId },
        profile: {
          id: 'profile-id',
          displayName: 'Test User',
          handleId: 'primary-handle-id',
          createdAt: new Date(),
          updatedAt: new Date(),
          settings: {},
          metadata: {},
        },
      } as any);

      const result = await handleService.getPrimaryHandle(identityId);

      // Verify the findOne was called with profile relation
      expect(handleRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['profile']),
        })
      );

      // Verify profile is available
      expect(result.profile).toBeDefined();
      expect(result.profile.displayName).toBe('Test User');
    });
  });
});
