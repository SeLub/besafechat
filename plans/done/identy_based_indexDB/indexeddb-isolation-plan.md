# IndexedDB Isolation & Encryption Security Plan

## Problem Summary

**Critical Security Issue**: Messages encrypted for one user account are visible and accessible when another user logs in on the same device.

### Scenario That Demonstrates the Issue

1. User 1 (seed1) logs in → sends encrypted messages in a chat
   - Messages are stored in IndexedDB database named `BeSafeDB`
   - Encrypted using `encryptWithPassphrase(content, handleId1, 210000 iterations)`
   - Auth tag stored separately for integrity verification

2. User 1 logs out
3. User 2 (seed2) logs in on the **same device** → opens the **same chat**
   - `loadDecryptedMessages(chatId, handleId2)` is called
   - **ERROR**: Messages are still in IndexedDB from User 1
   - System attempts to decrypt User 1's messages using **User 2's handleId**
   - Decryption **fails** (wrong key), but messages are still visible as raw data
   - User 2 can potentially access User 1's encrypted messages

### Root Cause

**Current Architecture** (in `db.ts`):

```typescript
class BeSafeDB extends Dexie {
  constructor() {
    super('BeSafeDB'); // ❌ SAME DATABASE NAME FOR ALL USERS
    this.version(4).stores(SCHEMA);
  }
}
export const db = new BeSafeDB(); // ❌ SINGLETON - SHARED ACROSS ALL ACCOUNTS
```

**Why This Is a Problem**:

- ✗ Single IndexedDB database `BeSafeDB` serves **all user accounts** on the device
- ✗ No per-account isolation
- ✗ When User 2 logs in, they see all data from User 1
- ✗ Encryption keys are derived from `handleId`, but database access is unrestricted
- ✗ If User 2 somehow obtains User 1's handleId, they can decrypt the messages

## Security Goals

1. **Data Isolation**: Each user account has isolated local storage
2. **No Cross-User Access**: User 2 cannot see or access User 1's data even on same device
3. **Cleanup on Logout**: All user data cleared from active IndexedDB when switching accounts
4. **Encryption Consistency**: Always encrypt/decrypt with current user's handleId
5. **Database Per Account**: Unique IndexedDB database per identityId

## Proposed Solution

### Architecture: Per-Account IndexedDB Instances

**Key Principle**: Create a separate IndexedDB database instance for each user account based on their `identityId`.

### Implementation Plan

#### Phase 1: Database Isolation

**1.1 Update db.ts - Dynamic Database Names**

```typescript
// Before: Single static database
export const db = new BeSafeDB();

// After: Dynamic per-account database
let currentDb: BeSafeDB | null = null;

export function getDb(): BeSafeDB {
  if (!currentDb) {
    throw new Error('Database not initialized. Call initializeDb() first.');
  }
  return currentDb;
}

export async function initializeDb(identityId: string): Promise<BeSafeDB> {
  // Generate deterministic database name from identityId
  const dbName = await generateDatabaseName(identityId);

  if (currentDb) {
    // Different account detected - close existing connection
    if (getDbName(currentDb) !== dbName) {
      await currentDb.close();
    } else {
      return currentDb; // Same account, reuse
    }
  }

  currentDb = new BeSafeDB(dbName);
  await currentDb.open();
  return currentDb;
}

export async function closeDb(): Promise<void> {
  if (currentDb) {
    await currentDb.close();
    currentDb = null;
  }
}

// Generate deterministic hash for database name
async function generateDatabaseName(identityId: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identityId));
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `BeSafeDB_${hashHex.substring(0, 16)}`; // Use first 16 chars of hash
}

function getDbName(database: BeSafeDB): string {
  return database.name;
}
```

**1.2 Update BeSafeDB Constructor**

```typescript
class BeSafeDB extends Dexie {
  messages!: Dexie.Table<Message, string>;
  contacts!: Dexie.Table<Contact, string>;
  publicKey!: Dexie.Table<PublicKey, string>;

  constructor(dbName: string = 'BeSafeDB') {
    super(dbName); // Dynamic name per account
    this.version(4).stores(SCHEMA);
  }
}
```

#### Phase 2: StorageService Updates

**2.1 Update All StorageService Methods**

Replace all `db.messages`, `db.contacts`, `db.publicKey` with `getDb().messages`, etc.

```typescript
// Before
export class StorageService {
  static async saveEncryptedMessage(...) {
    await db.messages.put(message);  // ❌ Hardcoded db
  }
}

// After
export class StorageService {
  static async saveEncryptedMessage(...) {
    await getDb().messages.put(message);  // ✅ Dynamic db
  }
}
```

**2.2 Add Database Initialization Check**

```typescript
export class StorageService {
  private static assertDbInitialized() {
    if (!currentDb) {
      throw new Error('Storage not initialized. Call StorageService.initialize() first.');
    }
  }

  static async initialize(identityId: string): Promise<void> {
    await initializeDb(identityId);
  }

  static async cleanup(): Promise<void> {
    await closeDb();
  }
}
```

#### Phase 3: Auth Flow Integration

**3.1 Update Login Flow** (in auth service or main component)

```typescript
// On successful login
async function handleLoginSuccess(identityId: string, user: User) {
  // Initialize database BEFORE using storage
  await StorageService.initialize(identityId);

  // Now safe to load messages, contacts, etc.
  const messages = await StorageService.loadDecryptedMessages(chatId, user.handle.id);
}
```

**3.2 Update Logout Flow**

```typescript
// On logout
async function handleLogout() {
  // Clear current database
  await StorageService.cleanup();
  await StorageService.clearAllData(); // or just close

  // Redirect to login
}
```

#### Phase 4: Data Cleanup on Account Switch

**4.1 Clear Previous Account Data**

When user logs out and logs in with different account:

```typescript
export async function switchAccount(newIdentityId: string) {
  // 1. Close and clear current account's database
  await StorageService.clearAllData(); // Clear data in current DB
  await StorageService.cleanup(); // Close connection

  // 2. Initialize new account's database
  await StorageService.initialize(newIdentityId);
}
```

**4.2 Optional: Delete Old Database from IndexedDB**

For long-term security, optionally delete old account databases after switching:

```typescript
export async function deleteAccountDatabase(identityId: string) {
  const dbName = await generateDatabaseName(identityId);
  // IndexedDB API provides no direct delete, but we can clear tables
  // or let browser's storage cleanup handle it
}
```

### Encryption Verification

**IMPORTANT**: Verify that encryption is consistent using `handleId`:

#### Current Implementation Status

✅ **Already Correct** (checked in `storage.service.ts`):

- Line 194: `encryptWithPassphrase(textBytes, handleId, iterations)`
- Line 341: `encryptWithPassphrase(textBytes, handleId, iterations)`
- Line 412: `decryptWithPassphrase(..., handleId, iterations)`

✅ **Encryption key derivation uses handleId** - this is correct and doesn't need changes

### Security Checklist

#### Before Going Live

- [ ] Each account gets unique IndexedDB database (based on identityId hash)
- [ ] Database is initialized on login before any storage operations
- [ ] Database is closed/cleared on logout
- [ ] Switching accounts clears previous account's data
- [ ] StorageService methods use `getDb()` instead of hardcoded `db`
- [ ] Messages encrypted with `handleId` (already implemented)
- [ ] Test: User 1 logs in → messages stored → User 1 logs out
- [ ] Test: User 2 logs in with same device → cannot see User 1's messages
- [ ] Test: User 2 logs out → User 1 logs back in → messages still there

#### Performance Considerations

- Database initialization on login adds ~10-50ms delay (acceptable)
- Multiple IndexedDB databases (one per account) uses slightly more storage (~1KB per DB overhead)
- No performance impact on message operations (same queries, different database)

## Implementation Sequence

### Week 1: Foundation

1. **Day 1-2**: Update db.ts with dynamic database initialization
2. **Day 3-4**: Update StorageService to use `getDb()`
3. **Day 5**: Add database initialization/cleanup methods

### Week 2: Integration

1. **Day 1-2**: Update auth flow (login/logout)
2. **Day 3-4**: Update account switching logic
3. **Day 5**: Testing on development environment

### Week 3: Testing & Validation

1. **Day 1-2**: Manual testing (two accounts, same device)
2. **Day 3**: Performance testing
3. **Day 4-5**: Security review & bug fixes

## Risk Assessment

### Low Risk

- No changes to encryption algorithm
- No changes to wire protocol
- All changes are frontend only

### Medium Risk

- Breaking change for existing users (databases will be inaccessible)
- **Mitigation**: This is new product, no existing users yet

### Testing Requirements

**Manual Test Case 1: Data Isolation**

```
1. Open app in incognito window
2. Login with account A (seed1)
3. Send message: "Hello from A"
4. Verify message stored in IndexedDB (devtools)
5. Logout
6. Login with account B (seed2)
7. Open same chat
8. Verify: Cannot see "Hello from A" message
9. Send message: "Hello from B"
10. Logout
11. Login with account A (seed1)
12. Open same chat
13. Verify: See only "Hello from A", not "Hello from B"
```

**Manual Test Case 2: Database Names**

```
1. Open DevTools → Application → IndexedDB
2. Login with account A → verify database name contains hash of A's identityId
3. Logout
4. Login with account B → verify different database name (hash of B's identityId)
5. Verify both databases exist in IndexedDB (for forensic purposes)
```

**Manual Test Case 3: Encryption Still Works**

```
1. Login with account A
2. Send encrypted message
3. Refresh page
4. Message still decrypts correctly
5. Verify authTag validation still works
```

## Files to Modify

### Core Changes

- `frontend/app/lib/db/db.ts` - Database initialization
- `frontend/app/services/storage.service.ts` - Replace all `db.` with `getDb().`

### Integration Points

- `frontend/app/routes/index.tsx` - Call `StorageService.initialize()` on login
- `frontend/app/hooks/use-auth.tsx` or auth service - Call `StorageService.cleanup()` on logout
- `frontend/app/services/account.service.ts` - Ensure proper cleanup on account switch

### Optional Improvements

- `frontend/app/lib/db/schema.ts` - No changes needed
- Add logging for database initialization/cleanup in StorageService

## Security Notes

### What This Solves

✅ Prevents User 2 from accessing User 1's encrypted messages
✅ Eliminates shared IndexedDB namespace
✅ Ensures data isolation per account
✅ Maintains encryption integrity

### What This Does NOT Solve

⚠️ Private key in memory (already handled by AccountService)
⚠️ Browser DevTools access (user controls this)
⚠️ Physical device theft (requires full encryption at OS level)

### Why This Approach

- **Simplicity**: Minimal changes to existing code
- **Compatibility**: No changes to encryption, just storage location
- **Performance**: Negligible overhead
- **Scalability**: Works for any number of accounts

## Conclusion

This plan addresses the critical security issue of shared IndexedDB by implementing per-account database isolation. The solution is straightforward, requires minimal code changes, and maintains all existing security properties while eliminating the cross-user access vulnerability.

**Status**: Ready for implementation  
**Priority**: HIGH (Security Issue)  
**Timeline**: 2-3 weeks
