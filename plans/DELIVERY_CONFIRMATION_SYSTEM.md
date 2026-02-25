# 📦 Message Delivery Confirmation System

**Дата:** 20 февраля 2026  
**Версия:** 2.0 (Smart presence-based delivery)  
**Статус:** Готово к реализации

---

## 🎯 Принципы

### 1. Client знает presence ДО отправки

```
┌──────────────┐
│ Client 1     │
│              │
│ Перед отпр:  │
│ getOnlineStatus(toHandleId)?
│ YES → SENT   │
│ NO  → QUEUED │
└──────────────┘
```

Это **критично**: начальный статус определяется контекстом, а не сервером.

### 2. Server слепой к доставке

```
Server видит (message_index):
  ├─ messageId
  ├─ chatId
  ├─ senderHandleId
  ├─ timestamp
  ├─ contentHash
  └─ isDeleted

Server НЕ видит:
  ├─ Был ли доставлен
  ├─ Был ли прочитан
  └─ encryptedPayload (хранится отдельно)
```

### 3. Доставка в два сценария

```
A. ONLINE RECIPIENT (presence = true)
   ├─ Отправитель знает это ДО отправки
   ├─ POST /messages
   ├─ Server: WebSocket EMIT to recipient (online)
   ├─ Recipient: Receive → Save → ACK
   ├─ Server: Forward ACK to sender
   └─ Sender: Update status SENT → DELIVERED

B. OFFLINE RECIPIENT (presence = false)
   ├─ Отправитель знает это ДО отправки
   ├─ POST /messages
   ├─ Server: Push to Redis pending_msgs
   ├─ Отправитель: status = QUEUED
   ├─ Recipient: Connect → Fetch pending
   ├─ Recipient: Batch ACK all pending
   ├─ Server: Forward batch ACKs to sender
   └─ Sender: Update statuses QUEUED → DELIVERED
```

---

## 🔄 Детальные Флоу

### Scenario A: ONLINE Delivery (мгновенно)

```
TIMELINE:

t=0ms   SENDER: Compose message
        ├─ getOnlineStatus(recipient) = TRUE (из context!)
        ├─ Create: { messageId, text, ... }
        ├─ Encrypt locally
        ├─ Save to IndexedDB
        │  status: SENDING
        └─ POST /messages

t=10ms  SERVER:
        ├─ Create message_index entry
        ├─ Store encryptedPayload in blob storage
        ├─ Check: online:{toHandleId} exists?
        │  YES (из Redis presence tracking)
        ├─ WebSocket emit to room user:{toHandleId}
        │  { type: 'message:new', messageId, encryptedPayload, ... }
        └─ Return 200 { success, messageId, status: 'sent' }

t=50ms  SENDER: Receive 200 response
        ├─ Update local IndexedDB
        │  status: SENDING → SENT
        │  sentAt: now()
        └─ UI: "Отправлено" (grey checkmark, clock icon)

t=100ms RECIPIENT: WebSocket event 'message:new'
        ├─ Decrypt encryptedPayload locally
        ├─ Save to IndexedDB
        ├─ Generate ACK: { messageId, type: 'delivery', fromHandleId: recipient }
        └─ POST /ack

t=150ms SERVER: Receive ACK
        ├─ Redis SET delivery:{messageId} = timestamp (TTL 24h)
        ├─ Find sender's WebSocket room: user:{senderHandleId}
        └─ WebSocket emit 'delivery:confirmed'
           { messageId, deliveredAt, fromHandleId }

t=200ms SENDER: WebSocket event 'delivery:confirmed'
        ├─ Find message in IndexedDB
        ├─ Update status: SENT → DELIVERED
        │  deliveredAt: now()
        └─ UI: "Доставлено" (green checkmark) ✅

5sec    RECIPIENT: User reads message
        ├─ Mark as read in UI
        └─ POST /ack { messageId, type: 'read' }

5.1s    SERVER: Receive read ACK
        ├─ Redis SET read:{messageId} = timestamp (TTL 24h)
        ├─ WebSocket emit to sender: 'read:confirmed'
        └─ { messageId, readAt, fromHandleId }

5.2s    SENDER: WebSocket event 'read:confirmed'
        ├─ Update status: DELIVERED → READ
        │  readAt: now()
        └─ UI: "Прочитано" (blue double checkmark) 👁️
```

### Scenario B: OFFLINE Buffering + Batch Delivery

```
TIMELINE:

t=0ms   SENDER: Compose message
        ├─ getOnlineStatus(recipient) = FALSE (из context!)
        ├─ Create: { messageId, text, ... }
        ├─ Encrypt locally
        ├─ Save to IndexedDB
        │  status: SENDING
        └─ POST /messages

t=10ms  SERVER:
        ├─ Create message_index entry
        ├─ Store encryptedPayload in blob storage
        ├─ Check: online:{toHandleId} exists?
        │  NO (recipient offline)
        ├─ LPUSH pending_msgs:{toHandleId}
        │  {
        │    messageId, chatId, fromHandleId,
        │    encryptedPayload, timestamp
        │  }
        │  TTL: 7 days
        └─ Return 200 { success, messageId, status: 'queued' }

t=50ms  SENDER: Receive 200 response + status: 'queued'
        ├─ Update local IndexedDB
        │  status: SENDING → QUEUED
        │  sentAt: now()
        └─ UI: "В очереди" (cloud icon with "offline" hint)

--- RECIPIENT OFFLINE FOR 30 SECONDS ---

t=30s   RECIPIENT: WebSocket CONNECT
        ├─ Authenticate
        └─ (socket connected, not yet in room)

t=30.1s SERVER: handleConnection() triggered
        ├─ Extract activeHandleId from session
        ├─ Store in Redis: online:{activeHandleId} with TTL 120s
        ├─ Call notifyContactsUserOnline(activeHandleId)
        │  (sends 'user_online' events to all contacts)
        │
        ├─ [NEW] Check pending_msgs:{activeHandleId}
        │  LRANGE pending_msgs:{activeHandleId} 0 -1
        │  Result: [msg_001_JSON, msg_002_JSON, ...]
        │
        ├─ WebSocket emit to recipient: 'pending:messages'
        │  {
        │    type: 'pending:messages',
        │    messages: [ msg_001, msg_002, ... ],
        │    count: N
        │  }
        │
        └─ (Do NOT delete from Redis yet - let ACK confirm)

t=30.5s SENDER: Receives 'user_online' event from gateway
        ├─ Context updated: getOnlineStatus(recipient) = TRUE
        ├─ For each QUEUED message to this recipient:
        │  └─ [OPTIONAL] Optimistically update status → SENT
        │     (Because now they're online, assume fast delivery)
        └─ UI updates icons

t=30.6s RECIPIENT: Receives 'pending:messages' event
        ├─ For each message in batch:
        │  ├─ Decrypt encryptedPayload locally
        │  ├─ Save to IndexedDB
        │  └─ Collect messageId for batch ACK
        │
        ├─ Generate batch ACK (single POST):
        │  POST /ack (batch)
        │  {
        │    messages: [
        │      { messageId: msg_001, type: 'delivery' },
        │      { messageId: msg_002, type: 'delivery' },
        │      ...
        │    ]
        │  }
        │
        └─ (Do NOT delete from Redis locally)

t=31ms  SERVER: Receive batch ACK
        ├─ For each messageId:
        │  ├─ Redis SET delivery:{messageId} = timestamp (TTL 24h)
        │  ├─ Redis SADD fully_delivered:{toHandleId} messageId
        │  │  (Track which messages in Redis are fully delivered)
        │  │  (So we don't resend on reconnect)
        │  │
        │  └─ Find sender's session
        │
        ├─ Check: sender online?
        │  ├─ YES → WebSocket emit batch ACKs immediately
        │  │        { type: 'delivery:batch_confirmed',
        │  │          acks: [ {messageId, deliveredAt, ...}, ... ]
        │  │        }
        │  │
        │  └─ NO → Cache in Redis (pending_acks:{senderHandleId})
        │          [ {messageId, type: 'delivery', timestamp}, ... ]
        │          TTL: 24h
        │          (When sender comes online, fetch and forward)

t=31.5s SENDER: (if online)
        ├─ Receives 'delivery:batch_confirmed' event
        ├─ For each ack in batch:
        │  ├─ Find message in IndexedDB
        │  ├─ Update status: QUEUED → DELIVERED
        │  │  deliveredAt: ackTimestamp
        │  └─ UI: Update icon from cloud → green checkmark
        │
        └─ All messages delivered! ✅

--- BATCH CLEANUP (Daily Cron Job) ---

t=next_day
        SERVER Cron Job:
        ├─ For each Redis key: pending_msgs:{handleId}
        │  ├─ For each message in the list:
        │  │  └─ Check: SISMEMBER fully_delivered:{handleId} messageId?
        │  │     ├─ YES → Safe to delete, message was delivered
        │  │     └─ NO → Message pending, keep in Redis
        │  │
        │  └─ Optional: LREM pending_msgs:{handleId} by fully_delivered set
        │
        ├─ Clean old delivery cache:
        │  └─ DEL delivery:{messageId} where TTL expired (24h)
        │
        └─ Clean old ACK cache:
           └─ DEL pending_acks:{handleId} where TTL expired (24h)
```

---

## 🗄️ Storage Structure

### PostgreSQL: message_index (existing, no changes)

```sql
CREATE TABLE message_index (
  id UUID PRIMARY KEY,
  messageId UUID UNIQUE NOT NULL,
  chatId UUID NOT NULL,
  senderHandleId UUID NOT NULL,
  timestamp BIGINT NOT NULL,
  contentHash TEXT NOT NULL,
  isDeleted BOOLEAN DEFAULT false,
  createdAt TIMESTAMPTZ DEFAULT now()
);

-- No delivery status stored on server!
-- Server is blind to delivery
```

### Redis: Delivery Tracking

```typescript
// 1. Pending offline messages (7 days TTL)
pending_msgs:{toHandleId}
  Type: LIST
  Element: JSON {
    messageId: string,
    chatId: string,
    fromHandleId: string,
    encryptedPayload: string,
    timestamp: number
  }
  TTL: 604800 (7 days)

// 2. Tracking which messages are delivered (cleanup helper)
fully_delivered:{toHandleId}
  Type: SET
  Element: messageId
  TTL: 604800 (7 days, same as pending_msgs)

// 3. Delivery confirmation cache (for UI, sender-side)
delivery:{messageId}
  Type: STRING (timestamp)
  TTL: 86400 (24 hours)
  Purpose: Cache delivery status if sender reconnects

// 4. Read confirmation cache
read:{messageId}
  Type: STRING (timestamp)
  TTL: 86400 (24 hours)
  Purpose: Cache read status if sender reconnects

// 5. Pending ACKs for offline sender
pending_acks:{senderHandleId}
  Type: LIST
  Element: JSON {
    messageId: string,
    type: 'delivery' | 'read',
    fromHandleId: string,
    timestamp: number
  }
  TTL: 86400 (24 hours)
  Purpose: Store ACKs while sender is offline
  Action: On sender login, fetch and forward via WebSocket
```

### Client: IndexedDB Message Schema

```typescript
export interface Message {
  messageId: string;
  chatId: string;
  senderHandleId: string;
  
  // ← Delivery Status (critical!)
  status: 'SENDING' | 'SENT' | 'QUEUED' | 'DELIVERED' | 'READ';
  
  // ← Timestamps
  createdAt: number;        // When we created locally
  sentAt?: number;          // When server accepted
  deliveredAt?: number;     // When recipient got it
  readAt?: number;          // When recipient read it
  
  // ← E2EE (immutable)
  encryptedPayload: string;
  contentHash: string;
  timestamp: number;
  
  // ← Rich metadata (client-side only)
  type: 'text' | 'image' | 'file' | 'audio' | 'video';
  text?: string;
  reactions?: Array<{
    emoji: string;
    handleId: string;
    timestamp: number;
  }>;
  isPinned?: boolean;
  replyToMessageId?: string;
  displayName?: string;
  
  // ← Flags
  isDeleted?: boolean;
  isEdited?: boolean;
}
```

---

## 🔌 WebSocket Events

### Sender → Server → Recipient (messages)

```typescript
// SENDING (client to server)
socket.emit('message', {
  messageId: string,
  chatId: string,
  toHandleId: string,
  encryptedPayload: string,
  timestamp: number
});

// SERVER processes, then broadcasts:
// If recipient online:
socket.to(`user:${toHandleId}`).emit('message:new', {
  id: messageId,
  from: fromHandleId,
  chatId,
  encryptedPayload,
  timestamp
});

// If recipient offline:
socket.to(`user:${fromHandleId}`).emit('message:accepted', {
  messageId,
  status: 'queued', // NOT 'sent' - it's buffered
  timestamp
});
```

### Recipient → Server → Sender (ACKs)

```typescript
// SINGLE ACK (recipient to server)
socket.emit('ack', {
  messageId: string,
  type: 'delivery' | 'read',
  fromHandleId: string // recipient (who's sending ACK)
});

// BATCH ACK (recipient to server, when coming online)
socket.emit('ack:batch', {
  messages: [
    { messageId: string, type: 'delivery' },
    { messageId: string, type: 'delivery' },
    ...
  ]
});

// SERVER forwards to sender:
socket.to(`user:${senderHandleId}`).emit('delivery:confirmed', {
  messageId: string,
  deliveredAt: number,
  fromHandleId: string  // Who delivered (recipient)
});

// OR batch:
socket.to(`user:${senderHandleId}`).emit('delivery:batch_confirmed', {
  acks: [
    { messageId, deliveredAt, fromHandleId },
    ...
  ]
});
```

### Online/Offline Events (existing)

```typescript
// These already work! No changes needed.
socket.to(`user:${handleId}`).emit('user_online', {
  handleId: activeHandleId
});

socket.to(`user:${handleId}`).emit('user_offline', {
  handleId: activeHandleId
});

// But now we also emit pending messages on connect:
socket.emit('pending:messages', {
  type: 'pending:messages',
  messages: [ ... ],
  count: N
});
```

---

## 📋 Client Implementation Flow

### Sending a Message

```typescript
// 1. User composes and sends
async function sendMessage(text: string, toHandleId: string, chatId: string) {
  const messageId = generateUUID();
  
  // 2. Check presence BEFORE sending
  const isOnline = getOnlineStatus(toHandleId);
  
  // 3. Encrypt and save locally (status = SENDING)
  const encryptedPayload = encrypt(text, privateKeyHash);
  await db.messages.add({
    messageId,
    chatId,
    senderHandleId: myHandleId,
    toHandleId,
    status: 'SENDING',
    createdAt: Date.now(),
    encryptedPayload,
    text, // metadata
    type: 'text'
  });
  
  // 4. Update UI (show spinner)
  updateMessageUI(messageId, 'SENDING');
  
  // 5. Send to server
  try {
    const response = await POST('/messages', {
      messageId,
      chatId,
      toHandleId,
      encryptedPayload,
      timestamp: Date.now()
    });
    
    // 6. Server responded with status
    const { status } = response; // 'sent' or 'queued'
    
    // 7. Update local status based on response
    if (status === 'sent') {
      await db.messages.update(messageId, {
        status: 'SENT',
        sentAt: Date.now()
      });
      updateMessageUI(messageId, 'SENT'); // grey checkmark, clock
    } else if (status === 'queued') {
      await db.messages.update(messageId, {
        status: 'QUEUED',
        sentAt: Date.now()
      });
      updateMessageUI(messageId, 'QUEUED'); // cloud icon
    }
    
  } catch (error) {
    // Network error - status stays SENDING
    updateMessageUI(messageId, 'SENDING_FAILED');
  }
}

// 8. Listen for delivery ACKs (WebSocket)
socket.on('delivery:confirmed', (data) => {
  const { messageId, deliveredAt } = data;
  
  // Update message
  await db.messages.update(messageId, {
    status: 'DELIVERED',
    deliveredAt
  });
  
  // Update UI (green checkmark)
  updateMessageUI(messageId, 'DELIVERED');
});

// 9. Listen for batch delivery ACKs (when recipient comes online)
socket.on('delivery:batch_confirmed', (data) => {
  const { acks } = data;
  
  for (const ack of acks) {
    const { messageId, deliveredAt } = ack;
    
    // Update all QUEUED messages to DELIVERED
    await db.messages.update(messageId, {
      status: 'DELIVERED',
      deliveredAt
    });
    
    updateMessageUI(messageId, 'DELIVERED');
  }
});

// 10. Listen for read ACKs
socket.on('read:confirmed', (data) => {
  const { messageId, readAt } = data;
  
  await db.messages.update(messageId, {
    status: 'READ',
    readAt
  });
  
  updateMessageUI(messageId, 'READ'); // blue double checkmark
});
```

### Receiving a Message

```typescript
// 1. Listen for incoming messages (existing)
socket.on('message:new', async (data) => {
  const { id: messageId, from: fromHandleId, chatId, encryptedPayload, timestamp } = data;
  
  // 2. Decrypt locally
  const text = decrypt(encryptedPayload, privateKeyHash);
  
  // 3. Save to IndexedDB
  await db.messages.add({
    messageId,
    chatId,
    senderHandleId: fromHandleId,
    status: 'RECEIVED', // Mark as received
    createdAt: Date.now(),
    encryptedPayload,
    text,
    type: 'text'
  });
  
  // 4. Send ACK immediately
  socket.emit('ack', {
    messageId,
    type: 'delivery',
    fromHandleId: myHandleId
  });
  
  // 5. Update UI (show message in chat)
  addMessageToChat(chatId, messageId, text);
});

// 2b. Listen for pending messages (batch, when coming online)
socket.on('pending:messages', async (data) => {
  const { messages } = data;
  
  for (const msg of messages) {
    const { messageId, encryptedPayload, fromHandleId, chatId, timestamp } = msg;
    
    // Decrypt
    const text = decrypt(encryptedPayload, privateKeyHash);
    
    // Save to IndexedDB
    await db.messages.add({
      messageId,
      chatId,
      senderHandleId: fromHandleId,
      status: 'RECEIVED',
      createdAt: Date.now(),
      encryptedPayload,
      text
    });
  }
  
  // Send batch ACK
  socket.emit('ack:batch', {
    messages: messages.map(m => ({
      messageId: m.messageId,
      type: 'delivery'
    }))
  });
  
  // Update UI (show all messages)
  for (const msg of messages) {
    addMessageToChat(msg.chatId, msg.messageId, decrypt(msg.encryptedPayload));
  }
});

// 3. When user reads message
function markMessageAsRead(messageId: string) {
  // Update local
  await db.messages.update(messageId, { status: 'READ' });
  
  // Send ACK
  socket.emit('ack', {
    messageId,
    type: 'read',
    fromHandleId: myHandleId
  });
}
```

---

## 🎯 Server Implementation (Backend Changes)

### 1. POST /messages (modify existing)

```typescript
@Post('/messages')
async sendMessage(@Body() dto: SendMessageDto, @Session() session: Session) {
  const { messageId, chatId, toHandleId, encryptedPayload, timestamp } = dto;
  
  // 1. Create message_index entry
  await this.messageIndexService.create({
    messageId,
    chatId,
    senderHandleId: session.activeHandleId,
    timestamp,
    contentHash: sha256(encryptedPayload),
    isDeleted: false
  });
  
  // 2. Store encrypted payload
  await this.blobStorage.upload(`messages/${messageId}`, encryptedPayload);
  
  // 3. Check if recipient is online
  const redis = this.redisService.getClient();
  const isOnline = await redis.exists(`online:${toHandleId}`);
  
  let status = 'queued';
  
  if (isOnline) {
    // 4a. Recipient is online - emit message
    this.socketServer
      .to(`user:${toHandleId}`)
      .emit('message:new', {
        id: messageId,
        from: session.activeHandleId,
        chatId,
        encryptedPayload,
        timestamp
      });
    
    status = 'sent';
  } else {
    // 4b. Recipient is offline - buffer in Redis
    await redis.lpush(
      `pending_msgs:${toHandleId}`,
      JSON.stringify({
        messageId,
        chatId,
        fromHandleId: session.activeHandleId,
        encryptedPayload,
        timestamp
      })
    );
    
    // Set TTL 7 days
    await redis.expire(`pending_msgs:${toHandleId}`, 7 * 24 * 60 * 60);
  }
  
  return { success: true, messageId, status };
}
```

### 2. WebSocket: @SubscribeMessage('ack')

```typescript
@SubscribeMessage('ack')
async handleAck(client: Socket, payload: AckPayload) {
  const { messageId, type, fromHandleId } = payload;
  
  // fromHandleId = recipient who's sending ACK
  // Extract sender from message_index
  const msgIndex = await this.messageIndexService.findById(messageId);
  const senderHandleId = msgIndex.senderHandleId;
  
  // 1. Cache the ACK in Redis (for sender's UI)
  const cacheKey = type === 'delivery' ? `delivery:${messageId}` : `read:${messageId}`;
  await redis.setex(cacheKey, 24 * 60 * 60, Date.now().toString());
  
  // 2. Find sender's session
  const senderSession = await this.sessionService.findByHandleId(senderHandleId);
  
  if (senderSession && this.socketServer.sockets.adapter?.rooms?.get(`user:${senderHandleId}`)) {
    // 3a. Sender is online - forward ACK immediately
    this.socketServer
      .to(`user:${senderHandleId}`)
      .emit(type === 'delivery' ? 'delivery:confirmed' : 'read:confirmed', {
        messageId,
        [`${type}At`]: Date.now(),
        fromHandleId
      });
  } else {
    // 3b. Sender is offline - cache ACK for later
    await redis.lpush(
      `pending_acks:${senderHandleId}`,
      JSON.stringify({
        messageId,
        type,
        fromHandleId,
        timestamp: Date.now()
      })
    );
    
    await redis.expire(`pending_acks:${senderHandleId}`, 24 * 60 * 60);
  }
}
```

### 3. WebSocket: @SubscribeMessage('ack:batch')

```typescript
@SubscribeMessage('ack:batch')
async handleBatchAck(client: Socket, payload: BatchAckPayload) {
  const { messages } = payload;
  const fromHandleId = client.data.activeHandleId; // recipient
  
  // Extract senders and group by sender
  const acksGroupedBySender = new Map<string, any[]>();
  
  for (const msg of messages) {
    const { messageId, type } = msg;
    
    // Get sender
    const msgIndex = await this.messageIndexService.findById(messageId);
    const senderHandleId = msgIndex.senderHandleId;
    
    // Cache the ACK
    const cacheKey = type === 'delivery' ? `delivery:${messageId}` : `read:${messageId}`;
    await redis.setex(cacheKey, 24 * 60 * 60, Date.now().toString());
    
    // Mark as fully delivered
    if (type === 'delivery') {
      await redis.sadd(`fully_delivered:${fromHandleId}`, messageId);
    }
    
    // Group by sender
    if (!acksGroupedBySender.has(senderHandleId)) {
      acksGroupedBySender.set(senderHandleId, []);
    }
    
    acksGroupedBySender.get(senderHandleId)!.push({
      messageId,
      type,
      fromHandleId,
      timestamp: Date.now()
    });
  }
  
  // 2. Forward ACKs to each sender
  for (const [senderHandleId, acks] of acksGroupedBySender) {
    // Check if sender is online
    const senderRoom = this.socketServer.sockets.adapter?.rooms?.get(`user:${senderHandleId}`);
    
    if (senderRoom && senderRoom.size > 0) {
      // Sender is online - forward batch
      this.socketServer
        .to(`user:${senderHandleId}`)
        .emit('delivery:batch_confirmed', { acks });
    } else {
      // Sender is offline - cache batch
      for (const ack of acks) {
        await redis.lpush(
          `pending_acks:${senderHandleId}`,
          JSON.stringify(ack)
        );
      }
      
      await redis.expire(`pending_acks:${senderHandleId}`, 24 * 60 * 60);
    }
  }
}
```

### 4. WebSocket: handleConnection (modify existing)

```typescript
async handleConnection(client: Socket) {
  try {
    // ... existing authentication code ...
    
    const handleId = session.activeHandleId;
    
    // ... existing code (set online:, notify contacts, etc.) ...
    
    // [NEW] Check for pending ACKs (messages we need to deliver to this user)
    const pendingAcks = await redis.lrange(`pending_acks:${handleId}`, 0, -1);
    
    if (pendingAcks.length > 0) {
      // Parse and send all pending ACKs
      const acks = pendingAcks.map(ack => JSON.parse(ack));
      
      // Separate by type
      const deliveryAcks = acks.filter(a => a.type === 'delivery');
      const readAcks = acks.filter(a => a.type === 'read');
      
      // Send to client
      if (deliveryAcks.length > 0) {
        client.emit('delivery:batch_confirmed', { acks: deliveryAcks });
      }
      
      if (readAcks.length > 0) {
        client.emit('read:batch_confirmed', { acks: readAcks });
      }
      
      // Clear cache
      await redis.del(`pending_acks:${handleId}`);
      
      console.log(`📬 Delivered ${acks.length} pending ACKs to ${handleId}`);
    }
    
    // [NEW] Check for pending messages (if recipient was offline)
    const pendingMsgs = await redis.lrange(`pending_msgs:${handleId}`, 0, -1);
    
    if (pendingMsgs.length > 0) {
      // Parse and send all pending messages
      const messages = pendingMsgs.map(msg => JSON.parse(msg));
      
      client.emit('pending:messages', {
        type: 'pending:messages',
        messages,
        count: messages.length
      });
      
      console.log(`📭 Sent ${messages.length} pending messages to ${handleId}`);
    }
  } catch (error) {
    console.error('❌ WebSocket connection error:', error);
    client.disconnect(true);
  }
}
```

### 5. Daily Cleanup Cron Job

```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async cleanupDeliveryCache() {
  const redis = this.redisService.getClient();
  
  // Find all pending_msgs keys
  const keys = await redis.keys('pending_msgs:*');
  
  for (const key of keys) {
    const handleId = key.replace('pending_msgs:', '');
    
    // Get all message IDs in this list
    const messages = await redis.lrange(key, 0, -1);
    
    // Check which ones are fully delivered
    for (const msgJson of messages) {
      const { messageId } = JSON.parse(msgJson);
      
      const isDelivered = await redis.sismember(
        `fully_delivered:${handleId}`,
        messageId
      );
      
      if (isDelivered) {
        // Safe to remove from pending
        await redis.lrem(key, 0, msgJson);
      }
    }
  }
  
  console.log('🧹 Cleaned up delivery cache');
}
```

---

## 🎨 UI Implementation

### Message Status Icons

```
SENDING     → ⏳ (grey, animated spinner)
SENT        → ✓ (grey checkmark, clock)
QUEUED      → ☁️ (grey cloud, with "recipient offline" tooltip)
DELIVERED   → ✓✓ (green double checkmark)
READ        → ✓✓ (blue double checkmark)
```

### Display Logic

```typescript
function getMessageStatusDisplay(message: Message) {
  switch (message.status) {
    case 'SENDING':
      return { icon: '⏳', color: 'grey', label: 'Sending...' };
    case 'SENT':
      return { icon: '✓', color: 'grey', label: 'Sent' };
    case 'QUEUED':
      return { icon: '☁️', color: 'grey', label: 'Queued (recipient offline)' };
    case 'DELIVERED':
      return { icon: '✓✓', color: 'green', label: 'Delivered' };
    case 'READ':
      return { icon: '✓✓', color: 'blue', label: 'Read' };
    default:
      return { icon: '?', color: 'grey', label: 'Unknown' };
  }
}
```

---

## ✅ Implementation Checklist

### Backend

- [ ] Modify POST /messages to return status ('sent' or 'queued')
- [ ] Add @SubscribeMessage('ack') handler
- [ ] Add @SubscribeMessage('ack:batch') handler
- [ ] Modify handleConnection to:
  - [ ] Fetch pending_acks
  - [ ] Fetch pending_msgs
  - [ ] Emit to client
- [ ] Create daily cleanup cron job
- [ ] Add Redis keys: delivery:{messageId}, read:{messageId}, pending_acks:{handleId}, fully_delivered:{handleId}
- [ ] Add database migration for message_index (if needed)

### Frontend

- [ ] Add status field to IndexedDB Message schema (v5)
- [ ] Update sendMessage flow to:
  - [ ] Check getOnlineStatus before sending
  - [ ] Save with status SENDING
  - [ ] Update to SENT or QUEUED based on response
- [ ] Add WebSocket listeners: delivery:confirmed, delivery:batch_confirmed, read:confirmed, read:batch_confirmed, pending:messages
- [ ] Implement batch ACK sending (ack:batch)
- [ ] Update message UI to show status icons
- [ ] Handle graceful degradation (if ACK never arrives)

### Testing

- [ ] Test online delivery (SENT → DELIVERED)
- [ ] Test offline buffering (QUEUED → DELIVERED on reconnect)
- [ ] Test batch ACKs
- [ ] Test offline sender (pending_acks caching)
- [ ] Test message read receipts
- [ ] Test cleanup cron job

---

## 🔍 Key Differences from v1

| Aspect | v1 | v2 |
|--------|----|----|
| Status determination | Server decides | Client decides (based on presence) |
| Initial status | Always SENT | SENT (if online) or QUEUED (if offline) |
| Offline buffering | Optional | Always (if recipient offline) |
| Batch ACKs | Single ACK per message | Batch ACKs on reconnect |
| Pending ACKs | Not cached | Cached in Redis, delivered on login |
| Server knowledge | Full delivery tracking | Blind to delivery status |

---

## 📌 Critical Notes

1. **Presence is authoritative**: Client determines status BEFORE sending, based on Online Status Context.
2. **Server is blind**: No delivery tracking on server. All status is client-side + Redis cache.
3. **E2EE compliant**: Server never sees message content or patterns.
4. **Batch efficiency**: Offline users send one batch ACK (not N individual ACKs).
5. **Offline sender**: ACKs cached in Redis and delivered when sender comes online.
