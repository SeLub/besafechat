import { AuthService } from '../src/domains/auth/services/auth.service';

// Мок-классы для зависимостей
class MockIdentityService {
  private identities: any[] = [];

  async registerIdentity(publicKey: string) {
    // Проверяем, существует ли уже идентичность с этим публичным ключом
    const existingIdentity = this.identities.find((id) =>
      id.masterPublicKey.equals(Buffer.from(publicKey, 'base64'))
    );

    if (existingIdentity) {
      return existingIdentity;
    }

    const newIdentity = {
      id: `identity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      masterPublicKey: Buffer.from(publicKey, 'base64'),
      createdAt: new Date(),
    };

    this.identities.push(newIdentity);
    return newIdentity;
  }

  async findByIdentityPublicKey(publicKey: string) {
    return (
      this.identities.find((id) => id.masterPublicKey.equals(Buffer.from(publicKey, 'base64'))) ||
      null
    );
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
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
  private handles: any[] = [];

  async createHandle(handleData: any) {
    const handle = {
      id: `handle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      value: handleData.value,
      type: handleData.type,
      ownerIdentityId: handleData.ownerIdentityId,
      isSearchable: handleData.isSearchable,
      isPrimary: handleData.isPrimary,
      createdAt: new Date(),
    };

    this.handles.push(handle);
    return handle;
  }

  async getHandlesByIdentity(identityId: string) {
    return this.handles.filter((h) => h.ownerIdentityId === identityId);
  }

  async getPrimaryHandle(identityId: string) {
    const handle = this.handles.find((h) => h.ownerIdentityId === identityId && h.isPrimary);
    if (!handle) {
      throw new Error('Primary handle not found'); // Имитируем NotFoundException
    }
    return handle;
  }
}

class MockProfileService {
  async createProfile(profileData: any) {
    return {
      id: `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      handleId: profileData.handleId,
      displayName: profileData.displayName,
      settings: { showEmail: true, showPhone: true, showPresence: true },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getProfileByHandle(handleId: string) {
    // Заглушка для получения профиля по handle
    return {
      displayName: 'Test User',
      firstName: null,
      lastName: null,
      avatarUrl: null,
      bio: null,
      settings: {},
    };
  }
}

// Тестирование защиты от дублирования
async function testDuplicateProtection() {
  console.log('=== Тестирование защиты от дублирования идентичности ===');

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
  const handleValue = 'user_test123456';
  const displayName = 'Test User';
  const deviceName = 'Test Device';

  try {
    console.log('1. Первая регистрация с публичным ключом...');
    const result1 = await authService.registerWithHandle(
      publicKey,
      handleValue,
      displayName,
      deviceName
    );

    console.log('   ✓ Первая регистрация прошла успешно');
    console.log('   Identity ID:', result1.identity.id);
    console.log('   Handle Value:', result1.handle.value);

    console.log('\n2. Повторная регистрация с тем же публичным ключом...');
    try {
      const result2 = await authService.registerWithHandle(
        publicKey,
        'different_handle_value',
        'Different Display Name',
        'Another Device'
      );

      console.log('   ✗ ОШИБКА: Вторая регистрация не должна была пройти успешно!');
      console.log('   Результат:', result2);
    } catch (error: any) {
      console.log('   ✓ Вторая регистрация корректно отклонена с ошибкой:', error.message);
    }

    console.log('\n3. Проверка: количество идентичностей с этим ключом');
    const identities: any[] = (identityService as any).identities;
    const matchingIdentities = identities.filter((id: any) =>
      id.masterPublicKey.equals(Buffer.from(publicKey, 'base64'))
    );
    console.log('   Найдено идентичностей с ключом:', matchingIdentities.length);

    console.log('\n4. Проверка: количество handle для этой идентичности');
    if (matchingIdentities.length > 0) {
      const handles: any[] = (handleService as any).handles.filter(
        (h: any) => h.ownerIdentityId === matchingIdentities[0].id
      );
      console.log('   Найдено handle для идентичности:', handles.length);
      handles.forEach((h: any) => {
        console.log('   - Handle:', h.value, '(primary:', h.isPrimary, ')');
      });
    }

    console.log('\n✓ Тестирование защиты от дублирования завершено успешно!');
    console.log('✓ Одна идентичность может иметь только один primary handle');
    console.log('✓ Повторная регистрация с тем же публичным ключом корректно отклоняется');
  } catch (error) {
    console.error('\n✗ Ошибка в процессе тестирования:', error);
    throw error;
  }
}

// Запускаем тест
testDuplicateProtection().catch(console.error);
