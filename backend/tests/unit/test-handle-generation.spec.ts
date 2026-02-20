import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid'),
}));

import { AuthService } from '../../src/domains/auth/services/auth.service';
import { HandleService } from '../../src/domains/handle/services/handle.service';
import { IdentityService } from '../../src/domains/identity/services/identity.service';
import { MediaService } from '../../src/domains/media/media.service';
import { ProfileService } from '../../src/domains/profile/services/profile.service';
import { SessionService } from '../../src/domains/session/services/session.service';

describe('AuthService Handle Generation Test', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: IdentityService,
          useValue: {
            registerIdentity: jest.fn(),
            findByIdentityPublicKey: jest.fn(),
            // Add other required methods as needed
          },
        },
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn(),
            // Add other required methods as needed
          },
        },
        {
          provide: HandleService,
          useValue: {
            createHandle: jest.fn(),
            // Add other required methods as needed
          },
        },
        {
          provide: ProfileService,
          useValue: {
            createProfile: jest.fn(),
            // Add other required methods as needed
          },
        },
        {
          provide: MediaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should generate handle from public key correctly', () => {
    const publicKey = 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=';
    const generatedHandle = service['generateHandleFromPublicKey'](publicKey);

    console.log('Тест внутреннего метода генерации handle:');
    console.log('Публичный ключ:', publicKey);
    console.log('Сгенерированный handle:', generatedHandle);

    // Проверяем, что handle начинается с "user_"
    expect(generatedHandle).toMatch(/^user_[a-f0-9]{12}$/);
  });

  it('should consistently generate the same handle for the same public key', () => {
    const publicKey = 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=';

    const handle1 = service['generateHandleFromPublicKey'](publicKey);
    const handle2 = service['generateHandleFromPublicKey'](publicKey);

    console.log('\nТест консистентности генерации:');
    console.log('Первый вызов:', handle1);
    console.log('Второй вызов:', handle2);
    console.log('Результаты совпадают:', handle1 === handle2);

    expect(handle1).toEqual(handle2);
  });

  it('should generate different handles for different public keys', () => {
    const publicKey1 = 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=';
    const publicKey2 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

    const handle1 = service['generateHandleFromPublicKey'](publicKey1);
    const handle2 = service['generateHandleFromPublicKey'](publicKey2);

    console.log('\nТест уникальности генерации:');
    console.log('Ключ 1:', publicKey1, '->', handle1);
    console.log('Ключ 2:', publicKey2, '->', handle2);
    console.log('Результаты различаются:', handle1 !== handle2);

    expect(handle1).not.toEqual(handle2);
  });
});
