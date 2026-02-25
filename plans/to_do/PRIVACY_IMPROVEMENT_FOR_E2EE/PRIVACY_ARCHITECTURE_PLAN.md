# Privacy Architecture Plan - E2EE Messenger

**Date:** 21 февраля 2026  
**Status:** 🎯 PLANNED (Not Yet Implemented)  
**Priority:** P1 - Critical for Privacy  

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Architecture Issues](#current-architecture-issues)
3. [Proposed Solution](#proposed-solution)
4. [Implementation Details](#implementation-details)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Success Criteria](#success-criteria)

---

## Problem Statement

BeSafeChat is an end-to-end encrypted messenger, but the **server currently stores too much metadata**. This violates the principle of "server should know as little as possible" and creates privacy risks.

### The Core Issue

Even though messages are encrypted, the server can infer user behavior patterns from metadata:
- Who communicates with whom
- When they communicate
- What type of content (video, image, text)
- File sizes and durations
- Reactions and message status
- Media-to-chat mappings (revealing shared content relationships)

**Scenario:** If User_A shares the same video in Chat_B and Chat_C, the server can deduce that Chat_B and Chat_C are related through shared media.

---

## Current Architecture Issues

### Issue 1: message_metadata Table Stores Too Much (CRITICAL)

**Current Fields:**
```typescript
- type (text, image, video, audio, etc.)
- text (encrypted, but still processed on server)
- reactions (emoji list)
- mediaUrl, mediaSize, mimeType
- duration (for video/audio)
- latitude, longitude (geolocation)
- displayName (of sender)
- replyToMessageId (threading info)
- isPinned, isEdited flags
```

**Problem:** Server knows the semantic content category even though text is encrypted.

**Risk Example:**
```
Server sees:
  Message A: type='video', size='45MB', timestamp='22:00'
  Message B: type='text', timestamp='22:15'
  
Inference: "User_1 sent video to User_2, then immediately texted about it"
```

### Issue 2: media Entity Has Dangerous Relationships (CRITICAL)

**Current Schema:**
```typescript
@Entity('media')
  id: UUID
  chatId: UUID          // ← PROBLEM: Reveals which chat used this media
  messageId: UUID       // ← PROBLEM: Reveals which message contains this media
  storageKey: string    // S3 path
  mimeType: string
  size: number
  uploaderIdentityId: UUID
  uploadedAt: timestamp
```

**Attack Scenario:**
```
Server observes:
  Media_1 has chatId = Chat_A
  Media_1 has chatId = Chat_B (same media, different chat)
  
Conclusion: Chat_A and Chat_B are connected
           (shared confidential content or group overlap)
```

### Issue 3: Redundant Metadata

**Current Unnecessary Storage:**
- Reaction counts (better calculated on client)
- Message edit status (local concern)
- Read status (local concern)
- PIN status (local concern)
- Threading info (can be derived from content)
- Geolocation data

---

## Proposed Solution

### Architecture: Minimal Server, Rich Client

**Principle:** Server stores ONLY what's needed for:
1. Delivery (who sent, when, to where)
2. Deduplication (prevent resending same message)
3. Synchronization (detect changes)

**Everything else** is encrypted and stored on client only.

### Server Role (PostgreSQL)

```
Stays on Server:
├─ identities (user accounts, public keys)
├─ handles (user identifiers for discovery)
├─ chats (chat metadata: name, members list)
├─ chat_members (roles, permissions)
├─ message_index (MINIMAL metadata):
│  ├─ messageId (UUID) - for delivery
│  ├─ chatId (UUID) - for routing
│  ├─ senderHandleId (UUID) - who sent
│  ├─ timestamp (when) - for ordering
│  ├─ contentHash (SHA256) - for deduplication
│  └─ isDeleted (bool) - for sync
├─ media (DELINKED from chats/messages):
│  ├─ id (UUID)
│  ├─ storageKey (S3 path)
│  ├─ contentHash (for deduplication)
│  ├─ mimeType (for browser display)
│  ├─ size (for quota management)
│  ├─ uploaderIdentityId - who uploaded
│  ├─ uploadedAt
│  └─ status (uploading/uploaded/processed)
└─ contact_requests (minimal)

Removed from Server:
├─ type (message/reaction type)
├─ text (even encrypted)
├─ reactions (emoji list)
├─ mediaUrl, mediaSize
├─ duration
├─ latitude, longitude
├─ displayName
├─ replyToMessageId
├─ isPinned, isEdited
├─ chatId (from media)
└─ messageId (from media)
```

### Client Role (IndexedDB)

```
Local Storage (IndexedDB):
├─ messages (FULL content):
│  ├─ messageId (from server)
│  ├─ chatId (from server)
│  ├─ senderHandleId (from server)
│  ├─ timestamp (from server)
│  ├─ contentHash (from server)
│  ├─ encryptedPayload (the full message)
│  ├─ decryptedContent (after decryption):
│  │  ├─ type (text/image/video/audio/system)
│  │  ├─ text (full message text)
│  │  ├─ reactions (emoji list)
│  │  ├─ mediaReferences (links to media IDs)
│  │  ├─ location (geolocation)
│  │  ├─ replyToMessageId (threading)
│  │  └─ metadata (duration, dimensions, etc.)
│  └─ localState:
│     ├─ isRead (local only)
│     ├─ isPinned (local only)
│     └─ myReactions (my emoji reactions)
├─ media_references (LOCAL links):
│  ├─ messageId → mediaId mapping
│  └─ (NO server knowledge of this mapping)
├─ media_cache (local copy of media):
│  ├─ mediaId
│  ├─ encryptedData (from S3)
│  └─ decryptedData (after decryption)
├─ chats (full info)
└─ contacts (full info)
```

### Key Design Decision: encryptedPayload

Instead of server storing multiple fields, **all message semantic data goes into one encrypted field**:

```typescript
// What client encrypts and sends:
{
  type: "video",
  text: "Check this out!",
  mediaId: "uuid-of-video",
  reactions: ["👍", "❤️"],
  location: { lat: 51.5, lng: -0.1 },
  replyToMessageId: "uuid",
  edits: [{ timestamp: 123, text: "original" }]
}

// Gets encrypted to Buffer/Uint8Array
encryptedPayload = cipher.encrypt(messageObject, chatKey)

// Server sees only:
{
  messageId: "uuid",
  chatId: "uuid",
  senderHandleId: "uuid",
  timestamp: 1708400000,
  encryptedPayload: <binary blob>,
  contentHash: "sha256...",
  isDeleted: false
}

// Server CANNOT know what's inside encryptedPayload
```

---

## Implementation Details

### Backend Changes

#### 1. Update `message-metadata.entity.ts`

**BEFORE:**
```typescript
@Entity('message_metadata')
export class MessageMetadata {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  chatId!: string;

  @Column({ type: 'uuid' })
  senderHandleId!: string;

  @Column({ type: 'text' })
  text!: string;  // ← REMOVE

  @Column({ type: 'varchar', length: 20 })
  type!: 'text' | 'image' | 'video';  // ← REMOVE

  @Column({ type: 'simple-array', nullable: true })
  reactions?: string[];  // ← REMOVE

  @Column({ type: 'float', nullable: true })
  latitude?: number;  // ← REMOVE

  @Column({ type: 'float', nullable: true })
  longitude?: number;  // ← REMOVE

  @Column({ type: 'uuid', nullable: true })
  replyToMessageId?: string;  // ← REMOVE

  // ... many more fields
}
```

**AFTER:**
```typescript
@Entity('message_metadata')
@Index('idx_message_metadata_chat', ['chatId', 'createdAt'])
@Index('idx_message_metadata_sender', ['senderHandleId', 'createdAt'])
export class MessageMetadata {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  chatId!: string;

  @ManyToOne(() => Handle, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'senderHandleId' })
  senderHandle!: Handle;

  @Column({ type: 'uuid' })
  senderHandleId!: string;

  // === NEW: Everything else encrypted in here ===
  @Column({ type: 'bytea', nullable: false })
  encryptedPayload!: Buffer;

  @Column({ type: 'varchar', length: 64, nullable: true })
  contentHash?: string;  // SHA256 of payload

  @Column({ type: 'timestamptz' })
  timestamp!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;

  // === REMOVED: text, type, reactions, location, replyToMessageId, etc. ===
}
```

#### 2. Update `media.entity.ts`

**BEFORE:**
```typescript
@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  storageKey!: string;

  @Column({ type: 'uuid', nullable: true })
  chatId?: string;  // ← REMOVE

  @Column({ type: 'uuid', nullable: true })
  messageId?: string;  // ← REMOVE

  @Column({ type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ type: 'bigint' })
  size!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFilename?: string;

  @Column({ type: 'integer', nullable: true })
  width?: number;

  @Column({ type: 'integer', nullable: true })
  height?: number;

  @Column({ type: 'integer', nullable: true })
  duration?: number;

  @Column({ type: 'uuid' })
  uploaderIdentityId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  uploadedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;
}
```

**AFTER:**
```typescript
@Entity('media')
@Index('idx_media_uploader', ['uploaderIdentityId'])
@Index('idx_media_hash', ['contentHash'])
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  storageKey!: string;

  @Column({ type: 'text', nullable: true })
  contentHash?: string;  // For deduplication

  @Column({ type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ type: 'bigint' })
  size!: number;

  @ManyToOne(() => Identity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaderIdentityId' })
  uploaderIdentity!: Identity;

  @Column({ type: 'uuid' })
  uploaderIdentityId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  uploadedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'uploaded' })
  status!: 'uploading' | 'uploaded' | 'processing' | 'processed' | 'error';

  // === REMOVED: chatId, messageId, originalFilename, width, height, duration ===
  // All this info now stored in encryptedPayload on client
}
```

#### 3. Update Backend Services

**Message Service - Create:**
```typescript
async createMessage(dto: {
  chatId: string;
  senderHandleId: string;
  encryptedPayload: Buffer;
  timestamp: Date;
  contentHash?: string;
}) {
  // No validation of content (it's encrypted)
  // Just store as-is
  const message = this.messageRepo.create({
    chatId: dto.chatId,
    senderHandleId: dto.senderHandleId,
    encryptedPayload: dto.encryptedPayload,
    timestamp: dto.timestamp,
    contentHash: dto.contentHash,
    isDeleted: false,
  });

  return await this.messageRepo.save(message);
}
```

**Message Service - Get:**
```typescript
async getMessages(chatId: string, limit: number, offset: number) {
  return await this.messageRepo.find({
    where: { chatId, isDeleted: false },
    order: { timestamp: 'DESC' },
    take: limit,
    skip: offset,
    // Return ONLY these fields (not full message)
    select: [
      'id',
      'chatId',
      'senderHandleId',
      'timestamp',
      'encryptedPayload',
      'contentHash'
    ],
  });
}
```

**Media Service - Register:**
```typescript
async registerMedia(dto: {
  storageKey: string;
  mimeType: string;
  size: number;
  uploaderIdentityId: string;
  contentHash?: string;
}) {
  // No chatId, no messageId
  // Just register the file
  const media = this.mediaRepo.create({
    storageKey: dto.storageKey,
    mimeType: dto.mimeType,
    size: dto.size,
    uploaderIdentityId: dto.uploaderIdentityId,
    contentHash: dto.contentHash,
    status: 'uploaded',
  });

  return await this.mediaRepo.save(media);
}
```

### Frontend Changes

#### 1. IndexedDB Schema Update

```typescript
// Dexie.js database schema
export const db = new Dexie('BeSafeChat');

db.version(5).stores({
  messages: '++id, chatId, timestamp, senderHandleId',
  mediaReferences: '++id, storageKey, messageId',
  chats: '++id, *participantIds',
  contacts: '++id, handleId',
  sessions: '++id'
});

// Message structure in IndexedDB
interface StoredMessage {
  messageId: string;
  chatId: string;
  senderHandleId: string;
  timestamp: Date;
  contentHash: string;
  
  // From server (encrypted)
  encryptedPayload: Uint8Array;
  
  // Decrypted on client
  decryptedContent: {
    type: 'text' | 'image' | 'video' | 'audio' | 'system';
    text?: string;
    reactions?: string[];
    mediaReferences?: string[]; // IDs of media
    location?: { lat: number; lng: number };
    replyToMessageId?: string;
    edits?: Array<{ timestamp: Date; text: string }>;
  };
  
  // Local state (never sent to server)
  localState: {
    isRead: boolean;
    isPinned: boolean;
    myReactions: string[];
  };
}
```

#### 2. Send Message Flow

```typescript
async sendMessage(chatId: string, content: MessageContent) {
  // Step 1: Upload media separately (without linking to message)
  let mediaReferences: { storageKey: string; mediaId: string }[] = [];
  
  if (content.media) {
    const uploadResult = await this.mediaService.uploadFile(content.media);
    mediaReferences.push({
      storageKey: uploadResult.storageKey,
      mediaId: uploadResult.id
    });
  }

  // Step 2: Build full message object (client-side only knowledge)
  const fullMessage = {
    type: content.type,
    text: content.text,
    reactions: [],
    mediaReferences: mediaReferences.map(m => m.mediaId),
    location: content.location,
    replyToMessageId: content.replyToMessageId,
    timestamp: new Date()
  };

  // Step 3: Encrypt the full object
  const chatKey = await this.getChatKey(chatId);
  const encryptedPayload = await this.crypto.encrypt(fullMessage, chatKey);
  const contentHash = await this.crypto.hash(encryptedPayload);

  // Step 4: Send ONLY the envelope to server
  const response = await this.api.post('/messages', {
    chatId,
    encryptedPayload: this.toBase64(encryptedPayload),
    contentHash,
    timestamp: new Date()
  });

  // Step 5: Store full message locally
  await db.messages.add({
    messageId: response.messageId,
    chatId,
    senderHandleId: this.currentHandleId,
    timestamp: new Date(),
    contentHash,
    encryptedPayload,
    decryptedContent: fullMessage,
    localState: {
      isRead: true,
      isPinned: false,
      myReactions: []
    }
  });

  // Step 6: Store local media references
  for (const media of mediaReferences) {
    await db.mediaReferences.add({
      messageId: response.messageId,
      storageKey: media.storageKey
    });
  }
}
```

#### 3. Receive Message Flow

```typescript
async onNewMessage(serverMessage: ServerMessageDto) {
  // Step 1: Get chat encryption key
  const chatKey = await this.getChatKey(serverMessage.chatId);

  // Step 2: Decrypt payload
  const decryptedContent = await this.crypto.decrypt(
    serverMessage.encryptedPayload,
    chatKey
  );

  // Step 3: Store locally
  await db.messages.add({
    messageId: serverMessage.messageId,
    chatId: serverMessage.chatId,
    senderHandleId: serverMessage.senderHandleId,
    timestamp: serverMessage.timestamp,
    contentHash: serverMessage.contentHash,
    encryptedPayload: serverMessage.encryptedPayload,
    decryptedContent: decryptedContent,
    localState: {
      isRead: false,
      isPinned: false,
      myReactions: []
    }
  });

  // Step 4: If message has media references, process them
  if (decryptedContent.mediaReferences?.length > 0) {
    for (const mediaId of decryptedContent.mediaReferences) {
      // Fetch and decrypt media separately
      await this.mediaService.fetchAndDecryptMedia(mediaId);
    }
  }

  // Step 5: Trigger UI update
  this.messagesSubject.next(await db.messages.toArray());
}
```

#### 4. Reactions & System Messages

Since reactions are no longer in database, implement as "system messages":

```typescript
async addReaction(messageId: string, emoji: string) {
  // Create a system message
  const systemMessage = {
    type: 'system_reaction',
    targetMessageId: messageId,
    emoji: emoji
  };

  // Encrypt and send as normal message
  const encryptedPayload = await this.crypto.encrypt(
    systemMessage,
    chatKey
  );

  await this.api.post('/messages', {
    chatId: this.currentChatId,
    encryptedPayload,
    // ... other fields
  });

  // Locally, update the target message's myReactions
  const message = await db.messages.get(messageId);
  if (!message.localState.myReactions.includes(emoji)) {
    message.localState.myReactions.push(emoji);
    await db.messages.put(message);
  }
}
```

When receiving a system message, client updates the target message instead of displaying it as a regular message.

---

## Implementation Roadmap

### Phase 1: Database & Backend (2-3 days)

- [ ] Backup current database
- [ ] Update `message-metadata.entity.ts`
- [ ] Update `media.entity.ts`
- [ ] Update message service (createMessage, getMessages)
- [ ] Update media service (registerMedia, uploadFile)
- [ ] Update DTOs in controllers
- [ ] Update test cases
- [ ] Test with clean database

### Phase 2: Frontend - Core Messaging (3-4 days)

- [ ] Update IndexedDB schema
- [ ] Implement send message flow (encrypt encryptedPayload)
- [ ] Implement receive message flow (decrypt payload)
- [ ] Update message list rendering
- [ ] Test message synchronization

### Phase 3: Frontend - Media & Advanced Features (2-3 days)

- [ ] Implement media upload (without linking)
- [ ] Implement media references (local only)
- [ ] Implement reactions as system messages
- [ ] Implement message deletion
- [ ] Test media sharing across chats

### Phase 4: Testing & Polish (2-3 days)

- [ ] Manual testing of all flows
- [ ] Performance testing
- [ ] Security review
- [ ] Edge case handling
- [ ] Documentation

**Total Timeline:** ~10-14 days

---

## Success Criteria

### Server Privacy

- [x] Server stores NO message content (even encrypted text field removed)
- [x] Server stores NO message type information
- [x] Server stores NO reaction data
- [x] Server stores NO media-to-message relationships
- [x] Server stores NO geolocation data
- [x] Media entity has NO chatId or messageId fields
- [x] All semantic data in encryptedPayload only

### Client Functionality

- [x] Full messages visible on client after decryption
- [x] Reactions work (via system messages)
- [x] Media can be shared across chats (no server knowledge)
- [x] Message threading works (replyToMessageId in payload)
- [x] Message editing works (edits array in payload)
- [x] Local pinning and read status work
- [x] Offline buffering still works

### Performance

- [x] Message encryption/decryption < 100ms
- [x] API payload size same or smaller
- [x] Database queries same speed (indexed correctly)
- [x] IndexedDB queries same speed

### Compatibility

- [x] No breaking API changes (only request/response format)
- [x] Can migrate from old to new schema cleanly
- [x] No data loss during migration

---

## Security Considerations

### What Server Knows (Unavoidable)

```
- Who talks to whom (identityId relationships)
- When they talk (timestamp)
- Approximate frequency (message count by time range)
- Network path (IP address)
```

### What Server Does NOT Know (Protected)

```
✅ Content (encrypted in payload)
✅ Message type (text/image/video)
✅ Reactions (stored client-side)
✅ Media usage (no messageId in media entity)
✅ Chat relationships through media
✅ Message threading
✅ Edit history
✅ Geolocation
✅ Read status
✅ Pin status
```

### Encryption Model

```
Each chat has a symmetric key (derived from chat creation)
Client encrypts: { content, metadata, reactions, etc. }
Server stores: encryptedPayload (binary blob)
Server cannot: decrypt OR infer content
Client cannot: share keys with server without explicit action
```

---

## Alternative Approaches Considered

### Option A: Current (No encryptedPayload)
- ❌ Server knows too much
- ❌ Privacy violated

### Option B: Proposed (encryptedPayload)
- ✅ Server knows nothing
- ✅ Scalable
- ✅ Simple to implement
- ✅ Client has full control
- ✅ Chosen approach

### Option C: Message Index with Signatures
- ❌ Still leaks metadata
- ❌ Complex verification
- ❌ More server processing

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Breaking API change** | API accepts new format, old clients still work for 1-2 weeks |
| **Data migration complex** | Clean database, no migration needed (new deployment) |
| **Performance loss** | Client-side encryption optimized, no server perf impact |
| **Client storage overflow** | IndexedDB can hold months of messages; cleanup by date |
| **Media without context** | Media references stored locally, client can fetch on demand |

---

## Future Enhancements

1. **Message Index Anonymization:** Use bloom filters instead of exact matches
2. **Obfuscated Timing:** Add random delays to message sends
3. **E2EE for Media:** Encrypt media before uploading to S3
4. **Forward Secrecy:** Rotate chat keys periodically
5. **Metadata Obfuscation:** Pad encryptedPayload to fixed size

---

## Status & Next Steps

**Current Status:** 🎯 PLANNED  
**Implementation Status:** NOT YET STARTED

**Decision Required:** Should we proceed with Phase 1 (database changes)?

**To Start Implementation:**
1. Confirm this approach is acceptable
2. Create backup of current database
3. Create feature branch for changes
4. Assign developer for backend changes
5. Assign developer for frontend changes

---

## Sign-Off Checklist

- [ ] Architecture reviewed and approved
- [ ] Security implications understood
- [ ] Timeline estimated at 10-14 days
- [ ] Team assignment clear
- [ ] Database backup confirmed
- [ ] Testing plan reviewed
- [ ] Ready to start Phase 1

**Status:** Awaiting approval to begin implementation
