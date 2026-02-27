# IndexedDB Isolation Architecture Diagram

## Current Architecture (VULNERABLE ❌)

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Device                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Session Storage                          │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  User A: {identityId, handleId, privateKey}          │   │
│  │  OR                                                  │   │
│  │  User B: {identityId, handleId, privateKey}          │   │
│  │  (Only ONE active session)                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          IndexedDB: "BeSafeDB" (SINGLE)              │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │ messages table                               │    │   │
│  │  ├──────────────────────────────────────────────┤    │   │
│  │  │ ❌ User A's messages                         │    │   │
│  │  │   - chatId: "chat_xyz"                       │    │   │
│  │  │   - encryptedContent: encrypted with A's key │    │   │
│  │  │   - senderId: user_a_handle                  │    │   │
│  │  │                                              │    │   │
│  │  │ ❌ User B's messages  (SAME TABLE)           │    │   │
│  │  │   - chatId: "chat_xyz"                       │    │   │
│  │  │   - encryptedContent: encrypted with B's key │    │   │
│  │  │   - senderId: user_b_handle                  │    │   │
│  │  │                                              │    │   │
│  │  │ 🔓 VULNERABILITY: Both users' messages in    │    │   │
│  │  │    same table! If User B somehow gets User A's │   │   │
│  │  │    handleId, they can decrypt A's messages!  │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │ contacts table                               │    │   │
│  │  │ (Same issue - mixed data)                    │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  │                                                       │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │ publicKey table                              │    │   │
│  │  │ (Gets overwritten on login)                  │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

ATTACK SCENARIO:
1. User A logs in → messages saved to BeSafeDB
2. User A logs out
3. User B logs in → IndexedDB still contains User A's messages!
4. User B loads "same chat" → queries BeSafeDB
5. User A's encrypted messages are loaded in User B's session
6. If User B can obtain User A's handleId, they can decrypt those messages
```

## Proposed Architecture (SECURE ✅)

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Device                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Session Storage (Memory)               │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  User A: {identityId, handleId, privateKey}          │   │
│  │  OR                                                  │   │
│  │  User B: {identityId, handleId, privateKey}          │   │
│  │  (Only ONE active session)                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  IndexedDB Instances (Per-Account)                  │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │                                                      │   │
│  │  Option A: Active Session                          │   │
│  │  ┌────────────────────────────────────────────┐     │   │
│  │  │ BeSafeDB_a1f3c5e9d2b4... (User B)          │     │   │
│  │  │ (identityId hash: a1f3c5e9...)             │     │   │
│  │  ├────────────────────────────────────────────┤     │   │
│  │  │ messages: [User B's encrypted messages]    │     │   │
│  │  │ contacts: [User B's contacts]              │     │   │
│  │  │ publicKey: [User B's public key]           │     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  │                                                      │   │
│  │  Option B: Inactive (Previous Accounts)            │   │
│  │  ┌────────────────────────────────────────────┐     │   │
│  │  │ BeSafeDB_f7d2a9b4c6e1... (User A)          │     │   │
│  │  │ (identityId hash: f7d2a9b4...)             │     │   │
│  │  ├────────────────────────────────────────────┤     │   │
│  │  │ messages: [User A's encrypted messages]    │     │   │
│  │  │ contacts: [User A's contacts]              │     │   │
│  │  │ publicKey: [User A's public key]           │     │   │
│  │  │                                             │     │   │
│  │  │ ⚠️  Closed/Inactive - NOT accessible       │     │   │
│  │  └────────────────────────────────────────────┘     │   │
│  │                                                      │   │
│  │  ✅ Separation: Each user has isolated DB           │   │
│  │  ✅ Security: Only active session DB is open        │   │
│  │  ✅ Privacy: User B cannot access User A's data     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

SECURITY GUARANTEE:
1. User A logs in → BeSafeDB_f7d2a9b4... opened
   - User A's messages loaded from their database
2. User A logs out → Database closed
   - BeSafeDB_f7d2a9b4... connection terminated
   - ALL in-memory session data cleared
3. User B logs in → BeSafeDB_a1f3c5e9... opened (DIFFERENT DATABASE)
   - User B's messages loaded from THEIR database
   - User A's database remains closed and inaccessible
   - User B cannot see User A's data
4. User B logs out → Connection closed
```

## Data Flow Diagrams

### Current (Vulnerable) Login/Logout Flow

```
LOGIN USER A
│
├─→ Create session {identityId: A, handleId: A_handle}
├─→ Access BeSafeDB (GLOBAL SINGLETON)
└─→ Load/save messages using A_handle as encryption key
    (Messages stored with A_handle)

LOGOUT USER A
│
├─→ Clear session {identityId: A, handleId: A_handle}
└─→ ❌ BeSafeDB still contains User A's messages

LOGIN USER B
│
├─→ Create session {identityId: B, handleId: B_handle}
├─→ Access BeSafeDB (SAME SINGLETON) ← PROBLEM!
└─→ ❌ Can query User A's messages!
    LoadDecryptedMessages("chat_xyz", B_handle)
    → Returns User A's encrypted messages from BeSafeDB
    → Tries to decrypt with B_handle (FAILS)
    → But messages are still visible as encrypted blobs
```

### Proposed (Secure) Login/Logout Flow

```
LOGIN USER A
│
├─→ Create session {identityId: A, handleId: A_handle}
├─→ Call StorageService.initialize(A_identityId)
│   ├─→ Generate DB name = hash(A_identityId) = "BeSafeDB_f7d2a9b4..."
│   ├─→ New BeSafeDB("BeSafeDB_f7d2a9b4...") instance
│   └─→ Database opened and ready (STORE REFERENCE)
├─→ Load/save messages using A_handle as encryption key
└─→ All operations use User A's database instance

LOGOUT USER A
│
├─→ Call StorageService.cleanup()
│   ├─→ Clear all data in BeSafeDB_f7d2a9b4...
│   ├─→ Close database connection
│   └─→ Release database reference
├─→ Clear session {identityId: A, handleId: A_handle}
└─→ ✅ BeSafeDB_f7d2a9b4... now inaccessible

LOGIN USER B
│
├─→ Create session {identityId: B, handleId: B_handle}
├─→ Call StorageService.initialize(B_identityId)
│   ├─→ Generate DB name = hash(B_identityId) = "BeSafeDB_a1f3c5e9..."
│   ├─→ New BeSafeDB("BeSafeDB_a1f3c5e9...") instance ← DIFFERENT DB
│   └─→ Database opened and ready (STORE REFERENCE)
├─→ Load/save messages using B_handle as encryption key
└─→ ✅ All operations use User B's database instance
    ✅ User A's database is not accessible
    ✅ User A's messages are in different database
```

## Code Organization

```
frontend/app/
├── lib/
│   └── db/
│       ├── db.ts
│       │   ├── getDb()           ← NEW: Get current database
│       │   ├── initializeDb()    ← NEW: Initialize for account
│       │   ├── closeDb()         ← NEW: Close connection
│       │   ├── BeSafeDB class    ← MODIFIED: Accept dbName parameter
│       │   └── const db = ...    ← DEPRECATED: Will be replaced
│       └── schema.ts             ← NO CHANGES NEEDED
│
├── services/
│   ├── storage.service.ts
│   │   ├── initialize()          ← NEW: Initialize storage for account
│   │   ├── cleanup()             ← NEW: Cleanup on logout
│   │   ├── saveEncryptedMessage()← MODIFIED: Use getDb()
│   │   ├── loadDecryptedMessages()← MODIFIED: Use getDb()
│   │   └── clearAllData()        ← MODIFIED: Use getDb()
│   │
│   ├── account.service.ts
│   │   └── (integration point)
│   │
│   └── auth.service.ts or similar
│       ├── onLogin()             ← Call StorageService.initialize()
│       └── onLogout()            ← Call StorageService.cleanup()
│
└── routes/
    └── index.tsx
        └── useEffect on auth change
            ├── On login: StorageService.initialize()
            └── On logout: StorageService.cleanup()
```

## Database Naming Strategy

### Hash Function
```
Input:  identityId (UUID: "550e8400-e29b-41d4-a716-446655440000")
        ↓
        SHA-256 hash
        ↓
Output: "f1c8e45b3d2a..." (hex)
        ↓
Database Name: "BeSafeDB_f1c8e45b3d2a"

Result: "BeSafeDB_f1c8e45b3d2a" (UNIQUE per account)
```

### Why Hash?
- ✅ Deterministic (same identityId → same hash)
- ✅ Fixed length (always ~32 characters)
- ✅ One-way (cannot reverse to get identityId)
- ✅ Consistent across app restarts

### Example Database Names

```
User A (identityId: "550e8400-e29b-41d4-a716-446655440000")
→ BeSafeDB_f1c8e45b3d2a

User B (identityId: "f47ac10b-58cc-4372-a567-0e02b2c3d479")
→ BeSafeDB_a7f3d2c8e45b

(Different identityIds → Different database names → Isolated data)
```

## Encryption Remains Unchanged ✅

```
Message Encryption (DOES NOT CHANGE):
┌─────────────────────────────────────────┐
│ 1. User composes message: "Hello"       │
├─────────────────────────────────────────┤
│ 2. Encrypt with handleId                │
│    encryptWithPassphrase(                │
│      "Hello",                            │
│      handleId,          ← Using handleId  │
│      210000 iterations  ← Standard KDF   │
│    )                                     │
├─────────────────────────────────────────┤
│ 3. Result: {encrypted, salt, iv, tag}   │
├─────────────────────────────────────────┤
│ 4. Store in IndexedDB                   │
│    (Now in account-specific database)    │
├─────────────────────────────────────────┤
│ 5. On load, decrypt with same handleId  │
│    decryptWithPassphrase(..., handleId) │
└─────────────────────────────────────────┘

KEY POINT: Encryption algorithm UNCHANGED
          Storage location CHANGED (per account)
```

## Testing Strategy

### Test 1: Database Isolation
```
Verify: Two users cannot see each other's data

Setup:
  Device: Chrome, clear IndexedDB
  Account A: identityId = "550e8400-...", handleId = "abc123"
  Account B: identityId = "f47ac10b-...", handleId = "xyz789"

Steps:
  1. Login as A
  2. Open DevTools → Application → IndexedDB
  3. ✅ Verify database named "BeSafeDB_f1c8e45b..."
  4. Create message: "Hello from A"
  5. ✅ Verify stored in BeSafeDB_f1c8e45b...
  6. Logout
  7. Login as B
  8. Open DevTools → Application → IndexedDB
  9. ✅ Verify NEW database: "BeSafeDB_a7f3d2c8..."
  10. Open same chat
  11. ✅ Verify NO message "Hello from A"
  12. Create message: "Hello from B"
  13. ✅ Verify only "Hello from B" in messages
  14. Logout
  15. Login as A
  16. ✅ Verify back to original database "BeSafeDB_f1c8e45b..."
  17. Open same chat
  18. ✅ Verify see "Hello from A" (not "Hello from B")
```

### Test 2: Database Names
```
Verify: Same identityId always maps to same database name

Steps:
  1. Account A (identityId = UUID1)
  2. Login → generates DB name hash(UUID1) = "Hash1"
  3. Create data in "Hash1"
  4. Logout
  5. Wait 1 hour
  6. Login again with same Account A
  7. ✅ Verify same DB name "Hash1"
  8. ✅ Verify old data still there
```

### Test 3: Encryption Still Works
```
Verify: Messages encrypted and decrypted correctly (unchanged)

Steps:
  1. Login as A
  2. Send: "Hello 🔐 World"
  3. Close chat
  4. Refresh page (F5)
  5. Reopen chat
  6. ✅ Message still displays as "Hello 🔐 World"
  7. Verify in DevTools: encrypted data is unreadable
```
