# 📄 Техническое задание: End-to-End Encryption System с Lazy Seed Activation

## 1. Цель

Реализовать **полностью зашифрованный E2EE мессенджер** с использованием modern криптографии:

- **Нулевое знание сервера** о содержимом сообщений
- **Два режима регистрации:**
  1. Cloud Recovery (seed зашифрован под паролем в S3)
  2. Self-Custody (seed только в голове, с ленивой активацией)
- **X3DH (Triple Diffie-Hellman)** для установления ключей чата
- **Double Ratchet Algorithm** для прямой секретности (forward secrecy)
- **Отличный UX** в обоих режимах (без повторного ввода seed при каждом чате)

---

## 2. Модель безопасности

### 2.1 Криптографические материалы пользователя

#### Приватный ключ (PK)
- **Генерация:** Ed25519 ключевая пара при регистрации
- **Восстановление:** При логине из seed-фразы или пароля
- **Хранение:** **НИКОГДА не хранится на устройстве**
  - Используется только для подписания challenge на этапе аутентификации
  - Стирается из памяти **сразу после** вычисления `hPK`
- **Функция:** Доказательство владения аккаунтом

#### Хеш приватного ключа (hPK = hash(PK))
- **Вычисление:** `SHA-256(PK)` при логине (односторонняя функция)
- **Хранение:** **В памяти сессии** (браузер)
- **Использование:**
  - Локальный секрет для расшифровки материалов в IndexedDB
  - Входной параметр для HKDF при генерации `chatKey`
  - Не передаётся на сервер
- **Жизненный цикл:** Стирается при logout или закрытии браузера

#### Публичный ключ (PbK)
- **Генерация:** Из Ed25519 private key
- **Хранение:** **В БД** (таблица `identities.publicKey`)
- **Доступность:** Публичная информация, всем известна
- **Использование:** Верификация подписей, идентификация аккаунта

#### Handle (H) — человекочитаемый псевдоним
- **Структура:**
  - `handleId` (UUID, неизменяемый)
  - `value` (строка, может меняться)
  - `displayName` (опционально)
- **Хранение:** БД (таблица `handles`)
- **Количество:** Много на один пользователь (разные анонимные личности)
- **Привязка к чатам:** Один чат ← один handle

---

### 2.2 Pre-key материалы (X3DH)

#### Signed Pre-Key (SPK)
- **Генерация:** Ed25519 ключевая пара **один раз при логине**
- **Структура:**
  - `spk.sk` (приватный ключ)
  - `spk.pk` (публичный ключ)
  - `signature` (подпись под `pk` приватным ключом PK)
- **Хранение:**
  - Приватный `spk.sk` → **зашифрован под `hPK`** → IndexedDB (`session_prekeys`)
  - Публичный `spk.pk` и подпись → **на сервер** (БД: `handle_prekeys`)
- **Срок жизни:** 30 дней (при следующем логине — новые)

#### One-Time Keys (OTK)
- **Генерация:** 100 пар Ed25519 ключей **один раз при логине**
- **Структура:** Массив `[{sk, pk}, {sk, pk}, ...]`
- **Хранение:**
  - Приватные `sk` → **зашифрованы под `hPK`** → IndexedDB (`session_prekeys`)
  - Публичные `pk` → **загружены на сервер** (БД: `handle_otkeys`)
- **Использование:** Каждый новый чат забирает один OTK для X3DH
- **Пополнение:** При падении ниже 50 — генерируются новые и загружаются на сервер

---

### 2.3 Chat-специфичные ключи

#### Chat Key (CK)
- **Генерация:** X3DH протокол при начале чата
  ```
  CK = HKDF(DH(IK_A, SPK_B) || DH(EK_A, IK_B) || DH(EK_A, SPK_B) || OTK_B, info="chat")
  ```
- **Хранение:** IndexedDB под ключом `hash(hPK + handleId + chatId)`
- **Использование:** Root для Double Ratchet Algorithm
- **Криптография:** ECDH (Elliptic Curve Diffie-Hellman)

#### Message Keys (MK)
- **Генерация:** Double Ratchet Algorithm (DH + KDF ratchet)
- **Свойство:** **Forward Secrecy** — старые сообщения защищены даже если ключ украден
- **Хранение:** **В памяти** (не сохраняется в IndexedDB)
- **Срок жизни:** Один рatchet (обычно 1-100 сообщений)

---

## 3. Два режима регистрации

### 3.1 Cloud Recovery Mode

#### Регистрация
1. **Пользователь вводит пароль** (один раз при регистрации)
2. **Генерируется seed-фраза** (12 слов BIP39)
3. **Seed шифруется:**
   - Ввод: пароль → PBKDF2 (10,000 итераций) → `key`
   - `encrypted_seed = AES-256-GCM(seed, key)`
4. **Загружается в S3:**
   - S3 путь: `s3://besafe-seeds/{handle_id}/encrypted_seed`
   - Доступ: только с валидным JWT и правильным паролем

#### Логин
1. **Пользователь вводит пароль**
2. **Fetch из S3:** `encrypted_seed`
3. **Расшифровка:** `seed = AES-256-GCM.decrypt(encrypted_seed, PBKDF2(password))`
4. **Восстановление PK:** `PK = BIP39.toSeed(seed) → Ed25519.derive()`
5. **Вычисление hPK:** `hPK = SHA-256(PK)` → в память
6. **Стирание PK из памяти**
7. **Загрузка pre-keys:**
   - Если `session_prekeys` в IndexedDB (не просрочены) → используются
   - Иначе → генерируются новые
8. **Сессия создана** ✅

#### UX
| Действие | Требуется ввод | Примечание |
|---------|----------------|-----------|
| Регистрация | Пароль (1 раз) | Запомнить или сохранить |
| Логин | Пароль | Каждый раз |
| Новый чат | Ничего | Pre-keys в IndexedDB (30 дней) |

---

### 3.2 Self-Custody Mode

#### Регистрация
1. **Генерируется seed-фраза** (12 слов BIP39)
2. **Пользователь записывает seed** (бумага, заметки, кошелёк)
3. **Seed НЕ хранится** ни в приложении, ни на сервере
4. **Пользователь может установить PIN** (опционально, для локальной защиты IndexedDB)

#### Логин
1. **Пользователь вводит 12 слов** (seed)
2. **Восстановление PK:** `PK = BIP39.toSeed(seed) → Ed25519.derive()`
3. **Вычисление hPK:** `hPK = SHA-256(PK)` → в память
4. **Стирание PK и seed из памяти** ✅
5. **Загрузка/генерация pre-keys:**
   - **Ленивая активация:** Если `session_prekeys` в IndexedDB (не просрочены) → используются
   - Иначе → генерируются новые и сохраняются в IndexedDB
6. **Сессия создана** ✅

#### UX
| Действие | Требуется ввод | Примечание |
|---------|----------------|-----------|
| Регистрация | 12 слов (записать!) | Один раз |
| Логин | 12 слов | Каждый раз (если очищен браузер) |
| Новый чат | **Ничего!** | **Ленивая активация**: pre-keys в IndexedDB |

> **Критическое улучшение:** Благодаря ленивой активации, self-custody становится практичным!

---

### 3.3 Ленивая активация seed (Lazy Seed Activation)

#### Концепция
> **После первого ввода seed при логине, не требуется вводить seed снова в течение ~30 дней.**

#### Реализация

**Шаг 1: При логине (после ввода seed или пароля)**
```
1. Восстанавливается PK из seed
2. Генерируются:
   - SPK: {sk, pk, signature}
   - OTKs: [{sk, pk}, {sk, pk}, ..., {sk, pk}]  (100 штук)
3. Шифруются приватные ключи:
   derivedKey = HKDF(hPK, salt="prekey_encryption", length=32)
   encrypted = {
     spk_sk: AES-256-GCM(SPK.sk, derivedKey),
     otk_sks: AES-256-GCM(OTKs[*].sk, derivedKey)
   }
4. Сохраняются в IndexedDB:
   session_prekeys = {
     encrypted,
     spk_pk: SPK.pk,
     spk_signature: SPK.signature,
     otk_pks: [OTK[*].pk],
     expires_at: now + 30 * 24 * 3600 * 1000,
     created_at: now
   }
5. PK и seed СТИРАЮТСЯ из памяти ✅
```

**Шаг 2: При получении первого сообщения в новом чате**
```
1. Сервер отправляет:
   {
     chatId,
     ephemeralPublicKey,
     usedOTK_pk,
     x3dhPayload: "зашифрованное сообщение"
   }
2. Клиент:
   a. Читает session_prekeys из IndexedDB
   b. Расшифровывает SPK.sk и OTK.sk под hPK
   c. Выполняет X3DH:
      CK = HKDF(
        DH(IK_A, usedOTK_pk) ||
        DH(ephemeralPublicKey, PK_A) ||
        DH(ephemeralPublicKey, SPK.sk)
      )
   d. Выполняет Double Ratchet
   e. Расшифровывает сообщение
3. Сохраняет chatKey в IndexedDB
4. Удаляет использованный OTK из session_prekeys
```

**Шаг 3: При истечении (30 дней)**
```
1. При следующем логине:
   - Проверка: expires_at < now?
   - Да → удалить session_prekeys
   - Запросить ввод seed снова
   - Сгенерировать новые pre-keys
```

#### Безопасность ленивой активации

| Риск | Анализ | Уровень |
|------|--------|--------|
| **Кража `hPK` из памяти браузера** | Если украсть `hPK` → можно расшифровать `session_prekeys` → получить SPK/OTK → читать новые чаты. **Но:** `hPK` только в памяти, XSS-атака требует выполнения кода на странице | ⚠️ **Средний** (разумный компромисс) |
| **Кража IndexedDB** | `session_prekeys` зашифрованы под `hPK`, которого нет на диске → бесполезны | ✅ **Защищено** |
| **Потеря при очистке браузера** | Да, но это ожидаемо в self-custody. Пользователь должен знать риск | ✅ **Приемлемо** |
| **Компрометация S3 (Cloud Mode)** | Seed зашифрован под паролем → требуется перебор | ✅ **Защищено** |

---

## 4. X3DH (Triple Diffie-Hellman) Protocol

### 4.1 Структура ключей участников

**Alice (отправитель):**
- `IK_A` (Identity Key — долгоживущий)
- `EK_A` (Ephemeral Key — один раз для этого чата)

**Bob (получатель):**
- `IK_B` (Identity Key — долгоживущий)
- `SPK_B` (Signed Pre-Key — живет 30 дней)
- `OTK_B` (One-Time Key — потребляется один раз)

### 4.2 Процесс

**Инициирование чата (Alice):**
```
1. Fetch Bob's public keys с сервера:
   {
     IK_B,
     SPK_B (с подписью),
     OTK_B (публичный)
   }
2. Генерировать EK_A (эфемерный ключ)
3. Вычислить DH результаты (ECDH):
   DH1 = ECDH(IK_A, SPK_B)
   DH2 = ECDH(EK_A, IK_B)
   DH3 = ECDH(EK_A, SPK_B)
   DH4 = ECDH(EK_A, OTK_B)
4. Вычислить shared secret:
   SK = HKDF(
     concat(DH1, DH2, DH3, DH4),
     salt=concat(IK_A, SPK_B),
     info="BeChat.X3DH.v1"
   )
5. Генерировать CK (Chat Key) из SK:
   CK = HKDF(SK, info="BeChat.RootKey")
6. Отправить на сервер:
   {
     IK_A,
     EK_A,
     usedOTK_B_pk,
     ciphertext (зашифровано под CK)
   }
```

**Получение сообщения (Bob):**
```
1. Получить с сервера:
   {
     IK_A,
     EK_A,
     usedOTK_B_pk,
     ciphertext
   }
2. Вычислить DH результаты:
   DH1 = ECDH(SPK_B_sk, IK_A)     // SPK.sk из IndexedDB
   DH2 = ECDH(IK_B_sk, EK_A)      // IK_B.sk из памяти
   DH3 = ECDH(SPK_B_sk, EK_A)     // SPK.sk из IndexedDB
   DH4 = ECDH(OTK_B_sk, EK_A)     // OTK.sk из IndexedDB, потом удалить!
3. Вычислить shared secret (тот же SK):
   SK = HKDF(
     concat(DH1, DH2, DH3, DH4),
     salt=concat(IK_A, SPK_B),
     info="BeChat.X3DH.v1"
   )
4. CK = HKDF(SK, info="BeChat.RootKey")
5. Расшифровать:
   plaintext = AES-256-GCM.decrypt(ciphertext, CK)
```

---

## 5. Per-Message Key Derivation (простой и эффективный подход)

### 5.1 Концепция
> **Один ключ X3DH → один ключ на весь чат. Но каждое сообщение использует уникальный derived key. Простота без complexity.**

### 5.2 Почему НЕ Double Ratchet?

**Double Ratchet требует:**
- ❌ Синхронизации состояния между устройствами одного пользователя
- ❌ Обработки out-of-order сообщений с буфером forward keys
- ❌ Хранения и восстановления сложного состояния в IndexedDB
- ❌ Восстановления при потере IndexedDB

**В BeSafeChat:**
- ✅ Каждое устройство независимо (не нужна синхронизация)
- ✅ Сообщения always in-order (live чат, не асинхронный email)
- ✅ Простота реализации и отладки
- ✅ Легко восстанавливается (просто перезагрузить чат)

### 5.3 Компоненты

**Chat Key (CK) — один на весь чат:**
- Инициализируется один раз из X3DH shared secret
- Сохраняется в IndexedDB под ключом `hash(hPK + handleId + chatId)`
- Используется как root для derivation message keys
- Никогда не меняется (в отличие от Double Ratchet)

**Message Key (MK) — уникальный для каждого сообщения:**
- Генерируется: `MK = HKDF(CK, salt=message_number, info="BeChat.MessageKey.v1")`
- Используется для AES-256-GCM шифрования сообщения
- **Не сохраняется** в IndexedDB (удаляется после использования)
- `message_number` = порядковый номер сообщения в чате (0, 1, 2, ...)

### 5.4 Процесс

**При отправке сообщения:**
```ts
1. Получить CK из IndexedDB
2. Получить следующий message_number (из metadata)
3. Генерировать MK:
   messageKey = HKDF(
     CK,
     salt=message_number,
     info="BeChat.MessageKey.v1",
     length=32
   )
4. Шифровать:
   ciphertext = AES-256-GCM(plaintext, messageKey, iv)
5. Отправить на сервер:
   {
     chatId,
     messageId,
     message_number,
     iv,
     ciphertext,
     timestamp
   }
6. MK стирается из памяти ✅
```

**При получении сообщения:**
```ts
1. Получить сообщение с сервера
2. Извлечь message_number
3. Получить CK из IndexedDB (тот же!)
4. Генерировать MK (с тем же message_number):
   messageKey = HKDF(
     CK,
     salt=message_number,
     info="BeChat.MessageKey.v1",
     length=32
   )
5. Расшифровать:
   plaintext = AES-256-GCM.decrypt(ciphertext, messageKey, iv)
6. Сохранить в IndexedDB
7. Обновить message_number counter
```

### 5.5 Forward Secrecy на уровне сообщения

**Защита:**
- Если `messageKey` украден → скомпрометировано только 1 сообщение
- Другие message keys не могут быть восстановлены (HKDF — односторонняя функция)
- Если `CK` украден → все сообщения в чате видны, но это меньший риск чем потеря `PK`

**Компромисс (приемлемый):**
- ❌ Нет forward secrecy между сессиями (если кто-то получит `CK` → видит все сообщения)
- ✅ Но `CK` хранится только в IndexedDB (защищена `hPK`)
- ✅ Сообщения хранятся локально на устройстве, не на сервере
- ✅ Это приемлемый trade-off для чат-приложения

---

## 6. Хранение данных

### 6.1 IndexedDB Schema

**Таблица: `session_prekeys`**
```ts
{
  id: "unique_identifier",
  encrypted_spk_sk: Uint8Array,          // AES-256-GCM зашифрован
  encrypted_otk_sks: Uint8Array,         // AES-256-GCM зашифрован
  spk_pk: string,                        // Base64
  spk_signature: string,                 // Base64
  otk_pks: string[],                     // Array of Base64
  otk_count: number,                     // Сколько ещё OTK осталось
  expires_at: number,                    // Timestamp (ms)
  created_at: number,                    // Timestamp (ms)
  mode: "cloud" | "self-custody"         // Режим
}
```

**Таблица: `chat_keys`**
```ts
{
  key: string,                           // hash(hPK + handleId + chatId)
  chat_id: string,
  handle_id: string,
  chat_key: Uint8Array,                  // CK из X3DH (НИКОГДА не меняется)
  message_number_counter: number,        // Счётчик для per-message key derivation (0, 1, 2, ...)
  created_at: number,
  updated_at: number
}
```

**Важно:** Нет рatchet state! Просто счётчик сообщений.


**Таблица: `messages`**
```ts
{
  id: string,                            // UUID
  chat_id: string,
  handle_id: string,
  content_encrypted: string,             // Base64
  iv: string,                            // IV для AES (Base64)
  timestamp: number,
  sender_handle_id: string,
  message_number: number,                // Per-message key derivation counter (0, 1, 2, ...)
  received_at: number,
  is_delivered: boolean,
  is_read: boolean
}
```

**Важно:** Простая структура — no ratchet complexity!


### 6.2 БД (PostgreSQL) Schema

**Таблица: `handle_prekeys`**
```sql
CREATE TABLE handle_prekeys (
  id UUID PRIMARY KEY,
  handle_id UUID NOT NULL REFERENCES handles(id),
  spk_pk TEXT NOT NULL,                   -- Public key (Base64)
  spk_signature TEXT NOT NULL,            -- Signature (Base64)
  otk_pks TEXT[] NOT NULL,                -- Array of public keys
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT FK_handle FOREIGN KEY (handle_id) REFERENCES handles(id)
);
```

**Таблица: `handle_otkeys`**
```sql
CREATE TABLE handle_otkeys (
  id UUID PRIMARY KEY,
  handle_id UUID NOT NULL REFERENCES handles(id),
  otk_pk TEXT NOT NULL UNIQUE,            -- Public key (Base64)
  is_used BOOLEAN DEFAULT false,
  used_by_chat_id UUID,                   -- Какой чат использовал
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT FK_handle FOREIGN KEY (handle_id) REFERENCES handles(id),
  CONSTRAINT FK_chat FOREIGN KEY (used_by_chat_id) REFERENCES chats(id)
);
```

---

## 7. Требования к безопасности

- ✅ **E2EE:** Сервер не видит содержимое сообщений (только зашифрованные данные)
- ✅ **Forward Secrecy:** Потеря одного MK не компрометирует другие сообщения
- ✅ **PK никогда на диске:** Используется только для签署 challenge, потом стирается
- ✅ **hPK только в памяти:** Служит локальным секретом, не передаётся на сервер
- ✅ **Seed-фраза защищена:**
  - Cloud Mode: зашифрована под паролем
  - Self-Custody: нигде не хранится
- ✅ **Pre-keys защищены:** Зашифрованы под hPK в IndexedDB
- ✅ **One-Time Keys:** Потребляются один раз, затем удаляются

---

## 8. Интеграция с текущей архитектурой

### Backend (NestJS)

**Новые сервисы:**
```ts
// crypto/x3dh.service.ts
export class X3DHService {
  async validateX3DHPayload(payload: X3DHPayload): Promise<boolean>
  async storePreKeys(handleId, spkPk, spkSignature, otkPks): Promise<void>
  async getPreKeysForHandle(handleId): Promise<PreKeysResponse>
}

// crypto/message-encryption.service.ts
export class MessageEncryptionService {
  async encryptMessage(chatKey: Uint8Array, messageNumber: number, plaintext: string): Promise<{ciphertext, iv}>
  async decryptMessage(chatKey: Uint8Array, messageNumber: number, ciphertext: string, iv: string): Promise<string>
  // Простая per-message KDF derivation, без рatchet state
}

// seed-recovery.service.ts
export class SeedRecoveryService {
  async uploadEncryptedSeed(handleId, encryptedSeed): Promise<void>  // Cloud mode
  async getEncryptedSeed(handleId): Promise<string>                   // Cloud mode
  async validateSeedPhrase(seed): Promise<boolean>                    // Self-custody
}
```

**Новые эндпоинты:**
```ts
POST /crypto/prekeys/upload
  Request: { spk_pk, spk_signature, otk_pks[] }
  Response: { success: true, prekey_id }

GET /crypto/prekeys/{handleId}
  Response: { spk_pk, spk_signature, otk_pks[], prekey_id }

POST /crypto/seed/upload (Cloud mode)
  Request: { encrypted_seed }
  Response: { success: true }

GET /crypto/seed/{handleId} (Cloud mode)
  Request: { password_hash }
  Response: { encrypted_seed }

POST /messages/send (updated for E2EE)
  Request: { 
    chatId, 
    message_number, 
    ciphertext, 
    iv, 
    timestamp 
  }
  Response: { messageId, delivered }
```

### Frontend (React)

**Новые hooks/utilities:**
```ts
// lib/crypto/e2ee.ts
export async function initializeE2EE(mode: "cloud" | "self-custody") {
  // 1. Восстановить или сгенерировать seed
  // 2. Восстановить PK → вычислить hPK
  // 3. Загрузить/сгенерировать pre-keys
  // 4. Стереть PK
}

export async function derivePreKeysFromSeed(seed: string[]) {
  // Восстановить PK, сгенерировать SPK и OTK
}

export async function performX3DH(
  myPreKeys,
  theirPublicKeys,
  ephemeralSecret
): Promise<chatKey> {
  // Вычислить shared secret и CK
}

export async function encryptMessage(
  chatKey: Uint8Array,
  messageNumber: number,
  message: string
): Promise<{ ciphertext: string, iv: string }> {
  // 1. Derive MK: messageKey = HKDF(chatKey, salt=messageNumber, info="BeChat.MessageKey.v1")
  // 2. Generate IV (random)
  // 3. AES-256-GCM encrypt plaintext
  // 4. Return { ciphertext (base64), iv (base64) }
}

export async function decryptMessage(
  chatKey: Uint8Array,
  messageNumber: number,
  ciphertext: string,
  iv: string
): Promise<string> {
  // 1. Derive MK: messageKey = HKDF(chatKey, salt=messageNumber, info="BeChat.MessageKey.v1")
  // 2. AES-256-GCM decrypt ciphertext with IV
  // 3. Return plaintext
}
```

---

## 9. Этапы реализации (рекомендуемые)

### Этап 1: Инфраструктура (криптография)
- [ ] Внедрить Ed25519 (подписи)
- [ ] Внедрить ECDH (key agreement)
- [ ] Внедрить HKDF (KDF)
- [ ] Внедрить AES-256-GCM (шифрование)
- [ ] Тесты для каждого примитива

### Этап 2: Seed recovery и регистрация
- [ ] Cloud Mode: зашифровка seed под паролем
- [ ] Self-Custody Mode: валидация BIP39 фразы
- [ ] Загрузка в S3 / локальное сохранение
- [ ] Восстановление PK и вычисление hPK

### Этап 3: X3DH и pre-keys
- [ ] Генерация SPK и OTK при логине
- [ ] Шифрование pre-keys под hPK
- [ ] Сохранение в IndexedDB (`session_prekeys`)
- [ ] Загрузка на сервер
- [ ] Fetch public keys и X3DH вычисления

### Этап 4: Per-Message Key Derivation
- [ ] Инициализация CK из X3DH result
- [ ] Per-message key derivation: `HKDF(CK, salt=message_number, info="BeChat.MessageKey.v1")`
- [ ] AES-256-GCM шифрование/расшифровка сообщения
- [ ] Сохранение CK и message_number counter в IndexedDB (`chat_keys`)

### Этап 5: Интеграция с messaging
- [ ] Modify `handleSendMessage()` в MessagesGateway
- [ ] Modify `handleIncomingMessage()` для расшифровки
- [ ] Обновить IndexedDB структуру для сообщений
- [ ] Миграции БД

### Этап 6: UX и управление ключами
- [ ] UI для выбора режима (Cloud vs Self-Custody)
- [ ] Backup/recovery интерфейс
- [ ] Управление pre-keys (истечение, пополнение)
- [ ] Уведомления о необходимости ввода seed (просрочка)

### Этап 7: Тестирование и аудит
- [ ] Unit-тесты для X3DH
- [ ] Unit-тесты для Per-Message Key Derivation
- [ ] Unit-тесты для seed recovery (Cloud и Self-Custody)
- [ ] Интеграционные тесты: end-to-end сообщение
- [ ] Security audit (криптография, key management)
- [ ] Performance testing (шифрование/расшифровка, HKDF)

---

## 10. Диаграмма жизненного цикла сессии (Self-Custody с ленивой активацией)

```
┌─────────────────────────────────────────────────────────────┐
│                    РЕГИСТРАЦИЯ (один раз)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Пользователь вводит 12-слов seed фразу                  │
│  2. Seed НЕ ХРАНИТСЯ нигде                                  │
│  3. Пользователь записывает seed (бумага)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  ПЕРВЫЙ ЛОГИН (day 1)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Пользователь вводит 12 слов seed                        │
│  2. PK = BIP39.derive(seed)                                 │
│  3. hPK = SHA-256(PK) → в памяти                            │
│  4. PK СТИРАЕТСЯ из памяти ✅                               │
│  5. Генерируются SPK и 100 OTK                              │
│  6. Pre-keys шифруются под hPK                              │
│  7. Сохраняются в IndexedDB с TTL=30 дней                  │
│  8. Seed СТИРАЕТСЯ из памяти ✅                             │
│                                                              │
│  Результат: session_prekeys в IndexedDB ✅                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                СЛЕДУЮЩИЕ 30 ДНЕЙ                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  • Пользователь может закрыть браузер                       │
│  • Можно создавать новые чаты                              │
│  • Pre-keys используются из IndexedDB                       │
│  • БЕЗ ввода SEED ФРАЗЫ! ✅                                 │
│                                                              │
│  (Благодаря ленивой активации)                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│             ИСТЕЧЕНИЕ (после 30 дней)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  При следующем логине:                                      │
│  1. IndexedDB: session_prekeys.expires_at < now?            │
│  2. Да → запросить ввод seed снова                         │
│  3. Повторить шаги ПЕРВОГО ЛОГИНА                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Сравнение режимов (финальный)

| Параметр | Cloud Recovery | Self-Custody (ленивая активация) |
|---------|----------------|-----------------------------------|
| **Регистрация** | Пароль | Seed-фраза (записать) |
| **Хранение seed** | Зашифрован в S3 | Нигде (голова) |
| **UX при логине** | Ввод пароля | Ввод seed (или нет, если <30 дней) |
| **UX при новом чате** | Ввод пароля (редко) | **Ничего!** (pre-keys в IndexedDB) |
| **Потеря устройства** | Восстановление по паролю | Восстановление по seed |
| **Безопасность** | ⭐⭐⭐⭐⭐ (Очень высокая) | ⭐⭐⭐⭐⭐ (Очень высокая) |
| **Удобство** | ⭐⭐⭐⭐⭐ (Отличная UX) | ⭐⭐⭐⭐⭐ (Отличная UX благодаря ленивой активации) |

> **Оба режима теперь практичны для повседневного использования!**

---

## 12. Открытые вопросы для обсуждения

- [ ] Какую криптографическую библиотеку использовать? (`TweetNaCl.js`, `libsodium.js`, Web Crypto API + `noble/*`)
- [ ] Нужны ли read receipts? Зашифровывать ли их?
- [ ] Как обновлять pre-keys при падении count ниже 50? (trigger на клиенте или сервере?)
- [ ] Как восстанавливать при потере IndexedDB в mid-session? (перезагрузить чат?)
- [ ] Нужна ли поддержка группировки сообщений? (thread replies в зашифрованном виде)

