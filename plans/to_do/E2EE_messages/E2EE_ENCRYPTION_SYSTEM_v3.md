# 📄 Техническое задание: End-to-End Encryption System с Lazy Seed Activation и поддержкой групповых чатов

## 1. Цель

Реализовать **полностью зашифрованный E2EE мессенджер** с использованием modern криптографии:

- **Нулевое знание сервера** о содержимом сообщений
- **Два режима регистрации:**
  1. Cloud Recovery (seed зашифрован под паролем в S3)
  2. Self-Custody (seed только в голове, с ленивой активацией)
- **X3DH (Triple Diffie-Hellman)** для установления ключей чата и доставки групповых ключей
- **Per-message key derivation** для прямой секретности (forward secrecy) в 1:1 чатах
- **Групповые чаты** через X3DH-доставку группового ключа
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

### 2.3 Ключи для 1:1 чатов

#### Chat Key (CK)
- **Генерация:** X3DH протокол при начале чата
  ```
  CK = HKDF(DH(IK_A, SPK_B) || DH(EK_A, IK_B) || DH(EK_A, SPK_B) || OTK_B, info="chat")
  ```
- **Хранение:** IndexedDB под ключом `hash(hPK + handleId + chatId)`
- **Использование:** Root для per-message key derivation
- **Криптография:** ECDH (Elliptic Curve Diffie-Hellman)

#### Message Keys (MK)
- **Генерация:** Per-message HKDF от CK
  ```
  MK = HKDF(CK, salt=message_number, info="BeChat.MessageKey.v1")
  ```
- **Свойство:** **Forward Secrecy** — старые сообщения защищены даже если ключ украден
- **Хранение:** **В памяти** (не сохраняется в IndexedDB)
- **Срок жизни:** Один message number

---

### 2.4 Ключи для групповых чатов

#### Group Key (GK)
- **Генерация:** Случайный 256-битный ключ при создании группы или изменении состава
- **Хранение:** IndexedDB под ключом `hash(hPK + handleId + groupId + epoch)`
- **Использование:** Шифрование всех сообщений в группе в течение одной эпохи
- **Эпоха (epoch):** Увеличивается при каждом входе/выходе участника

#### Delivery Key (DK)
- **Генерация:** Результат X3DH handshake между инициатором и участником
- **Использование:** Шифрование `GK` для доставки новому участнику
- **Жизненный цикл:** Один раз на вход участника

#### Ограничения групп
- **Максимум участников:** 100
- **Нет истории для новых:** Новые участники не видят прошлые сообщения
- **Зависимость от онлайн-участников:** Только текущие участники могут добавлять новых

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
| Новый чат (1:1 или группа) | Ничего | Pre-keys в IndexedDB (30 дней) |

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
| Новый чат (1:1 или группа) | **Ничего!** | **Ленивая активация**: pre-keys в IndexedDB |

> **Критическое улучшение:** Благодаря ленивой активации, self-custody становится практичным!

---

### 3.3 Ленивая активация seed (Lazy Seed Activation)

#### Концепция
> **После первого ввода seed при логине, не требуется вводить seed снова в течение ~30 дней.**
> Работает **как для 1:1, так и для групповых чатов**.

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
   d. Выполняет per-message key derivation
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

**Инициирует чат Alice (знает Bob's pre-keys):**

```
1. Alice генерирует ephemeral key: EK_A = random()
2. Alice получает Bob's pre-keys с сервера: IK_B, SPK_B, OTK_B
3. Alice выполняет 4 DH операции:
   - DH1 = DH(IK_A, SPK_B)
   - DH2 = DH(EK_A, IK_B)
   - DH3 = DH(EK_A, SPK_B)
   - DH4 = DH(IK_A, OTK_B)
4. Concatenate: IKM = DH1 || DH2 || DH3 || DH4
5. KDF: CK = HKDF(IKM, salt=null, info="chat", length=32)
6. Alice сохраняет CK в IndexedDB
7. Alice отправляет Bob: [EK_A.public, message]
```

**Когда Bob получает сообщение:**

```
1. Bob получает EK_A от Alice
2. Bob выполняет те же 4 DH операции:
   - DH1 = DH(SPK_B, IK_A)  ← из EK_A, Bob уже знает EK_A.public
   - DH2 = DH(IK_B, EK_A)
   - DH3 = DH(SPK_B, EK_A)
   - DH4 = DH(OTK_B, IK_A)
3. Concatenate: IKM = DH1 || DH2 || DH3 || DH4
4. KDF: CK = HKDF(IKM, salt=null, info="chat", length=32)
   → **ОДИНАКОВЫЙ CK!** ✅
5. Bob расшифровывает сообщение
```

**Почему 4 операции:**
- DH1 + DH4 → только Alice и Bob знают результат (используются identity keys)
- DH2 + DH3 → ephemeral key + SPK для свежести (forward secrecy)
- OTK обеспечивает один раз на чат

---

## 5. Per-Message Key Derivation

### 5.1 Для 1:1 чатов

**Chat Key (CK) — один на весь чат:**
- Инициализируется один раз из X3DH shared secret
- Сохраняется в IndexedDB под ключом `hash(hPK + handleId + chatId)`
- Используется как root для derivation message keys

**Message Key (MK) — уникальный для каждого сообщения:**
```
MK = HKDF(CK, salt=message_number, info="BeChat.MessageKey.v1")
```
- Генерируется для каждого сообщения
- Используется для AES-256-GCM шифрования сообщения
- **Не сохраняется** в IndexedDB

### 5.2 Для групповых чатов

**Group Key (GK) — один на эпоху:**
- Генерируется при создании группы или изменении состава
- Все сообщения в эпохе шифруются **напрямую под GK**
- Формат: `AES-256-GCM(plaintext, GK, iv)`
- Нет per-message key derivation — достаточно одного GK

**Почему это безопасно:**
- Эпоха короткая (пока состав не меняется)
- При выходе участника — GK ротируется → forward secrecy
- Простота реализации и синхронизации

---

## 6. Хранение данных

### 6.1 IndexedDB Schema

**Таблица: `session_prekeys`**

```ts
{
  key: string,                           // id
  spk_pk: Uint8Array,                    // SPK публичный ключ
  spk_sk_encrypted: Uint8Array,          // SPK приватный, зашифрован
  spk_signature: Uint8Array,             // Подпись
  otk_pks: Uint8Array[],                 // OTK публичные ключи
  otk_sks_encrypted: Uint8Array[],       // OTK приватные, зашифрованы
  created_at: number,
  expires_at: number
}
```

**Таблица: `chat_keys`** (для 1:1 чатов)

```ts
{
  key: string,                           // hash(hPK + handleId + chatId)
  chat_id: string,
  handle_id: string,
  chat_key: Uint8Array,                  // CK из X3DH (НИКОГДА не меняется)
  message_number_counter: number,         // Счётчик для per-message key derivation
  created_at: number,
  updated_at: number,
  type: "direct"                         // Тип чата
}
```

**Таблица: `group_keys`** (для групповых чатов)

```ts
{
  key: string,                           // hash(hPK + handleId + groupId + epoch)
  group_id: string,
  handle_id: string,
  group_key: Uint8Array,                 // GK
  epoch: number,                         // 0, 1, 2...
  created_at: number,
  type: "group"
}
```

**Таблица: `messages`**

```ts
{
  id: string,
  chat_id?: string,                      // Для 1:1
  group_id?: string,                     // Для групп
  handle_id: string,
  content_encrypted: string,
  iv: string,
  timestamp: number,
  sender_handle_id: string,
  message_number?: number,                // Только для 1:1
  epoch?: number,                        // Только для групп
  is_group: boolean,                     // true если групповое
  received_at: number,
  is_delivered: boolean,
  is_read: boolean
}
```

### 6.2 БД (PostgreSQL) Schema

**Таблица: `groups`** (для групповых чатов)

```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY,
  creator_handle_id UUID NOT NULL REFERENCES handles(id),
  current_epoch INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Таблица: `group_members`**

```sql
CREATE TABLE group_members (
  id UUID PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id),
  handle_id UUID NOT NULL REFERENCES handles(id),
  epoch_joined INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_member UNIQUE (group_id, handle_id, epoch_joined)
);
```

**Таблица: `group_key_deliveries`**

```sql
CREATE TABLE group_key_deliveries (
  id UUID PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id),
  recipient_handle_id UUID NOT NULL REFERENCES handles(id),
  epoch INTEGER NOT NULL,
  encrypted_group_key TEXT NOT NULL,     -- Base64
  delivered_by_handle_id UUID NOT NULL REFERENCES handles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Таблица: `handle_prekeys`** (для X3DH)

```sql
CREATE TABLE handle_prekeys (
  id UUID PRIMARY KEY,
  handle_id UUID NOT NULL REFERENCES handles(id),
  spk_pk BYTEA NOT NULL,
  spk_signature BYTEA NOT NULL,
  otk_pks BYTEA[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
```

**Таблица: `used_otkeys`** (отслеживание использованных OTK)

```sql
CREATE TABLE used_otkeys (
  id UUID PRIMARY KEY,
  handle_id UUID NOT NULL REFERENCES handles(id),
  otk_pk BYTEA NOT NULL,
  used_by_sender_id UUID NOT NULL REFERENCES identities(id),
  chat_id UUID REFERENCES chats(id),
  used_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_otk_usage UNIQUE (otk_pk, used_by_sender_id)
);
```

---

## 7. Требования к безопасности

- ✅ **E2EE:** Сервер не видит содержимое сообщений (только зашифрованные данные)
- ✅ **Forward Secrecy (1:1):** Потеря одного MK не компрометирует другие сообщения
- ✅ **Forward Secrecy (группа):** GK ротируется при каждом изменении состава
- ✅ **PK никогда на диске:** Используется только для подписания challenge, потом стирается
- ✅ **hPK только в памяти:** Служит локальным секретом, не передаётся на сервер
- ✅ **Seed-фраза защищена:**
  - Cloud Mode: зашифрована под паролем
  - Self-Custody: нигде не хранится
- ✅ **Pre-keys защищены:** Зашифрованы под hPK в IndexedDB
- ✅ **One-Time Keys:** Потребляются один раз, затем удаляются
- ✅ **Групповая безопасность:** GK ротируется при каждом изменении состава, обеспечивая forward secrecy для вышедших участников
- ✅ **Нет истории для новых:** Новые участники не получают доступ к прошлым сообщениям — защита от утечек

---

## 8. Интеграция с текущей архитектурой

### Backend (NestJS)

**Обновлённые сервисы:**

```ts
// crypto/x3dh.service.ts
export class X3DHService {
  async validateX3DHPayload(payload: X3DHPayload): Promise<boolean>
  async storePreKeys(handleId, spkPk, spkSignature, otkPks): Promise<void>
  async getPreKeysForHandle(handleId): Promise<PreKeysResponse>
  
  async deliverGroupKey(
    groupId: string,
    senderHandleId: string,
    recipientHandleId: string,
    encryptedGroupKey: string
  ): Promise<void>

  async getGroupKeyDeliveries(groupId: string, handleId: string): Promise<GroupKeyDelivery[]>
}

// crypto/message-encryption.service.ts
export class MessageEncryptionService {
  // Для 1:1 чатов
  async encryptMessage(chatKey: Uint8Array, messageNumber: number, plaintext: string): Promise<{ciphertext, iv}>
  async decryptMessage(chatKey: Uint8Array, messageNumber: number, ciphertext: string, iv: string): Promise<string>
  
  // Для групповых чатов
  async encryptGroupMessage(
    groupKey: Uint8Array,
    plaintext: string
  ): Promise<{ ciphertext: string; iv: string }>

  async decryptGroupMessage(groupKey: Uint8Array, ciphertext: string, iv: string): Promise<string>
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
// 1:1 чаты
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

POST /messages/send (1:1)
  Request: { 
    chatId, 
    message_number, 
    ciphertext, 
    iv, 
    timestamp 
  }
  Response: { messageId, delivered }

// Групповые чаты
POST /groups/create
  Request: { member_handle_ids[] }
  Response: { group_id, epoch }

POST /groups/{groupId}/add-members
  Request: { new_member_handle_ids[] }
  Response: { success: true, new_epoch }

GET /groups/{groupId}/key-deliveries
  Response: { deliveries: [{epoch, encrypted_group_key}] }

POST /groups/{groupId}/messages/send
  Request: {
    group_id,
    epoch,
    ciphertext,
    iv,
    timestamp
  }
  Response: { messageId, delivered }
```

### Frontend (React)

**Новые утилиты:**

```ts
// lib/crypto/e2ee.ts

// Для 1:1 чатов
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

// Для групповых чатов
export async function createGroup(
  memberHandles: string[],
  myPreKeys: PreKeys
): Promise<{ groupId: string; epoch: number }> {
  // 1. Генерировать GK
  // 2. Для каждого участника выполнить X3DH
  // 3. Зашифровать GK под результатом X3DH
  // 4. Отправить на сервер
}

export async function joinGroup(
  groupId: string,
  deliveries: GroupKeyDelivery[],
  myHandleId: string
): Promise<void> {
  // 1. Найти delivery для своего handleId
  // 2. Расшифровать GK через X3DH
  // 3. Сохранить GK в IndexedDB
}

export async function encryptGroupMessage(
  groupKey: Uint8Array,
  message: string
): Promise<{ ciphertext: string; iv: string }> {
  // Прямое AES-256-GCM шифрование под GK
}

export async function decryptGroupMessage(
  groupKey: Uint8Array,
  ciphertext: string,
  iv: string
): Promise<string> {
  // Прямое AES-256-GCM расшифрование под GK
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

### Этап 4: Per-Message Key Derivation (1:1 чаты)
- [ ] Инициализация CK из X3DH result
- [ ] Per-message key derivation: `HKDF(CK, salt=message_number, info="BeChat.MessageKey.v1")`
- [ ] AES-256-GCM шифрование/расшифровка сообщения
- [ ] Сохранение CK и message_number counter в IndexedDB (`chat_keys`)

### Этап 5: Интеграция с messaging (1:1)
- [ ] Modify `handleSendMessage()` в MessagesGateway
- [ ] Modify `handleIncomingMessage()` для расшифровки
- [ ] Обновить IndexedDB структуру для сообщений
- [ ] Миграции БД

### Этап 4.5: Групповые чаты
- [ ] Реализовать модель групп (создание, вход, выход)
- [ ] Реализовать доставку GK через X3DH
- [ ] Реализовать ротацию GK при изменении состава
- [ ] Обновить UI для групп (добавление участников, управление)
- [ ] Реализовать шифрование/расшифровку групповых сообщений

### Этап 6: UX и управление ключами
- [ ] UI для выбора режима (Cloud vs Self-Custody)
- [ ] Backup/recovery интерфейс
- [ ] Управление pre-keys (истечение, пополнение)
- [ ] Уведомления о необходимости ввода seed (просрочка)

### Этап 7: Тестирование и аудит
- [ ] Unit-тесты для X3DH
- [ ] Unit-тесты для Per-Message Key Derivation
- [ ] Unit-тесты для Group Key Exchange
- [ ] Unit-тесты для seed recovery (Cloud и Self-Custody)
- [ ] Интеграционные тесты: end-to-end сообщение (1:1 и группа)
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
│  • Можно создавать новые 1:1 чаты и групповые чаты        │
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

## 11. Диаграмма жизненного цикла группового чата

```
┌─────────────────────────────────────────────────────────────┐
│                    СОЗДАНИЕ ГРУППЫ                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Инициатор генерирует Group Key (GK)                    │
│  2. Для каждого участника:                                 │
│     - Выполняет X3DH handshake                             │
│     - Шифрует GK под результатом X3DH                      │
│  3. Отправляет зашифрованные GK на сервер                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   УЧАСТИЕ В ГРУППЕ                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  • Получает уведомление о новом сообщении                  │
│  • Загружает GK из IndexedDB                               │
│  • Расшифровывает сообщение под GK                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   ВХОД НОВОГО УЧАСТНИКА                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Любой участник генерирует НОВЫЙ GK                     │
│  2. Рассылает его через X3DH всем (включая нового)         │
│  3. Старый GK удаляется → вышедшие не могут читать         │
│  4. Epoch увеличивается                                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Сравнение режимов (финальный)

| Параметр | Cloud Recovery | Self-Custody (ленивая активация) |
|---------|----------------|-----------------------------------|
| **Регистрация** | Пароль | Seed-фраза (записать) |
| **Хранение seed** | Зашифрован в S3 | Нигде (голова) |
| **UX при логине** | Ввод пароля | Ввод seed (или нет, если <30 дней) |
| **UX при новом чате (1:1)** | Ничего | **Ничего!** (pre-keys в IndexedDB) |
| **UX при новой группе** | Ничего | **Ничего!** (pre-keys в IndexedDB) |
| **Максимум в группе** | 100 участников | 100 участников |
| **Нет истории для новых** | Да | Да |
| **Потеря устройства** | Восстановление по паролю | Восстановление по seed |
| **Безопасность** | ⭐⭐⭐⭐⭐ (Очень высокая) | ⭐⭐⭐⭐⭐ (Очень высокая) |
| **Удобство** | ⭐⭐⭐⭐⭐ (Отличная UX) | ⭐⭐⭐⭐⭐ (Отличная UX благодаря ленивой активации) |

> **Оба режима теперь поддерживают все типы чатов с отличным UX!**

---

## 13. Открытые вопросы для обсуждения

- [ ] Какую криптографическую библиотеку использовать? (`TweetNaCl.js`, `libsodium.js`, Web Crypto API + `noble/*`)
- [ ] Нужны ли read receipts? Зашифровывать ли их?
- [ ] Как обновлять pre-keys при падении count ниже 50? (trigger на клиенте или сервере?)
- [ ] Как восстанавливать при потере IndexedDB в mid-session? (перезагрузить чат?)
- [ ] Какую максимальную группу поддерживать? (50? 100?)
- [ ] Нужны ли модераторы в группах или любой участник может добавлять?
- [ ] Как обрабатывать offline-участников при ротации GK?
- [ ] Нужна ли поддержка групповых read receipts?

---

**Версия:** 3.0  
**Дата:** 2026-02-17  
**Статус:** Готово к реализации  
**Охват:** 1:1 чаты + Групповые чаты с X3DH-доставкой группового ключа
