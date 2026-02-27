Конечно! Ниже — **полностью обновлённое техническое задание**, включающее поддержку **групповых зашифрованных чатов** без отказа от философии эфемерного PK и ленивой активации seed.

---

# 📄 Техническое задание: End-to-End Encryption System с Lazy Seed Activation и Поддержкой Групповых Чатов

## 1. Цель

Реализовать **полностью зашифрованный E2EE мессенджер** с использованием modern криптографии:

- **Нулевое знание сервера** о содержимом сообщений
- **Два режима регистрации:**
  1. Cloud Recovery (seed зашифрован под паролем в S3)
  2. Self-Custody (seed только в голове, с ленивой активацией)
- **X3DH (Triple Diffie-Hellman)** для доставки ключей
- **Простая per-message key derivation** для 1:1 чатов
- **Групповые чаты через X3DH-доставку группового ключа**
- **Отличный UX** в обоих режимах (без повторного ввода seed при каждом чате)

---

## 2. Модель безопасности

### 2.1 Криптографические материалы пользователя

_(Без изменений — остаётся как в оригинале)_

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
  - Входной параметр для HKDF при генерации ключей
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

_(Без изменений — остаётся как в оригинале)_

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

_(Без изменений в UX-таблицах, но с уточнением)_

### 3.3 Ленивая активация seed (Lazy Seed Activation)

**Обновление:**  
Ленивая активация работает **как для 1:1, так и для групповых чатов**.  
Pre-keys в IndexedDB позволяют участвовать в любых чатах без повторного ввода seed.

---

## 4. X3DH (Triple Diffie-Hellman) Protocol

_(Без изменений в базовой логике)_

**Новое применение:**  
X3DH используется:

- Для установки **Chat Key (CK)** в 1:1 чатах
- Для доставки **Group Key (GK)** в групповых чатах

---

## 5. Per-Message Key Derivation

### 5.1 Для 1:1 чатов (как в оригинале)

**Chat Key (CK) — один на весь чат:**

- Инициализируется один раз из X3DH shared secret
- Сохраняется в IndexedDB под ключом `hash(hPK + handleId + chatId)`
- Используется как root для derivation message keys

**Message Key (MK) — уникальный для каждого сообщения:**

- Генерируется: `MK = HKDF(CK, salt=message_number, info="BeChat.MessageKey.v1")`
- Используется для AES-256-GCM шифрования сообщения
- **Не сохраняется** в IndexedDB

### 5.2 Для групповых чатов (новое)

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
_(Без изменений)_

**Таблица: `chat_keys`**  
_(Обновлена)_

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

**Таблица: `group_keys`** _(НОВАЯ)_

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

**Таблица: `messages`** _(Обновлена)_

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

**Таблица: `groups`** _(НОВАЯ)_

```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY,
  creator_handle_id UUID NOT NULL REFERENCES handles(id),
  current_epoch INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Таблица: `group_members`** _(НОВАЯ)_

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

**Таблица: `group_key_deliveries`** _(НОВАЯ)_

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

_(Остальные таблицы без изменений)_

---

## 7. Требования к безопасности

_(Добавить пункт)_

- ✅ **Групповая безопасность:** GK ротируется при каждом изменении состава, обеспечивая forward secrecy для вышедших участников
- ✅ **Нет истории для новых:** Новые участники не получают доступ к прошлым сообщениям — защита от утечек

---

## 8. Интеграция с текущей архитектурой

### Backend (NestJS)

**Обновлённые сервисы:**

```ts
// crypto/x3dh.service.ts
export class X3DHService {
  // ... существующие методы
  async deliverGroupKey(
    groupId: string,
    senderHandleId: string,
    recipientHandleId: string,
    encryptedGroupKey: string
  ): Promise<void>;

  async getGroupKeyDeliveries(groupId: string, handleId: string): Promise<GroupKeyDelivery[]>;
}

// crypto/message-encryption.service.ts
export class MessageEncryptionService {
  // ... существующие методы для 1:1

  async encryptGroupMessage(
    groupKey: Uint8Array,
    plaintext: string
  ): Promise<{ ciphertext: string; iv: string }>;

  async decryptGroupMessage(groupKey: Uint8Array, ciphertext: string, iv: string): Promise<string>;
}
```

**Новые эндпоинты:**

```ts
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
```

### Frontend (React)

**Обновлённые утилиты:**

```ts
// lib/crypto/e2ee.ts
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
```

---

## 9. Этапы реализации (обновлённые)

### Этап 4.5: Групповые чаты

- [ ] Реализовать модель групп (создание, вход, выход)
- [ ] Реализовать доставку GK через X3DH
- [ ] Реализовать ротацию GK при изменении состава
- [ ] Обновить UI для групп (добавление участников, управление)
- [ ] Реализовать шифрование/расшифровку групповых сообщений

_(Остальные этапы без изменений)_

---

## 10. Диаграмма жизненного цикла группового чата

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

## 11. Сравнение режимов (финальный)

| Параметр                  | Cloud Recovery                         | Self-Custody (ленивая активация) |
| ------------------------- | -------------------------------------- | -------------------------------- |
| **1:1 чаты**              | Полная поддержка                       | Полная поддержка                 |
| **Групповые чаты**        | Полная поддержка                       | Полная поддержка                 |
| **UX при групповом чате** | Ничего                                 | Ничего                           |
| **Ограничения групп**     | ≤100 участников, нет истории для новых | То же                            |

> **Оба режима теперь поддерживают все типы чатов с отличным UX!**

---

## 12. Открытые вопросы для обсуждения

- [ ] Какую максимальную группу поддерживать? (50? 100?)
- [ ] Нужны ли модераторы в группах или любой участник может добавлять?
- [ ] Как обрабатывать offline-участников при ротации GK?
- [ ] Нужна ли поддержка групповых read receipts?

---

Это ТЗ теперь **полностью готово к реализации** и поддерживает как 1:1, так и групповые зашифрованные чаты, сохраняя вашу философию безопасности и UX.
