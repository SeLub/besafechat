# Phase 5: Bug Fix - Database Initialization Order

## Issue

When creating a new self-custody account, the error occurred:

```
Error storing public key: Database not initialized. 
Call StorageService.initialize(identityId) after login.
```

## Root Cause

The account creation flow was trying to store the public key **before** initializing the database:

```typescript
// WRONG ORDER (before fix)
1. Generate keypair
2. Store public key ❌ (database not initialized)
3. Login
4. Initialize database ✅ (too late!)
```

Since `storePublicKey()` requires an initialized IndexedDB (obtained via `getDb()`), it failed when the database wasn't ready.

## Solution

Reordered the account creation flow to initialize the database **before** storing keys:

```typescript
// CORRECT ORDER (after fix)
1. Generate keypair
2. Login (get identityId from server)
3. Initialize database ✅
4. Store public key ✅ (database is ready)
5. Hash private key
6. Destroy original key
7. Set session hash
```

## Changes Made

### File: `frontend/app/services/account.service.ts`

**Method: `createAccountWithCloud()`** (Lines 80-111)
- Moved `StorageService.initialize(result.identityId)` to BEFORE `StorageService.storePublicKey()`
- Updated comment numbering to reflect correct sequence

**Method: `createAccountWithSelfCustody()`** (Lines 150-193)
- Moved `StorageService.initialize(result.identityId)` to BEFORE `StorageService.storePublicKey()`
- Updated comment numbering to reflect correct sequence

## Why This Fix Works

The `storePublicKey()` function internally calls `getDb()`:

```typescript
// In storage.service.ts
static async storePublicKey(publicKeyBase64: string): Promise<void> {
  const record: PublicKey = {
    id: 'current',
    publicKeyBase64,
    createdAt: Date.now(),
  };

  await getDb().publicKey.put(record);  // ← This requires database to be initialized
  console.log('Public key stored successfully');
}
```

And `getDb()` throws an error if database isn't initialized:

```typescript
// In db.ts
export function getDb(): BeSafeDB {
  if (!currentDb) {
    throw new Error(
      'Database not initialized. Call StorageService.initialize(identityId) after login.'
    );
  }
  return currentDb;
}
```

So the fix ensures `StorageService.initialize()` is called before any database operations.

## Testing

To verify the fix works:

1. **Create a new self-custody account**:
   - Go to http://localhost:3000
   - Click "Create Account"
   - Select "Self-Custody"
   - Follow the flow

2. **Expected result**: Account creation should succeed without the database initialization error

3. **Then run browser tests**:
   - Go to http://localhost:3000/phase5test
   - Click "Run All Tests"
   - All 8 tests should pass

## Impact

- ✅ Self-custody account creation now works
- ✅ Cloud backup account creation now works  
- ✅ Recovery flows unaffected (they initialize DB correctly)
- ✅ Browser tests can now run with proper login

## Before/After Comparison

| Step | Before | After |
|------|--------|-------|
| 1. Generate keypair | ✅ | ✅ |
| 2. Store public key | ❌ (DB not init) | Skip for now |
| 3. Login | ✅ | ✅ |
| 4. Initialize DB | ✅ | ✅ |
| 5. Store public key | Skipped | ✅ (DB ready) |
| 6. Hash key | ✅ | ✅ |
| 7. Destroy key | ✅ | ✅ |
| 8. Set session hash | ✅ | ✅ |

## Code Changes Summary

```diff
- // Store public key BEFORE login
- await StorageService.storePublicKey(publicKeyBase64);
  
  // Login with server
  const result = await AuthService.login({...});
  
+ // Initialize database FIRST
+ await StorageService.initialize(result.identityId);
+ 
+ // NOW store public key (database is ready)
+ await StorageService.storePublicKey(publicKeyBase64);
```

## Related Files

- `frontend/app/services/account.service.ts` - Fixed both account creation methods
- `frontend/app/lib/db/db.ts` - Database initialization logic
- `frontend/app/services/storage.service.ts` - Public key storage requires initialized DB

## Status

✅ **Fix Applied**
✅ **Ready for Testing**
✅ **All account creation flows should now work**
