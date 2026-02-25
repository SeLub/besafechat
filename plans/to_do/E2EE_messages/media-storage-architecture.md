# Multi-Media Storage Architecture for E2EE Messenger

## Problem Statement

Currently, BeSafeChat supports only text messages stored locally in IndexedDB (encrypted). The system needs to extend to support:
- **Text**: Currently handled (IndexedDB)
- **Images**: New requirement
- **Video**: New requirement  
- **Audio**: New requirement
- **Documents**: New requirement

### The Dilemma

**Current Proposal**: 
- Store encrypted files in S3
- Store file references/links in IndexedDB messages

**Problem**: This creates a fragmented data model:
- Message metadata (text) lives locally (IndexedDB)
- File references live locally (IndexedDB)
- Actual files live remotely (S3)
- Three different access patterns, consistency risks, potential for orphaned files

**Question**: Should we consolidate all storage into one unified system?

---

## Analysis of Your Options

### Option 1: Local Device Storage Only (FDE-based)
```
User A (Device 1)
├── IndexedDB
│   ├── Text messages (encrypted)
│   └── File metadata (encrypted)
└── Local filesystem
    ├── image_uuid.jpg (encrypted)
    ├── video_uuid.mp4 (encrypted)
    ├── audio_uuid.m4a (encrypted)
    └── document_uuid.pdf (encrypted)
```

**Pros:**
- ✅ Simplest architecture
- ✅ No server infrastructure needed for files
- ✅ Complete user control (data never leaves device)
- ✅ Works offline completely
- ✅ Zero server-side compromise risk
- ✅ Device-level FDE handles encryption (transparent)
- ✅ Lowest latency (local I/O)
- ✅ Unlimited storage (limited by device)

**Cons:**
- ❌ No cross-device sync
- ❌ Files lost if device is lost
- ❌ No backup mechanism
- ❌ Not suitable for shared team files
- ❌ Mobile devices limited storage
- ❌ Cannot share files with multiple users

**Suitable for:**
- Personal/private chats only
- Single-device users
- Privacy-paranoid users

---

### Option 2: IndexedDB Only
```
User A
└── IndexedDB (Dexie)
    ├── messages table
    │   ├── id
    │   ├── text (encrypted)
    │   ├── type: 'image' | 'video' | 'audio' | 'file'
    │   └── binaryContent (encrypted ArrayBuffer - images/videos/audio/PDFs)
    └── metadata
```

**Pros:**
- ✅ Unified storage model
- ✅ ACID transactions
- ✅ Same encryption for all content
- ✅ Cross-tab synchronization
- ✅ Offline-first architecture
- ✅ No server dependency
- ✅ Consistent backup/restore

**Cons:**
- ❌ **Browser storage quota limits** (typically 50GB-100GB, but varies)
- ❌ Large files (HD video) quickly exceed quota
- ❌ No cross-device sync
- ❌ No server-side backup
- ❌ Memory intensive for large files
- ❌ Browser can clear IndexedDB (user's browser settings)
- ❌ Not suitable for heavy media users
- ❌ Performance degrades with large blobs

**Browser Quotas (approximate):**
- Chrome: 50GB (6% of disk space)
- Firefox: 10GB (default, user-configurable)
- Safari: 50GB
- Edge: 50GB

**Suitable for:**
- Text-heavy messaging (few images)
- Mobile apps (offline-first)
- Privacy-critical use (no server access)

---

### Option 3: S3 Only (Tebi)
```
Server                          S3 (Tebi)
├── MessageMetadata (DB)        ├── /images/user_abc/img_1.jpg (encrypted)
│   ├── id                       ├── /videos/user_abc/vid_1.mp4 (encrypted)
│   ├── type: 'image'            ├── /audio/user_abc/aud_1.m4a (encrypted)
│   ├── mediaUrl: "s3://..."     └── /documents/user_abc/doc_1.pdf (encrypted)
│   └── encrypted metadata
└── Media table (tracking)
    └── storageKey, fileHash, etc.
```

**Pros:**
- ✅ Unlimited storage
- ✅ Server-side backup
- ✅ Cross-device sync
- ✅ Shareable files
- ✅ Centralized media management
- ✅ Deduplication possible (file hashes)
- ✅ Works on weak mobile networks
- ✅ Server can generate thumbnails

**Cons:**
- ❌ Server sees ALL files (unless client-side encrypted)
- ❌ Files must be encrypted on client before upload
- ❌ Decryption required for display
- ❌ Network latency for access
- ❌ Costs scale with storage volume
- ❌ Lost if S3 provider shut down
- ❌ Cannot verify server isn't reading files
- ❌ Privacy issue: server can see file metadata (MIME type, size, upload time)

**Suitable for:**
- Collaborative/team messaging
- Backup/archive storage
- Cloud-synced messaging apps

---

### Option 4: Hybrid (IndexedDB + S3)
```
Local Device (Browser)          Server
├── IndexedDB                    ├── Message metadata (encrypted)
│   ├── messages                 ├── File references
│   │   ├── small files          └── S3 URLs
│   │   └── thumbnails
│   └── recent media cache
│
└── Device Storage
    └── Local cache (temp)

                                 S3 (Tebi)
                                 ├── Full resolution images
                                 ├── Videos
                                 ├── Audio
                                 └── Documents
```

**Pros:**
- ✅ Best of both worlds
- ✅ Small content cached locally (fast access)
- ✅ Large files stored remotely (scalable)
- ✅ Works offline for recent messages
- ✅ Server-side backup
- ✅ Cross-device sync
- ✅ Reasonable storage costs
- ✅ Reduces browser quota pressure

**Cons:**
- ❌ Complex implementation
- ❌ Cache invalidation challenges
- ❌ Sync logic needed
- ❌ Multiple storage layers to maintain
- ❌ Server still sees file metadata
- ❌ Requires sync service

**Storage Strategy:**
```
IndexedDB (cache):
  - Text messages (always)
  - Image thumbnails (120x120px)
  - Last 30 days of recent files
  - Audio waveforms (metadata)

S3 (primary):
  - Full resolution images
  - All video files
  - Audio files (>5MB)
  - Documents
  - Full resolution versions
```

**Suitable for:**
- General-purpose messaging (most apps use this)
- Cross-device sync needed
- Balance of privacy and functionality

---

### Option 5: Dedicated Media Servers (Multiple S3-like)
```
Frontend ──→ API Gateway
            ├─→ MediaService (coordinator)
            │   ├─→ S3 Images    (images only)
            │   ├─→ S3 Videos    (videos only)
            │   ├─→ S3 Audio     (audio only)
            │   └─→ S3 Documents (documents only)
            └─→ Message metadata
```

**Pros:**
- ✅ Separation of concerns
- ✅ Type-specific optimizations
- ✅ Breach of one doesn't compromise others
- ✅ Load balancing per type
- ✅ Can use different encryption per type
- ✅ Independent scaling
- ✅ Media theft requires 4+ breach operations

**Cons:**
- ❌ **Overkill for most use cases**
- ❌ 4x infrastructure cost
- ❌ 4x attack surface (4 separate services)
- ❌ Complexity of orchestration
- ❌ Harder to maintain
- ❌ Still have server-side metadata
- ❌ False sense of security (metadata leaks file type anyway)
- ❌ All still vulnerable to same threat model (server breach)

**Security Reality:**
- If server is breached → attacker has ALL file references
- Breaking one S3 → attacker only gets that media type
- But E2EE means server never stores unencrypted content anyway
- Multiple buckets provide "defense in depth" but limited practical benefit

**Suitable for:**
- Military/intelligence agencies
- Extreme paranoia
- Regulatory compliance requiring data separation
- **NOT suitable for commercial messenger**

---

## My Recommendation: Hybrid Model (Option 4)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BeSafeChat User                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  IndexedDB (Local - Per-Account Database)           │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  1. Text Messages (all)                             │   │
│  │     - encryptedContent (encrypted)                  │   │
│  │     - salt, iv, authTag                             │   │
│  │                                                     │   │
│  │  2. Media Metadata (all types)                      │   │
│  │     - id, type, mimeType, size                      │   │
│  │     - remoteStorageKey (reference to S3)            │   │
│  │     - localCachePath (if cached)                    │   │
│  │     - checksum                                      │   │
│  │                                                     │   │
│  │  3. Small File Cache (<5MB)                         │   │
│  │     - encryptedContent (ArrayBuffer)                │   │
│  │     - Used for offline access                       │   │
│  │     - Auto-expires after 30 days                    │   │
│  │                                                     │   │
│  │  4. Thumbnails (all images)                         │   │
│  │     - 200x200px, encrypted                          │   │
│  │     - Always cached locally                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Device Storage (Browser Cache)                     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  - Temporary download cache                         │   │
│  │  - In-memory decryption buffers                     │   │
│  │  - Cleared on logout                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
            ┌──────────────────────────────┐
            │  BeSafeChat Backend (Server) │
            ├──────────────────────────────┤
            │  1. Message Metadata (DB)    │
            │     - chatId, senderId       │
            │     - timestamp, reactions   │
            │     - encrypted content      │
            │                              │
            │  2. Media Tracking (DB)      │
            │     - storageKey (S3 path)   │
            │     - fileHash               │
            │     - metadata               │
            │     - messageId (reference)  │
            │                              │
            │  3. API for:                 │
            │     - Presigned URLs         │
            │     - File metadata fetch    │
            │     - Deduplication check    │
            └──────────────────────────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  S3 (Tebi Storage)   │
                 ├──────────────────────┤
                 │  All media files:    │
                 │  - /images/*         │
                 │  - /videos/*         │
                 │  - /audio/*          │
                 │  - /documents/*      │
                 │  (All encrypted)     │
                 └──────────────────────┘
```

### Storage Decisions

**What goes in IndexedDB:**
```
Message {
  id: UUID
  chatId: UUID
  type: 'text' | 'image' | 'video' | 'audio' | 'file'
  
  // Text messages
  encryptedContent: ArrayBuffer (text encrypted with handleId)
  
  // Media messages
  media: {
    id: UUID                          (unique media ID)
    mimeType: 'image/jpeg' | etc.     (what type)
    size: number                      (bytes)
    checksum: string                  (SHA-256 of plaintext)
    remoteStorageKey: string          (S3 path)
    
    // Cached locally if <5MB or image
    cachedLocally: boolean
    encryptedLocalContent?: ArrayBuffer (if cached)
    
    // Thumbnail (always cached for images)
    thumbnail?: {
      encryptedContent: ArrayBuffer (200x200)
      width: number
      height: number
    }
    
    // Metadata
    duration?: number                 (for audio/video)
    width?: number, height?: number   (for images/video)
    fileName?: string                 (for documents)
  }
  
  // Encryption
  salt: ArrayBuffer
  iv: ArrayBuffer
  authTag: ArrayBuffer
  
  // Standard
  timestamp: number
  isOwn: boolean
  status: 'sending' | 'sent' | 'delivered' | 'read'
}
```

**What stays on Server (PostgreSQL):**
```
MessageMetadata {
  id: UUID
  chatId: UUID
  senderHandleId: UUID
  type: 'text' | 'image' | 'video' | 'audio' | 'file'
  text?: string                  (encrypted text for search?)
  
  mediaId?: UUID                 (reference to Media table if has file)
  encryptedKey?: Buffer          (if server-side key management)
  
  timestamp: Date
  reactions: []
  metadata: { ... }
}

Media {
  id: UUID
  storageKey: string             (S3 path: /media/hash/uuid)
  originalFilename?: string
  mimeType: string
  size: bigint
  fileHash: string               (SHA-256 of encrypted content)
  uploaderIdentityId: UUID
  messageId: UUID                (references MessageMetadata)
  
  width?, height?                (for images)
  duration?                      (for audio/video)
  
  status: 'uploading' | 'uploaded' | 'error'
  variants: []                   (thumbnails, different qualities)
  
  uploadedAt: Date
  metadata: { ... }
}
```

**What goes to S3:**
```
S3 Structure:
  /besafe/media/{mediaId}
    ├── original.{ext}            (encrypted full file)
    ├── thumbnail.jpg             (encrypted thumbnail)
    └── metadata.json             (encrypted metadata)
```

### Encryption Strategy

**Client-Side (Before upload to S3):**
```
1. User selects file
2. Generate: salt, IV, key from handleId
3. Encrypt file: AES-256-GCM(file, handleId-derived-key, salt, IV)
4. Calculate: SHA-256 hash of encrypted content
5. Generate thumbnails (encrypted)
6. Store locally in IndexedDB:
   - encrypted file (if <5MB)
   - encrypted thumbnail
   - media metadata
7. Upload encrypted file to S3
8. Create message in DB with media reference
```

**No Server-Side Decryption:**
- Server never has plaintext
- Server only stores encrypted blobs
- Server only knows: MIME type, size, filename (metadata)
- All decryption happens client-side on download

---

## Why NOT Option 5 (Multiple Buckets)?

### The Reality of E2EE

In a true E2EE system:
- **Everything** on the server is encrypted
- **Server compromise** = attacker sees all encrypted files anyway
- Splitting into 4 buckets doesn't change this

### Attack Scenarios

**Scenario 1: Single S3 Bucket**
```
Attacker breaches S3:
  ✓ Gets all encrypted images, videos, audio, documents
  ✗ Cannot decrypt (no keys on server)
  Result: Encrypted blobs, unusable
```

**Scenario 2: Four Separate S3 Buckets**
```
Attacker breaches all 4 buckets:
  ✓ Gets all encrypted images, videos, audio, documents  
  ✗ Still cannot decrypt (no keys on server)
  Result: Same as scenario 1
```

**Scenario 3: Server DB Compromise**
```
Attacker gets PostgreSQL:
  ✓ Knows which user has which messages
  ✓ Knows file types, sizes, timestamps
  ✓ Can correlate metadata (4 buckets don't help)
  ✗ Still can't decrypt files
  Result: Metadata leak, not content leak
```

**Scenario 4: Attacker gets BOTH server DB + S3 keys**
```
Single bucket:  Gets all media (4 buckets pointless - they have all 4 keys)
Four buckets:   Same result - attacker has all bucket keys
Result:        Multiplied 4x infrastructure = same security as 1x
```

### Conclusion on Option 5
- ❌ **Does NOT improve security** in E2EE model
- ❌ **Increases complexity** by 4x
- ❌ **Increases costs** by 4x
- ❌ **Increases attack surface** (4 services instead of 1)
- ❌ **False sense of security** (defense in depth is wrong here)

**Use Option 5 only if:**
- Regulatory requirement mandates physical separation
- Compliance needs to show "separation of concerns"
- You need to restrict which teams can access which media types
- NOT for security reasons in E2EE model

---

## Implementation Plan (Hybrid Model)

### Phase 1: Backend Changes (Week 1)

**1. Extend MessageMetadata**
```typescript
// Add to MessageMetadata
@Column({ type: 'uuid', nullable: true })
mediaId?: string;  // Reference to Media table

@Column({ type: 'bytea', nullable: true })
encryptedKey?: Buffer;  // Optional: server-side key management
```

**2. Update Media Entity** (already has good structure)
- Already supports: storageKey, fileHash, variants, metadata
- Add: messageId (foreign key to MessageMetadata)

**3. API Endpoints**
```
POST   /media/upload/{type}              (type: image|video|audio|file)
GET    /media/{mediaId}                  (get metadata)
GET    /media/{mediaId}/presigned-url    (S3 presigned URL)
DELETE /media/{mediaId}                  (mark as deleted)
```

### Phase 2: Frontend Schema Updates (Week 1)

**Update Dexie Schema**
```typescript
export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  
  // Text
  encryptedContent?: ArrayBuffer;
  
  // Media
  media?: {
    id: string;
    mimeType: string;
    size: number;
    remoteStorageKey: string;
    
    // Cache
    cachedLocally?: boolean;
    encryptedLocalContent?: ArrayBuffer;
    
    // Thumbnail
    thumbnail?: {
      encryptedContent: ArrayBuffer;
      width: number;
      height: number;
    };
    
    // Metadata
    duration?: number;
    width?: number;
    height?: number;
    fileName?: string;
  };
  
  salt: ArrayBuffer;
  iv: ArrayBuffer;
  authTag: ArrayBuffer;
  timestamp: number;
  isOwn: boolean;
}
```

### Phase 3: Upload Flow (Week 2)

```typescript
async function uploadMediaMessage(
  chatId: string,
  file: File,
  type: 'image' | 'video' | 'audio' | 'file'
) {
  // 1. Read file
  const fileData = await file.arrayBuffer();
  
  // 2. Generate encryption key from handleId
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const key = deriveKey(user.handle.id, salt);
  
  // 3. Encrypt file
  const encryptedFile = await encryptAES256GCM(
    new Uint8Array(fileData),
    key,
    iv
  );
  
  // 4. Generate thumbnail (for images)
  if (type === 'image') {
    const thumbnail = await generateThumbnail(file, 200);
    const encryptedThumbnail = await encryptAES256GCM(
      thumbnail,
      key,
      iv
    );
  }
  
  // 5. Calculate checksum (for deduplication)
  const checksum = SHA256(encryptedFile);
  
  // 6. Check deduplication
  const existingMedia = await checkMediaDeduplication(checksum);
  if (existingMedia) {
    // Reuse existing file, just create new message
    await createMessage({
      chatId,
      type,
      mediaId: existingMedia.id,
      // Don't re-upload
    });
    return;
  }
  
  // 7. Store locally in IndexedDB (if <5MB)
  if (encryptedFile.byteLength < 5 * 1024 * 1024) {
    await StorageService.saveMessage({
      chatId,
      type,
      media: {
        encryptedLocalContent: encryptedFile,
        cachedLocally: true,
        ...metadata
      }
    });
  }
  
  // 8. Upload to S3
  const s3Key = generateS3Key(type, chatId);
  const presignedUrl = await getPresignedUrl(s3Key);
  
  await uploadToS3(presignedUrl, encryptedFile);
  
  // 9. Create message metadata on server
  const message = await createMessage({
    chatId,
    type,
    mediaId: newMediaId,
    salt: base64(salt),
    iv: base64(iv),
    // ... other metadata
  });
  
  // 10. Save to IndexedDB (reference only, if >5MB)
  if (encryptedFile.byteLength >= 5 * 1024 * 1024) {
    await StorageService.saveMessage({
      chatId,
      type,
      media: {
        id: mediaId,
        remoteStorageKey: s3Key,
        cachedLocally: false,
        ...metadata
      }
    });
  }
}
```

### Phase 4: Download Flow (Week 2)

```typescript
async function loadMessage(messageId: string) {
  const message = await StorageService.getMessage(messageId);
  
  if (message.type === 'text') {
    // Already decrypted and stored
    return message.text;
  }
  
  if (message.type !== 'text') {
    // Check if cached locally
    if (message.media?.cachedLocally && message.media?.encryptedLocalContent) {
      // Decrypt from local cache
      const decrypted = await decryptAES256GCM(
        message.media.encryptedLocalContent,
        deriveKey(user.handle.id, message.salt),
        message.iv
      );
      return decrypted;
    }
    
    // Not cached, fetch from S3
    const presignedUrl = await getPresignedUrl(message.media.remoteStorageKey);
    const encryptedFile = await fetch(presignedUrl).then(r => r.arrayBuffer());
    
    // Decrypt
    const decrypted = await decryptAES256GCM(
      new Uint8Array(encryptedFile),
      deriveKey(user.handle.id, message.salt),
      message.iv
    );
    
    // Cache if small enough
    if (decrypted.byteLength < 5 * 1024 * 1024) {
      await updateMessageCache(messageId, encryptedFile);
    }
    
    return decrypted;
  }
}
```

### Phase 5: Testing & Optimization (Week 3)

- Test upload of all file types
- Test download and decryption
- Test deduplication
- Test cache expiration
- Test cross-device sync (message references only)
- Performance testing on slow networks
- Storage quota monitoring

---

## Storage Calculations

### IndexedDB Usage Per User

**Scenario: Active user, 30 days of messages**

```
1. Text messages: 1000 messages
   - Per message: ~500 bytes (encrypted text + metadata)
   - Total: ~500 KB

2. Image messages: 200 messages
   - Per message: ~250 KB (encrypted thumbnail 200x200)
   - Total: ~50 MB

3. Small files (<5MB): 50 messages
   - Per message: avg 2 MB (encrypted)
   - Total: ~100 MB

4. Overhead (indexes, metadata): ~10 MB

TOTAL per user: ~160 MB (well within browser quota)
```

**S3 Usage Per User**

```
1. Full resolution images: 200 files
   - Average: 3 MB per image
   - Total: ~600 MB

2. Videos: 20 files
   - Average: 100 MB per video
   - Total: ~2 GB

3. Audio: 50 files
   - Average: 10 MB per audio
   - Total: ~500 MB

4. Documents: 100 files
   - Average: 1 MB per document
   - Total: ~100 MB

TOTAL per active user: ~3.2 GB
(Typical cloud messenger user)
```

---

## Security Checklist

- [ ] All files encrypted client-side before S3 upload
- [ ] File hashes stored (for deduplication check)
- [ ] Thumbnails encrypted
- [ ] Database does NOT store unencrypted file content
- [ ] S3 access requires authentication (presigned URLs)
- [ ] File URLs are temporary (5-15 minute expiry)
- [ ] Server cannot access file content
- [ ] Client verifies file checksum after download
- [ ] Orphaned files cleaned up (file without message reference)
- [ ] User cannot access other users' files
- [ ] Deduplication doesn't leak file existence

---

## Recommendation Summary

| Aspect | Option 1 | Option 2 | Option 3 | Option 4 | Option 5 |
|--------|----------|----------|----------|----------|----------|
| **Local Only** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Server Backup** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Cross-Device** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Unlimited Storage** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Privacy** | ✅✅✅ | ✅✅ | ⚠️ | ✅✅ | ✅ |
| **Simplicity** | ✅✅ | ✅ | ✅ | ⚠️ | ❌❌ |
| **Cost** | Free | Free | $ | $ | $$$ |
| **For E2EE** | Best | Good | Good | **Best** | Unnecessary |

### 🟢 **RECOMMENDATION: Option 4 (Hybrid)**

**Why:**
- Balances privacy (client-side encryption) with functionality (cloud backup)
- Works offline for recent messages
- Scales to unlimited files on S3
- Minimal extra complexity (manageable)
- Most users expect cross-device sync
- Industry standard (Signal, Wire, Telegram all use this)

**Implementation Priority:**
1. Phase 1-2: Backend schema + frontend schema
2. Phase 3-4: Upload/download flows  
3. Phase 5: Testing + optimization
4. Estimated: 3 weeks for 2 developers

---

## Conclusion

For an E2EE messenger:
- **Option 5** (multiple servers) provides zero additional security benefit over **Option 4**
- **Option 4** (hybrid) is the sweet spot: privacy + functionality + scalability
- Implement with proper cache management and quota monitoring
- All encryption happens client-side, server is just a blob store

**Start with Option 4. You can always optimize later if needed.**
