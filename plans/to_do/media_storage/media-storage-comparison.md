# Media Storage Options - Visual Comparison

## Quick Decision Matrix

```
                   Privacy  Cross-Device  Unlimited  Simplicity  Cost
                   ───────  ────────────  ─────────  ──────────  ────
Option 1: Local     🟢🟢🟢      ❌           ❌          🟢🟢      $0
Option 2: IndexedDB 🟢🟢        ❌           ❌          🟢        $0
Option 3: S3        ⚠️⚠️        🟢🟢🟢        🟢🟢🟢      🟢        $$
Option 4: Hybrid    🟢🟢🟢      🟢🟢🟢        🟢🟢🟢      ⚠️        $
Option 5: Multi-S3  🟢🟢        🟢🟢🟢        🟢🟢🟢      ❌❌      $$$
```

---

## Visual Architecture Comparison

### Option 1: Local Device Only
```
┌─────────────────────────────────┐
│    User A (Device 1)            │
│                                 │
│  IndexedDB:                     │
│  ├─ Messages (encrypted)        │
│  └─ File metadata               │
│                                 │
│  Local Filesystem:              │
│  ├─ image_1.jpg (encrypted)     │
│  ├─ video_1.mp4 (encrypted)     │
│  └─ document_1.pdf (encrypted)  │
│                                 │
│  Device Encryption (FDE)        │
│  └─ All data protected at OS    │
└─────────────────────────────────┘

❌ Device lost → all data lost
❌ Multiple devices → no sync
✅ Maximum privacy
✅ No server needed
```

---

### Option 2: IndexedDB Only
```
┌─────────────────────────────────────────┐
│    Browser (Any Device)                 │
│                                         │
│  IndexedDB (Dexie):                     │
│  ├─ Text messages (encrypted ArrayBuf) │
│  ├─ Images (encrypted ArrayBuf)         │
│  ├─ Videos (encrypted ArrayBuf)         │
│  ├─ Audio (encrypted ArrayBuf)          │
│  └─ Documents (encrypted ArrayBuf)      │
│                                         │
│  Problem: Browser quota limits!         │
│  Max: ~50-100 GB per domain             │
│  (HD video eats quota fast)             │
└─────────────────────────────────────────┘

❌ Browser can clear cache
❌ Quota fills quickly (large files)
❌ No backup if device dies
❌ No cross-device sync
✅ All local (offline works)
✅ Simple implementation
```

---

### Option 3: S3 Only
```
┌──────────────┐         S3 Cloud
│   Browser    │      (Tebi.io)
│              │
│ IndexedDB:   ├────→ /media/image_1
│ ├─ Messages  ├────→ /media/video_1
│ └─ Metadata  ├────→ /media/audio_1
│              ├────→ /media/doc_1
└──────────────┘

Server sees:
  ✓ File MIME type (image/jpeg)
  ✓ File size
  ✓ Upload timestamp
  ✗ File content (encrypted)

⚠️  Privacy issue: metadata leakage
❌  No offline access to files
❌  Requires internet for all access
❌  Complete loss if S3 provider fails
✅  Unlimited storage
✅  Automatic backup
✅  Easy cross-device
```

---

### Option 4: Hybrid (RECOMMENDED)
```
┌─────────────────────────────┐
│      Browser (Device)       │
├─────────────────────────────┤
│                             │
│  IndexedDB:                 │
│  ├─ Text (encrypted)        │
│  ├─ Thumbnails (encrypted)  │
│  ├─ Small files <5MB        │
│  │  (encrypted, cached)     │
│  └─ Media metadata          │
│     (references to S3)      │
│                             │
│  Cache Status:              │
│  ├─ Last 30 days           │
│  ├─ Size: ~160 MB/user     │
│  └─ Auto-cleanup on space  │
│                             │
│  Network: WiFi/Mobile       │
│  (required for large files) │
└─────────────────────────────┘
          │
          │ (encrypted upload)
          │
          ▼
    ┌──────────────┐
    │  S3 (Tebi)   │
    ├──────────────┤
    │ /images/*    │
    │ /videos/*    │
    │ /audio/*     │
    │ /documents/* │
    │              │
    │ All encrypted│
    │ (no plaintext)
    └──────────────┘

✅ Privacy: Client-side encryption
✅ Cross-device: S3 syncs references
✅ Offline: Recent files in IndexedDB
✅ Scalable: Unlimited S3 storage
✅ Practical: Works on mobile
⚠️  Complexity: Cache management needed
```

---

### Option 5: Multiple S3 Buckets
```
                  ┌─ S3 Images
    API Gateway ──┼─ S3 Videos
         │        ├─ S3 Audio
         │        └─ S3 Documents
         │
    Browser
    IndexedDB: metadata
    
This adds:
  ✗ 4x infrastructure cost
  ✗ 4x complexity
  ✗ 4x attack surface
  
But SAME security as Option 4!
(Server breach gets all 4 anyway)

❌ Not recommended for E2EE
✅ Only if regulatory requirement
```

---

## Storage Usage Breakdown

### Per Active User Over 30 Days

```
Option 1: Local Device Only
├─ IndexedDB: ~100 MB
├─ Local files: ~3 GB
└─ TOTAL: ~3 GB (limited by device)

Option 2: IndexedDB Only
├─ Text: ~500 KB
├─ Images: ~50 MB (thumbnails only)
├─ Small files: ~100 MB (cached)
├─ Large files: ❌ NOT SUPPORTED
└─ TOTAL: ~160 MB

Option 3: S3 Only
├─ IndexedDB: ~1 MB (metadata only)
├─ S3: ~3.2 GB
│  ├─ Images: 600 MB
│  ├─ Videos: 2 GB
│  ├─ Audio: 500 MB
│  └─ Documents: 100 MB
└─ TOTAL: ~3.2 GB (unlimited)

Option 4: Hybrid ⭐️
├─ IndexedDB: ~160 MB
│  ├─ Text: 500 KB
│  ├─ Thumbnails: 50 MB
│  ├─ Small files: 100 MB
│  └─ Metadata refs: 10 MB
├─ S3: ~3.2 GB (full size files)
│  ├─ Images: 600 MB
│  ├─ Videos: 2 GB
│  ├─ Audio: 500 MB
│  └─ Documents: 100 MB
└─ TOTAL: ~3.36 GB

Option 5: Multiple S3
├─ IndexedDB: ~160 MB
├─ S3 Images: 600 MB
├─ S3 Videos: 2 GB
├─ S3 Audio: 500 MB
├─ S3 Documents: 100 MB
└─ TOTAL: ~3.36 GB (same as Option 4)
         (+ 4x operational cost)
```

---

## Use Case Recommendations

### Personal Private Chat (One-to-One)
```
Best Option: 1 (Local) or 4 (Hybrid)

If privacy is EXTREME concern:
  → Option 1: Keep everything local, FDE handles encryption

If want cross-device access:
  → Option 4: Hybrid model, still encrypted on server
```

### Team/Group Chat
```
Best Option: 4 (Hybrid)

Why:
  ✅ Team members on different devices
  ✅ Shared files need backup
  ✅ Files referenced by multiple users
  ✅ Cross-device sync essential
```

### Broadcasting (Channels)
```
Best Option: 3 or 4

For archive/reference:
  → Option 3: S3 with metadata index
  
For interactive:
  → Option 4: Hybrid with caching
```

### Military/Intelligence
```
Best Option: 1 (Local) or 5 (Multiple Servers)

Extreme paranoia:
  → Option 1 + Physical separation of devices
  
Regulatory compliance:
  → Option 5 (shows data separation)
```

### Commercial Messenger (General)
```
Best Option: 4 (Hybrid)

Industry practice:
  ✅ Signal: Hybrid (local + cloud backup for attachments)
  ✅ Wire: Hybrid (local + encrypted S3)
  ✅ Telegram: Hybrid (local + cloud for sync)
  ✅ WhatsApp: Local only (files on device by default)

Standard approach for:
  • Mobile-first messaging
  • Cross-device support needed
  • Scalability important
  • User experience matters
```

---

## Decision Tree

```
START: Want to add media to BeSafeChat
│
├─ Q1: Must work offline?
│  ├─ YES → Need local copy
│  └─ NO → S3 only OK
│
├─ Q2: Multiple devices?
│  ├─ YES → Need server sync
│  └─ NO → Local only fine
│
├─ Q3: Large files? (>1 GB/user)
│  ├─ YES → S3 required (browser quota: ~50-100GB)
│  └─ NO → IndexedDB possible
│
├─ Q4: Budget for servers?
│  ├─ YES → Can afford S3 costs
│  └─ NO → Local only or free tier
│
├─ Q5: Privacy paranoia level?
│  ├─ EXTREME → Option 1 (local only)
│  ├─ HIGH → Option 2 (IndexedDB) or Option 4 (hybrid with trust in S3 encryption)
│  ├─ MEDIUM → Option 4 (hybrid, standard)
│  └─ LOW → Option 3 (S3 only, no local cache needed)
│
└─ RESULT:
   Option 1 (Local)     → Privacy extreme + single device
   Option 2 (IndexedDB) → Privacy high + medium files + offline
   Option 3 (S3)        → Trust server + easy + scale
   Option 4 (Hybrid)    → Best balance ⭐️ (RECOMMENDED)
   Option 5 (Multi-S3)  → Regulatory requirement only
```

---

## Security Analysis

### What gets encrypted?

```
Option 1: Local Only
├─ Files at rest: ✅ Device FDE
└─ Transport: ✅ No transport

Option 2: IndexedDB
├─ Files at rest: ✅ Browser IndexedDB
├─ Transport: ❌ Local only
└─ Attack: Browser history, DevTools access

Option 3: S3 Only
├─ Files at rest: ✅ Client-side AES-256 before upload
├─ Transport: ✅ HTTPS
├─ S3 bucket: ✅ Encrypted at rest
└─ Attack: Server metadata leaks (type, size, timestamp)

Option 4: Hybrid ⭐️
├─ In IndexedDB: ✅ Per-account encryption
├─ In S3: ✅ Client-side AES-256
├─ Transport: ✅ HTTPS + presigned URLs (15min expiry)
├─ Cross-device: ✅ Message refs only (metadata)
└─ Attack: Server never sees plaintext

Option 5: Multi-S3
├─ Same encryption as Option 4
├─ Adds: Physical bucket separation
├─ Problem: Server breach gets ALL buckets anyway
└─ Reality: Same security, 4x cost
```

### Threat Models

```
Scenario: Attacker hacks server
─────────────────────────────────
Option 1: ✅ No effect (local only)
Option 2: ✅ No effect (local only)
Option 3: ⚠️  Gets encrypted blobs (can't decrypt)
Option 4: ⚠️  Same as Option 3
Option 5: ⚠️  Same as Option 3 (4 buckets don't help)

Scenario: Attacker hacks user's device
─────────────────────────────────────
Option 1: ❌ All files compromised (local)
Option 2: ❌ All files in IndexedDB compromised
Option 3: ❌ S3 files need device keys (might be in memory)
Option 4: ❌ Same as Option 3
Option 5: ❌ Same as Option 3

Scenario: Attacker gets S3 credentials
──────────────────────────────────
Option 3: ⚠️  Gets encrypted files (can't decrypt)
Option 4: ⚠️  Same as Option 3
Option 5: ⚠️  Gets all 4 buckets (still encrypted)

Conclusion:
──────────
In E2EE: Encryption keys on CLIENT
         Server breach = encrypted blobs only
         Device breach = game over regardless

Multiple S3 buckets = security theater
(If attacker has server, they have all bucket keys)
```

---

## Recommendation: Option 4 (Hybrid)

### Implementation Timeline

```
Week 1:
  ├─ Backend: Extend MessageMetadata + Media entity
  ├─ Backend: API endpoints for upload/presigned URLs
  └─ Frontend: Update Dexie schema

Week 2:
  ├─ Frontend: Upload flow (encrypt → S3)
  ├─ Frontend: Download flow (fetch → decrypt)
  └─ Frontend: Cache management + deduplication

Week 3:
  ├─ Testing (all file types)
  ├─ Performance optimization
  └─ Cross-device sync testing

Effort: ~3 weeks (2 developers)
```

### What NOT to do

```
❌ DON'T use Option 5 for security
   (Adds cost, not security)

❌ DON'T encrypt files on server
   (Defeats purpose of E2EE)

❌ DON'T store encryption keys on server
   (Might as well not encrypt)

❌ DON'T mix encrypted + unencrypted storage
   (Use consistent encryption for all)

❌ DON'T forget cache cleanup
   (IndexedDB quota fills up)
```

### What TO do

```
✅ DO encrypt files on client before S3 upload
✅ DO store encryption keys ONLY on client (derived from handleId)
✅ DO use presigned URLs with short expiry (15 mins)
✅ DO verify file checksum after download
✅ DO deduplicate by file hash (don't re-encrypt same file)
✅ DO clean up orphaned files (no message reference)
✅ DO monitor IndexedDB quota
✅ DO cache small files locally (<5MB)
✅ DO cache thumbnails for all images
```

---

## Final Recommendation

### **Use Option 4: Hybrid Model**

**Why:**
- ✅ Best privacy-functionality balance
- ✅ Industry standard (Signal, Wire, Telegram)
- ✅ Works offline (recent files cached)
- ✅ Scales unlimited (S3)
- ✅ Simple to understand
- ✅ Manageable complexity

**Not Option 5 because:**
- ❌ Multiple S3 buckets add NO security in E2EE
- ❌ 4x infrastructure cost
- ❌ 4x operational complexity
- ❌ False sense of security
- ⚠️  Only use if regulatory requirement mandates separation

**Start implementing Option 4 this week.**
