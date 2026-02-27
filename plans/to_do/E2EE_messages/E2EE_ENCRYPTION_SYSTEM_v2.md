# 📄 Техническое задание: End-to-End Encryption System v2 с поддержкой групповых чатов

## 1. Цель

Реализовать **полностью зашифрованный E2EE мессенджер** с поддержкой **1:1 и групповых чатов**:

- **Нулевое знание сервера** о содержимом сообщений
- **Два режима регистрации:**
  1. Cloud Recovery (seed зашифрован под паролем в S3)
  2. Self-Custody (seed только в голове, с ленивой активацией)
- **X3DH (Triple Diffie-Hellman)** для установления ключей в 1:1 чатах
- **Групповая E2EE архитектура:**
  - Tree-based approach (Messaging Layer Security — MLS-подобный)
  - Или Simple Fanout (каждый отправитель шифрует для каждого получателя)
- **Double Ratchet Algorithm** для прямой секретности (forward secrecy)
- **Отличный UX** в обоих режимах без повторного ввода seed

---

## 2. Архитектура E2EE (обновленная)

### 2.1 Типы чатов

| Тип | Участники | E2EE механизм | Сложность | Примечание |
|-----|-----------|---------------|-----------|-----------|
| **1:1 чат** | 2 | X3DH + Double Ratchet | Простая | Текущая реализация |
| **Групповой чат** | N (2-100) | Group Key Exchange (GKE) | Средняя | NEW: v2 |

### 2.2 Модель безопасности (без изменений от v1)

#### Криптографические материалы пользователя
- **Private Key (PK):** Ed25519, только в памяти при аутентификации
- **Hash Private Key (hPK):** SHA-256(PK), в памяти сессии
- **Public Key (PbK):** Хранится в БД, используется для верификации подписей
- **Handle (H):** Человекочитаемый псевдоним, один на чат

#### Pre-key материалы (X3DH)
- **Signed Pre-Key (SPK):** Долгоживущий (30 дней), подписанный PK
- **One-Time Keys (OTK):** 100 пар, потребляются один раз за чат

---

## 3. Два режима регистрации (без изменений от v1)

### 3.1 Cloud Recovery Mode
1. Пользователь вводит пароль
2. Генерируется BIP39 seed (12 слов)
3. Seed шифруется: `AES-256-GCM(seed, PBKDF2(password))`
4. Загружается в S3: `s3://besafe-seeds/{handle_id}/encrypted_seed`

### 3.2 Self-Custody Mode (Lazy Activation)
1. Генерируется BIP39 seed (12 слов)
2. Пользователь записывает seed
3. Seed НЕ хранится нигде
4. При логине: ввод 12 слов → вычисление hPK → загрузка pre-keys из IndexedDB
5. **Ленивая активация:** Pre-keys используются 30 дней, затем нужна переинициализация

---

## 4. Два типа чатов и их E2EE механизмы

### 4.1 1:1 Чат (One-to-One)

#### Сценарий установления ключа
```
Alice (Отправитель)              Bob (Получатель)
───────────────────              ────────────────

Fetch Bob's pre-keys:
- IK_B (Identity Key)
- SPK_B (Signed Pre-Key)
- OTK_B (One-Time Key)

X3DH Protocol:
─────────────
DH1 = DH(IK_A, SPK_B)
DH2 = DH(EK_A, IK_B)
DH3 = DH(EK_A, SPK_B)

CK = HKDF(DH1 || DH2 || DH3 || OTK_B, info="chat")

Store CK in IndexedDB:
{
  chatId,
  chatKey: CK,
  participantCount: 2,
  participantIds: [aliceId, bobId],
  isGroup: false,
  createdAt: now
}
```

**Per-Message Encryption (Double Ratchet Simplified):**
```
For message N:
─────────────
messageKey = HKDF(CK, salt=N, info="BeChat.MessageKey.v1")
IV = random(12 bytes)
ciphertext = AES-256-GCM(message, messageKey, IV)
```

---

### 4.2 Групповой чат (Group Chat)

#### Новое: Групповая архитектура с поддержкой масштабирования

**Два подхода:**

##### Вариант A: Simple Fanout (простейший, рекомендуется для начала)
```
Отправитель (Alice) создает сообщение:
──────────────────────────────────────

1. Генерирует групповой key derivation для каждого участника
2. Для каждого участника N:
   - participantKey_N = HKDF(groupSecret, salt=participantId, info="participant")
   - Шифрует сообщение: ciphertext_N = AES-256-GCM(message, participantKey_N)
3. Отправляет на сервер один раз
4. Сервер отправляет каждому участнику свою версию (с его ciphertext_N)

Преимущества:
✅ Простая реализация
✅ Нет изменений при добавлении/удалении участников
✅ Масштабируется до 100+ участников

Недостатки:
❌ Отправитель должен знать всех участников
❌ Размер сообщения = size(message) * N (N шифротекстов)
```

##### Вариант B: Tree-based (MLS-подобный, для будущего)
```
Группа использует бинарное дерево ключей:
──────────────────────────────────────────

          Root Key (RK)
          │
      ┌───┴───┐
    Node1   Node2
    │         │
  ┌─┴─┐     ┌─┴─┐
  L1  L2   L3  L4
  │   │    │   │
  A   B    C   D

Преимущества:
✅ Сообщение отправляется один раз (размер = size(message))
✅ Динамическое добавление/удаление участников
✅ Forward secrecy и post-compromise security

Недостатки:
❌ Сложнее в реализации
❌ Нужно синхронизировать состояние дерева
```

**РЕШЕНИЕ для v2:** Начинаем с **Simple Fanout**, потом можем улучшить до Tree-based.

#### Сценарий установления группового ключа (Simple Fanout)

```
Группа создается Initiator (Alice):
────────────────────────────────────

1. Alice создает groupSecret:
   groupSecret = SHA-256(random(32) || timestamp || groupId)
   
2. Для каждого участника (включая Alice):
   participantKey_i = HKDF(groupSecret, salt=participantId, info="group_participant")
   
3. В каждом участнике это сохраняется в IndexedDB:
   {
     chatId (group),
     groupSecret,  // Базовый секрет для дериватции
     participantKeys: {
       [aliceId]: participantKey_A,
       [bobId]: participantKey_B,
       [charlieId]: participantKey_C
     },
     participantCount: 3,
     participantIds: [aliceId, bobId, charlieId],
     isGroup: true,
     createdAt: now,
     lastRekey: now
   }
```

**Per-Message in Group (Simple Fanout):**
```
Отправитель Alice отправляет сообщение:
───────────────────────────────────────

plaintext = "Hello, group!"

// Для локального хранения и своего восстановления
localMessageKey = HKDF(participantKey_A, salt=messageNumber, info="message")
localStorage = AES-256-GCM(plaintext, localMessageKey)

// Для каждого другого участника
for each participant (Bob, Charlie):
  recipientMessageKey = HKDF(participantKey_N, salt=messageNumber, info="message")
  ciphertext_N = AES-256-GCM(plaintext, recipientMessageKey)
  
  ServerMessage {
    chatId,
    messageNumber,
    ciphertext_N,  // Зашифровано под Bob/Charlie
    senderHandle,
    timestamp
  }

Сервер роутит каждый ciphertext_N нужному участнику.
```

**При получении сообщения в группе:**
```
Bob получает от Alice:
──────────────────────

1. Fetch: ciphertext_B (зашифрован под Bob)
2. Имеет: participantKey_B, messageNumber
3. Вычисляет: messageKey_B = HKDF(participantKey_B, salt=messageNumber, info="message")
4. Расшифровывает: plaintext = AES-256-GCM.decrypt(ciphertext_B, messageKey_B)
```

#### Управление участниками в группе

**Добавление участника:**
```
1. Initiator знает groupSecret
2. Вычисляет для новичка: newParticipantKey = HKDF(groupSecret, salt=newParticipantId, info="...")
3. Отправляет (зашифровано под публичным ключом новичка):
   - groupSecret (в зашифрованном виде)
   - Или более безопасно: derivedKey для новичка
4. Новичок сохраняет в IndexedDB
```

**Удаление участника:**
```
1. Initiator генерирует newGroupSecret
2. Rekeying: все участники (кроме удаленного) получают новый secret
3. Старые сообщения остаются расшифровываемыми
4. Новые сообщения используют newGroupSecret
```

---

## 5. X3DH Protocol (для 1:1 чатов, без изменений от v1)

### 5.1 Структура ключей участников

**Alice (Отправитель):**
- `IK_A` (Identity Key — долгоживущий)
- `EK_A` (Ephemeral Key — один раз для этого чата)

**Bob (Получатель):**
- `IK_B` (Identity Key — долгоживущий)
- `SPK_B` (Signed Pre-Key — живет 30 дней)
- `OTK_B` (One-Time Key — потребляется один раз)

### 5.2 Процесс

```
Alice инициирует 1:1 чат с Bob:
──────────────────────────────

1. Запрашивает у сервера pre-keys Bob:
   GET /crypto/prekeys/{bobHandleId}
   Response: {spk_pk, spk_signature, otk_pks[], prekey_id}

2. Выполняет X3DH:
   - Генерирует ephemeral key pair (EK_A)
   - Вычисляет:
     DH1 = DH(IK_A.sk, SPK_B.pk)
     DH2 = DH(EK_A.sk, IK_B.pk)
     DH3 = DH(EK_A.sk, SPK_B.pk)
     DH4 = DH(IK_A.sk, OTK_B.pk)  ← использует OTK!
   
   - KDF:
     KM = KDF(DH1 || DH2 || DH3 || DH4)
     CK = KM[0:32]  (Chat Key)

3. Сохраняет в IndexedDB:
   session.chats[chatId] = {
     chatKey: CK,
     ephemeralPublicKey: EK_A.pk,
     usedOTK: otk_id,
     participantIds: [aliceId, bobId],
     isGroup: false
   }

4. Отправляет первое сообщение на сервер:
   {
     chatId,
     messageNumber: 1,
     ciphertext,
     iv,
     ephemeralPublicKey: EK_A.pk,
     usedOTK_pk: OTK_B.pk,
     timestamp
   }
```

---

## 6. Ленивая активация seed (Lazy Activation, без изменений от v1)

### 6.1 Сценарий

```
День 1: Первый логин (Self-Custody)
───────────────────────────────────

1. Пользователь вводит 12-слов seed
2. PK = BIP39.derive(seed) → ed.getPublicKey()
3. hPK = SHA-256(PK) → в памяти
4. PK СТИРАЕТСЯ из памяти
5. Генерируются SPK и 100 OTK
6. Шифруются под hPK → IndexedDB (session_prekeys)
7. Expires: now + 30 days
8. seed СТИРАЕТСЯ из памяти ✅

День 2-30: Браузер открыт
──────────────────────────

• Пользователь может создавать чаты (1:1 и группы)
• Pre-keys используются из IndexedDB
• БЕЗ повторного ввода seed

День 31: После истечения
─────────────────────────

• При следующем логине: expires_at < now?
• Запросить ввод seed снова
• Повторить генерацию pre-keys
```

---

## 7. Структура данных в IndexedDB

### 7.1 Для всех чатов (обновлено для групп)

```typescript
// Ключевой материал чата
ChatKeyMaterial = {
  chatId: string,
  type: "1:1" | "group",
  
  // Для 1:1 чатов (X3DH)
  chatKey?: Uint8Array,
  ephemeralPublicKey?: Uint8Array,
  usedOTK?: string,
  
  // Для групповых чатов (Simple Fanout)
  groupSecret?: Uint8Array,
  participantKeys?: {
    [participantId]: Uint8Array
  },
  
  // Общее
  participantIds: string[],
  participantCount: number,
  messageCounterPerParticipant?: {
    [participantId]: number  // Для отслеживания порядка
  },
  
  createdAt: number (timestamp),
  lastKeyRotationAt?: number,
  expiresAt?: number
}

// Шифрованные pre-keys в сессии (с ленивой активацией)
SessionPreKeys = {
  spk_sk_encrypted: string (base64),     // Зашифрован под hPK
  otk_sks_encrypted: string[] (base64),  // Зашифрованы под hPK
  spk_pk: string (base64),
  spk_signature: string (base64),
  otk_pks: string[] (base64),
  created_at: number,
  expires_at: number
}
```

---

## 8. Database Schema (Backend)

### 8.1 Новые таблицы для Crypto

```sql
-- Предварительные ключи (публичные, на сервере)
CREATE TABLE handle_prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handleId UUID NOT NULL REFERENCES handles(id) ON DELETE CASCADE,
  spk_pk BYTEA NOT NULL,        -- Public key SPK (32 bytes)
  spk_signature BYTEA NOT NULL, -- Signature over SPK (64 bytes)
  otk_pks BYTEA[] NOT NULL,     -- Array of public OTK keys
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  rotated_at TIMESTAMP,
  UNIQUE(handleId, created_at)
);

-- Для отслеживания использованных OTK (для безопасности)
CREATE TABLE used_otkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handleId UUID NOT NULL REFERENCES handles(id) ON DELETE CASCADE,
  otk_pk BYTEA NOT NULL,
  used_by_sender_id UUID NOT NULL,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(otk_pk, used_by_sender_id)  -- Каждый OTK используется один раз
);

-- Информация о групповых чатах (расширено)
CREATE TABLE group_chat_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES identities(id),
  group_name VARCHAR(255),
  description TEXT,
  max_members INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_rekey_at TIMESTAMP
);

-- Члены группы
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES group_chat_info(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  role VARCHAR(50) DEFAULT 'member',  -- 'admin', 'member'
  UNIQUE(group_chat_id, member_id)
);

-- Для отслеживания message counters (важно для Simple Fanout)
CREATE TABLE chat_message_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES identities(id),
  message_counter INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(chat_id, sender_id)
);
```

### 8.2 Обновленная сущность Chat

```typescript
// backend/src/domains/chat/chat.entity.ts

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'private',
  })
  type!: 'private' | 'group'; // NEW: поддержка группы

  // E2EE материалы
  @Column({ type: 'bytea', nullable: true })
  ephemeralPublicKey?: Buffer; // Для X3DH (только 1:1)

  @Column({ type: 'bytea', nullable: true })
  usedOTKey?: Buffer; // Какой OTK был использован (только 1:1)

  @Column({ type: 'uuid', nullable: true })
  groupInfoId?: string; // FK к group_chat_info (только group)

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
```

---

## 9. API Endpoints (обновленные)

### 9.1 Pre-keys Management

```http
POST /crypto/prekeys/upload
  Request: {
    spk_pk: string (base64),
    spk_signature: string (base64),
    otk_pks: string[] (base64)
  }
  Response: { success: true, prekey_id: string }

GET /crypto/prekeys/{handleId}
  Response: {
    spk_pk: string (base64),
    spk_signature: string (base64),
    otk_pks: string[] (base64),
    prekey_id: string
  }

POST /crypto/prekeys/rotate
  Request: {}
  Response: { success: true }
```

### 9.2 Messages (обновленные для групп)

```http
POST /messages/send
  Request: {
    chatId: string,
    messageNumber: number,
    messageType: "1:1" | "group",
    
    // Для 1:1
    ciphertext?: string (base64),
    iv?: string (base64),
    
    // Для группы (Simple Fanout)
    ciphertexts?: {
      [recipientId]: string (base64)
    },
    
    ephemeralPublicKey?: string (base64),
    usedOTK_pk?: string (base64),
    timestamp: number
  }
  Response: { messageId: string, delivered: boolean }

GET /messages/{chatId}
  Response: {
    messages: [{
      id: string,
      chatId: string,
      senderId: string,
      messageNumber: number,
      ciphertext: string (base64),
      iv?: string (base64),
      timestamp: number,
      // NEW: для групп
      recipientId?: string  // Для простоты указываем, кому это сообщение
    }]
  }
```

### 9.3 Group Chat Management (NEW)

```http
POST /group-chats/create
  Request: {
    participantHandleIds: string[],
    name?: string,
    description?: string
  }
  Response: {
    chatId: string,
    groupSecret?: string (base64),  // Отправляем зашифрованным!
    participantKeys: {
      [participantId]: string (base64)
    }
  }

POST /group-chats/{chatId}/add-member
  Request: {
    memberHandleId: string,
    newGroupSecret?: string (base64)  // Опционально: если нужен rekey
  }
  Response: { success: true }

POST /group-chats/{chatId}/remove-member
  Request: {
    memberHandleId: string
  }
  Response: { success: true, newGroupSecret?: string (base64) }

GET /group-chats/{chatId}/info
  Response: {
    chatId: string,
    name: string,
    members: [{
      id: string,
      handleId: string,
      role: string,
      joinedAt: string
    }]
  }
```

---

## 10. Frontend Implementation (обновленное)

### 10.1 1:1 Chat Flow

```typescript
// lib/crypto/e2ee-1-to-1.ts
export async function initiate1to1Chat(recipientHandleId: string): Promise<{
  chatId: string,
  ciphertext: string,
  ephemeralPublicKey: string
}> {
  // 1. Fetch recipient's pre-keys
  const prekeys = await fetch(`/crypto/prekeys/${recipientHandleId}`);
  
  // 2. Perform X3DH
  const { chatKey, ephemeralPublicKey, usedOTK } = await performX3DH(
    recipientPrekeys
  );
  
  // 3. Save to IndexedDB
  await db.chatKeys.put({
    chatKey,
    participantIds: [currentUserId, recipientId],
    type: '1:1'
  });
  
  // 4. Encrypt first message
  const { ciphertext, iv } = await encryptMessage(
    chatKey,
    1,  // messageNumber
    "Hello!"
  );
  
  return { chatId, ciphertext, ephemeralPublicKey };
}
```

### 10.2 Group Chat Flow (Simple Fanout)

```typescript
// lib/crypto/e2ee-group.ts
export async function createGroupChat(participantHandleIds: string[]): Promise<{
  chatId: string,
  encryptedGroupSecrets: Map<string, string>
}> {
  // 1. Generate group secret
  const groupSecret = await generateGroupSecret();
  
  // 2. Derive participant keys
  const participantKeys = new Map<string, Uint8Array>();
  for (const participantId of participantHandleIds) {
    participantKeys.set(
      participantId,
      await HKDF(
        groupSecret,
        new TextEncoder().encode(participantId),
        'group_participant'
      )
    );
  }
  
  // 3. Save to IndexedDB
  await db.chatKeys.put({
    groupSecret,
    participantKeys,
    participantIds: participantHandleIds,
    type: 'group'
  });
  
  // 4. Encrypt group secret for each participant
  const encryptedGroupSecrets = new Map<string, string>();
  for (const [participantId, pubKey] of participants) {
    const encrypted = await encryptForRecipient(groupSecret, pubKey);
    encryptedGroupSecrets.set(participantId, encrypted);
  }
  
  return { chatId, encryptedGroupSecrets };
}

export async function sendGroupMessage(
  chatId: string,
  plaintext: string
): Promise<Map<string, string>> {
  // 1. Fetch group key material from IndexedDB
  const keyMat = await db.chatKeys.get(chatId);
  
  // 2. For each participant, derive per-message key
  const ciphertexts = new Map<string, string>();
  
  for (const [participantId, participantKey] of keyMat.participantKeys) {
    const messageKey = await HKDF(
      participantKey,
      new TextEncoder().encode(messageNumber.toString()),
      'message'
    );
    
    const { ciphertext, iv } = await encryptWithKey(plaintext, messageKey);
    ciphertexts.set(participantId, base64(ciphertext));
  }
  
  // 3. Send all ciphertexts to server
  await api.post('/messages/send', {
    chatId,
    messageNumber,
    messageType: 'group',
    ciphertexts,
    timestamp: Date.now()
  });
  
  return ciphertexts;
}

export async function receiveGroupMessage(
  chatId: string,
  senderId: string,
  messageNumber: number,
  ciphertext: string
): Promise<string> {
  // 1. Fetch group key material
  const keyMat = await db.chatKeys.get(chatId);
  
  // 2. Get participant key (для меня это должно быть участником группы)
  const myParticipantKey = keyMat.participantKeys[currentUserId];
  
  // 3. Derive per-message key
  const messageKey = await HKDF(
    myParticipantKey,
    new TextEncoder().encode(messageNumber.toString()),
    'message'
  );
  
  // 4. Decrypt
  const plaintext = await decryptWithKey(
    base64ToUint8(ciphertext),
    messageKey,
    iv
  );
  
  return plaintext;
}
```

---

## 11. Backend Services (обновленные)

### 11.1 X3DH Service

```typescript
// backend/src/domains/crypto/services/x3dh.service.ts
@Injectable()
export class X3DHService {
  async validateX3DHPayload(payload: X3DHPayload): Promise<boolean> {
    // Verify X3DH payloads
  }

  async storePreKeys(
    handleId: string,
    spkPk: Uint8Array,
    spkSignature: Uint8Array,
    otkPks: Uint8Array[]
  ): Promise<void> {
    // Store in DB and update pre-key bundle
  }

  async getPreKeysForHandle(handleId: string): Promise<PreKeysResponse> {
    // Fetch and validate
  }

  async rotatePreKeys(handleId: string): Promise<void> {
    // Mark old as expired, signal client to generate new
  }

  async validateOTKUsage(
    handleId: string,
    otkPk: Uint8Array,
    senderId: string,
    chatId: string
  ): Promise<void> {
    // Prevent OTK reuse
  }
}
```

### 11.2 Group Chat Service (NEW)

```typescript
// backend/src/domains/crypto/services/group-chat.service.ts
@Injectable()
export class GroupChatService {
  async createGroupChat(
    initiatorId: string,
    participantIds: string[],
    encryptedGroupSecrets: Map<string, string>
  ): Promise<Chat> {
    // Create group chat, store participant info
  }

  async addMember(
    groupChatId: string,
    newMemberId: string,
    rekeys?: string
  ): Promise<void> {
    // Add new member, notify others for rekey if needed
  }

  async removeMember(groupChatId: string, memberId: string): Promise<void> {
    // Remove member, trigger rekey
  }

  async getGroupInfo(groupChatId: string): Promise<GroupChatInfo> {
    // Fetch group metadata
  }

  async validateGroupMessageAccess(
    userId: string,
    groupChatId: string
  ): Promise<boolean> {
    // Check if user is member of group
  }
}
```

### 11.3 Message Service (обновленный)

```typescript
// backend/src/domains/messages/services/message.service.ts
@Injectable()
export class MessageService {
  async sendMessage(
    chatId: string,
    senderId: string,
    payload: SendMessageDTO
  ): Promise<Message> {
    const chat = await this.chatRepository.findOne(chatId);
    
    if (chat.type === 'private') {
      // 1:1 logic
      await this.validate1to1Message(payload);
    } else if (chat.type === 'group') {
      // Group logic with fanout routing
      await this.validateGroupMessage(payload);
      await this.routeGroupMessage(chatId, senderId, payload);
    }
  }

  private async routeGroupMessage(
    chatId: string,
    senderId: string,
    payload: any
  ): Promise<void> {
    // For Simple Fanout: route each ciphertext to its recipient
    const members = await this.getGroupMembers(chatId);
    
    for (const [recipientId, ciphertext] of Object.entries(payload.ciphertexts)) {
      // Store message for this specific recipient
      await this.messageRepository.save({
        chatId,
        senderId,
        recipientId,  // Important: track who this message is for
        ciphertext,
        messageNumber: payload.messageNumber,
        timestamp: payload.timestamp
      });
    }
  }
}
```

---

## 12. Требования к безопасности (обновленные)

### 12.1 Шифрование

- ✅ **E2EE:** Сервер НЕ видит содержимое (только зашифрованные данные)
- ✅ **1:1 чаты:** X3DH + Double Ratchet для forward secrecy
- ✅ **Групповые чаты:** Group Key Exchange (Simple Fanout для v2)
- ✅ **PK никогда на диске:** Используется только для подписания challenge
- ✅ **hPK только в памяти:** Служит локальным секретом
- ✅ **Pre-keys защищены:** Зашифрованы под hPK в IndexedDB
- ✅ **OTK одноразовые:** После использования удаляются

### 12.2 Групповые чаты (Simple Fanout)

- ✅ **Изоляция ключей:** Каждый участник имеет свой derivedKey
- ✅ **Отправитель шифрует для каждого:** Стандартный подход в групповом E2EE
- ⚠️ **Размер сообщения:** Увеличивается с числом участников (можно оптимизировать позже)
- ✅ **Управление участниками:** Добавление/удаление требует rekeying

### 12.3 Атаки и защита

| Атака | Защита | Уровень |
|-------|--------|--------|
| **Перехват сообщения на транспорте** | TLS + E2EE | ✅ Высокий |
| **Кража hPK из памяти (XSS)** | hPK только в памяти, XSS требует кода | ⚠️ Средний |
| **Компрометация IndexedDB** | session_prekeys зашифрованы под hPK | ✅ Защищено |
| **Повторное использование OTK** | Tracking used_otkeys в БД | ✅ Защищено |
| **Удаленный участник читает старые сообщения (группа)** | Rekeying меняет groupSecret | ⚠️ Средний (требует rekeying) |

---

## 13. Этапы реализации (обновленные)

### Фаза 1: Инфраструктура (существует)
- ✅ Ed25519 подписи
- ✅ ECDH key agreement
- ✅ HKDF derivation
- ✅ AES-256-GCM encryption

### Фаза 2: Seed Recovery (существует)
- ✅ Cloud Mode (Argon2id + AES-GCM)
- ✅ Self-Custody Mode (BIP39)
- ✅ Ленивая активация

### Фаза 3: X3DH для 1:1 (to do)
- [ ] Генерация SPK и OTK при логине
- [ ] Шифрование pre-keys под hPK в IndexedDB
- [ ] Загрузка на сервер
- [ ] X3DH вычисления и CK генерация

### Фаза 4: Per-Message Encryption (to do)
- [ ] Per-message key derivation (HKDF)
- [ ] AES-256-GCM шифрование сообщений
- [ ] Сохранение chatKey в IndexedDB

### Фаза 5: Групповые чаты — Simple Fanout (to do, НОВОЕ)
- [ ] Генерация groupSecret при создании группы
- [ ] Дериватция participantKeys для каждого члена
- [ ] Per-message шифрование для каждого участника
- [ ] Роутинг ciphertexts на сервере
- [ ] Расшифровка полученных сообщений на клиенте

### Фаза 6: Управление участниками (to do, НОВОЕ)
- [ ] Добавление участников в группу
- [ ] Удаление участников (с rekeying)
- [ ] Синхронизация состояния группы

### Фаза 7: Интеграция с messaging (to do)
- [ ] Обновление MessagesGateway для групп
- [ ] WebSocket роутинг для группы
- [ ] Обновление UI для группы

### Фаза 8: Тестирование и аудит (to do)
- [ ] Unit-тесты X3DH
- [ ] Unit-тесты Group Key Exchange
- [ ] E2E тесты 1:1 чатов
- [ ] E2E тесты групповых чатов
- [ ] Security audit

---

## 14. Диаграмма: 1:1 vs Group Flow

```
1:1 Chat Flow (X3DH):
═════════════════════════

Alice                                    Bob
  │                                       │
  ├─ Fetch Bob's pre-keys ──────────────→ Server
  │                                       │
  ├─ Perform X3DH ─────────────────────────┐
  │  (DH1||DH2||DH3||DH4)               (hashed)
  │  CK = HKDF(...)                       │
  │                                       │
  ├─ Encrypt message ──────────────────────┐
  │  (messageKey from CK)                  │
  │                                       │
  └─ Send ciphertext ───────────────────→ Server ──→ Bob
                                                      │
                                          Bob receives
                                          X3DH pubkeys
                                          from Alice
                                          │
                                          ├─ Perform X3DH (his side)
                                          │  Same CK (symmetric!)
                                          │
                                          ├─ Decrypt message
                                          │
                                          └─ Plaintext


Group Chat Flow (Simple Fanout):
═════════════════════════════════

Alice (Initiator)
  │
  ├─ Generate groupSecret
  ├─ For each participant (Bob, Charlie):
  │  ├─ participantKey_Bob = HKDF(groupSecret, salt=bob_id)
  │  ├─ participantKey_Charlie = HKDF(groupSecret, salt=charlie_id)
  │  └─ participantKey_Alice = HKDF(groupSecret, salt=alice_id)
  │
  ├─ Save in IndexedDB: groupSecret, participantKeys
  │
  └─ When sending message:
     ├─ For Bob: ciphertext_Bob = AES-GCM(msg, HKDF(participantKey_Bob, salt=msgNum))
     ├─ For Charlie: ciphertext_Charlie = AES-GCM(msg, HKDF(participantKey_Charlie, salt=msgNum))
     └─ For Alice: ciphertext_Alice = AES-GCM(msg, HKDF(participantKey_Alice, salt=msgNum))

Server (Fan-out routing):
  │
  ├─ Receive: {chatId, ciphertexts: {bob_id: ct_bob, charlie_id: ct_charlie, ...}}
  │
  ├─ Route to Bob: {ciphertext: ct_bob}
  ├─ Route to Charlie: {ciphertext: ct_charlie}
  └─ Route to Alice: {ciphertext: ct_alice}

Each participant:
  │
  ├─ Fetch message: ciphertext (only for them)
  ├─ Derive: messageKey = HKDF(participantKey, salt=msgNum)
  ├─ Decrypt: plaintext = AES-GCM.decrypt(ciphertext, messageKey)
  └─ Store: plaintext
```

---

## 15. Сравнение: Simple Fanout vs Tree-based (MLS)

| Аспект | Simple Fanout (v2) | Tree-based / MLS (будущее) |
|--------|-------------------|---------------------------|
| **Реализация** | Простая, 1-2 недели | Сложная, 3-4 недели |
| **Размер сообщения** | N × size(message) | size(message) (константа) |
| **Масштабируемость** | До 100 участников | До 1000+ участников |
| **Управление участниками** | Добавление = трансляция, Удаление = rekeying | Динамическое с деревом |
| **Forward secrecy** | Per-message (HKDF) | Per-message (рatchet) |
| **Сложность реализации** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Рекомендуется для v2** | ✅ ДА | Для v3+ |

---

## 16. Открытые вопросы

### 16.1 Для v2 (текущие)
- [ ] Использовать Simple Fanout или другой подход для групп?
- [ ] Макс. участников в группе: 10, 50, 100?
- [ ] Как синхронизировать state при потере соединения?
- [ ] Нужны ли read receipts в группе?

### 16.2 Для будущего (v3+)
- [ ] Миграция с Simple Fanout на Tree-based (MLS)?
- [ ] Поддержка большых групп (1000+)?
- [ ] Добавление функций управления (mute, notifications)?
- [ ] Интеграция с Channels (открытые группы)?
- [ ] Поддержка message reactions/edits в E2EE?

---

## 17. Примеры кода: Backend

### 17.1 Генерация groupSecret и participantKeys

```typescript
// backend/src/domains/crypto/services/group-key-exchange.service.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';

@Injectable()
export class GroupKeyExchangeService {
  async generateGroupSecret(): Promise<Uint8Array> {
    // Generate 32 bytes of random data
    return randomBytes(32);
  }

  async deriveParticipantKey(
    groupSecret: Uint8Array,
    participantId: string
  ): Promise<Uint8Array> {
    // HKDF: groupSecret -> participantKey
    const salt = Buffer.from(participantId, 'utf-8');
    const info = Buffer.from('group_participant', 'utf-8');
    
    return hkdf(sha256, groupSecret, salt, info, 32);
  }

  async deriveParticipantKeysForGroup(
    groupSecret: Uint8Array,
    participantIds: string[]
  ): Promise<Map<string, Uint8Array>> {
    const keys = new Map<string, Uint8Array>();
    
    for (const participantId of participantIds) {
      const key = await this.deriveParticipantKey(groupSecret, participantId);
      keys.set(participantId, key);
    }
    
    return keys;
  }
}
```

### 17.2 Роутинг группового сообщения

```typescript
// backend/src/domains/messages/services/message.service.ts
async sendGroupMessage(
  chatId: string,
  senderId: string,
  ciphertexts: Map<string, string>,  // {recipientId: ciphertext}
  messageNumber: number
): Promise<void> {
  // 1. Validate sender is member
  const isValidMember = await this.groupChatService.validateGroupMessageAccess(
    senderId,
    chatId
  );
  if (!isValidMember) {
    throw new UnauthorizedException('Not a group member');
  }

  // 2. Increment message counter
  await this.messageCounterService.increment(chatId, senderId, messageNumber);

  // 3. For each recipient, store message
  for (const [recipientId, ciphertext] of ciphertexts.entries()) {
    const message = await this.messageRepository.save({
      chatId,
      senderId,
      recipientId,  // Важно: каждое сообщение предназначено конкретному получателю
      ciphertext,
      messageNumber,
      timestamp: new Date()
    });

    // 4. Notify recipient via WebSocket
    await this.notifyRecipient(recipientId, message);
  }
}

private async notifyRecipient(recipientId: string, message: Message): Promise<void> {
  const session = this.sessionRegistry.getSession(recipientId);
  if (session) {
    session.socket.emit('message:received', {
      chatId: message.chatId,
      senderId: message.senderId,
      messageNumber: message.messageNumber,
      ciphertext: message.ciphertext,
      timestamp: message.timestamp
    });
  }
}
```

---

## 18. Миграционный путь (Self-Custody → Cloud если нужно)

```
User Journey (Future):
══════════════════════

1. Регистрация в Self-Custody
   └─ 12-слово seed в голове
   
2. Полгода использования
   └─ Все работает без проблем
   
3. Решил включить Cloud Recovery
   └─ "Backup seed in cloud?"
   └─ Вводит пароль
   └─ Seed шифруется и загружается в S3
   
4. Теперь оба режима
   └─ Может логиниться по паролю (Cloud)
   └─ Или по 12 словам (Self-Custody)
```

**Реализация:**
```typescript
async migrateToCloudRecovery(userId: string, password: string): Promise<void> {
  // 1. Fetch current seed from user (requires seed input)
  const seedWords = await promptUserForSeed();
  
  // 2. Validate
  const validation = validateSeedPhrase(seedWords);
  if (!validation.isValid) throw new Error('Invalid seed');
  
  // 3. Encrypt with password
  const encrypted = await encryptSeedForCloud(seedWords, password);
  
  // 4. Upload to S3
  await this.seedRecoveryService.uploadEncryptedSeed(userId, encrypted);
  
  // 5. Mark account as dual-mode
  await this.userRepository.update(userId, { hasCloudRecovery: true });
}
```

---

## 19. Заключение: Roadmap до v3

### v1 (Текущий план)
✅ Cloud Recovery + Self-Custody (done)
✅ Lazy Seed Activation (done)
✅ Pre-keys Management (done)
⏳ X3DH для 1:1 чатов (in progress)
⏳ Per-message encryption (in progress)

### v2 (Этот документ)
🎯 Групповые чаты с Simple Fanout (NEW)
🎯 Управление участниками (add/remove/rekey)
🎯 Group message routing на сервере
🎯 Full E2EE для групп

### v3 (Future)
🔮 Migration от Simple Fanout к Tree-based (MLS)
🔮 Поддержка больших групп (1000+)
🔮 Advanced group management (roles, permissions)
🔮 Integration с Channels (public groups)
🔮 Message reactions и edits (зашифрованные)

---

**Версия документа:** 2.0
**Дата:** 2026-02-17
**Статус:** Ready for Phase 3 (X3DH + Group Chats)
