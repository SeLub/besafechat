import { AuthService } from '../src/domains/auth/services/auth.service';
import { HandleService } from '../src/domains/handle/services/handle.service';
import { IdentityService } from '../src/domains/identity/services/identity.service';
import { ProfileService } from '../src/domains/profile/services/profile.service';
import { SessionService } from '../src/domains/session/services/session.service';

// Простой тест для проверки логики генерации handle
async function testHandleGeneration() {
  console.log('=== Тестирование генерации handle из публичного ключа ===');

  // Создаем экземпляр AuthService с поддельными зависимостями
  const mockIdentityService = {} as IdentityService;
  const mockSessionService = {} as SessionService;
  const mockHandleService = {} as HandleService;
  const mockProfileService = {} as ProfileService;

  const authService = new AuthService(
    mockIdentityService,
    mockSessionService,
    mockHandleService,
    mockProfileService
  );

  // Тестируем генерацию handle
  const testPublicKey = 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=';
  const generatedHandle = authService['generateHandleFromPublicKey'](testPublicKey);

  console.log('Публичный ключ:', testPublicKey);
  console.log('Сгенерированный handle:', generatedHandle);

  // Проверяем формат handle
  const isValidFormat = /^user_[a-f0-9]{12}$/.test(generatedHandle);
  console.log('Формат handle корректен:', isValidFormat);

  // Проверяем консистентность
  const generatedHandle2 = authService['generateHandleFromPublicKey'](testPublicKey);
  const isConsistent = generatedHandle === generatedHandle2;
  console.log('Генерация консистентна:', isConsistent);

  // Проверяем уникальность для разных ключей
  const publicKey2 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const handle2 = authService['generateHandleFromPublicKey'](publicKey2);
  const isUnique = generatedHandle !== handle2;
  console.log('Handle для разных ключей различаются:', isUnique);
  console.log('Handle 2:', handle2);

  console.log('\n=== Результаты тестирования ===');
  console.log('Формат корректен:', isValidFormat ? '✓' : '✗');
  console.log('Консистентность:', isConsistent ? '✓' : '✗');
  console.log('Уникальность:', isUnique ? '✓' : '✗');

  if (isValidFormat && isConsistent && isUnique) {
    console.log('\n✓ Все тесты пройдены успешно!');
  } else {
    console.log('\n✗ Один или несколько тестов не пройдены');
  }
}

// Запускаем тест
testHandleGeneration().catch(console.error);
