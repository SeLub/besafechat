# 📄 Техническое задание: Real-time синхронизация между онлайн-устройствами

**Версия**: 2.0  
**Дата обновления**: Февраль 2026  
**Статус**: ✅ Актуально (соответствует реализованной CryptoKey-архитектуре)  
**Язык**: Русский

---

## 1. Цель

Реализовать механизм **синхронизации данных между несколькими онлайн-устройствами одного пользователя** во время активной беседы:

- Когда один пользователь онлайн на **нескольких устройствах одновременно** (например, компьютер + планшет)
- **Входящие сообщения** поступают на **все устройства пользователя** в реальном времени
- **Статус печатания** (typing indicator) синхронизируется между устройствами
- **Статус прочтения сообщений** синхронизируется между всеми устройствами пользователя

> ⚠️ **Важно**: Исходящие сообщения **не синхронизируются** между устройствами — каждое устройство ведёт свою локальную историю. Синхронизация происходит только для входящих событий и статусов.

---

## 2. Архитектурные принципы

### 2.1 Модель безопасности и multi-device

- **Одна seed-фраза на пользователя** → восстанавливается при каждом логине
- **CryptoKey (extractable: false)** импортируется из хэша приватного ключа и хранится в IndexedDB:
  - Ключ **нельзя экспортировать** через JavaScript (защита от XSS)
  - Ключ **можно использовать** для операций `deriveKey`, `encrypt`, `decrypt`
- Один пользователь = один `identityId` = **несколько активных сессий (устройств)**
- Каждая сессия имеет уникальный `sessionId` и один активный `activeHandleId`
- **Ключи не синхронизируются между устройствами** — каждое устройство деривирует свой CryptoKey независимо из seed/password
- Деривация ключа шифрования: `deriveEncryptionKeyFromHash(baseKey, handleId, purpose)`
  - `handleId` используется как соль для уникальности ключа на пользователя
  - `purpose` (`'message'`, `'file'`, etc.) обеспечивает разделение ключей по контекстам

### 2.2 Multi-handle модель

- Один пользователь может использовать **несколько разных handles** (разные публичные личности)
- Каждый handle — уникальный `handleId` (UUID из таблицы `handles`)
- Один чат = один handle → при переключении между чатами переключается `activeHandleId`
- Чаты привязаны к `handles` (в `chat_members.memberHandleId`), не к `identities`

### 2.3 Синхронизация входящих сообщений (маршрутизация по handleId)

- **Входящие сообщения** доставляются на **все сессии пользователя, активные с этим handle'ом**
- Сообщения маршрутизируются по `toHandleId` (из `chat_members.memberHandleId`)
- Сервер находит все активные сессии, где `activeHandleId = toHandleId`, и маршрутизирует через их WebSocket
- Каждое устройство сохраняет входящие сообщения в свою локальную IndexedDB с использованием `identityId` для загрузки CryptoKey
- Сообщения **отправленные с одного устройства НЕ синхронизируются обратно** на другие (каждое ведёт свою историю)
- Когда пользователь переключает `activeHandleId`, он перестаёт получать сообщения для прежнего handle'а и начинает получать для нового

### 2.4 Маршрутизация

- Чаты идентифицируются по `chatId` (из таблицы `chats`)
- Участники чата идентифицируются по `memberHandleId` (из `chat_members`)
- Сервер маршрутизирует только на основе handle'а, не зная реальную личность пользователя

---

## 3. Основные компоненты

| Компонент                       | Роль                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **MessagesGateway (WebSocket)** | Приёмник всех событий, маршрутизирует входящие сообщения на все сессии с `toHandleId`                    |
| **SessionService**              | Ведёт маппинг: `identityId → [sessionId1, sessionId2, ...]` и `(identityId, sessionId) → activeHandleId` |
| **RedisService**                | Кэширует маппинг активных сессий по `activeHandleId` для быстрого поиска `socket_id`                     |
| **ChatService**                 | Определяет участников чата по `chatId` → `chat_members.memberHandleId`                                   |
| **ClientSocket**                | Слушает входящие сообщения и синхронизирует состояние (typing, read status)                              |
| **StorageService**              | Локальное хранилище с CryptoKey-архитектурой: шифрование/расшифровка с явной передачей `identityId`      |
| **IndexedDB**                   | Локальное хранилище для каждого устройства (группировано по `identityId` → `chatId`)                     |

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
7. **🔐 Загрузить CryptoKey для шифрования (клиентская часть)**:
   ```typescript
   const baseKey = await StorageService.loadEncryptionKey(identityId);
   if (baseKey) {
     setSessionCryptoKey(baseKey); // Кэш в RAM для производительности
   } else {
     // Key not found — expected on first login from new device
     // Показать модалку восстановления доступа (ввод пароля/seed)
   }
   ```
8. Отправить клиенту: `{ connectionId: socket_id, sessionId, identityId, activeHandleId }`

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
     toHandleId: string; // ← Changed from toPubkeyHash
     encryptedPayload: string; // ← AES-GCM, ключ деривирован с handleId
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
       fromHandleId, // ← Changed from fromPubkeyHash
       encryptedPayload,
       timestamp,
       deliveredAt: Date.now(),
     });
     ```
5. Каждое устройство получает событие и сохраняет в IndexedDB:
   ```typescript
   // index.tsx — handleMessageReceived
   await StorageService.saveEncryptedMessage(
     message.chatId,
     message.fromHandleId,
     message.text, // ← зашифрованный контент
     user.handle.id, // handleId получателя для деривации ключа
     false, // isOwn
     messageId,
     user.identity.id // ← identityId для загрузки CryptoKey
   );
   ```

**Result:** User 2 видит входящее сообщение на **всех своих устройствах, активных с этим handle'ом**

---

### 4.2.1 Синхронизация исходящих сообщений между устройствами отправителя

**When:**

- User 1 отправляет сообщение User 2
- User 1 онлайн на **нескольких устройствах** (например, компьютер + планшет)

**Problem:**

Без синхронизации исходящих сообщений:
- Device A (отправитель) сохраняет сообщение локально
- Device B (второе устройство отправителя) НЕ видит это сообщение в чате
- История разных между устройствами → плохой UX

**Flow:**

1. User 1 (компьютер) отправляет сообщение на `/send` с `toHandleId` получателя
2. Backend (MessagesGateway) получает в `handleMessage()`:
   ```ts
   {
     messageId: string;
     toHandleId: string;       // handleId получателя
     encryptedPayload: string;
     timestamp: number;
   }
   ```
3. Сохранить метаданные в PostgreSQL (как обычно)
4. **Отправить на все устройства получателя** (в комнату `user:{toHandleId}`):
   ```ts
   this.server.to(`user:${toHandleId}`).emit('message:new', {
     messageId,
     from: client.data.activeHandleId,
     chatId,
     encryptedPayload,
     timestamp,
   });
   ```
5. **🔄 Отправить на все устройства ОТПРАВИТЕЛЯ** (кроме текущего сокета):
   ```ts
   // Получить все сессии отправителя из Redis
   const redis = this.redisService.getClient();
   const senderSessions = await redis.smembers(
     `sessions:${client.data.identityId}`
   );
   
   // Для каждой сессии (кроме текущей)
   for (const sessionData of senderSessions) {
     const [sessionId, socketId] = sessionData.split(':');
     if (socketId !== client.id) { // ← Исключаем текущий сокет
       this.server.to(socketId).emit('message:sent', {
         messageId,
         toHandleId, // ← handleId адресата (для определения чата)
         chatId,
         encryptedPayload,
         timestamp,
         deliveredAt: Date.now(),
       });
     }
   }
   ```
6. **Frontend — обработка на других устройствах отправителя**:
   ```typescript
   // useWebSocketNotifications или отдельный слушатель
   socket.on('message:sent', (payload: any) => {
     // Это мое сообщение, пришедшее с другого устройства
     if (payload.toHandleId === selectedChat?.handleId) {
       // Добавляем в UI с флагом isOwn=true
       setMessages(prev => {
         if (prev.some(m => m.id === payload.messageId)) {
           return prev; // Дедупликация
         }
         return [...prev, {
           id: payload.messageId,
           text: decryptedText,
           isOwn: true,
           fromHandleId: currentUserHandleId,
           timestamp: payload.timestamp,
         }];
       });
       
       // Сохраняем в IndexedDB
       await StorageService.saveEncryptedMessage(
         payload.chatId,
         currentUserHandleId,
         payload.encryptedPayload,
         user.handle.id,
         true, // ← isOwn = true
         payload.messageId,
         user.identity.id
       );
     }
   });
   ```

**Key Points:**

- ✅ Используется **Redis структура** `sessions:{identityId}` (SET сессий отправителя)
- ✅ **Фильтрирование по socket.id** исключает текущее устройство (нет дублей)
- ✅ **На фронтенде нет логики фильтрования** — просто слушаем 2 события: `message:new` (входящие) и `message:sent` (исходящие)
- ✅ **Готовит инфраструктуру** для MESSAGE_DELIVERY_SYSTEM (Redis маршрутизация по sessionId)

**Result:** User 1 видит отправленное сообщение на **всех своих устройствах** практически в реальном времени

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
     fromHandleId: string;      // ← Changed from fromPubkeyHash
   })
   ```
2. Backend (MessagesGateway) получает `typing:start`:
   - Найти участников чата с `chatId` и получить их `handleId`
   - Для каждого `toHandleId` найти все активные сессии: `SMEMBERS online:{toHandleId}`
   - Отправить на все сессии:
     ```ts
     socket.emit('typing:user_active', {
       fromHandleId,
       chatId,
     });
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
     fromHandleId: string;      // ← Changed from fromPubkeyHash
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
       byHandleId: fromHandleId, // ← Changed from byPubkeyHash
     });
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
4. **Клиентская часть**: при размонтировании компонента очистить RAM-кэш ключа:
   ```typescript
   useEffect(() => {
     return () => {
       clearSessionCryptoKey(); // Очистить RAM-кэш при размонтировании
     };
   }, []);
   ```

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
  toHandleId: string;              // ← Changed from toPubkeyHash
  encryptedPayload: string;        // ← AES-GCM encrypted with handleId-derived key
  timestamp: number;
})

// Начало печатания
socket.emit('typing:start', {
  chatId: string;
  fromHandleId: string;            // ← Changed from fromPubkeyHash
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
  fromHandleId: string;            // ← Changed from fromPubkeyHash
})
```

**Server → Client:**

```ts
// Входящее сообщение
socket.on('message:incoming', data => {
  // { messageId, fromHandleId, encryptedPayload, timestamp }
  // Сохранить через StorageService.saveEncryptedMessage(..., identityId)
});

// Пользователь печатает
socket.on('typing:user_active', data => {
  // { fromHandleId, chatId }
  // Показать "User печатает..." в UI
});

// Пользователь перестал печатать
socket.on('typing:user_stopped', data => {
  // { fromHandleId, chatId }
  // Скрыть индикатор печатания
});

// Сообщение прочитано
socket.on('message:marked_as_read', data => {
  // { chatId, lastReadMessageId, byHandleId }
  // Обновить галочку прочтения в UI
});
```

### 5.3 Интеграция с StorageService

Все операции с локальным хранилищем используют обновлённый `StorageService` с явной передачей `identityId`:

```typescript
// Сохранение входящего сообщения
await StorageService.saveEncryptedMessage(
  chatId,
  senderHandleId,
  encryptedContent,
  recipientHandleId,  // handleId для деривации ключа
  false,              // isOwn
  messageId,
  identityId          // ← Обязательный параметр для загрузки CryptoKey
);

// Загрузка и расшифровка сообщений
const messages = await StorageService.loadDecryptedMessages(
  chatId,
  userHandleId,
  identityId  // ← Обязательный параметр
);

// Вспомогательный метод получения ключа (внутри StorageService)
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

**Важно**:

- `identityId` передаётся явно из React-контекста (`useAuth`), **не читается из localStorage**
- `StorageService.getBaseKey(identityId)` реализует fallback: RAM-кэш → IndexedDB
- При отсутствии ключа в IndexedDB пользователь должен восстановить доступ (ввод пароля/seed)

---

## 6. Требования к безопасности

- ✅ **Аутентификация:** JWT в cookie, валидный `sessionId` из SessionService
- ✅ **Анонимность:** Идентификация через `handleId`, не user ID или pubkey
- ✅ **Маршрутизация:** Сообщения отправляются только по целевому `handleId` всем сессиям с `activeHandleId = toHandleId`
- ✅ **Конфиденциальность:** Сервер не видит содержимое (зашифровано E2EE)
- ✅ **Защита ключей:** CryptoKey с `extractable: false` — XSS не может экспортировать ключ, только использовать для крипто-операций
- ✅ **Хранение ключей:** CryptoKey хранится в IndexedDB, привязан к `identityId`, загружается при необходимости
- ✅ **Изоляция устройств:** Ключи не синхронизируются между устройствами — компрометация одного не раскрывает другие
- ✅ **Явная передача identityId:** Компоненты React передают `identityId` в сервисы явно, без чтения из localStorage
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
  // 2. Извлечь sessionId, identityId, activeHandleId
  // 3. Сохранить маппинг в Redis
  // 4. Установить presence
  // 5. (Клиент) Загрузить CryptoKey из IndexedDB
}

// Отключение
async handleDisconnect(client: Socket) {
  // 1. Удалить маппинг из Redis
  // 2. Проверить, есть ли ещё активные сессии
  // 3. (Клиент) Очистить RAM-кэш ключа
}

// Входящее сообщение
@SubscribeMessage('message:send')
async handleMessageSend(client: Socket, data: SendMessageDto) {
  // 1. Валидировать данные (toHandleId, fromHandleId)
  // 2. Найти все сессии адресата: SMEMBERS online:{toHandleId}
  // 3. Отправить на все сессии или в Redis (если офлайн)
}

// Статус печатания
@SubscribeMessage('typing:start')
async handleTypingStart(client: Socket, data: TypingStartDto) {
  // 1. Найти все сессии адресата
  // 2. Отправить событие typing:user_active
}

// Прочтение сообщения
@SubscribeMessage('message:read')
async handleMessageRead(client: Socket, data: MessageReadDto) {
  // 1. Сохранить статус в Redis: read_status:{chatId}:{handleId}
  // 2. Отправить на все сессии адресата: message:marked_as_read
}
```

**Новые DTOs:**

```ts
export class SendMessageDto {
  messageId: string;
  toHandleId: string; // ← Changed from toPubkeyHash
  encryptedPayload: string;
  timestamp: number;
}

export class TypingStartDto {
  chatId: string;
  fromHandleId: string; // ← Changed from fromPubkeyHash
}

export class MessageReadDto {
  chatId: string;
  lastReadMessageId: string;
  fromHandleId: string; // ← Changed from fromPubkeyHash
}
```

### Frontend (React)

**Использовать существующее:**

- `useWebSocketNotifications()` → расширить для новых событий
- `StorageService` → сохранять входящие сообщения в IndexedDB с явной передачей `identityId`

**Новый код:**

```ts
// hooks/use-multi-device-sync.ts
import { useAuth } from '@/hooks/use-auth-context';
import { StorageService } from '@/services/storage.service';

export function useMultiDeviceSync() {
  const { user } = useAuth();
  const socketRef = useRef(window.socketInstance);

  // Отправить сообщение
  const sendMessage = async (chatId: string, toHandleId: string, encryptedPayload: string) => {
    if (!user?.identity?.id) return;

    socketRef.current?.emit('message:send', {
      messageId: crypto.randomUUID(),
      toHandleId,
      encryptedPayload,
      timestamp: Date.now(),
    });

    // Сохранить локально для отображения
    await StorageService.saveEncryptedMessage(
      chatId,
      user.handle.id,
      encryptedPayload,
      toHandleId,
      true, // isOwn
      undefined,
      user.identity.id // ← identityId для шифрования
    );
  };

  // Отправить статус печатания
  const notifyTyping = (chatId: string, isTyping: boolean) => {
    if (!user?.handle?.id) return;

    const event = isTyping ? 'typing:start' : 'typing:stop';
    socketRef.current?.emit(event, {
      chatId,
      fromHandleId: user.handle.id,
    });
  };

  // Отправить статус прочтения
  const markAsRead = (chatId: string, lastReadMessageId: string) => {
    if (!user?.handle?.id) return;

    socketRef.current?.emit('message:read', {
      chatId,
      lastReadMessageId,
      fromHandleId: user.handle.id,
    });
  };

  // Слушать входящие сообщения
  useEffect(() => {
    if (!socketRef.current || !user?.identity?.id) return;

    const socket = socketRef.current;

    socket.on('message:incoming', async data => {
      // Сохранить в IndexedDB с identityId для расшифровки
      await StorageService.saveEncryptedMessage(
        data.chatId,
        data.fromHandleId,
        data.encryptedPayload,
        user.handle.id,
        false,
        data.messageId,
        user.identity.id // ← identityId для загрузки CryptoKey
      );
      // Обновить UI (через глобальный стейт или события)
    });

    socket.on('typing:user_active', data => {
      // Показать "User печатает..." в UI чата
      // Использовать глобальный стейт typingIndicators
    });

    socket.on('message:marked_as_read', data => {
      // Обновить галочку прочтения в UI
      // Использовать глобальный стейт readStatuses
    });

    return () => {
      socket.off('message:incoming');
      socket.off('typing:user_active');
      socket.off('message:marked_as_read');
    };
  }, [user?.identity?.id, user?.handle?.id]);

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

## 9. Деривация ключей на нескольких устройствах

### Принцип независимой деривации

Каждое устройство пользователя независимо деривирует криптографические ключи:

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

### Почему ключи не синхронизируются?

| Преимущество          | Объяснение                                                      |
| --------------------- | --------------------------------------------------------------- |
| **Безопасность**      | Компрометация одного устройства не раскрывает ключи на других   |
| **Zero-knowledge**    | Сервер не участвует в управлении ключами, не видит plaintext    |
| **Изоляция**          | Утечка на одном устройстве не влияет на другие сессии           |
| **Соответствие E2EE** | Ключи всегда остаются на клиенте, никогда не передаются по сети |

### Что синхронизируется между устройствами?

| Синхронизируется                          | Не синхронизируется           |
| ----------------------------------------- | ----------------------------- |
| ✅ Метаданные сообщений (через WebSocket) | ❌ Криптографические ключи    |
| ✅ Статусы прочтения (через Redis)        | ❌ Приватный ключ или его хэш |
| ✅ Индикаторы печатания (через WebSocket) | ❌ Seed-фраза или пароль      |
| ✅ Ссылки на файлы в S3 (метаданные)      | ❌ Ключи деривации для файлов |

### Восстановление доступа на новом устройстве

1. Пользователь вводит password или seed-фразу
2. Деривируется приватный ключ → импортируется как `CryptoKey (extractable: false)`
3. Ключ сохраняется в IndexedDB нового устройства через `StorageService.storeEncryptionKey()`
4. История сообщений (зашифрованная) синхронизируется при получении через WebSocket
5. Расшифровка происходит локально с использованием нового CryptoKey

---

## 10. Этапы реализации

### Этап 0: Интеграция CryptoKey-архитектуры (предварительный, критичный)

**Цель**: Обеспечить совместимость real-time синхронизации с новой архитектурой ключей.

- [ ] Обновить `StorageService` для приёма `identityId` как обязательного параметра:
  - [ ] `saveEncryptedMessage(..., identityId)`
  - [ ] `loadDecryptedMessages(..., identityId)`
  - [ ] `getBaseKey(identityId)` с fallback: RAM → IndexedDB
- [ ] Реализовать методы управления CryptoKey:
  - [ ] `storeEncryptionKey(identityId, key)`
  - [ ] `loadEncryptionKey(identityId)`
  - [ ] `deleteEncryptionKey(identityId)`
- [ ] Обновить `deriveEncryptionKeyFromHash()` для приёма `CryptoKey` вместо `Uint8Array`
- [ ] Обновить все вызовы крипто-функций в `index.tsx`, `useWebSocketNotifications`:
  - [ ] Передавать `user.identity.id` явно из контекста
  - [ ] Убрать чтение `identityId` из localStorage
- [ ] Протестировать базовый flow:
  - [ ] Логин → CryptoKey сохранён в IndexedDB
  - [ ] Рефреш страницы → CryptoKey загружен, шифрование работает
  - [ ] Logout → CryptoKey удалён из IndexedDB и RAM

**Критерий готовности**: Отправка/получение сообщения работает после рефреша без ошибок `Identity ID not available`.

---

### Этап 1: Инфраструктура Redis

**Цель**: Подготовить Redis для маршрутизации по сессиям и handle'ам.

#### 1.1 Структуры Redis

- [ ] `sessions:{identityId}` (SET) — все активные сессии пользователя
  - Элемент: `{sessionId}:{socketId}` (разделитель `:`)
  - TTL: 3600 сек (обновляется на heartbeat)
  
- [ ] `online:{handleId}` (SET) — активные сессии для конкретного handle'а
  - Элемент: `sessionId`
  - TTL: 3600 сек

- [ ] `session:{sessionId}` (STRING) — маппинг сессии на handle и socket
  - Значение: `{handleId}:{socketId}`
  - TTL: 3600 сек

#### 1.2 RedisService методы

- [ ] `storeSession(identityId: string, sessionId: string, handleId: string, socketId: string): Promise<void>`
  - Добавить в `sessions:{identityId}` элемент `{sessionId}:{socketId}`
  - Добавить в `online:{handleId}` элемент `sessionId`
  - Установить `session:{sessionId}` = `{handleId}:{socketId}`
  - Установить TTL 3600 на все ключи

- [ ] `getSessionsByIdentityId(identityId: string): Promise<{sessionId, socketId}[]>`
  - Получить все элементы из `sessions:{identityId}`
  - Распарсить и вернуть список

- [ ] `getSessionsByHandleId(handleId: string): Promise<string[]>`
  - Получить все sessionId из `online:{handleId}`

- [ ] `clearSession(identityId: string, sessionId: string, handleId: string): Promise<void>`
  - Удалить из `sessions:{identityId}` элемент `{sessionId}:*`
  - Удалить из `online:{handleId}` элемент `sessionId`
  - Удалить ключ `session:{sessionId}`

- [ ] `refreshSessionTTL(identityId: string, handleId: string): Promise<void>`
  - Вызывать на heartbeat
  - Обновить TTL для `sessions:{identityId}`, `online:{handleId}`, `session:{sessionId}`

- [ ] Добавить мониторинг размера Redis-ключей (логирование при превышении лимита)

---

### Этап 2: WebSocket Gateway

**Цель**: Реализовать синхронизацию входящих и исходящих сообщений через WebSocket.

#### 2.1 handleConnection()

- [ ] При подключении клиента:
  - [ ] Валидировать JWT и извлечь `identityId`, `sessionId`, `activeHandleId`
  - [ ] Присоединить сокет к комнате `user:{activeHandleId}`
  - [ ] **Сохранить в Redis** через `RedisService.storeSession()`
  - [ ] Отправить клиенту подтверждение: `{ sessionId, identityId, activeHandleId }`
  - [ ] Запустить heartbeat для поддержания TTL

#### 2.2 handleDisconnect()

- [ ] При отключении клиента:
  - [ ] Получить `identityId`, `sessionId`, `activeHandleId` из `client.data`
  - [ ] **Очистить Redis** через `RedisService.clearSession()`
  - [ ] Уведомить контакты об офлайн-статусе

#### 2.3 handleMessage() — Входящие сообщения

- [ ] Получить сообщение от отправителя с `toHandleId`
- [ ] Сохранить метаданные в PostgreSQL
- [ ] **Отправить на все сессии получателя**:
  - [ ] Получить список сессий из Redis: `RedisService.getSessionsByHandleId(toHandleId)`
  - [ ] Для каждой сессии отправить событие `message:new`
  - [ ] Логировать доставку для отладки

#### 2.4 handleMessage() — Исходящие сообщения (NEW)

- [ ] **После отправки на получателя** отправить на все сессии отправителя:
  - [ ] Получить список сессий отправителя: `RedisService.getSessionsByIdentityId(client.data.identityId)`
  - [ ] **Исключить текущий сокет**: `if (socketId !== client.id)`
  - [ ] Отправить событие `message:sent` на каждый другой сокет
  - [ ] Пример кода:
    ```typescript
    const senderSessions = await this.redisService.getSessionsByIdentityId(client.data.identityId);
    for (const session of senderSessions) {
      if (session.socketId !== client.id) {
        this.server.to(session.socketId).emit('message:sent', {
          messageId,
          toHandleId,
          chatId,
          encryptedPayload,
          timestamp,
        });
      }
    }
    ```

#### 2.5 Heartbeat обработчик

- [ ] Реализовать `handleHeartbeat()` для поддержания TTL в Redis
- [ ] Клиент отправляет heartbeat каждые 20 сек
- [ ] Сервер обновляет TTL через `RedisService.refreshSessionTTL()`

#### 2.6 Дополнительно

- [ ] Добавить обработчики `typing:start`, `typing:stop`, `message:read` (для § 4.3-4.4)
- [ ] Реализовать дедупликацию входящих сообщений по `messageId` (не сохранять дубли)

---

### Этап 3: Маршрутизация сообщений

**Цель**: Интегрировать Redis маршрутизацию в `handleMessage()` для входящих и исходящих сообщений.

#### 3.1 Входящие сообщения

- [ ] В `handleMessage()` после сохранения метаданных:
  - [ ] Получить список сессий получателя: `const sessions = await this.redisService.getSessionsByHandleId(toHandleId)`
  - [ ] Для каждой сессии отправить `message:new` через `this.server.to(socketId).emit('message:new', {...})`
  - [ ] Обновить статус в БД: `delivered = true`

#### 3.2 Исходящие сообщения (NEW)

- [ ] В `handleMessage()` после отправки на получателя:
  - [ ] Получить список сессий отправителя: `const sessions = await this.redisService.getSessionsByIdentityId(client.data.identityId)`
  - [ ] Для каждой сессии кроме текущей отправить `message:sent`
  - [ ] Убедиться в правильности маппинга `socketId` из Redis

#### 3.3 Дедупликация

- [ ] На клиенте: проверять наличие сообщения по `messageId` перед добавлением в UI
- [ ] На сервере: перед отправкой проверить, не отправляли ли это сообщение уже (опционально, для безопасности)
- [ ] В IndexedDB: использовать `messageId` как UNIQUE key

#### 3.4 Логирование

- [ ] Логировать все доставки сообщений для отладки многоустройственного сценария:
  - [ ] Какие сессии найдены для получателя/отправителя
  - [ ] Какие сокеты исключены/включены в доставку
  - [ ] Ошибки при отправке на конкретный сокет

---

### Этап 4: Фронтенд

**Цель**: Реализовать слушатели WebSocket событий для входящих и исходящих сообщений.

#### 4.1 Слушатель входящих сообщений

- [ ] В `useWebSocketNotifications()` обновить обработчик `message:new`:
  - [ ] Декодировать `encryptedPayload` из base64
  - [ ] Вызвать callback `onMessageReceived()`
  - [ ] Логировать для отладки

#### 4.2 Слушатель исходящих сообщений (NEW)

- [ ] В `useWebSocketNotifications()` добавить обработчик `message:sent`:
  ```typescript
  socket.on('message:sent', (payload: any) => {
    // Это мое сообщение, пришедшее с другого устройства
    const binaryString = atob(payload.encryptedPayload);
    const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
    const decoder = new TextDecoder();
    const text = decoder.decode(bytes);
    
    callbacksRef.current.onOwnMessageReceived?.({
      id: payload.messageId,
      text,
      toHandleId: payload.toHandleId,
      chatId: payload.chatId,
      isOwn: true,
      timestamp: payload.timestamp,
    });
  });
  ```

#### 4.3 Обработка в маршруте (index.tsx)

- [ ] Добавить callback `onOwnMessageReceived` в `useWebSocketNotifications()`
- [ ] При получении `message:sent`:
  - [ ] Проверить, что это текущему чату (`payload.toHandleId === selectedChat?.handleId`)
  - [ ] Добавить сообщение в UI с `isOwn: true`
  - [ ] Сохранить в IndexedDB через `StorageService.saveEncryptedMessage(..., true, identityId)`
  - [ ] Обновить `updateChatLastMessage()` если это последнее сообщение

#### 4.4 Дедупликация на фронтенде

- [ ] При добавлении сообщения в UI проверить: `if (prev.some(m => m.id === message.id)) return prev`
- [ ] Использовать `messageId` как уникальный ключ для дедупликации

#### 4.5 Дополнительно

- [ ] Реализовать модалку восстановления доступа при отсутствии CryptoKey
- [ ] Убедиться, что `identityId` всегда передается явно в `StorageService` методы

---

### Этап 5: Тестирование

- [ ] Интеграционные тесты: отправка на несколько сессий одного пользователя
- [ ] Интеграционные тесты: отключение одной сессии (другие продолжают получать)
- [ ] Интеграционные тесты: typing synchronization между устройствами
- [ ] Интеграционные тесты: read status sync
- [ ] Security тест: попытка `exportKey()` на CryptoKey → `InvalidAccessError`
- [ ] Нагрузочный тест: 100+ одновременных сессий, 1000 сообщений/сек

---

### Этап 6: Мониторинг

- [ ] Метрики: количество активных сессий по `handleId`
- [ ] Метрики: количество сообщений в сек
- [ ] Алерты: потеря маппинга сессий в Redis
- [ ] Алерты: CryptoKey not found при попытке шифрования
- [ ] Логирование: все WebSocket-события с `sessionId` для отладки

---

## 11. Открытые вопросы

- [ ] Нужны ли heartbeat-события для поддержания TTL в Redis?
- [ ] Должен ли клиент отправлять `typing:stop`, или автоматически после таймаута (например, 5 сек без ввода)?
- [ ] Как обрабатывать ситуацию, когда CryptoKey не найден в IndexedDB при подключении?
  - Вариант A: Показать модалку восстановления (ввод пароля/seed)
  - Вариант B: Разрешить только чтение, запретить отправку до восстановления
- [ ] Нужна ли дедупликация входящих сообщений на разных устройствах? (по `messageId` в IndexedDB)
- [ ] Как синхронизировать `read_status` между устройствами одного пользователя при переключении `activeHandleId`?
- [ ] Нужен ли механизм "последнего прочитанного" на уровне сессии, а не handle'а?

---

## 12. Что НЕ делать

```
❌ НЕ хранить приватные ключи или их хэши в localStorage
❌ НЕ шифровать файлы на сервере (только клиентское шифрование)
❌ НЕ передавать ключи шифрования через сеть
❌ НЕ смешивать зашифрованные и незашифрованные данные в одном хранилище
❌ НЕ забывать очищать кэш IndexedDB при нехватке места
❌ НЕ использовать pubkeyHash для маршрутизации (только handleId)
❌ НЕ синхронизировать CryptoKey между устройствами (нарушает E2EE)
❌ НЕ читать identityId из localStorage (только из React-контекста)
```

---

## 13. Что ОБЯЗАТЕЛЬНО делать

```
✅ Шифровать все данные на клиенте перед отправкой
✅ Использовать CryptoKey с extractable: false для всех операций
✅ Передавать identityId и handleId явно из React-контекста в сервисы
✅ Проверять checksum файла после расшифровки
✅ Реализовать дедупликацию по messageId для входящих сообщений
✅ Очищать орфанные сессии в Redis при disconnect
✅ Мониторить квоту IndexedDB и предупреждать пользователя
✅ Кэшировать CryptoKey в RAM для производительности (с очисткой при logout)
✅ Использовать presigned URLs с TTL 15 минут для файлов
✅ Удалять ключи из IndexedDB и RAM при logout
✅ Обрабатывать отсутствие CryptoKey модалкой восстановления доступа
```

---

## 14. Заключение

Реализация real-time синхронизации между устройствами для BeSafeChat:

- 🔐 **Сохраняет принципы E2EE**: все данные шифруются на клиенте, ключи не покидают устройство
- ⚡ **Обеспечивает отличный UX**: мгновенная доставка сообщений, синхронизация статусов в реальном времени
- 🔄 **Масштабируется**: поддержка неограниченного количества сессий через Redis
- 🛡️ **Защищена от современных угроз**: XSS, компрометация сервера, утечки ключей
- 🧩 **Имеет чистую архитектуру**: явные зависимости, тестируемость, возможность эволюции

**Следующий шаг**: Приступить к реализации Этапа 0 (интеграция CryptoKey-архитектуры) и параллельно подготовить Redis-инфраструктуру.

---

> 📄 **История версий**  
> **v2.0** (Февраль 2026): Полная актуализация под CryptoKey-архитектуру, замена `pubkeyHash` на `handleId`/`identityId`, добавление защиты от XSS через `extractable: false`, документирование мульти-девайс деривации ключей, явная передача `identityId` в сервисы.  
> **v1.0** (Исходная версия): Базовый план real-time синхронизации.

> 🗑️ **Статус документа**: Готов к использованию. Архитектурные решения согласуются с реализованной криптографической базой BeSafeChat.
