# 📄 Предусловия для интеграции E2EE при имплементации MESSAGE_DELIVERY_SYSTEM и MULTI_DEVICE_SYNC

## Обзор

При реализации системы доставки сообщений (MESSAGE_DELIVERY_SYSTEM.md) и синхронизации между устройствами (MULTI_DEVICE_SYNC.md) **необходимо зарезервировать место и подготовить инфраструктуру** для последующей интеграции End-to-End Encryption (E2EE_ENCRYPTION_SYSTEM.md).

Этот документ описывает **минимальные изменения на Этапах 1-2**, которые облегчат реализацию E2EE без переделки существующего кода.

---

## 1. Структура сообщений в Redis и БД

### Текущее состояние (MESSAGE_DELIVERY_SYSTEM.md)

```json
{
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "chatId": "chat-uuid",
  "fromHandleId": "handle-uuid",
  "encryptedPayload": "base64_encrypted_data",
  "timestamp": 1706400000000
}
```

### Что добавить для E2EE

✅ **Поле `encryptedPayload` уже есть** — хорошо.

⚠️ **Добавить поля:**

```json
{
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "chatId": "chat-uuid",
  "fromHandleId": "handle-uuid",
  "encryptedPayload": "base64_encrypted_data",
  "iv": "base64_initialization_vector",          // ← НОВОЕ
  "messageNumber": 1,                             // ← НОВОЕ (для Double Ratchet)
  "x3dhPayload": null,                            // ← НОВОЕ (только для message_number=0)
  "timestamp": 1706400000000
}
```

### Объяснение

- **`iv`** — Initialization Vector для AES-256-GCM. Требуется при расшифровке сообщения на клиенте.
- **`messageNumber`** — Счетчик сообщений в чате. Используется для per-message key derivation в Double Ratchet Algorithm. Стартует с `0` (X3DH init), потом `1, 2, 3...`
- **`x3dhPayload`** — Служебное поле только для `messageNumber = 0` (X3DH инициализация ключей). Обычные сообщения имеют `null`.

### Где менять

1. **Redis (`pending_msgs:{toHandleId}`)** — Добавить эти поля при сохранении
2. **PostgreSQL (`message_delivery` таблица)** — Добавить колонки (nullable на старте)
3. **WebSocket события** — Включить при отправке через `message:incoming`

---

## 2. Расширение таблицы message_delivery в PostgreSQL

### Текущая схема

```sql
CREATE TABLE message_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL UNIQUE,
  chat_id UUID NOT NULL,
  from_handle_id UUID NOT NULL,
  to_handle_id UUID NOT NULL,
  timestamp BIGINT NOT NULL,
  delivered BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT FK_chat FOREIGN KEY (chat_id) REFERENCES chats(id),
  CONSTRAINT FK_from_handle FOREIGN KEY (from_handle_id) REFERENCES handles(id),
  CONSTRAINT FK_to_handle FOREIGN KEY (to_handle_id) REFERENCES handles(id),
  
  INDEX (to_handle_id, created_at),
  INDEX (chat_id, created_at),
  INDEX (expires_at)
);
```

### Что добавить для E2EE

```sql
ALTER TABLE message_delivery ADD COLUMN (
  iv BYTEA,                              -- Initialization vector (nullable)
  message_number INTEGER,                -- Counter in chat (nullable)
  x3dh_ephemeral_key BYTEA,            -- X3DH ephemeral public key (nullable, only for message_number=0)
  
  INDEX (message_number, chat_id)       -- Для быстрого поиска по номеру сообщения
);
```

### Объяснение

- **`iv`** — IV для AES-256-GCM. Nullable потому что на старте может быть не заполнено.
- **`message_number`** — Счетчик сообщений. Уникален в контексте каждого чата.
- **`x3dh_ephemeral_key`** — Публичный ephemeral ключ отправителя (только для инициализации). На диске хранится как BYTEA (не plaintext).
- **Индекс** на `(message_number, chat_id)` для быстрого поиска конкретного сообщения в чате.

### Когда применять

- При миграции БД перед Этапом 3 E2EE
- Сейчас можно оставить и просто спланировать миграцию

---

## 3. hPK в Redis маппингах сессии

### Текущее состояние (MULTI_DEVICE_SYNC.md)

```
session:{sessionId} → STRING "{activeHandleId}:{socket_id}"
```

### Что добавить для E2EE

```
session:{sessionId} → STRING "{activeHandleId}:{socket_id}:{hPK_digest}"
```

**ИЛИ** отдельный ключ:

```
session_hpk:{sessionId} → STRING "{hPK_digest}"
```

### Объяснение

- **`hPK_digest`** — Хеш `hPK` (не сам `hPK`!). Хранится для логирования и аудита.
  - На сервере: `hPK_digest = SHA-256(hPK_from_jwt_claim)`
  - Используется для отслеживания, какой сессии принадлежит сообщение, без раскрытия содержимого.

### Зачем это нужно

При получении сообщения сервер будет логировать:
```
[message:incoming] messageId=123, chatId=abc, fromHandleId=xyz, hPK_digest=hash, timestamp=now
```

Это позволяет аудитору видеть поток сообщений без доступа к plaintext.

### Когда применять

- На Этапе 1 (подключение WebSocket): Добавить вычисление `hPK_digest` при `handleConnection()`
- Извлечь `hPK` из JWT claim (если будет добавлено)

### Текущий JWT claim

⚠️ **Вопрос:** Есть ли в JWT claim текущего приложения информация о публичном ключе или `hPK`?

Если нет — добавить в JWT при логине:
```ts
const token = jwt.sign({
  sessionId,
  identityId,
  activeHandleId,
  publicKey: user.publicKey,  // ← Добавить
  // Сервер вычислит: hPK_digest = SHA-256(publicKey)
}, secret);
```

---

## 4. Зарезервировать message_number = 0 для X3DH инициализации

### Текущее состояние

Нет упоминания о первом сообщении в чате.

### Что зарезервировать

- **`message_number = 0`** — X3DH initialization message (служебное, не пользовательское содержимое)
- **`message_number ≥ 1`** — Пользовательские сообщения

### Структура X3DH init message

```json
{
  "messageId": "...",
  "chatId": "...",
  "fromHandleId": "...",
  "messageNumber": 0,
  "type": "x3dh_init",
  "ephemeralKey": "base64_public_key",
  "usedOTK_index": 42,
  "x3dhPayload": "base64_encrypted_shared_secret",
  "timestamp": 1706400000000,
  "iv": null
}
```

### Объяснение

- **`messageNumber = 0`** зарезервирован для инициализации
- **`type = "x3dh_init"`** помечает это как служебное сообщение
- **`x3dhPayload`** содержит зашифрованный результат X3DH (для отправителя)
- **`usedOTK_index`** — индекс OTK, который был использован (для удаления на получателе)

### Где упомянуть

- В MESSAGE_DELIVERY_SYSTEM.md раздел 4 (Требования к функциональности)
- В MULTI_DEVICE_SYNC.md раздел 4.2 (Получение входящего сообщения)

### Когда применять

На Этап 3 E2EE (не на Этапе 1-2)

---

## 5. Структура chat_keys в IndexedDB (Frontend)

### Текущее состояние

В MESSAGE_DELIVERY_SYSTEM.md и MULTI_DEVICE_SYNC.md упоминается IndexedDB, но не структура для `chatKey`.

### Что добавить (при E2EE)

На фронтенде потребуется отдельная таблица IndexedDB:

```ts
// IndexedDB таблица: chat_keys
interface ChatKey {
  // Key: `${handleId}:${chatId}`
  handleId: string;
  chatId: string;
  
  // Derived from X3DH
  chatKey: Uint8Array;           // Base key for Double Ratchet
  messageNumber: number;          // Current counter
  
  // Double Ratchet state (если реализуется full DRA)
  dh_state?: {
    dh_send: Uint8Array;
    dh_recv: Uint8Array;
    ratchet_key: Uint8Array;
  };
  
  // Metadata
  created_at: number;
  last_used: number;
  x3dh_result?: {
    ephemeral_key: Uint8Array;
    used_otk_index: number;
  };
}
```

### Где это находится

- **На клиенте:** IndexedDB (браузер)
- **НЕ на сервере:** Сервер никогда не видит `chatKey`

### Важно

- `chatKey` шифруется под `hPK` перед сохранением в IndexedDB (защита от XSS)
- Загружается в память только при необходимости расшифровки
- Стирается из памяти после использования

### Когда планировать

- На Этапе 1: Оставить место в IndexedDB схеме
- На Этапе 3 (E2EE): Полная реализация

---

## 6. Логирование и аудит — не раскрывать криптографический материал

### Текущее состояние

В MESSAGE_DELIVERY_SYSTEM.md и MULTI_DEVICE_SYNC.md есть требование:
> ✅ **Нет логирования содержимого:** Логировать только `message_id`, `handleId`, статусы, события

### Что уточнить

**НИКОГДА не логировать:**
- Приватные ключи (`PK`, `SPK.sk`, `OTK.sk`)
- `hPK` (hash private key)
- `chatKey` (derived key)
- `encryptedPayload` содержимое (только `messageId`)
- `seed` (в любом виде)

**МОЖНО логировать:**
- `handleId`, `chatId`, `messageId` (идентификаторы)
- Публичные ключи (`PbK`, `SPK.pk`)
- `hPK_digest` (хеш от хеша, safe для аудита)
- `message_number` (счетчик)
- Статусы доставки: `delivered = true/false`
- Временные метки

### Пример логирования

```ts
// ✅ ХОРОШО
logger.info('message:incoming', {
  messageId: '550e8400-e29b-41d4-a716-446655440000',
  chatId: 'chat-uuid',
  fromHandleId: 'handle-uuid-1',
  toHandleId: 'handle-uuid-2',
  messageNumber: 5,
  delivered: true,
  hPK_digest: 'hash of hash of private key',  // safe
  timestamp: new Date()
});

// ❌ ПЛОХО
logger.info('message:incoming', {
  messageId: '...',
  encryptedPayload: '...',  // ← Don't log encrypted content
  hPK: '...',               // ← Don't log hPK
  privateKey: '...'         // ← Never!
});
```

### Где проверить

- Backend: MessagesGateway, RedisService логирование
- Frontend: DevTools (убедиться, что hPK не в console.log)

---

## 7. Обновление TTL session_prekeys при heartbeat

### Текущее состояние (MULTI_DEVICE_SYNC.md)

```bash
# При heartbeat
EXPIRE online:{activeHandleId} 3600
```

### Что добавить для E2EE

На **фронтенде** добавить проверку при heartbeat:

```ts
// Client-side heartbeat logic
function handleHeartbeat() {
  // Обновить Redis presence (как сейчас)
  socket.emit('heartbeat', { activeHandleId });
  
  // ← НОВОЕ: Проверить session_prekeys в IndexedDB
  const prekeys = await indexedDB.get('session_prekeys');
  
  if (prekeys && prekeys.expires_at) {
    const daysUntilExpire = 
      (prekeys.expires_at - Date.now()) / (24 * 3600 * 1000);
    
    if (daysUntilExpire < 5) {
      // Warn user: "Your session keys will expire in X days"
      showNotification('Please log in to refresh your session keys');
    }
  }
}
```

### Объяснение

- **`session_prekeys`** в IndexedDB имеет TTL ~30 дней
- За 5 дней до истечения — показать пользователю уведомление
- Пользователь должен логиниться и сгенерировать новые pre-keys

### Когда применять

- На Этапе 1-2: Добавить сообщение в TODO комментариях
- На Этап 3 (E2EE): Полная реализация

---

## 8. Pre-keys должны быть загружены перед первым сообщением

### Текущее состояние

В MESSAGE_DELIVERY_SYSTEM.md и MULTI_DEVICE_SYNC.md описывается отправка сообщений, но не fetch pre-keys.

### Что зарезервировать

Перед отправкой сообщения отправитель должен:

```ts
// Шаг 0: Fetch pre-keys получателя
async function sendMessage(toHandleId, plaintext) {
  // 1. Проверить, есть ли chatKey для этого чата
  let chatKey = await getChatKeyFromIndexedDB(chatId);
  
  if (!chatKey) {
    // 2. Если нет → запросить pre-keys получателя с сервера
    const prekeys = await fetch(`/crypto/prekeys/${toHandleId}`).then(r => r.json());
    // {
    //   spk_pk: base64,
    //   spk_signature: base64,
    //   otk_pks: [base64, base64, ...],
    //   otk_index: 0
    // }
    
    // 3. Выполнить X3DH и получить chatKey
    chatKey = await performX3DH(
      myEphemeralSecret,
      myIdentityKey,
      prekeys.spk_pk,
      prekeys.otk_pks[0],
      prekeys.spk_signature
    );
    
    // 4. Сохранить chatKey в IndexedDB
    await saveChatKeyToIndexedDB(chatId, chatKey);
  }
  
  // 5. Теперь отправить сообщение с messageNumber=1 (или 0 если инициация)
  const messageNumber = await getNextMessageNumber(chatId);
  const encrypted = await encryptMessage(chatKey, messageNumber, plaintext);
  
  await socket.emit('message:send', {
    toHandleId,
    chatId,
    messageNumber,
    encryptedPayload: encrypted.ciphertext,
    iv: encrypted.iv,
    timestamp: Date.now()
  });
}
```

### Эндпоинт на бэкенде

```ts
// Добавить в backend (E2EE Этап 3)
GET /crypto/prekeys/{handleId}
  Response: {
    spk_pk: base64,
    spk_signature: base64,
    otk_pks: [base64, base64, ...],
    otk_indexes: [0, 1, 2, ...],
    handle_id: uuid
  }
```

### Когда планировать

- На Этапе 1-2: Зарезервировать эндпоинт в TODO
- На Этап 3 (E2EE): Реализовать

---

## 9. Disconnect handler — учесть влияние на OTK

### Текущее состояние (MULTI_DEVICE_SYNC.md)

```bash
SREM online:{activeHandleId} {sessionId}
DEL session:{sessionId}
```

### Что добавить для E2EE

```ts
// Backend handleDisconnect
async function handleDisconnect(socket: Socket) {
  // ... существующий код удаления из Redis ...
  
  // ← НОВОЕ: Проверить, есть ли еще активные сессии
  const remainingSessions = await redis.smembers(`online:{activeHandleId}`);
  
  if (remainingSessions.length === 0) {
    // Все устройства пользователя offline для этого handle
    // → Пометить в кэше, что можно переиспользовать OTK
    // (или наоборот, заблокировать новые чаты до восстановления)
    
    logger.info('handle_fully_offline', {
      handleId: activeHandleId,
      timestamp: new Date()
    });
  }
}
```

### Объяснение

- **OTK (One-Time Keys)** используются один раз для X3DH
- Если handle полностью offline → можно резервировать новые OTK для приходящих сообщений
- Если есть активные сессии → не переиспользовать OTK

### Когда применять

На Этап 3 (E2EE), сейчас просто оставить TODO

---

## 10. Чек-лист для Этапов 1-2 реализации

### ✅ Что сделать сразу (Этап 1-2)

- [ ] **Redis:** Подготовить структуру для `iv` и `messageNumber` в `pending_msgs:{toHandleId}`
- [ ] **PostgreSQL:** Планировать миграцию для колонок `iv`, `message_number`, `x3dh_ephemeral_key`
- [ ] **JWT claim:** Добавить `publicKey` в JWT (для вычисления `hPK_digest` на сервере)
- [ ] **Session Redis:** Расширить `session:{sessionId}` для добавления `hPK_digest`
- [ ] **Логирование:** Убедиться, что логи не содержат `hPK`, `PK`, `encryptedPayload`
- [ ] **Документация:** Упомянуть, что `message_number = 0` зарезервирован для X3DH
- [ ] **IndexedDB схема:** Оставить место для таблицы `chat_keys` и `session_prekeys`

### ⏳ Что подготовить (на Этап 3)

- [ ] Эндпоинт `GET /crypto/prekeys/{handleId}`
- [ ] Таблица `handle_prekeys` и `handle_otkeys` в PostgreSQL
- [ ] X3DH вычисления на фронтенде
- [ ] Per-message key derivation (HKDF)
- [ ] AES-256-GCM шифрование/расшифровка

### 🚫 Что НЕ трогать

- [ ] Существующая структура сообщений (добавлять, не переделывать)
- [ ] Существующая логика маршрутизации по `handleId`
- [ ] Существующие эндпоинты (расширять, не заменять)

---

## 11. Итоговая таблица: Что менять в какой документ

| Документ | Раздел | Что добавить |
|----------|--------|-------------|
| MESSAGE_DELIVERY_SYSTEM.md | 4.1 (Отправка) | Упомянуть `messageNumber` и `iv` в payload |
| MESSAGE_DELIVERY_SYSTEM.md | 5.2 (Redis format) | Формат с `iv`, `messageNumber`, `x3dhPayload` |
| MESSAGE_DELIVERY_SYSTEM.md | 8 (Диаграмма) | Добавить X3DH init как step 0 |
| MULTI_DEVICE_SYNC.md | 4.1 (Подключение) | Вычисление `hPK_digest` и добавление в Redis |
| MULTI_DEVICE_SYNC.md | 5.1 (Redis структура) | `hPK_digest` в session маппинге |
| MULTI_DEVICE_SYNC.md | 6 (Безопасность) | Упомянуть, что `hPK` не логируется |
| E2EE_ENCRYPTION_SYSTEM.md | 9 (Этапы) | Добавить зависимость от MESSAGE_DELIVERY + MULTI_DEVICE_SYNC |

---

## 12. Примеры кода (шаблоны)

### Миграция PostgreSQL

```sql
-- Этап 1-2: Подготовка (не применять, только планировать)
-- НАЧАЛО КОММЕНТАРИЯ

ALTER TABLE message_delivery ADD COLUMN (
  iv BYTEA COMMENT 'AES-256-GCM initialization vector',
  message_number INTEGER COMMENT 'Message counter in chat (0=X3DH init)',
  x3dh_ephemeral_key BYTEA COMMENT 'X3DH ephemeral public key (only for message_number=0)'
);

CREATE INDEX idx_message_number_chat_id 
ON message_delivery(message_number, chat_id);

-- КОНЕЦ КОММЕНТАРИЯ
```

### Backend TypeScript (что оставить место)

```ts
// messagesGateway.ts
@SubscribeMessage('message:send')
async handleMessageSend(client: Socket, data: {
  messageId: string;
  toHandleId: string;
  encryptedPayload: string;
  iv?: string;                    // ← НОВОЕ в E2EE (Этап 3)
  messageNumber?: number;         // ← НОВОЕ в E2EE (Этап 3)
  x3dhPayload?: string;          // ← НОВОЕ в E2EE (Этап 3)
  timestamp: number;
}) {
  // Текущая логика...
  
  // TODO: На Этап 3 (E2EE)
  // if (data.messageNumber === 0) {
  //   // Handle X3DH initialization
  // }
}
```

### Frontend TypeScript (IndexedDB структура)

```ts
// indexeddb-schema.ts
const DB_NAME = 'BeSafeChat';
const DB_VERSION = 1;  // ← Обновить на Этап 3

const STORES = {
  messages: 'messages',
  chats: 'chats',
  handles: 'handles',
  
  // ← НОВОЕ на Этап 3
  // chatKeys: 'chatKeys',        // {handleId}:{chatId} → { chatKey, messageNumber, ... }
  // sessionPrekeys: 'sessionPrekeys', // { spk_sk, otk_sks, expires_at, ... }
};
```

---

## 13. Открытые вопросы для обсуждения

- [ ] Какова текущая структура JWT? Есть ли `publicKey` в claim?
- [ ] Где сейчас логируются сообщения? Какие данные попадают в логи?
- [ ] Есть ли уже таблица `session_prekeys` в БД или только в IndexedDB?
- [ ] Как сейчас обрабатываются первые сообщения в чате?
- [ ] Нужна ли поддержка group chats или только 1-to-1?

