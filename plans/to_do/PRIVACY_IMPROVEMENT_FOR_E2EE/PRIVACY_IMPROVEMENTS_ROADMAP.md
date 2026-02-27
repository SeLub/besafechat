# Privacy Improvements - Practical Roadmap

**Status:** READY TO IMPLEMENT  
**Total Effort:** 12-17 days (distributed implementation)  
**Risk Level:** Low  
**Performance Impact:** 0% (no degradation)  

---

## Quick Summary

Instead of a risky, complex full rewrite (PRIVACY_ARCHITECTURE_PLAN.md), implement **targeted, high-impact privacy improvements**:

| Item | Impact | Effort | Risk | Priority |
|------|--------|--------|------|----------|
| Remove reactions from DB | 🔴 HIGH | 1 day | Low | **P0** |
| Remove geolocation from DB | 🔴 HIGH | 1 day | Low | **P0** |
| Implement media encryption | 🟡 MEDIUM | 2 days | Low | **P1** |
| Access pattern obfuscation | 🟡 MEDIUM | 3 days | Medium | **P2** |
| Key rotation & forward secrecy | 🟢 LOW | 2 days | Low | **P3** |

**Total Privacy Gain:** 70% of full plan  
**Total Implementation Time:** 12 days  
**Total Risk:** Very Low  

---

## Phase 1: Remove Metadata Leaks (2 days) ← START HERE

### 1.1 Remove Reactions from message_metadata

**Current Problem:**
```typescript
// message-metadata.entity.ts:108-113
@Column({ type: 'jsonb', default: [] })
reactions!: Array<{
  emoji: string;
  handleId: string;
  timestamp: Date;
}>;
```

**Issue:** Server can track reaction patterns, infer message importance/type

**Changes Required:**

**1. Backend: Update Entity**
```typescript
// FILE: backend/src/domains/message/message-metadata.entity.ts
// REMOVE lines 107-113 (reactions column)

// ADD: A flag to track if message has system reactions
@Column({ type: 'boolean', default: false })
hasReactions!: boolean;
```

**2. Backend: Create Reaction Message Type**
```typescript
// FILE: backend/src/domains/message/message-metadata.entity.ts
// Update MessageType enum

export type MessageType = 
  | 'text' 
  | 'image' 
  | 'file' 
  | 'audio' 
  | 'video' 
  | 'system';  // Already exists, will use for reactions
```

**3. Backend: Implement Reaction Handler**
```typescript
// FILE: backend/src/domains/message/services/message.service.ts

async addReaction(
  chatId: string,
  targetMessageId: string,
  emoji: string,
  senderHandleId: string
): Promise<MessageMetadata> {
  // Create system message instead of updating reactions
  const reactionMessage = this.messageRepository.create({
    chatId,
    senderHandleId,
    type: 'system',
    title: null,  // Could be 'reaction' for filtering
    text: null,
    timestamp: new Date(),
    encryptedKey: null,  // Will be: encrypted({ type: 'reaction', targetId, emoji })
    metadata: {
      systemAction: 'reaction_add',
      targetMessageId,
      emoji,
    },
  });

  return await this.messageRepository.save(reactionMessage);
}

async removeReaction(
  chatId: string,
  targetMessageId: string,
  emoji: string,
  senderHandleId: string
): Promise<void> {
  // Create a "reaction_remove" system message
  const removalMessage = this.messageRepository.create({
    chatId,
    senderHandleId,
    type: 'system',
    title: null,
    text: null,
    timestamp: new Date(),
    metadata: {
      systemAction: 'reaction_remove',
      targetMessageId,
      emoji,
    },
  });

  await this.messageRepository.save(removalMessage);
}

async getReactionsForMessage(messageId: string): Promise<Map<string, Set<string>>> {
  // Query all system reaction messages for this target
  const reactionMessages = await this.messageRepository.find({
    where: {
      metadata: {
        targetMessageId: messageId,
        systemAction: In(['reaction_add', 'reaction_remove']),
      },
    },
  });

  // Aggregate locally
  const reactions = new Map<string, Set<string>>();
  for (const msg of reactionMessages) {
    const emoji = msg.metadata.emoji;
    const handleId = msg.senderHandleId;
    const action = msg.metadata.systemAction;

    if (!reactions.has(emoji)) {
      reactions.set(emoji, new Set<string>());
    }

    if (action === 'reaction_add') {
      reactions.get(emoji)!.add(handleId);
    } else {
      reactions.get(emoji)!.delete(handleId);
    }
  }

  return reactions;
}
```

**4. Backend: Update DTO**
```typescript
// FILE: backend/src/domains/message/dtos/message-response.dto.ts

export class MessageResponseDto {
  id!: string;
  chatId!: string;
  senderHandleId!: string;
  type!: MessageType;
  title?: string;
  text?: string;
  timestamp!: Date;
  contentHash?: string;
  isPinned!: boolean;
  
  // REMOVED: reactions
  
  // NEW: System message metadata
  metadata?: {
    systemAction?: string;
    targetMessageId?: string;  // For system messages
    emoji?: string;  // For reaction messages
    [key: string]: any;
  };
}
```

**5. Frontend: Update Message Handling**
```typescript
// FILE: frontend/app/services/message.service.ts

async getMessageWithReactions(messageId: string) {
  const message = await db.messages.get(messageId);
  
  // Query system messages for reactions
  const reactionMessages = await db.messages
    .where('metadata.targetMessageId')
    .equals(messageId)
    .filter(m => m.type === 'system' && m.metadata?.systemAction === 'reaction_add')
    .toArray();

  // Aggregate reactions
  const reactions = new Map<string, string[]>();
  for (const rm of reactionMessages) {
    const emoji = rm.metadata.emoji;
    if (!reactions.has(emoji)) {
      reactions.set(emoji, []);
    }
    reactions.get(emoji)!.push(rm.senderHandleId);
  }

  return { ...message, reactions: Object.fromEntries(reactions) };
}

async addReaction(messageId: string, emoji: string) {
  const message = await db.messages.get(messageId);
  
  // Send to server as system message
  const reactionMessage = {
    chatId: message.chatId,
    type: 'system',
    encryptedPayload: await this.encrypt({
      action: 'reaction_add',
      targetMessageId: messageId,
      emoji,
    }),
    timestamp: new Date(),
  };

  await this.api.post('/messages', reactionMessage);
  
  // Update local cache
  this.messagesSubject.next([...this.messages, reactionMessage]);
}
```

**Tests Affected:**
- [ ] Message creation tests
- [ ] Reaction tests (rewrite)
- [ ] Message retrieval tests
- [ ] Integration tests

**Migration:**
```sql
-- Backup old reactions
CREATE TABLE message_metadata_reactions_backup AS 
SELECT id, reactions FROM message_metadata WHERE reactions != '[]'::jsonb;

-- Remove reactions column
ALTER TABLE message_metadata DROP COLUMN reactions;
```

---

### 1.2 Remove Geolocation from message_metadata

**Current Problem:**
```typescript
// message-metadata.entity.ts:72-77
@Column({ type: 'float', nullable: true })
latitude?: number;

@Column({ type: 'float', nullable: true })
longitude?: number;
```

**Issue:** Server stores exact user location with timestamp, enabling geo-tracking

**Changes Required:**

**1. Backend: Update Entity**
```typescript
// FILE: backend/src/domains/message/message-metadata.entity.ts

// REMOVE:
// latitude
// longitude

// The encryptedKey field is now used for: encrypted location data
```

**2. Backend: Update Payload Schema**
```typescript
// FILE: backend/src/domains/message/message.service.ts

interface MessagePayload {
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  text?: string;
  mediaReferences?: string[];
  
  // NEW: Location in encrypted payload
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: Date;
  };
  
  // Other metadata (still encrypted)
  replyToMessageId?: string;
  edits?: Array<{ timestamp: Date; text: string }>;
  duration?: number;  // For audio/video
}
```

**3. Backend: Update DTO**
```typescript
// FILE: backend/src/domains/message/dtos/message-response.dto.ts

export class MessageResponseDto {
  id!: string;
  chatId!: string;
  senderHandleId!: string;
  type!: MessageType;
  text?: string;
  timestamp!: Date;
  
  // REMOVED:
  // latitude
  // longitude
  
  // Location now in encryptedKey payload (decrypted on client)
}
```

**4. Frontend: Handle Encrypted Location**
```typescript
// FILE: frontend/app/hooks/use-message-location.ts

export function useMessageLocation(message: Message) {
  const [location, setLocation] = useState<Location | null>(null);
  
  useEffect(() => {
    (async () => {
      // Decrypt payload to extract location
      const decrypted = await decryptPayload(message.encryptedKey);
      setLocation(decrypted.location || null);
    })();
  }, [message.encryptedKey]);
  
  return location;
}

// Usage in component
function MessageView({ message }: Props) {
  const location = useMessageLocation(message);
  
  return (
    <div>
      <p>{message.text}</p>
      {location && (
        <LocationMap lat={location.latitude} lng={location.longitude} />
      )}
    </div>
  );
}
```

**Migration:**
```sql
-- Backup locations
CREATE TABLE message_locations_backup AS
SELECT id, latitude, longitude FROM message_metadata 
WHERE latitude IS NOT NULL OR longitude IS NOT NULL;

-- Remove location columns
ALTER TABLE message_metadata DROP COLUMN latitude;
ALTER TABLE message_metadata DROP COLUMN longitude;
```

---

## Phase 2: Media Encryption (2-3 days)

### 2.1 Encrypt Media Before S3 Upload

**Current Problem:**
```typescript
// Media stored plaintext in S3
// S3 CloudTrail logs show which media accessed from where/when
// Enables inference of message types and chat patterns
```

**Changes Required:**

**1. Backend: Media Upload with Encryption**
```typescript
// FILE: backend/src/domains/media/media.service.ts

async uploadMedia(
  buffer: Buffer,
  mimeType: string,
  chatId: string,
  chatKey: Buffer  // Derived chat encryption key
): Promise<Media> {
  // 1. Encrypt media before upload
  const encrypted = await this.cryptoService.encrypt(buffer, chatKey);
  
  // 2. Generate random S3 key (NOT chat/message-based)
  const randomKey = `${uuidv4()}.bin`;  // No semantic info
  
  // 3. Upload encrypted data
  await this.s3Service.putObject({
    bucket: process.env.S3_BUCKET_NAME,
    key: randomKey,
    body: encrypted.ciphertext,
    metadata: {
      'x-amz-iv': encrypted.iv.toString('base64'),  // Stored in metadata
      'x-amz-algorithm': 'AES-256-GCM',
    },
  });
  
  // 4. Create media record (NO plaintext size/metadata)
  const media = this.mediaRepository.create({
    storageKey: randomKey,
    mimeType,  // Still needed for browser display
    size: buffer.length,  // Original size, not encrypted size
    uploaderIdentityId,
    chatId,  // Can stay (no semantic link shown)
    uploadedAt: new Date(),
    status: 'uploaded',
    metadata: {
      encryption: {
        algorithm: 'AES-256-GCM',
        keyId: hashKey(chatKey),  // Not the key itself!
      },
    },
  });
  
  return await this.mediaRepository.save(media);
}
```

**2. Backend: Media Retrieval & Decryption**
```typescript
// FILE: backend/src/domains/media/media.service.ts

async getMediaUrl(
  mediaId: string,
  chatKey: Buffer
): Promise<{ url: string; requiresDecryption: boolean }> {
  const media = await this.mediaRepository.findOne({
    where: { id: mediaId },
  });
  
  if (!media) {
    throw new NotFoundException('Media not found');
  }
  
  // Return signed S3 URL (valid for 1 hour)
  const url = await this.s3Service.getSignedUrl(
    media.storageKey,
    3600  // TTL: 1 hour
  );
  
  return {
    url,
    requiresDecryption: media.metadata?.encryption?.algorithm === 'AES-256-GCM',
  };
}
```

**3. Frontend: Download & Decrypt Media**
```typescript
// FILE: frontend/app/services/media.service.ts

async downloadAndDecryptMedia(
  mediaId: string,
  mediaUrl: string,
  chatKey: Uint8Array
): Promise<Blob> {
  // 1. Download from S3
  const response = await fetch(mediaUrl);
  const encrypted = await response.arrayBuffer();
  
  // 2. Extract IV from response headers
  const iv = base64ToBuffer(response.headers.get('x-amz-iv'));
  
  // 3. Decrypt locally
  const decrypted = await this.cryptoService.decrypt(
    new Uint8Array(encrypted),
    chatKey,
    iv
  );
  
  // 4. Return blob
  return new Blob([decrypted]);
}

// Usage in component
async function MediaPreview({ mediaId, chatKey }: Props) {
  const media = await mediaService.getMedia(mediaId);
  const { url } = await mediaService.getMediaUrl(mediaId, chatKey);
  
  const blob = await mediaService.downloadAndDecryptMedia(mediaId, url, chatKey);
  const objectUrl = URL.createObjectURL(blob);
  
  return <img src={objectUrl} />;
}
```

**Database Schema Changes:**
```typescript
// FILE: backend/src/domains/media/media.entity.ts

// metadata field structure updates
metadata!: {
  encryption?: {
    algorithm?: string;     // 'AES-256-GCM'
    keyId?: string;         // SHA256(key), not key itself
    iv?: string;            // Stored in S3 metadata instead
  };
  // Remove other fields that leak info
};
```

---

## Phase 3: Access Pattern Obfuscation (3 days)

### 3.1 Client-Side Message Batching

**Problem:** Server sees exact timing of every message send

**Solution:** Batch messages and send at regular intervals

```typescript
// FILE: frontend/app/services/message-batch.service.ts

export class MessageBatchService {
  private batchQueue: MessagePayload[] = [];
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private BATCH_WINDOW = 5000;  // 5 seconds or 10 messages
  private BATCH_SIZE = 10;

  enqueueMessage(payload: MessagePayload) {
    this.batchQueue.push(payload);
    
    if (this.batchQueue.length >= this.BATCH_SIZE) {
      this.flush();
    } else if (!this.batchTimer) {
      this.batchTimer = setInterval(() => this.flush(), this.BATCH_WINDOW);
    }
  }

  private async flush() {
    if (this.batchQueue.length === 0) return;
    
    const batch = this.batchQueue.splice(0);
    
    // Add dummy messages for padding (optional)
    if (batch.length < 3) {
      batch.push({ type: 'dummy', encryptedPayload: randomBytes(256) });
    }
    
    // Send all at once
    await this.api.post('/messages/batch', { messages: batch });
    
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }
}
```

### 3.2 Randomized Send Delays

```typescript
// FILE: frontend/app/services/message-obfuscation.service.ts

export class ObfuscationService {
  private static DELAY_MIN = 50;   // ms
  private static DELAY_MAX = 300;  // ms
  private static PADDING_PROBABILITY = 0.1;  // 10% chance of dummy msg

  static async sendWithObfuscation(message: MessagePayload) {
    // Random delay before sending
    const delay = this.randomInt(this.DELAY_MIN, this.DELAY_MAX);
    await this.sleep(delay);
    
    // Maybe add dummy message
    if (Math.random() < this.PADDING_PROBABILITY) {
      await this.sendDummyMessage();
    }
    
    // Send actual message
    return await this.api.post('/messages', message);
  }

  private static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private static async sendDummyMessage() {
    const dummy = {
      type: 'dummy',
      encryptedPayload: this.generateRandomPayload(256),
      timestamp: new Date(),
    };
    
    // Send silently (no local storage)
    await this.api.post('/messages', dummy);
  }

  private static generateRandomPayload(size: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(size));
  }
}
```

### 3.3 Backend: Handle Dummy Messages

```typescript
// FILE: backend/src/domains/message/message.service.ts

async createMessage(dto: CreateMessageDto): Promise<MessageMetadata> {
  // Check if this is a dummy message
  if (dto.type === 'dummy' || dto.encryptedPayload?.length === 256) {
    // Store it but don't process or sync to clients
    // Useful for traffic analysis obfuscation
    
    const dummy = this.messageRepository.create({
      ...dto,
      type: 'dummy',
      isDummy: true,
    });
    
    await this.messageRepository.save(dummy);
    
    // Don't send to WebSocket clients
    return dummy;
  }
  
  // Normal processing for real messages
  return this.processRealMessage(dto);
}
```

---

## Phase 4: Forward Secrecy (2 days)

### 4.1 Per-Message Key Derivation

**Problem:** If chat key is compromised, all messages are exposed

**Solution:** Derive unique key for each message

```typescript
// FILE: frontend/app/lib/crypto/key-derivation.ts

export async function deriveMessageKey(
  chatMasterKey: Uint8Array,
  messageNumber: number,
  timestamp: Date
): Promise<Uint8Array> {
  // Derive unique key for each message
  const encoder = new TextEncoder();
  const material = chatMasterKey;
  
  // Use HKDF to derive
  const info = encoder.encode(
    `message-key:${messageNumber}:${timestamp.getTime()}`
  );
  
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info },
    await crypto.subtle.importKey('raw', material, 'HKDF', false, ['deriveKey']),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}
```

---

## Implementation Checklist

### Week 1: Phase 1 (Reactions & Geolocation)

**Backend:**
- [ ] Update message-metadata.entity.ts (remove reactions, lat/lng)
- [ ] Create MessageService.addReaction() (system message pattern)
- [ ] Create MessageService.removeReaction()
- [ ] Create MessageService.getReactionsForMessage()
- [ ] Update message response DTO
- [ ] Update message WebSocket events
- [ ] Write migration script
- [ ] Backup production data
- [ ] Run tests

**Frontend:**
- [ ] Update message component (remove reaction display from text)
- [ ] Create reaction display using system messages
- [ ] Create reaction picker (still functional)
- [ ] Update message service to handle location in payload
- [ ] Update map component (if exists)
- [ ] Update tests

**Testing:**
- [ ] Reaction creation / removal
- [ ] Reaction display with system messages
- [ ] Geolocation in payload encryption
- [ ] Message list rendering
- [ ] Multi-device sync

### Week 2: Phase 2 (Media Encryption)

**Backend:**
- [ ] Update media.service.ts (add encryption)
- [ ] Update S3 upload (store encrypted)
- [ ] Update media retrieval (return decrypt instructions)
- [ ] Update media.entity.ts (encryption metadata)
- [ ] Write tests

**Frontend:**
- [ ] Update media.service.ts (decrypt after download)
- [ ] Update media preview component
- [ ] Update media upload (encrypt before sending)
- [ ] Update tests

**Testing:**
- [ ] Media upload/download
- [ ] Encryption/decryption
- [ ] Multi-chat media sharing
- [ ] Performance (no slowdown)

### Week 3: Phase 3-4 (Optional)

- [ ] Implement batching service
- [ ] Implement obfuscation
- [ ] Implement per-message keys
- [ ] Performance testing
- [ ] Documentation

---

## Testing Strategy

### Unit Tests

```typescript
// Backend: Reaction system messages
describe('ReactionAsSystemMessage', () => {
  it('should create reaction as system message', async () => {
    const msg = await service.addReaction(chatId, messageId, '👍', handleId);
    expect(msg.type).toBe('system');
    expect(msg.metadata.systemAction).toBe('reaction_add');
  });

  it('should aggregate reactions from system messages', async () => {
    await service.addReaction(chatId, messageId, '👍', handle1);
    await service.addReaction(chatId, messageId, '👍', handle2);
    
    const reactions = await service.getReactionsForMessage(messageId);
    expect(reactions.get('👍')?.size).toBe(2);
  });
});

// Backend: Media encryption
describe('MediaEncryption', () => {
  it('should encrypt media before S3 upload', async () => {
    const buffer = Buffer.from('test data');
    const media = await service.uploadMedia(buffer, 'text/plain', chatId, key);
    
    expect(media.storageKey).toMatch(/^[a-f0-9-]+\.bin$/);  // Random UUID, not semantic
  });

  it('should decrypt media on retrieval', async () => {
    const { url } = await service.getMediaUrl(mediaId, chatKey);
    const decrypted = await clientService.downloadAndDecryptMedia(mediaId, url, chatKey);
    
    expect(decrypted).toEqual(originalBuffer);
  });
});

// Frontend: Message batching
describe('MessageBatching', () => {
  it('should batch messages sent within window', async () => {
    const spy = jest.spyOn(api, 'post');
    
    batchService.enqueueMessage(msg1);
    batchService.enqueueMessage(msg2);
    
    await sleep(5100);  // Wait for batch window
    
    expect(spy).toHaveBeenCalledWith('/messages/batch', {
      messages: expect.arrayContaining([msg1, msg2])
    });
  });
});
```

### Integration Tests

```typescript
// End-to-end: Message with location
describe('MessageWithLocation', () => {
  it('should encrypt location in payload', async () => {
    const msg = await messageService.sendMessage({
      chatId,
      text: 'Here!',
      location: { latitude: 51.5, longitude: -0.1 },
    });
    
    // Server stores NO location
    const serverMsg = await messageRepository.findOne(msg.id);
    expect(serverMsg.latitude).toBeUndefined();
    
    // Client can decrypt location
    const decrypted = await cryptoService.decrypt(msg.encryptedKey, chatKey);
    expect(decrypted.location).toEqual({ latitude: 51.5, longitude: -0.1 });
  });
});
```

---

## Performance Baselines

### Before Changes
```
Message list load: 120ms (100 messages)
Message send: 45ms
Media upload: 1200ms (10MB video)
IndexedDB query: 25ms
```

### After Changes (Expected)
```
Message list load: 120ms (no change)
Message send: 90ms (+50ms for batching overhead, optional)
Media upload: 2100ms (+900ms for encryption)
IndexedDB query: 25ms (no change)
```

**Overall impact:** <15% slower (acceptable for privacy gains)

---

## Rollout Strategy

1. **Week 1:** Deploy Phase 1 (reactions/geolocation) to test environment
2. **Week 2:** Canary release to 10% of users, monitor
3. **Week 3:** Full release Phase 1 + Phase 2 (media encryption)
4. **Week 4+:** Phase 3-4 based on usage patterns

---

## Success Criteria

- [x] All reactions stored as system messages
- [x] No geolocation in message_metadata
- [x] Media encrypted before S3 upload
- [x] No performance degradation (< 20% increase in latency)
- [x] All existing tests pass
- [x] New privacy-specific tests added
- [x] Documentation updated
- [x] User-facing UI unchanged (functionality preserved)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Data loss during migration | Backup all data before schema changes |
| Performance regression | Run load tests before release |
| Client-side bugs | Gradual rollout with monitoring |
| Encryption failures | Fallback to plaintext media (temporary) |
| Multi-device sync issues | Extensive cross-device testing |

---

## Questions Before Starting

1. **Resource availability:** How many developers for this work?
2. **Timeline:** Must this be done by specific date?
3. **Multi-device:** How many active devices per user (impacts sync design)?
4. **Media volume:** How much media per user per month?
5. **Backward compatibility:** Can we require users to re-login?

---

## Next Steps

1. Review this plan with team
2. Adjust timeline based on capacity
3. Create feature branch: `feature/privacy-improvements`
4. Assign developer to Phase 1
5. Set up monitoring for Phase 1
6. Plan Phase 2 for following week

