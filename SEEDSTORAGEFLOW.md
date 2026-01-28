# Seed Storage Flow в BeSafeChat

## Обзор архитектуры

BeSafeChat использует **BIP39 12-word seed phrases** для генерации Ed25519 ключевых пар с двумя режимами хранения:

### 1. **Cloud Recovery** (Облачное восстановление)
- Seed шифруется **Argon2id + AES-GCM** с паролем пользователя
- Хранится в **S3 (Tebi)** по пути, производному от пароля
- Включает **checksum** для валидации пароля

### 2. **Self-Custody** (Самостоятельное хранение)
- Seed показывается пользователю для ручного сохранения
- **Не хранится** в облаке или IndexedDB
- Только временно в памяти во время сессии

## Детальный Flow

### Создание аккаунта (Cloud Recovery)

```typescript
// 1. Генерация seed
const seed = await generateSeedPhrase(); // 12 BIP39 слов

// 2. Деривация ключей
const keyPair = await deriveKeyPairFromSeed(seed);

// 3. Сохранение публичного ключа локально
await StorageService.storePublicKey(publicKeyBase64);

// 4. Регистрация на сервере
await AuthService.login({ publicKey, deviceId, deviceName });

// 5. Шифрование seed для облака
const encrypted = await encryptSeedForCloud(seed, password, userId);

// 6. Загрузка в S3
await CloudBackupService.backupSeed(encrypted, password);
```

### Шифрование для облака

```typescript
// Генерация checksum для валидации пароля
const checksum = await generateSeedChecksum(seedString);
const dataToEncrypt = `${seedString}|${checksum}`;

// Argon2id деривация ключа
const keyMaterial = await deriveKeyArgon2id(password, salt, {
  timeCost: 3,
  memoryCost: 65536, // 64MB
  parallelism: 4,
  hashLength: 32
});

// AES-GCM шифрование
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  aesKey,
  dataBytes
);
```

### Путь хранения в S3

```typescript
// Путь вычисляется из пароля через Argon2id
const storagePath = await computeStoragePath(password);
// Результат: seeds/{hash}/encrypted-seed.enc
```

### Восстановление аккаунта

```typescript
// 1. Загрузка из S3 по пути от пароля
const encryptedSeed = await restoreSeedByPassword(password);

// 2. Дешифрование с валидацией checksum
const seed = await decryptSeedFromCloud(encryptedSeed, password);

// 3. Валидация checksum (критично для проверки пароля)
const isValid = await validateSeedChecksum(seedString, storedChecksum);
if (!isValid) throw new Error('Неверный пароль');

// 4. Деривация ключей и сохранение
const keyPair = await deriveKeyPairFromSeed(seed);
await StorageService.storePublicKey(publicKeyBase64);
```

## Безопасность

### Временное хранение
- Seed **никогда не сохраняется** в IndexedDB
- Только в памяти (`temporarySeed`) во время сессии
- Очищается при logout/перезагрузке

### Валидация пароля
- **Checksum** в зашифрованных данных позволяет определить неверный пароль
- Без правильного пароля невозможно получить валидный checksum

### Криптографические параметры
- **Argon2id**: timeCost=3, memoryCost=64MB, parallelism=4
- **AES-GCM**: 256-bit ключи, 12-byte IV, 16-byte auth tag
- **BIP39**: 128-bit энтропия (12 слов)

## Структура данных

### EncryptedSeedData
```typescript
{
  encrypted: string;    // Base64 ciphertext
  salt: string;        // Base64 Argon2id salt
  iv: string;          // Base64 AES-GCM IV
  authTag: string;     // Base64 auth tag
  version: number;     // Версия формата
  kdfParams: {         // Параметры Argon2id
    algorithm: 'argon2id',
    timeCost: 3,
    memoryCost: 65536,
    parallelism: 4,
    hashLength: 32
  }
}
```

## Компоненты UI

### Создание аккаунта
- `MethodSelection` - выбор Cloud/Self-Custody
- `SeedDisplay` - показ 12 слов (только Self-Custody)
- `SeedVerification` - проверка 3 случайных слов
- `PasswordCreation` - создание пароля (Cloud Recovery)

### Восстановление
- `RecoveryOptions` - выбор метода восстановления
- Ввод пароля или 12-word seed phrase

## Файловая структура

```
frontend/app/
├── components/auth/
│   ├── seed-display.tsx          # Показ seed phrase
│   ├── seed-verification.tsx     # Проверка seed
│   ├── recovery-options.tsx      # Выбор метода восстановления
│   ├── password-creation.tsx     # Создание пароля
│   └── method-selection.tsx      # Cloud vs Self-Custody
├── lib/crypto/
│   └── core/key-derivation.ts    # BIP39, Argon2id, шифрование
├── services/
│   ├── account.service.ts        # Создание/восстановление аккаунтов
│   ├── cloud-backup.service.ts   # S3 операции
│   └── storage.service.ts        # IndexedDB операции
└── routes/auth.tsx               # Основной auth flow
```

## Zero-Knowledge Architecture

Сервер **никогда не видит**:
- Seed phrases
- Приватные ключи  
- Пароли для шифрования

Сервер **видит только**:
- Публичные ключи (для идентификации)
- Зашифрованные метаданные сообщений
- WebSocket соединения

Этот подход обеспечивает полную приватность и контроль пользователя над своими данными.