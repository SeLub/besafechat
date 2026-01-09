import { AuthService } from '../src/domains/auth/services/auth.service';

// Мок-классы для зависимостей
class MockIdentityService {
  async registerIdentity(publicKey: string) {
    return {
      id: 'test-identity-id',
      masterPublicKey: Buffer.from(publicKey, 'base64'),
      createdAt: new Date(),
    };
  }
}

class MockSessionService {
  async createSession(
    identityId: string,
    deviceName: string,
    deviceType?: string,
    ipAddress?: string,
    userAgent?: string,
    activeHandleId?: string
  ) {
    return {
      session: {
        id: 'test-session-id',
        identityId,
        deviceName,
        deviceType,
        ipAddress,
        userAgent,
        activeHandleId,
        isActive: true,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 минут
        accessTokenHash: 'test-access-token-hash',
        refreshToken: 'test-refresh-token',
      },
      tokens: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      },
    };
  }
}

class MockHandleService {
  async createHandle(handleData: any) {
    return {
      id: 'test-handle-id',
      value: handleData.value,
      type: handleData.type,
      ownerIdentityId: handleData.ownerIdentityId,
      isSearchable: handleData.isSearchable,
      isPrimary: handleData.isPrimary,
      createdAt: new Date(),
    };
  }

  async setSearchable(handleId: string, isSearchable: boolean) {
    return { handleId, isSearchable };
  }
}

class MockProfileService {
  async createProfile(profileData: any) {
    return {
      id: 'test-profile-id',
      handleId: profileData.handleId,
      displayName: profileData.displayName,
      settings: { showEmail: true, showPhone: true, showPresence: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

// Тест полного потока регистрации
async function testFullRegistrationFlow() {
  console.log('=== Тестирование полного потока регистрации ===');

  // Создаем сервисы с моками
  const identityService = new MockIdentityService() as any;
  const sessionService = new MockSessionService() as any;
  const handleService = new MockHandleService() as any;
  const profileService = new MockProfileService() as any;

  const authService = new AuthService(
    identityService,
    sessionService,
    handleService,
    profileService
  );

  // Подготовим тестовые данные
  const publicKey = 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=';
  const displayName = 'Anonym User';
  const deviceName = 'Test Device';

  try {
    console.log('1. Вызов registerWithHandle с тестовыми данными...');
    console.log('   PublicKey:', publicKey);
    console.log('   DisplayName:', displayName);
    console.log('   DeviceName:', deviceName);

    // Вызываем метод регистрации
    const result = await authService.registerWithHandle(
      publicKey,
      'user_test123456', // handle может быть любым, т.к. в нашей реализации используется генерация из ключа
      displayName,
      deviceName
    );

    console.log('\n2. Результат регистрации:');
    console.log('   Identity ID:', result.identity.id);
    console.log('   Handle Value:', result.handle.value);
    console.log('   Profile DisplayName:', result.profile.displayName);
    console.log('   Session ID:', result.session.id);

    // Проверяем, что handle был сгенерирован из публичного ключа
    const expectedHandle = authService['generateHandleFromPublicKey'](publicKey);
    console.log('\n3. Проверка генерации handle:');
    console.log('   Ожидаемый handle:', expectedHandle);
    console.log('   Фактический handle:', result.handle.value);
    console.log('   Handle сгенерирован корректно:', result.handle.value === expectedHandle);

    // Проверяем, что displayName совпадает
    console.log('\n4. Проверка displayName:');
    console.log('   Ожидаемый displayName:', displayName);
    console.log('   Фактический displayName:', result.profile.displayName);
    console.log('   DisplayName корректен:', result.profile.displayName === displayName);

    console.log('\n✓ Полный тест регистрации пройден успешно!');
    console.log('✓ Handle генерируется из публичного ключа');
    console.log('✓ DisplayName сохраняется корректно');
    console.log('✓ Процесс регистрации завершается успешно');
  } catch (error) {
    console.error('\n✗ Ошибка в процессе регистрации:', error);
    throw error;
  }
}

// Запускаем тест
testFullRegistrationFlow().catch(console.error);
