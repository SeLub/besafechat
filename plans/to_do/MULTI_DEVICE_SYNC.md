# 📄 Техническое задание: Real-time синхронизация между онлайн-устройствами

## 1. Цель

Реализовать механизм **синхронизации данных между несколькими онлайн-устройствами одного пользователя** во время активной беседы:

- Когда один пользователь онлайн на **нескольких устройствах одновременно** (например, компьютер + планшет)
- **Входящие сообщения** поступают на **все устройства пользователя** в реальном времени
- **Статус печатания** (typing indicator) синхронизируется между устройствами
- **Статус прочтения сообщений** синхронизируется между всеми устройствами пользователя

---

## 2. Архитектурные принципы

### 2.1 Модель безопасности и multi-device
- **Один приватный ключ PK** на всех устройствах пользователя (восстанавливается при каждом логине)
- **hPK = hash(PK)** — хранится в памяти сессии, используется как локальный секрет для расшифровки
- Один пользователь = один `identityId` = **несколько активных сессий (устройств)**
- Каждая сессия имеет уникальный `sessionId` и один активный `activeHandleId`
- Сессия подключается к WebSocket и получает свой `socket_id`

### 2.2 Multi-handle модель
- Один пользователь может использовать **несколько разных handles** (разные публичные личности)
- Каждый handle — уникальный `handleId` (UUID из таблицы `handles`)
- Один чат = один handle → при переключении между чатами переключается `activeHandleId`
- Чаты привязаны к `handles` (в `chat_members.memberHandleId`), не к `identities`

### 2.3 Синхронизация входящих сообщений (маршрутизация по activeHandleId)
- **Входящие сообщения** доставляются на **все сессии пользователя, активные с этим handle'ом**
- Сообщения маршрутизируются по `toHandleId` (из `chat_members.memberHandleId`)
- Сервер находит все активные сессии, где `activeHandleId = toHandleId`, и маршрутизирует через их WebSocket
- Каждое устройство сохраняет входящие сообщения в свою локальную IndexedDB
- Сообщения **отправленные с одного устройства НЕ синхронизируются обратно** на другие (каждое ведёт свою историю)
- Когда пользователь переключает `activeHandleId`, он перестаёт получать сообщения для прежнего handle'а и начинает получать для нового

### 2.4 Маршрутизация
- Чаты идентифицируются по `chatId` (из таблицы `chats`)
- Участники чата идентифицируются по `memberHandleId` (из `chat_members`)
- Сервер маршрутизирует только на основе handle'а, не зная реальную личность пользователя

---

## 3. Основные компоненты

| Компонент | Роль |
|---------|------|
| **MessagesGateway (WebSocket)** | Приёмник всех событий, маршрутизирует входящие сообщения на все сессии с `toHandleId` |
| **SessionService** | Ведёт маппинг: `identityId → [sessionId1, sessionId2, ...]` и `(identityId, sessionId) → activeHandleId` |
| **RedisService** | Кэширует маппинг активных сессий по `activeHandleId` для быстрого поиска socket_id |
| **ChatService** | Определяет участников чата по `chatId` → `chat_members.memberHandleId` |
| **ClientSocket** | Слушает входящие сообщения и синхронизирует состояние (typing, read status) |
| **IndexedDB** | Локальное хранилище для каждого устройства (группировано по `chatId`) |

---

## 4. Требования к функциональности

### 4.1 Подключение к WebSocket при входе

**When:**
- Пользователь логинится в приложение
- JWT в cookie валидный
- Сессия активна (из SessionService)

**Flow:**
1. Клиент подключается к WebSocket: `io(API_BASE + '/messages')`
2. Backend получает `handleConnection(client: Socket)`
3. Валидировать cookies и извлечь `sessionId` из JWT
4. Запросить из `SessionService`:
   - `identityId`
   - `activeHandleId` (текущий активный handle пользователя)
5. Сохранить маппинг в Redis:
   ```bash
   SADD sessions:{identityId} {sessionId}
   SET session:{sessionId} {activeHandleId}:{socket_id}
   EXPIRE session:{sessionId} 3600  # 1 час
   ```
6. Установить presence по handle'у:
   ```bash
   SADD online:{activeHandleId} {sessionId}
   EXPIRE online:{activeHandleId} 3600
   ```
7. Отправить клиенту: `{ connectionId: socket_id, sessionId, identityId, activeHandleId }`

---

### 4.2 Получение входящего сообщения

**When:**
- User 1 отправляет сообщение User 2
- User 2 онлайн на **нескольких устройствах**

**Flow:**
1. User 1 отправляет на `/send` с `toHandleId` (из таблицы `chat_members` для конкретного чата)
2. Backend (MessagesGateway) получает сообщение:
   ```ts
   {
     messageId: string;
     toHandleId: string;
     encryptedPayload: string;
     timestamp: number;
   }
   ```
3. Запросить в Redis все активные сессии User 2, где `activeHandleId = toHandleId`:
   ```bash
   SMEMBERS online:{toHandleId}  # Вернёт [sessionId1, sessionId2, ...]
   ```
4. Для каждой сессии:
   - Получить `socket_id` из маппинга: `GET session:{sessionId}`
   - Отправить WebSocket-сообщение через socket_id:
     ```ts
     socket.emit('message:incoming', {
       messageId,
       fromHandleId,
       encryptedPayload,
       timestamp,
       deliveredAt: Date.now()
     })
     ```
5. Каждое устройство получает событие и сохраняет в IndexedDB

**Result:** User 2 видит входящее сообщение на **всех своих устройствах, активных с этим handle'ом**

---

### 4.3 Синхронизация статуса печатания (Typing Indicator)

**Сценарий:**
- User 1 печатает сообщение в чате (linked к `handleId1`)
- User 1 онлайн на компьютере и планшете оба активны с этим handle'ом
- User 2 (с другим `handleId2`) должен видеть "User 1 печатает..." на **всех своих устройствах**

**Flow:**
1. User 1 (компьютер) начинает печатать → отправляет:
   ```ts
   socket.emit('typing:start', {
     chatId: string;
     fromHandleId: string;
   })
   ```
2. Backend (MessagesGateway) получает `typing:start`:
   - Найти участников чата с `chatId` и получить их `handleId`
   - Для каждого `toHandleId` найти все активные сессии: `SMEMBERS online:{toHandleId}`
   - Отправить на все сессии:
     ```ts
     socket.emit('typing:user_active', {
       fromHandleId,
       chatId
     })
     ```
3. User 2 (на обоих устройствах) получает событие → показывает "User 1 печатает..."
4. Когда User 1 (компьютер) отправляет сообщение:
   - Отправляет `typing:stop`
   - Backend отправляет на все сессии других участников

**Result:** Все участники чата видят typing indicator на всех своих устройствах

---

### 4.4 Синхронизация статуса прочтения

**Сценарий:**
- User 1 прочитал сообщение от User 2 на компьютере
- User 1 онлайн на компьютере и планшете
- User 2 должен видеть, что User 1 прочитал сообщение (галочка), и это должно синхронизироваться на **компьютер и планшет User 1**

**Flow:**
1. User 1 (компьютер) открывает чат и прочитал сообщение → отправляет:
   ```ts
   socket.emit('message:read', {
     chatId: string;
     lastReadMessageId: string;
     fromHandleId: string;
   })
   ```
2. Backend (MessagesGateway) обрабатывает:
   - **Сохранить состояние прочтения в Redis** (кэш):
     ```bash
     SET read_status:{chatId}:{fromHandleId} {lastReadMessageId}
     EXPIRE ... 3600
     ```
   - **Найти всех участников чата** (из `chat_members` по `chatId`)
   - **Для каждого участника найти его активные сессии и отправить:**
     ```ts
     socket.emit('message:marked_as_read', {
       chatId,
       lastReadMessageId,
       byHandleId: fromHandleId
     })
     ```
3. Все участники чата (на всех своих устройствах) получают событие → обновляют UI (галочка)

**Дополнительно: Синхронизация между устройствами User 1**
1. User 1 (планшет) подключился позже и вызывает `/sync`
2. Backend отправляет `read_status` из Redis для текущего `activeHandleId`
3. Планшет обновляет UI (галочка)

**Result:** 
- Все участники видят галочку (прочтение) на всех своих устройствах
- User 1 также видит синхронизированное состояние на обоих своих устройствах

---

### 4.5 Отключение устройства

**When:**
- WebSocket разорван (user закрыл приложение, потеря интернета)

**Flow:**
1. Backend получает `handleDisconnect(client: Socket)`
2. Удалить маппинги из Redis:
   ```bash
   SREM sessions:{identityId} {sessionId}
   DEL session:{sessionId}
   SREM online:{activeHandleId} {sessionId}
   ```
3. Если `online:{activeHandleId}` пуста:
   - Пользователь полностью офлайн с этим handle'ом
   - Будущие сообщения для этого `activeHandleId` должны сохраняться в Redis (см. MESSAGE_DELIVERY_SYSTEM.md)

---

## 5. Требования к данным

### 5.1 Структура в Redis

**Активные сессии пользователя:**
```
sessions:{identityId} → SET [sessionId1, sessionId2, ...]
TTL: 3600 сек
```

**Маппинг сессии:**
```
session:{sessionId} → STRING "{activeHandleId}:{socket_id}"
TTL: 3600 сек
```

**Online статус по handle'у:**
```
online:{activeHandleId} → SET [sessionId1, sessionId2, ...]
TTL: 3600 сек
```

**Кэш статуса прочтения:**
```
read_status:{chatId}:{handleId} → STRING "{lastReadMessageId}"
TTL: 3600 сек
```

### 5.2 WebSocket события

**Client → Server:**
```ts
// Входящее сообщение
socket.emit('message:send', {
  messageId: string;
  toHandleId: string;
  encryptedPayload: string;
  timestamp: number;
})

// Начало печатания
socket.emit('typing:start', {
  chatId: string;
  fromHandleId: string;
})

// Конец печатания
socket.emit('typing:stop', {
  chatId: string;
  fromHandleId: string;
})

// Прочтение сообщения
socket.emit('message:read', {
  chatId: string;
  lastReadMessageId: string;
  fromHandleId: string;
})
```

**Server → Client:**
```ts
// Входящее сообщение
socket.on('message:incoming', (data) => {
  // { messageId, fromHandleId, encryptedPayload, timestamp }
})

// Пользователь печатает
socket.on('typing:user_active', (data) => {
  // { fromHandleId, chatId }
})

// Пользователь перестал печатать
socket.on('typing:user_stopped', (data) => {
  // { fromHandleId, chatId }
})

// Сообщение прочитано
socket.on('message:marked_as_read', (data) => {
  // { chatId, lastReadMessageId, byHandleId }
})
```

---

## 6. Требования к безопасности

- ✅ **Аутентификация:** JWT в cookie, валидный `sessionId` из SessionService
- ✅ **Анонимность:** Идентификация через `handleId`, не user ID или pubkey
- ✅ **Маршрутизация:** Сообщения отправляются только по целевому `handleId` всем сессиям с `activeHandleId = toHandleId`
- ✅ **Конфиденциальность:** Сервер не видит содержимое (зашифровано E2EE)
- ✅ **Timeout:** Автоматическое отключение неактивных сессий (3600 сек)
- ✅ **Мультиперсонность:** Переключение между `activeHandleId` означает переключение между личностями, сообщения изолированы по handle'ам

---

## 7. Интеграция с текущей архитектурой

### Backend (NestJS)

**Расширить `MessagesGateway`:**
```ts
// Подключение
async handleConnection(client: Socket) {
  // 1. Валидировать сессию
  // 2. Извлечь sessionId, identityId, pubkeyHash
  // 3. Сохранить маппинг в Redis
  // 4. Установить presence
}

// Отключение
async handleDisconnect(client: Socket) {
  // 1. Удалить маппинг из Redis
  // 2. Проверить, есть ли ещё активные сессии
}

// Входящее сообщение
@SubscribeMessage('message:send')
async handleMessageSend(client: Socket, data: SendMessageDto) {
  // 1. Валидировать данные
  // 2. Найти все сессии адресата
  // 3. Отправить на все сессии или в Redis (если офлайн)
}

// Статус печатания
@SubscribeMessage('typing:start')
async handleTypingStart(client: Socket, data: TypingStartDto) {
  // 1. Найти все сессии адресата
  // 2. Отправить событие
}

// Прочтение сообщения
@SubscribeMessage('message:read')
async handleMessageRead(client: Socket, data: MessageReadDto) {
  // 1. Сохранить статус в Redis
  // 2. Отправить на все сессии адресата
}
```

**Новые DTOs:**
```ts
export class SendMessageDto {
  messageId: string;
  toPubkeyHash: string;
  encryptedPayload: string;
  timestamp: number;
}

export class TypingStartDto {
  chatId: string;
  fromPubkeyHash: string;
}

export class MessageReadDto {
  chatId: string;
  lastReadMessageId: string;
  fromPubkeyHash: string;
}
```

### Frontend (React)

**Использовать существующее:**
- `useWebSocketNotifications()` → расширить для новых событий
- `StorageService` → сохранять входящие сообщения в IndexedDB

**Новый код:**
```ts
// hooks/use-multi-device-sync.ts
export function useMultiDeviceSync() {
  const socketRef = useRef(window.socketInstance);

  // Отправить сообщение
  const sendMessage = (toPubkeyHash, encryptedPayload) => {
    socketRef.current?.emit('message:send', {
      messageId: uuid(),
      toPubkeyHash,
      encryptedPayload,
      timestamp: Date.now()
    });
  };

  // Отправить статус печатания
  const notifyTyping = (chatId) => {
    socketRef.current?.emit('typing:start', {
      chatId,
      fromPubkeyHash: currentUserPubkeyHash
    });
  };

  // Отправить статус прочтения
  const markAsRead = (chatId, lastReadMessageId) => {
    socketRef.current?.emit('message:read', {
      chatId,
      lastReadMessageId,
      fromPubkeyHash: currentUserPubkeyHash
    });
  };

  // Слушать входящие сообщения
  useEffect(() => {
    socketRef.current?.on('message:incoming', (data) => {
      // Сохранить в IndexedDB
      // Обновить UI
    });

    socketRef.current?.on('typing:user_active', (data) => {
      // Показать "User печатает..."
    });

    socketRef.current?.on('message:marked_as_read', (data) => {
      // Обновить галочку
    });

    return () => {
      socketRef.current?.off('message:incoming');
      socketRef.current?.off('typing:user_active');
      socketRef.current?.off('message:marked_as_read');
    };
  }, []);

  return { sendMessage, notifyTyping, markAsRead };
}
```

---

## 8. Диаграмма взаимодействия

```
Сценарий: User 1 отправляет сообщение User 2 (User 2 онлайн на двух устройствах)
═════════════════════════════════════════════════════════════════════════════

[User 1 Computer]           [Server (WebSocket)]         [User 2 Computer]  [User 2 Tablet]
   (handleId1)                       │                    (handleId2)        (handleId2)
        │                           │                           │                 │
        ├─ message:send ───────────>│                           │                 │
        │  (toHandleId2)            │                           │                 │
        │                           ├─ Find sessions           │                 │
        │                           │  SMEMBERS online:handleId2
        │                           │  → [session1, session2]   │                 │
        │                           │                           │                 │
        │                           ├────────────────────────>  │                 │
        │                           │    message:incoming       │                 │
        │                           │                           │                 │
        │                           ├──────────────────────────────────────────>  │
        │                           │           message:incoming                  │
        │                           │                           │                 │
        │                           │                      [save to IndexedDB]    │
        │                           │                           │        [save to IndexedDB]
        │                           │                      [show in UI]      [show in UI]

Сценарий: Typing indicator синхронизируется между всеми устройствами User 2
═════════════════════════════════════════════════════════════════════════════

[User 1 Computer]           [Server (WebSocket)]         [User 2 Computer]  [User 2 Tablet]
   (handleId1)                       │                    (handleId2)        (handleId2)
        │                           │                           │                 │
        ├─ typing:start ───────────>│                           │                 │
        │  (chatId, handleId1)      │                           │                 │
        │                           ├─ Find all participants    │                 │
        │                           │  and their sessions       │                 │
        │                           │  SMEMBERS online:handleId2
        │                           │                           │                 │
        │                           ├────────────────────────>  │                 │
        │                           │    typing:user_active     │                 │
        │                           │                           │                 │
        │                           ├──────────────────────────────────────────>  │
        │                           │        typing:user_active                   │
        │                           │                           │                 │
        │                           │                    [show typing...]   [show typing...]
```

---

## 9. Этапы реализации

### Этап 1: Инфраструктура Redis
- [ ] Расширить `RedisService` методами:
  - `storeSession(identityId, sessionId, pubkeyHash, socketId)`
  - `getSessionsByPubkeyHash(pubkeyHash): Promise<sessionId[]>`
  - `setPresence(pubkeyHash, sessionId)`
  - `clearPresence(pubkeyHash, sessionId)`
  - `getReadStatus(chatId, pubkeyHash): Promise<lastReadMessageId>`
  - `setReadStatus(chatId, pubkeyHash, lastReadMessageId)`

### Этап 2: WebSocket Gateway
- [ ] Реализовать `handleConnection()` с маппингом сессий
- [ ] Реализовать `handleDisconnect()` с очисткой Redis
- [ ] Реализовать `handleMessageSend()` с маршрутизацией
- [ ] Добавить обработчики `typing:start`, `typing:stop`, `message:read`

### Этап 3: Маршрутизация сообщений
- [ ] Функция `broadcastToSessions(pubkeyHash, event, data)`
- [ ] Определить логику: онлайн vs офлайн (отправить vs сохранить в Redis)

### Этап 4: Фронтенд
- [ ] Создать hook `useMultiDeviceSync()`
- [ ] Подписаться на WebSocket события
- [ ] Сохранять входящие сообщения в IndexedDB
- [ ] Отправлять typing events
- [ ] Синхронизировать статус прочтения

### Этап 5: Тестирование
- [ ] Интеграционные тесты: отправка на несколько сессий
- [ ] Интеграционные тесты: отключение одной сессии
- [ ] Интеграционные тесты: typing synchronization
- [ ] Интеграционные тесты: read status sync

### Этап 6: Мониторинг
- [ ] Метрики: количество активных сессий
- [ ] Метрики: количество сообщений в сек
- [ ] Алерты: потеря маппинга сессий в Redis

---

## 10. Открытые вопросы

- [ ] Как передавать `pubkeyHash` в JWT? (отдельный claim или вычислить от `publicKey`?)
- [ ] Нужны ли heartbeat-события для поддержания TTL в Redis?
- [ ] Должен ли клиент отправлять `typing:stop`, или автоматически после таймаута?
- [ ] Как синхронизировать `read_status` между устройствами одного пользователя?

