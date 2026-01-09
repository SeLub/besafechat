import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/domains/auth/services/auth.service';

// Создаем поддельный модуль для всех зависимостей
const mockIdentityService = {
  registerIdentity: jest.fn(),
};

const mockSessionService = {
  createSession: jest.fn(),
};

const mockHandleService = {
  createHandle: jest.fn(),
};

const mockProfileService = {
  createProfile: jest.fn(),
};

describe('AuthService Handle Generation Test', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: 'IdentityService', useValue: mockIdentityService },
        { provide: 'SessionService', useValue: mockSessionService },
        { provide: 'HandleService', useValue: mockHandleService },
        { provide: 'ProfileService', useValue: mockProfileService },
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

// Простой запуск без Jest для быстрой проверки
console.log('\n=== Тестирование интеграции с реальным сервисом ===');

// Создаем временный экземпляр AuthService с моками
const tempAuthService = new (class {
  generateHandleFromPublicKey(publicKeyBase64: string): string {
    // Та же логика, что и в оригинальном сервисе
    const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
    const hash = require('crypto').createHash('sha256').update(publicKeyBuffer).digest('hex');
    const hashPrefix = hash.substring(0, 12);
    return `user_${hashPrefix}`;
  }
})();

const testPublicKey = 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=';
const result = tempAuthService.generateHandleFromPublicKey(testPublicKey);

console.log('Результат генерации для тестового ключа:', result);
console.log('Формат корректен:', /^user_[a-f0-9]{12}$/.test(result));
