# 📄 Техническое задание: Система доставки сообщений для офлайн-получателей

**Статус:** v2.0 - Updated для Practical E2EE Model  
**Интеграция:** АРХИТЕКТУРА*E2EE*МЕССЕНДЖЕР.md

## 1. Цель

Реализовать механизм **буферизации и доставки сообщений офлайн-получателям** с использованием Redis:

- Гарантированная доставка в течение **7 дней**
- Поддержка офлайн-отправителей (они не участвуют в повторной отправке)
- Маршрутизация по `handleId` (чат привязан к конкретному handle'у)
- **Минимизация утечки метаданных** (только messageId, timestamp, contentHash на сервере)
- Простая и надёжная архитектура

---

## 2. Архитектурные принципы

### 2.1 Модель безопасности и идентификации

- **Один приватный ключ PK** на всех устройствах пользователя (восстанавливается при каждом логине)
- **hPK = hash(PK)** — хранится в памяти сессии, используется как локальный секрет
- **PbK (публичный ключ)** — глобальный идентификатор, хранится в БД
- **Handle (H)** — человекочитаемый псевдоним, может быть несколько на один аккаунт
  - Каждый handle имеет уникальный `handleId` (UUID)
  - Handle не меняется при переименовании (меняется только отображаемое имя)
  - Один чат = один handle → переключение между чатами = переключение между handles

### 2.2 Маршрутизация по Handle (activeHandleId)

- Чаты привязаны к **конкретному handle'у** (`chat_members.memberHandleId`)
- Сообщения доставляются **по handleId получателя** (в контексте сессии это `activeHandleId`)
- Сервер маршрутизирует сообщения на все активные сессии пользователя, где `activeHandleId = toHandleId`
- Это позволяет одному пользователю иметь несколько анонимных личностей в разных чатах
- Онлайн-статус хранится по `handleId`: `online:{handleId}` содержит активные сессии с этим handle'ом

### 2.3 Офлайн-сценарий

- Когда получатель офлайн, сообщение сохраняется в Redis (индексировано по `handleId`)
- При входе получателя онлайн, сообщение извлекается и доставляется
- Переписка хранится **только на устройствах участников** (не восстанавливается в истории)

---

## 3. Основные компоненты

| Компонент                      | Роль                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Redis**                      | Временное хранилище зашифрованных сообщений по `handleId` получателя (`TTL = 7 дней`) + presence (онлайн/офлайн статус по handle)     |
| **PostgreSQL**                 | Хранение метаданных сообщений (без тела): `message_id`, `from_handle`, `to_handle`, `chatId`, `timestamp`, `delivered`, `expires_at`  |
| **MessagesGateway (NestJS)**   | Проверяет статус получателя по `handleId`, сохраняет в Redis при офлайн, отправляет онлайн-получателям всем сессиям с этим `handleId` |
| **Клиент (React + IndexedDB)** | Запрашивает недоставленные сообщения при входе, расшифровывает, сохраняет локально                                                    |

---

## 4. Требования к функциональности

### 4.1 Отправка сообщения (`POST /send`)

**Request:**

```json
{
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "chatId": "chat-uuid",
  "toHandleId": "handle-uuid-recipient",
  "encryptedPayload": "base64_encrypted_data",
  "timestamp": 1706400000000
}
```

**Обработка сервером:**

1. Валидировать JWT из cookie (аутентификация из `sessionId`)
2. Проверить формат `messageId`, `toHandleId`, `chatId`, `encryptedPayload`
3. Запросить в Redis: `EXISTS online:{toHandleId}` (проверить, есть ли активные сессии с этим handle'ом)
4. **Если получатель онлайн:**
   - Найти все активные WebSocket сессии из Redis, где `activeHandleId = toHandleId`
   - Отправить сообщение всем найденным сессиям (JSON с `messageId`, `chatId`, `fromHandleId`, `encryptedPayload`, `timestamp`)
   - Записать метаданные в PostgreSQL: `delivered = true`
5. **Если получатель офлайн:**
   - Сохранить в Redis:
     ```bash
     LPUSH pending_msgs:{toHandleId} "{messageId, chatId, fromHandleId, encryptedPayload, timestamp}"
     EXPIRE pending_msgs:{toHandleId} 604800  # 7 дней
     ```
   - Записать метаданные: `delivered = false`, `expires_at = now() + 7d`
6. **Rate-limiting:** максимум 10 сообщений/мин на один `toHandleId` в чате
7. Вернуть `{ success: true, messageId, delivered: boolean }`

**Response:**

```json
{
  "success": true,
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "delivered": true
}
```

---

### 4.2 Синхронизация при входе (`GET /sync`)

**Когда вызывается:**

- При первом подключении WebSocket (после аутентификации)
- При явной синхронизации (на случай потери соединения)
- Автоматически при переключении между handles

**Request:**

```json
{
  "activeHandleId": "handle-uuid"
}
```

**Обработка сервером:**

1. Валидировать JWT (аутентификация из `sessionId`)
2. Извлечь `activeHandleId` из сессии (текущий активный handle пользователя)
3. Запросить Redis: `LRANGE pending_msgs:{activeHandleId} 0 -1` (получить все оффлайн-сообщения для этого handle'а)
4. Если есть сообщения:
   - Вернуть массив сообщений клиенту
   - Обновить в PostgreSQL: `delivered = true` для всех сообщений
   - Удалить из Redis: `DEL pending_msgs:{activeHandleId}`
5. Вернуть пустой массив, если ничего нет

**Response:**

```json
{
  "success": true,
  "messages": [
    {
      "messageId": "uuid",
      "chatId": "chat-uuid",
      "fromHandleId": "handle-uuid",
      "encryptedPayload": "...",
      "timestamp": 1706400000000
    }
  ]
}
```

**Клиент:**

1. Получает список сообщений для текущего `activeHandleId`
2. Расшифровывает каждое (используя локальный `hPK`)
3. Сохраняет в локальное IndexedDB (с группировкой по чатам)
4. Обновляет UI для каждого чата

---

### 4.3 Статус онлайн (Presence)

**При подключении WebSocket:**

- Добавить сессию в Redis: `SADD online:{activeHandleId} {sessionId}` (добавить сессию в множество активных сессий с этим handle'ом)
- Установить TTL: `EXPIRE online:{activeHandleId} 3600` (1 час)
- При каждом heartbeat обновлять TTL
- Маппинг сессии: `session:{sessionId} → {activeHandleId}:{socket_id}` (для получения socket_id по sessionId)

**При отключении WebSocket:**

- Удалить сессию: `SREM online:{activeHandleId} {sessionId}`
- Удалить маппинг: `DEL session:{sessionId}`

**Проверка статуса и маршрутизация:**

- Перед отправкой сообщения на `toHandleId`: `EXISTS online:{toHandleId}` (есть ли хотя бы одна активная сессия)
- Получить все активные сессии: `SMEMBERS online:{toHandleId}` (вернёт список sessionId)
- Для каждого sessionId получить socket_id из маппинга: `GET session:{sessionId}`

---

## 5. Требования к данным

### 5.1 Метаданные в PostgreSQL (`message_delivery` таблица)

```sql
-- Таблица для offline доставки (дополнение к message_index)
CREATE TABLE message_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  messageId UUID NOT NULL UNIQUE,
  toHandleId UUID NOT NULL,
  delivered BOOLEAN DEFAULT false,
  expiresAt TIMESTAMPTZ NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT FK_message FOREIGN KEY (messageId) REFERENCES message_index(messageId),
  CONSTRAINT FK_to_handle FOREIGN KEY (toHandleId) REFERENCES handles(id),

  INDEX (toHandleId, createdAt),
  INDEX (expiresAt)
);

-- ПРИМЕЧАНИЕ: chat_id и from_handle_id уже есть в message_index
-- Server НЕ нужно дублировать их в message_delivery
```

### 5.2 Формат в Redis

**Ключ:** `pending_msgs:{toHandleId}`  
**Тип:** `LIST`

**Элемент (JSON-строка):**

```json
{
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "chatId": "chat-uuid",
  "fromHandleId": "handle-uuid",
  "encryptedPayload": "base64_encrypted",
  "timestamp": 1706400000000
}
```

**Ключ присутствия:** `online:{activeHandleId}`  
**Тип:** `SET` (множество sessionId, привязанных к этому handle'у)  
**Элемент:** `sessionId` (уникальный идентификатор сессии)  
**TTL:** 3600 секунд (1 час)

**Маппинг сессии:** `session:{sessionId}`  
**Тип:** `STRING` (значение = `{activeHandleId}:{socket_id}`)  
**TTL:** 3600 секунд (1 час)

---

## 6. Требования к безопасности

- ✅ **Аутентификация:** Все запросы требуют валидного JWT в cookie с `sessionId`
- ✅ **Анонимность:** Идентификация через `handleId`, не user ID или personal data
- ✅ **Локальный секрет hPK:** Клиент расшифровывает сообщения локально, используя `hPK = hash(PK)` в памяти
- ✅ **Rate-limiting:** Максимум 10 сообщений/мин на адресата в чате
- ✅ **Защита от спама:** Максимум 100 сообщений в очереди Redis на один `handleId`
- ✅ **Нет логирования содержимого:** Логировать только `message_id`, `handleId`, статусы, события
- ✅ **TTL для Redis:** Ровно 7 дней, затем автоматическое удаление
- ✅ **Маршрутизация по handle:** Сообщения доставляются только участникам чата с соответствующим `handleId`

---

## 7. Нефункциональные требования

| Требование                   | Значение                              |
| ---------------------------- | ------------------------------------- |
| TTL сообщений в Redis        | 7 дней (604800 сек)                   |
| Максимум сообщений в очереди | 100 на адресата                       |
| Rate-limit                   | 10 сообщений/мин на адресата          |
| Timeout WebSocket            | 30 сек неактивности = переподключение |
| Heartbeat интервал           | 30 сек                                |

---

## 8. Интеграция с текущей архитектурой

### Backend (NestJS)

**Расширить `MessagesGateway`:**

```ts
- async storePendingMessage(toPubkeyHash, message): Promise<void>
- async fetchAndClearPendingMessages(pubkeyHash): Promise<Message[]>
- async checkOnlineStatus(pubkeyHash): Promise<boolean>
- async setPresence(pubkeyHash, socketId): Promise<void>
- async clearPresence(pubkeyHash): Promise<void>
```

**Новые эндпоинты:**

```ts
POST /send           # Отправить сообщение
GET /sync            # Получить недоставленные сообщения
```

**Новая сущность:**

```ts
@Entity('message_delivery')
export class MessageDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  messageId: string;

  @Column('uuid')
  toHandleId: string;

  @Column('boolean', { default: false })
  delivered: boolean;

  @Column('timestamptz')
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => MessageIndex)
  message: MessageIndex;

  @ManyToOne(() => Handle)
  toHandle: Handle;
}
```

### Frontend (React)

**Новые методы:**

```ts
// services/message-delivery.service.ts
export class MessageDeliveryService {
  static async fetchPendingMessages(pubkeyHash: string): Promise<Message[]> {
    const res = await fetch(`${API_BASE}/sync`, {
      method: 'GET',
      credentials: 'include',
    });
    return res.json();
  }

  static async sendMessage(
    toPubkeyHash: string,
    encryptedPayload: string,
    messageId: string
  ): Promise<{ delivered: boolean }> {
    const res = await fetch(`${API_BASE}/send`, {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ messageId, toPubkeyHash, encryptedPayload }),
    });
    return res.json();
  }
}
```

---

## 9. Диаграмма взаимодействия

```
Сценарий: Офлайн-получатель
═════════════════════════════

[User 1 Device A]              [Server (Redis + PgSQL)]       [User 2 Device B]
        │                              │                             │
        ├─ POST /send ─────────────>   │                             │
        │  (toHandleId, encrypted)     │                             │
        │                              ├─ check online:{toHandleId}  │
        │                              │  (NOT EXISTS in Redis)       │
        │                              │  → получатель офлайн        │
        │                              │                             │
        │                              ├─ LPUSH pending_msgs:{toHandleId}
        │                              │  INSERT into message_delivery│
        │                          delivered=false                    │
        │<─ { delivered: false } ──    │                             │
        │                              │                             │
        │                              │  [7 дней в Redis]           │
        │                              │                             │
        │                              │              [User 2 открывает приложение]
        │                              │                             │
        │                              │  <─ GET /sync ──────────────┤
        │                              │     activeHandleId          │
        │                              ├─ LRANGE pending_msgs:{activeHandleId}
        │                              ├─ UPDATE delivered=true      │
        │                              ├─ DEL pending_msgs:{activeHandleId}
        │                              │                             │
        │                              │  [messages] ───────────────>│
        │                              │                             │
        │                              │                       [сохранить в IndexedDB]
```

---

## 10. Этапы реализации

### Этап 1: Инфраструктура

- [ ] Создать миграцию для `message_delivery` таблицы
- [ ] Создать сущность `MessageDelivery` и репозиторий
- [ ] Расширить `RedisService` методами для очередей

### Этап 2: Backend-логика

- [ ] Реализовать `storePendingMessage()` в MessagesGateway
- [ ] Реализовать `fetchAndClearPendingMessages()` в MessagesGateway
- [ ] Добавить эндпоинт `POST /send`
- [ ] Добавить эндпоинт `GET /sync`

### Этап 3: Presence (статус онлайн)

- [ ] При подключении WebSocket: `setPresence(pubkeyHash, socketId)`
- [ ] При отключении WebSocket: `clearPresence(pubkeyHash)`
- [ ] Heartbeat для обновления TTL

### Этап 4: Фронтенд

- [ ] Вызывать `/sync` при инициализации приложения
- [ ] Сохранять полученные сообщения в IndexedDB
- [ ] Отправлять сообщения через `/send`

### Этап 5: Тестирование

- [ ] Интеграционные тесты: отправка онлайн-получателю
- [ ] Интеграционные тесты: сохранение для офлайн-получателя
- [ ] Интеграционные тесты: синхронизация при входе
- [ ] Load-тесты

### Этап 6: Мониторинг

- [ ] Алерты на переполнение очереди Redis
- [ ] Метрики на доставку сообщений
- [ ] Логирование только метаданных

---

## 11. Открытые вопросы

- [ ] Как клиент узнаёт свой `pubkeyHash` при входе? (Должен быть в JWT в claim?)
- [ ] Нужны ли retry-механизмы, если сохранение в Redis не удалось?
- [ ] Требуется ли подтверждение доставки (ACK) от клиента?

# 📎 ДОПОЛНЕНИЕ v2.1: Интеграция с CryptoKey-архитектурой

**Дата**: Февраль 2026  
**Статус**: ✅ Дополнение к основному ТЗ v2.0  
**Применимость**: Все разделы, где упоминается шифрование, ключи или `pubkeyHash`

---

## 🔧 Терминология: замена идентификаторов

| Было в ТЗ v2.0       | Стало (актуально)                            | Контекст использования                          |
| -------------------- | -------------------------------------------- | ----------------------------------------------- |
| `pubkeyHash` / `hPK` | `handleId`                                   | Маршрутизация сообщений, деривация ключей, UI   |
| `pubkeyHash`         | `identityId`                                 | Изоляция БД, хранение CryptoKey, аутентификация |
| `hPK в RAM`          | `CryptoKey (extractable: false) в IndexedDB` | Управление ключами шифрования                   |
| `toPubkeyHash`       | `toHandleId`                                 | Payload WebSocket, Redis-ключи, API             |

**Пример обновления payload**:

```json
// Было:
{
  "toPubkeyHash": "abc123...",
  "encryptedPayload": "..."
}

// Стало:
{
  "toHandleId": "uuid-handle-recipient",
  "encryptedPayload": "..."
}
```

---

## 🔐 Управление ключами: CryptoKey-архитектура

### Что изменилось в модели безопасности

```
[Старая модель v2.0]
приватный ключ → hash(PK) → hPK в RAM сессии
                                   ↓
                         Используется для деривации ключей

[Новая модель v2.1 ✅]
приватный ключ → hash(PK) → importKey(extractable: false) → CryptoKey
                                   ↓
                storeEncryptionKey(identityId, key) → IndexedDB
                                   ↓
            При шифровании: getBaseKey(identityId) → RAM-кэш → IndexedDB fallback
```

### Преимущества новой модели

| Преимущество               | Объяснение                                                         |
| -------------------------- | ------------------------------------------------------------------ |
| **Защита от XSS**          | `extractable: false` — ключ нельзя экспортировать через JavaScript |
| **Устойчивость к рефрешу** | Ключ хранится в IndexedDB, загружается автоматически после F5      |
| **Изоляция устройств**     | Каждое устройство деривирует свой CryptoKey независимо             |
| **Zero-knowledge**         | Сервер не участвует в управлении ключами, не видит plaintext       |

### Обновлённый поток работы с ключом

```
[Логин / Восстановление аккаунта]
  ↓
deriveKeyPairFromSeed(seed) → hashPrivateKey() → importKey(extractable: false)
  ↓
StorageService.storeEncryptionKey(identityId, baseKey)
  ↓
setSessionCryptoKey(baseKey) [RAM-кэш для производительности]
  ↓
[Отправка / Получение сообщения]
  ↓
getBaseKey(identityId): RAM → IndexedDB fallback
  ↓
deriveEncryptionKeyFromHash(baseKey, handleId, purpose) → AES-GCM ключ
  ↓
Шифрование / Расшифровка
  ↓
[Logout]
  ↓
StorageService.deleteEncryptionKey(identityId) + clearSessionCryptoKey()
```

---

## 🗄️ Интеграция с StorageService

### Явная передача `identityId`

Все криптографические операции теперь требуют явной передачи `identityId` из React-контекста:

```typescript
// Сохранение сообщения (офлайн или онлайн)
await StorageService.saveEncryptedMessage(
  chatId,
  senderHandleId,
  encryptedContent,
  recipientHandleId, // handleId для деривации ключа
  isOwn,
  messageId,
  identityId // ← Обязательный параметр для загрузки CryptoKey
);

// Загрузка офлайн-сообщений при синхронизации
const messages = await StorageService.loadDecryptedMessages(
  chatId,
  userHandleId,
  identityId // ← Обязательный параметр
);
```

### Вспомогательный метод `getBaseKey`

```typescript
// Внутри StorageService (приватный метод)
private static async getBaseKey(identityId: string): Promise<CryptoKey> {
  // 1. Try RAM cache first (fastest)
  const ramKey = getSessionCryptoKey();
  if (ramKey) return ramKey;

  // 2. Fallback: load from IndexedDB (after page refresh)
  const dbKey = await StorageService.loadEncryptionKey(identityId);
  if (dbKey) {
    setSessionCryptoKey(dbKey); // Cache for subsequent calls
    return dbKey;
  }

  // 3. Key not found — user needs to restore access
  throw new Error('Encryption key not available. Please restore access to enable encryption.');
}
```

---

## 🔄 Обновления по разделам ТЗ

### Раздел 4.1: Отправка сообщения (`POST /send`)

**Дополнение к обработке сервером**:

```typescript
// Шаг 4/5: При сохранении в Redis или отправке онлайн
// Клиентская часть должна передать identityId для шифрования:

await StorageService.saveEncryptedMessage(
  chatId,
  user.handle.id, // sender handleId
  encryptedPayload, // уже зашифрованный контент
  toHandleId, // recipient handleId для деривации
  true, // isOwn
  messageId,
  user.identity.id // ← identityId для загрузки CryptoKey
);
```

**Важно**: `encryptedPayload` должен быть зашифрован **до** отправки на сервер, с использованием ключа, деривированного через `deriveEncryptionKeyFromHash(baseKey, handleId, 'message')`.

---

### Раздел 4.2: Синхронизация при входе (`GET /sync`)

**Дополнение к клиентской обработке**:

```typescript
// При получении офлайн-сообщений:
for (const msg of response.messages) {
  // Расшифровка с явным identityId
  const decrypted = await StorageService.loadDecryptedMessages(
    msg.chatId,
    user.handle.id,
    user.identity.id // ← Обязательный параметр
  );

  // Сохранение в IndexedDB (уже выполняется внутри loadDecryptedMessages)
  // Обновление UI
}
```

**Обработка отсутствия ключа**:

```typescript
try {
  await StorageService.loadDecryptedMessages(...);
} catch (error) {
  if (error.message.includes('Encryption key not available')) {
    // Показать модалку восстановления доступа
    showKeyRecoveryModal({
      onRestore: async (passwordOrSeed) => {
        // Деривация ключа → сохранение в IndexedDB → повтор попытки
        await restoreEncryptionKey(passwordOrSeed, user.identity.id);
        // Повторить загрузку сообщений
      }
    });
  }
}
```

---

### Раздел 4.3: Статус онлайн (Presence)

**Дополнение**: При подключении WebSocket, после установки presence в Redis, клиент должен загрузить CryptoKey:

```typescript
// После успешного подключения к WebSocket:
socket.on('connect', async () => {
  // Загрузить CryptoKey для шифрования
  const baseKey = await StorageService.loadEncryptionKey(user.identity.id);
  if (baseKey) {
    setSessionCryptoKey(baseKey);
  } else {
    // Key not found — expected on first login from new device
    // Пользователь сможет получать сообщения, но не сможет отправлять
    // до восстановления доступа
  }
});
```

---

### Раздел 5.2: Формат в Redis

**Дополнение к элементу очереди**:

```json
{
  "messageId": "uuid",
  "chatId": "chat-uuid",
  "fromHandleId": "handle-uuid",
  "encryptedPayload": "base64_encrypted", // ← Зашифрован на клиенте с handleId-derived key
  "timestamp": 1706400000000,
  "contentHash": "sha256_of_encrypted_payload" // ← Для дедупликации (опционально)
}
```

**Важно**: `encryptedPayload` должен быть зашифрован **на клиенте** до отправки на сервер. Сервер хранит только зашифрованные данные, не имеет доступа к ключам расшифровки.

---

### Раздел 6: Требования к безопасности (дополнение)

```markdown
- ✅ **Управление ключами**: CryptoKey с `extractable: false` — XSS не может экспортировать ключ, только использовать для крипто-операций
- ✅ **Хранение ключей**: CryptoKey хранится в IndexedDB, привязан к `identityId`, загружается при необходимости через `getBaseKey(identityId)`
- ✅ **Изоляция устройств**: Ключи не синхронизируются между устройствами — компрометация одного не раскрывает другие
- ✅ **Явная передача identityId**: Компоненты React передают `identityId` в сервисы явно, без чтения из localStorage
- ✅ **Восстановление доступа**: При отсутствии CryptoKey в IndexedDB пользователь должен восстановить доступ через ввод пароля/seed
- ✅ **Очистка при logout**: `StorageService.deleteEncryptionKey(identityId)` + `clearSessionCryptoKey()` удаляют ключи из хранилища и RAM
```

---

### Раздел 8: Интеграция с текущей архитектурой (дополнение)

**Backend (NestJS) — обновление DTO**:

```typescript
// Было:
export class SendMessageDto {
  toPubkeyHash: string; // ← Устарело
}

// Стало:
export class SendMessageDto {
  toHandleId: string; // ← handleId получателя (из chat_members)
  fromHandleId: string; // ← handleId отправителя
  encryptedPayload: string; // ← Зашифрован на клиенте
  messageId: string;
  chatId: string;
  timestamp: number;
}
```

**Frontend (React) — обновление сервиса**:

```typescript
// services/message-delivery.service.ts
export class MessageDeliveryService {
  static async sendMessage(
    toHandleId: string, // ← Changed from toPubkeyHash
    fromHandleId: string, // ← Новый параметр
    encryptedPayload: string,
    messageId: string,
    chatId: string,
    identityId: string // ← Обязательный параметр для шифрования
  ): Promise<{ delivered: boolean }> {
    // Шифрование (если ещё не зашифровано)
    // const encryptedPayload = await encryptWithHandleKey(content, fromHandleId, identityId);

    const res = await fetch(`${API_BASE}/send`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        toHandleId, // ← Updated
        fromHandleId, // ← Added
        encryptedPayload,
        chatId,
        timestamp: Date.now(),
      }),
    });
    return res.json();
  }
}
```

---

## 🧩 Деривация ключей для офлайн-сообщений

### Принцип независимой деривации

Каждое устройство пользователя независимо деривирует ключи для шифрования:

```
[Устройство A]                          [Устройство B]
     │                                        │
     ├─ Логин с seed/password                 ├─ Логин с seed/password
     ├─ deriveKeyPairFromSeed(seed)           ├─ deriveKeyPairFromSeed(seed)
     ├─ hashPrivateKey() → privateKeyHash     ├─ hashPrivateKey() → privateKeyHash
     ├─ importKey(extractable: false)         ├─ importKey(extractable: false)
     ├─ storeEncryptionKey(identityId, key)   ├─ storeEncryptionKey(identityId, key)
     │                                        │
     └─ CryptoKey в IndexedDB                 └─ CryptoKey в IndexedDB
```

### Шифрование офлайн-сообщения

```typescript
async function encryptMessageForDelivery(
  content: string,
  recipientHandleId: string,
  identityId: string
): Promise<string> {
  // 1. Получить базовый ключ
  const baseKey = await StorageService.getBaseKey(identityId);

  // 2. Деривировать контекстный ключ
  const encryptionKey = await deriveEncryptionKeyFromHash(
    baseKey,
    recipientHandleId, // handleId как соль для уникальности
    'message' // purpose для разделения ключей
  );

  // 3. Зашифровать контент
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    new TextEncoder().encode(content)
  );

  // 4. Вернуть base64 для отправки
  return uint8ToBase64(new Uint8Array(encrypted));
}
```

---

## 🗓️ Обновление этапов реализации

### Этап 0 (новый, предварительный): Интеграция CryptoKey-архитектуры

**Цель**: Обеспечить совместимость системы доставки с новой архитектурой ключей.

- [ ] Обновить `StorageService` для приёма `identityId` как обязательного параметра
- [ ] Реализовать методы управления CryptoKey: `store/load/deleteEncryptionKey`
- [ ] Обновить `deriveEncryptionKeyFromHash()` для приёма `CryptoKey` вместо `Uint8Array`
- [ ] Обновить все вызовы крипто-функций в компонентах: передавать `user.identity.id` явно
- [ ] Протестировать базовый flow: логин → CryptoKey сохранён → рефреш → шифрование работает

**Критерий готовности**: Отправка/получение сообщения работает после рефреша без ошибок `Identity ID not available`.

### Этап 1-6 (существующие) — дополнения:

| Этап                       | Дополнение                                                                        |
| -------------------------- | --------------------------------------------------------------------------------- |
| **Этап 2: Backend-логика** | Обновить DTO: `toPubkeyHash` → `toHandleId`, добавить `fromHandleId`              |
| **Этап 4: Фронтенд**       | Интегрировать явную передачу `identityId` в `MessageDeliveryService`              |
| **Этап 5: Тестирование**   | Добавить security-тест: попытка `exportKey()` на CryptoKey → `InvalidAccessError` |
| **Этап 6: Мониторинг**     | Добавить метрику: `crypto_key_not_found` при попытке шифрования без ключа         |

---

## ❓ Обновление открытых вопросов

| Вопрос                                                              | Статус    | Решение / Комментарий                                                                            |
| ------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| Как клиент узнаёт свой `pubkeyHash` при входе?                      | ✅ Решено | Использовать `handleId` из `user.handle.id` (React-контекст), не из JWT                          |
| Нужны ли retry-механизмы, если сохранение в Redis не удалось?       | ⏳ Открыт | Рекомендация: логировать ошибку, возвращать `delivered: false`, клиент может повторить отправку  |
| Требуется ли подтверждение доставки (ACK) от клиента?               | ⏳ Открыт | Для E2EE: ACK не раскрывает содержимое, можно добавить опционально для метрик                    |
| **Новый**: Как обрабатывать отсутствие CryptoKey при синхронизации? | ⏳ Открыт | Вариант A: показать модалку восстановления; Вариант B: разрешить только чтение до восстановления |

---

## ✅ Чек-лист совместимости

Перед началом реализации убедитесь, что:

- [ ] `StorageService` принимает `identityId` как обязательный параметр в методах шифрования
- [ ] Все вызовы крипто-функций передают `identityId` явно из React-контекста
- [ ] CryptoKey импортируется с `extractable: false` и сохраняется в IndexedDB
- [ ] При logout ключи удаляются из IndexedDB и RAM
- [ ] Терминология обновлена: `pubkeyHash` → `handleId` / `identityId`
- [ ] Payload'ы WebSocket и API используют `handleId` для маршрутизации
- [ ] Обработана ситуация отсутствия CryptoKey (модалка восстановления)

---

> 📄 **История версий дополнения**  
> **v2.1** (Февраль 2026): Интеграция с CryptoKey-архитектурой, замена терминологии, явная передача `identityId`, защита от XSS через `extractable: false`.  
> **Применяется к**: ТЗ "Система доставки сообщений для офлайн-получателей" v2.0

> 🗑️ **Статус**: Готов к вставке в конец основного документа. Все изменения аддитивны, не ломают существующую логику.
