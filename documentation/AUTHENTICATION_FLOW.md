# Актуализированный флоу аутентификации BeSafe Chat

## Общее описание

Процесс аутентификации в BeSafe Chat состоит из 6 фаз:

1. **Инициализация приложения** — проверка существующей сессии
2. **Маршрутизация** — определение доступа на защищённые маршруты
3. **Создание аккаунта (Cloud)** — с облачным бэкапом
4. **Создание аккаунта (Self-Custody)** — без облачного бэкапа
5. **Восстановление по паролю** — восстановление seed из облака
6. **Восстановление по seed** — восстановление из текстовой фразы

---

## Фаза 1: Инициализация приложения

### Процесс

1. Пользователь открывает веб-приложение на **любом маршруте** (может быть `/`, `/auth`, `/settings` и т.д.)
2. **root.tsx** загружается с оборачивающим `<AuthProvider>`
3. `AuthProvider` запускает `useEffect` с вызовом `checkAuth()`
4. `authenticateUser()` выполняет следующие попытки:
   - Вызывает `silentAuthCheck()`: `GET /auth/profile` с `credentials: 'include'`
   - **Если 200 OK**: извлекает профиль пользователя
   - **Если 401 Unauthorized**: вызывает `attemptTokenRefresh()`: `POST /auth/refresh` с `credentials: 'include'`
   - **Если refresh успешен**: повторяет `silentAuthCheck()`
5. **Если пользователь аутентифицирован**:
   - Устанавливает `user` в контекст AuthProvider
   - `StorageService.initialize(user.identity.id)` инициализирует IndexedDB с ID пользователя (создаёт отдельную БД для каждого юзера)
   - `loading = false`, `user != null`
6. **Если пользователь не аутентифицирован**:
   - `user = null`
   - `loading = false`

### Компоненты

- **root.tsx**: `AuthProvider` (глобальный контекст аутентификации)
- **use-auth.tsx**: `AuthProvider` компонент с методом `checkAuth()`
- **auth-utils.ts**: `authenticateUser()`, `silentAuthCheck()`, `attemptTokenRefresh()`
- **storage.service.ts**: `StorageService.initialize()`

---

## Фаза 2: Маршрутизация

### Процесс

После инициализации AuthProvider, компоненты проверяют статус аутентификации через `AuthGuard`:

1. **Защищённый маршрут** (например, `/`):
   - `AuthGuard` оборачивает содержимое маршрута
   - **Если `loading = true`**: показывает "Loading... Checking authentication"
   - **Если `user != null`**: показывает защищённый контент
   - **Если `user = null` и `loading = false`**: `window.location.href = '/auth'` (редирект на страницу аутентификации)

2. **Маршрут `/auth**:
   - Доступен всегда, без AuthGuard
   - Инициализирует `useAuthFlow` для управления процессом создания/восстановления аккаунта

### Компоненты

- **auth-guard.tsx**: `AuthGuard` компонент с проверкой прав доступа

---

## Фаза 3: Создание аккаунта (Cloud — с облачным бэкапом)

### Пользовательский интерфейс

1. **Экран выбора метода**: пользователь выбирает "Create Identity" → выбирает "Cloud" или "Self-Custody"
2. **Отображение seed**: система показывает 12 слов, пользователь записывает их
3. **Верификация seed**: пользователь повторяет слова из seed для подтверждения
4. **Создание пароля**: пользователь вводит пароль для облачного бэкапа (только для Cloud)
5. **Завершение**: экран "You are live! Redirecting..." → редирект на `/`

### Техническая реализация

#### Step 1: Инициализация

- `useAuthFlow.handleMethodSelect('cloud')`:
  - Генерирует seed фразу через `generateSeedPhrase()`
  - Переводит пользователя на экран отображения seed

#### Step 2: Верификация seed

- `useAuthFlow.handleSeedVerified()`:
  - Проверяет, что пользователь правильно ввел слова
  - Для Cloud → переводит на экран создания пароля
  - Для Self-Custody → сразу завершает процесс

#### Step 3: Создание пароля

- `useAuthFlow.handlePasswordCreated(password)`:
  - Вызывает `AccountService.createAccountWithCloud(password)`

#### Step 4: `AccountService.createAccountWithCloud(password)`

1. ✅ **Валидация пароля**:
   - Проверка силы пароля (мин. 8 символов)
   - Проверка уникальности через `PasswordRecoveryService.checkPasswordAvailability()`

2. ✅ **Генерация ключевой пары**:
   - `generateSeedPhrase()`: генерирует 12 слов
   - `deriveKeyPairFromSeed(seed)`: дериватирует Ed25519 публичный и приватный ключи из seed
   - `publicKeyBase64 = btoa(publicKey)`

3. ✅ **Получение информации об устройстве**:
   - `AccountService.getDeviceInfo()`: `deviceId`, `deviceName`

4. ✅ **Аутентификация на сервере** (создание identity):
   - `AuthService.login({ publicKey, privateKey, deviceId, deviceName })`
   - Сервер возвращает `{ identityId, ... }`
   - Приватный ключ используется **один раз** для подписи challenge-ответа
   - **Важно**: приватный ключ передаётся в метод `login()`, но не хранится на сервере

5. ✅ **Инициализация IndexedDB**:
   - `StorageService.initialize(result.identityId)`
   - Создаёт отдельную БД для этого пользователя

6. ✅ **Сохранение публичного ключа**:
   - `StorageService.storePublicKey(publicKeyBase64)`
   - Сохраняет в таблице `publicKey` с id='current'
   - Требует инициализированной IndexedDB

7. ✅ **Обработка приватного ключа**:
   - `pkcs8ToRawPrivateKey(keyPair.privateKey)`: преобразует в сырой формат
   - `hashPrivateKey(rawPrivateKey)`: создаёт хеш приватного ключа
   - `secureClearUint8Array(rawPrivateKey)`: безопасное уничтожение сырого ключа (перезапись случайными данными)
   - `secureClearUint8Array(keyPair.privateKey)`: безопасное уничтожение исходного ключа
   - `AccountService.setSessionPrivateKeyHash(privateKeyHash)`: сохраняет **только** хеш в памяти
   - **Критично**: полный приватный ключ никогда не хранится, используется только для одной операции подписи

8. ✅ **Облачный бэкап** (2 сек. ожидание):
   - Пауза для обработки профиля на бэкенде
   - `encryptSeedForCloud(seed, password, identityId)`: шифрует seed паролем
   - `PasswordRecoveryService.claimPasswordWithRetry(password)`: регистрирует пароль на сервере
   - `CloudBackupService.backupSeed(encrypted, password)`: загружает зашифрованный seed в облако
   - `downloadBackupFile(encrypted, publicKey)`: скачивает локальный backup файл

9. ✅ **Завершение**:
   - `setStep('complete')`: переводит на экран завершения
   - `window.location.href = '/'`: редирект на главную страницу через 1 сек.

### Компоненты

- **use-auth-flow.ts**: `useAuthFlow()` hook
- **account.service.ts**: `AccountService.createAccountWithCloud()`
- **auth.service.ts**: `AuthService.login()`
- **storage.service.ts**: `StorageService.initialize()`, `StorageService.storePublicKey()`
- **password-recovery.service.ts**: `PasswordRecoveryService.checkPasswordAvailability()`, `.claimPasswordWithRetry()`
- **cloud-backup.service.ts**: `CloudBackupService.backupSeed()`

---

## Фаза 4: Создание аккаунта (Self-Custody — без облачного бэкапа)

### Пользовательский интерфейс

1. **Экран выбора метода**: выбирает "Self-Custody"
2. **Отображение seed**: показывает 12 слов
3. **Верификация seed**: пользователь повторяет слова
4. **Завершение**: редирект на `/` (пароль не требуется)

### Техническая реализация

`AccountService.createAccountWithSelfCustody()`:

1. ✅ **Генерация ключевой пары**: идентично Cloud (шаги 1-3)
2. ✅ **Аутентификация**: идентично Cloud (шаг 4)
3. ✅ **Инициализация IndexedDB**: идентично Cloud (шаг 5)
4. ✅ **Сохранение публичного ключа**: идентично Cloud (шаг 6)
5. ✅ **Обработка приватного ключа**: идентично Cloud (шаг 7)
6. ⏭️ **Облачный бэкап**: ПРОПУСКАЕТСЯ (нет пароля, нет облака)
7. ✅ **Завершение**: ожидание 2 сек., редирект на `/`

### Компоненты

- **account.service.ts**: `AccountService.createAccountWithSelfCustody()`

---

## Фаза 5: Восстановление по паролю

### Пользовательский интерфейс

1. **Экран выбора способа**: пользователь выбирает "Restore Access" → выбирает "Password"
2. **Ввод пароля**: пользователь вводит пароль от облачного бэкапа
3. **Успех/Ошибка**: если пароль верный и ключи совпадают → редирект на `/`, иначе ошибка

### Техническая реализация

`useAuthFlow.handlePasswordRecovery(password)`:

1. ✅ **Восстановление seed**:
   - `PasswordRecoveryService.restoreSeedByPassword(password)`
   - Загружает зашифрованный seed с облака
   - Расшифровывает с помощью пароля
   - Возвращает seed или ошибку

2. ✅ **Дериватизация ключевой пары**:
   - `deriveKeyPairFromSeed(seed)`: создаёт keypair из восстановленного seed

3. ✅ **Аутентификация**:
   - `AuthService.login({ publicKey, privateKey, deviceId, deviceName })`
   - Получает identityId

4. ✅ **Инициализация IndexedDB**:
   - `StorageService.initialize(identityId)`

5. 🔍 **Верификация публичного ключа**:
   - `StorageService.getPublicKey()`: получает сохранённый ключ из IndexedDB
   - **Сравнение**: `if (storedKey !== publicKeyBase64)`
   - **Если не совпадает**: `throw new Error('Seed verification failed: Public key mismatch')`
   - **Если совпадает**: или ключ не был сохранён (новое восстановление), то `StorageService.storePublicKey(publicKeyBase64)`

6. ✅ **Обработка приватного ключа**: идентично созданию (шаг 7)

7. ✅ **Завершение**:
   - `window.location.href = '/'`

### Компоненты

- **use-auth-flow.ts**: `useAuthFlow.handlePasswordRecovery()`
- **password-recovery.service.ts**: `PasswordRecoveryService.restoreSeedByPassword()`
- **account.service.ts**: `AccountService.recoverWithPassword()`
- **storage.service.ts**: `StorageService.getPublicKey()`, `StorageService.storePublicKey()`

---

## Фаза 6: Восстановление по seed

### Пользовательский интерфейс

1. **Экран выбора способа**: выбирает "Restore Access" → выбирает "Seed"
2. **Ввод seed**: пользователь вводит 12 слов
3. **Успех/Ошибка**: если seed верный и ключи совпадают → редирект на `/`, иначе ошибка

### Техническая реализация

`useAuthFlow.handleSeedRecovery(recoveredSeed)`:

1. ✅ **Валидация seed**:
   - `validateSeedPhrase(seed)`
   - Проверяет корректность слов и контрольной суммы

2. ✅ **Дериватизация ключевой пары**:
   - `deriveKeyPairFromSeed(seed)`

3. ✅ **Аутентификация**: идентично Фазе 5 (шаг 3)

4. ✅ **Инициализация IndexedDB**: идентично Фазе 5 (шаг 4)

5. 🔍 **Верификация публичного ключа**: идентично Фазе 5 (шаг 5)

6. ✅ **Обработка приватного ключа**: идентично Фазе 5 (шаг 6)

7. ✅ **Завершение**: идентично Фазе 5 (шаг 7)

### Компоненты

- **use-auth-flow.ts**: `useAuthFlow.handleSeedRecovery()`
- **account.service.ts**: `AccountService.recoverWithSeed()`

---

## Ключевые особенности

### Управление приватным ключом

| Этап              | Действие                    | Хранилище                      |
| ----------------- | --------------------------- | ------------------------------ |
| Генерация         | Создаётся в памяти          | Память                         |
| Подпись challenge | Используется один раз       | Память                         |
| Хеширование       | Преобразуется в хеш         | Память                         |
| Уничтожение       | Перезапись + удаление       | ❌ Нигде                       |
| Сессия            | Хеш доступен для шифрования | Память (sessionPrivateKeyHash) |
| Logout            | Хеш уничтожается            | ❌ Нигде                       |

### Управление публичным ключом

| Этап                     | Действие                     | Хранилище           |
| ------------------------ | ---------------------------- | ------------------- |
| Создание аккаунта        | Сохраняется в IndexedDB      | IndexedDB.publicKey |
| Восстановление по паролю | Проверяется против IndexedDB | IndexedDB.publicKey |
| Восстановление по seed   | Проверяется против IndexedDB | IndexedDB.publicKey |
| Logout                   | Остаётся в IndexedDB         | IndexedDB.publicKey |

### Управление seed фразой

| Этап                             | Где находится                                   | Безопасность            |
| -------------------------------- | ----------------------------------------------- | ----------------------- |
| Создание аккаунта (Cloud)        | Памяразу + облако (зашифрованный) + backup файл | ✅ Высокая              |
| Создание аккаунта (Self-Custody) | Только в памяти пользователя                    | Зависит от пользователя |
| Восстановление                   | Облако (зашифрованный) или backup файл          | ✅ Высокая              |
| После аутентификации             | ❌ Удаляется из памяти                          | N/A                     |

---

## Типичные сценарии

### Сценарий 1: Новый пользователь с Cloud

```
1. Открывает app → AuthProvider проверяет auth → 401 → user = null
2. AuthGuard редиректит на /auth
3. Видит "Create Identity" + "Restore Access"
4. Нажимает "Create Identity"
5. Выбирает "Cloud"
6. Получает seed фразу из 12 слов
7. Подтверждает seed (повторяет слова)
8. Вводит пароль
9. Система:
   - Генерирует keypair из seed
   - Логинит пользователя (создаёт identity)
   - Сохраняет публичный ключ в IndexedDB
   - Шифрует seed с паролем
   - Загружает в облако
   - Скачивает backup файл
10. Редирект на /
11. AuthProvider снова проверяет auth → теперь 200 OK → user заполнен
12. Видит чат-приложение
```

### Сценарий 2: Восстановление через пароль

```
1. Открывает app → 401 → user = null → редирект на /auth
2. Нажимает "Restore Access"
3. Выбирает "Password"
4. Вводит пароль
5. Система:
   - Загружает зашифрованный seed с облака
   - Расшифровывает паролем → получает seed
   - Генерирует keypair из seed
   - Логинит пользователя (identity создан ранее)
   - Проверяет: публичный ключ совпадает с IndexedDB?
   - Если да → успех, если нет → ошибка
6. Редирект на /
7. Видит чат-приложение
```

### Сценарий 3: Восстановление через seed

```
1. Открывает app → 401 → редирект на /auth
2. Нажимает "Restore Access"
3. Выбирает "Seed"
4. Вводит 12 слов вручную
5. Система:
   - Валидирует seed
   - Генерирует keypair из seed
   - Логинит пользователя
   - Проверяет: публичный ключ совпадает?
   - Если да → успех, если нет → ошибка
6. Редирект на /
```

### Сценарий 4: Повторная аутентификация (cookies ещё в браузере)

```
1. Открывает app на /
2. AuthProvider проверяет auth → cookies присутствуют → GET /auth/profile → 200 OK
3. Загружает профиль пользователя
4. StorageService.initialize(identity.id)
5. AuthGuard видит user != null → показывает чат-приложение
6. Доступ без повторного логина
```

### Сценарий 5: Cookies истекли (требуется refresh)

```
1. Открывает app
2. AuthProvider проверяет auth → GET /auth/profile → 401
3. Пытается refresh → POST /auth/refresh → 200 OK → новые cookies
4. Повторяет GET /auth/profile → 200 OK → user загружен
5. Остальное как в Сценарии 4
```

---

## Диаграмма состояний

```
┌─────────────┐
│ App Started │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ AuthProvider.check  │
│ Auth in useEffect   │
└──────┬──────────────┘
       │
       ├─── GET /auth/profile ──┐
       │                        │
       │                   200 OK?
       │                   │    │
       │                   Yes  No (401)
       │                   │    │
       │                   ▼    ▼
       │                  User  POST /auth/refresh
       │                Loaded  │
       │                   │    ├─ Success → Retry GET
       │                   │    └─ Fail → user = null
       │                   │
       └───────┬───────────┘
               │
       ┌───────▼────────┐
       │ AuthProvider   │
       │ Ready          │
       └───────┬────────┘
               │
       ┌───────▼─────────┐
       │ Route Check via │
       │ AuthGuard       │
       └───────┬─────────┘
               │
       ┌───────┴──────────┐
       │                  │
       ▼                  ▼
   [user != null]    [user = null]
       │                  │
       │                  ▼
       │         Redirect to /auth
       │                  │
       ▼                  ▼
  Protected        useAuthFlow
  Content          │
                   ├─ Create Account
                   │  ├─ Cloud
                   │  └─ Self-Custody
                   │
                   └─ Recover Account
                      ├─ Password
                      └─ Seed
                      │
                      ▼
                   Redirect to /
                      │
                      └─ Back to Auth Check
```

---

## Безопасность

### Что защищено

✅ **Приватные ключи**: уничтожаются после одной операции подписи, хранится только хеш  
✅ **Seed фразы**: шифруются паролем перед облачным хранением, скачиваются локально как backup  
✅ **Пароли**: проверяются на уникальность, не хранятся в открытом виде  
✅ **Cookies**: отправляются с `credentials: 'include'`, шифруются по HTTPS  
✅ **IndexedDB**: привязана к specific identity.id, содержит только публичный ключ

### Что потребует внимания

⚠️ **Seed Self-Custody**: полностью зависит от пользователя (нет резервной копии)  
⚠️ **Публичный ключ верификация**: проверяется только при восстановлении, не при создании  
⚠️ **Хеш приватного ключа**: использует внутреннюю логику шифрования сообщений

---

## Файлы и модули

### Основные файлы

**Core Authentication:**
- **root.tsx**: точка входа приложения, оборачивает AuthProvider
- **hooks/use-auth.tsx**: AuthProvider, управление глобальным состоянием, метод `switchToHandle()`
- **hooks/use-auth-flow.ts**: управление этапами создания/восстановления на /auth
- **components/auth-guard.tsx**: компонент для защиты маршрутов
- **lib/auth-utils.ts**: утилиты для проверки и обновления аутентификации
- **services/auth.service.ts**: операции с API аутентификации, включая `switchToHandle()`
- **services/account.service.ts**: создание и восстановление аккаунтов
- **services/storage.service.ts**: управление IndexedDB
- **services/password-recovery.service.ts**: восстановление по паролю
- **services/cloud-backup.service.ts**: облачный бэкап
- **routes/auth.tsx**: UI страницы аутентификации
- **lib/crypto**: криптографические операции (seed, keypair, хеширование)

**Handle Switching (Phase 2):**
- **components/handle-switcher-modal.tsx**: модальное окно для быстрого переключения handle
- **components/hamburger-menu.tsx**: интеграция switcher modal в главное меню
- **components/user-profile-card.tsx**: карточка профиля пользователя с кнопкой переключения

### API endpoints

**Authentication & Profiles:**
- `POST /auth/login/challenge` — получить challenge для подписи
- `POST /auth/login` — аутентификация с подписанным challenge
- `GET /auth/profile` — получить профиль текущего пользователя (с activeHandleId)
- `POST /auth/refresh` — обновить токены
- `POST /auth/logout` — выход из текущей сессии

**Session Management:**
- `GET /auth/sessions` — получить список активных сессий с их handles
- `POST /auth/sessions/revoke/:id` — закрыть конкретную сессию
- `POST /auth/sessions/revoke-all` — закрыть все сессии кроме текущей
- `POST /auth/sessions/create-with-handle/:handleId` — создать новую сессию с выбранным handle

**Additional APIs:**
- Cloud API — загрузка/скачивание зашифрованного seed
- Password API — регистрация/проверка пароля

---

## Challenge-Response механизм (детали реализации)

### Характеристики Challenge

- **Генерация**: 256-битный случайный challenge
- **Хранилище**: Redis с TTL 2 минуты
- **Одноразовость**: удаляется после проверки (предотвращение replay-атак)
- **Попытки**: максимум 5 попыток на challenge
- **IP-валидация**: дополнительная проверка источника

### Процесс Challenge-Response

1. **Request Challenge**:
   - `POST /auth/login/challenge` с публичным ключом
   - Сервер генерирует challenge, сохраняет в Redis
   - Возвращает: `challengeId`, `challenge`, `expiresAt`

2. **Sign Challenge**:
   - Клиент подписывает challenge приватным ключом
   - `POST /auth/login` с `challengeId` и `signature`
   - Приватный ключ **никогда** не отправляется на сервер

3. **Verify Signature**:
   - Сервер проверяет Ed25519 подпись с публичным ключом
   - Валидирует, что challenge не истёк
   - Удаляет challenge из Redis (одноразовость)

4. **Session Creation**:
   - Создание Identity (если новый публичный ключ)
   - Создание сессии (максимум 5 на Identity)
   - Генерация access и refresh токенов
   - Отправка в HttpOnly cookies

### Защита от атак

✅ **Replay атаки**: challenge одноразовый, удаляется после проверки  
✅ **Brute-force**: лимит 5 попыток, TTL 2 минуты  
✅ **Кража токенов**: HttpOnly cookies, SameSite strict/lax  
✅ **XSS**: HttpOnly, Secure флаги на cookies  
✅ **CSRF**: SameSite strict в production  

---

## Управление сессиями

### Характеристики сессии

- **Максимум**: 5 активных сессий на Identity
- **Отслеживание**: имя устройства, IP, время последней активности
- **Отзыв**: возможность закрыть конкретную или все сессии
- **activeHandleId**: привязка сессии к конкретному handle (username) пользователя

### Переключение handle (Variant B)

**Механизм**: Создание новой сессии при переключении на другой handle

1. **Инициация**:
   - Пользователь видит список своих handles в HandleSwitcherModal
   - Выбирает handle для активации

2. **Backend процесс** (`POST /auth/sessions/create-with-handle/{handleId}`):
   - Валидация: handle принадлежит текущей Identity
   - Создание новой сессии с выбранным handle как `activeHandleId`
   - Генерация новых access и refresh токенов
   - Отправка новых HttpOnly cookies

3. **Frontend процесс**:
   - `AuthService.switchToHandle(handleId)` → вызывает backend endpoint
   - Браузер автоматически обновляет cookies (новая сессия)
   - `checkAuth()` перезагружает профиль с новым handle
   - UI обновляется: отображается новый username, profile data

4. **Результат**:
   - Новая сессия активна в cookies
   - `activeHandleId` указывает на новый handle
   - Старая сессия остаётся в истории (может быть просмотрена в /auth/sessions)
   - Повторное переключение создаёт ещё одну новую сессию

### Жизненный цикл токенов

| Токен | Длительность | Хранилище | В БД |
|-------|-------------|-----------|------|
| Access | 30 минут | HttpOnly cookie | SHA256 hash |
| Refresh | 30 дней | HttpOnly cookie | Plaintext |

### Обновление токенов

- **Автоматическое**: при 401 на защищённом маршруте
- **Ручное**: `POST /auth/refresh` запрос
- **Валидация**: hash-сравнение в базе данных

### API Endpoints для управления сессиями

- `GET /auth/sessions` — получить список активных сессий
- `POST /auth/sessions/revoke/:id` — закрыть конкретную сессию
- `POST /auth/sessions/revoke-all` — закрыть все сессии кроме текущей
- `POST /auth/sessions/create-with-handle/:handleId` — создать новую сессию с выбранным handle

---

## История изменений

**Версия 1.2** (20.02.2026)

- Добавлено описание Phase 2 Handle Switching (Variant B)
- Обновлено описание управления сессиями: `activeHandleId` и новая сессия при переключении
- Добавлены Frontend компоненты для handle switching: HandleSwitcherModal, HamburgerMenu
- Обновлены API endpoints с явным указанием `POST /auth/sessions/create-with-handle/:handleId`
- Уточнена логика переключения handle: создание новой сессии, новые токены, обновление UI

**Версия 1.1** (20.02.2026)

- Объединены три документа в один (AUTHENTICATION_FLOW.md)
- Добавлены детали Challenge-Response механизма из AUTHENTICATION_SYSTEM_ANALYSIS.md
- Добавлена информация о управлении сессиями и токенами
- Удалены дубликаты и уточнены описания процессов
- Актуализирована информация о безопасности

**Версия 1.0** (14.02.2025)

- Актуализирован флоу аутентификации на основе реального кода
- Удалено упоминание `hasKey` (полностью удалено из флоу)
- Уточнена логика создания и восстановления аккаунта
- Добавлена подробная техническая реализация каждой фазы
- Добавлены типичные сценарии использования
- Добавлена информация о безопасности
