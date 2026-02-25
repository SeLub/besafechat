# 📄 Техническое задание: Система доставки сообщений для офлайн-получателей

**Статус:** v2.0 - Updated для Practical E2EE Model  
**Интеграция:** АРХИТЕКТУРА_E2EE_МЕССЕНДЖЕР.md

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

| Компонент | Роль |
|---------|------|
| **Redis** | Временное хранилище зашифрованных сообщений по `handleId` получателя (`TTL = 7 дней`) + presence (онлайн/офлайн статус по handle) |
| **PostgreSQL** | Хранение метаданных сообщений (без тела): `message_id`, `from_handle`, `to_handle`, `chatId`, `timestamp`, `delivered`, `expires_at` |
| **MessagesGateway (NestJS)** | Проверяет статус получателя по `handleId`, сохраняет в Redis при офлайн, отправляет онлайн-получателям всем сессиям с этим `handleId` |
| **Клиент (React + IndexedDB)** | Запрашивает недоставленные сообщения при входе, расшифровывает, сохраняет локально |

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

| Требование | Значение |
|-----------|----------|
| TTL сообщений в Redis | 7 дней (604800 сек) |
| Максимум сообщений в очереди | 100 на адресата |
| Rate-limit | 10 сообщений/мин на адресата |
| Timeout WebSocket | 30 сек неактивности = переподключение |
| Heartbeat интервал | 30 сек |

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
      credentials: 'include'
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
      body: JSON.stringify({ messageId, toPubkeyHash, encryptedPayload })
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

