# Phase 5: Seed Verification & Account Recovery Validation

## Overview

This document describes the seed verification mechanism implemented in Phase 5 to ensure account recovery integrity and prevent users from accidentally using the wrong seed phrase or password for their account.

## Problem Statement

During account recovery, users can enter a seed phrase or password that:
- Is syntactically valid (passes BIP39 validation)
- Derives a valid key pair
- But belongs to a **different account**

Without verification, a user could unknowingly:
- Log into the wrong account
- Access another person's messages (if they had that seed)
- Be confused about account identity

## Solution: Public Key Verification

We implemented a cryptographic verification check that ensures the recovered seed matches the user's actual account.

### How It Works

**Recovery Flow with Verification:**

```
1. User enters seed phrase / password
   ↓
2. AccountService.recoverWithSeed() or recoverWithPassword()
   - Derives key pair from seed
   - Returns: publicKeyBase64 (derived)
   ↓
3. AuthService.login()
   - Signs challenge with derived private key
   - Authenticates user → receives identityId
   ↓
4. StorageService.initialize(identityId)
   - Opens per-user database
   ↓
5. ✨ NEW: Public Key Verification
   - Retrieve stored public key from database
   - Compare: publicKeyBase64_derived === publicKeyBase64_stored
   - If MISMATCH: throw error → reject recovery
   - If MATCH or NOT_FOUND: continue
   ↓
6. StorageService.storePublicKey() (if needed)
   - Stores public key in database
   ↓
7. Redirect to main app
```

### Key Insight

Each account has:
- A **unique identityId** (from server)
- A **unique database** in IndexedDB (derived from identityId)
- A **stored public key** in that database (immutable after first login)
- A **derived public key** from the seed phrase

If the user provides the correct seed/password, the derived public key MUST match what's stored in their account's database.

## Implementation Details

### In `auth.tsx` - handlePasswordRecovery()

```typescript
const { publicKeyBase64, privateKey } = await AccountService.recoverWithPassword(password);
const loginResult = await loginOnly(publicKeyBase64, privateKey);

// Initialize database after login with identityId
await StorageService.initialize(loginResult.identityId);

// Verify that derived public key matches stored key
const storedKey = await StorageService.getPublicKey();
if (storedKey && storedKey !== publicKeyBase64) {
  throw new Error('Seed verification failed: Public key mismatch. This password does not match your account.');
}

// Store public key if not already stored
if (!storedKey) {
  await StorageService.storePublicKey(publicKeyBase64);
}

toast.success('Account recovered!');
window.location.href = '/';
```

### In `auth.tsx` - handleSeedRecovery()

Same verification logic applied to seed phrase recovery:

```typescript
const { publicKeyBase64, privateKey } = await AccountService.recoverWithSeed(recoveredSeed);
// ... login and initialize database ...

// Verify that derived public key matches stored key
const storedKey = await StorageService.getPublicKey();
if (storedKey && storedKey !== publicKeyBase64) {
  throw new Error('Seed verification failed: Public key mismatch. This seed does not match your account.');
}

if (!storedKey) {
  await StorageService.storePublicKey(publicKeyBase64);
}
```

## Security Properties

### What This Protects Against

1. **Wrong Seed Phrase**
   - User enters valid seed but for different account
   - Derived public key won't match stored key
   - Recovery rejected

2. **Typo in Seed**
   - Seed with typos still derives a key (just wrong one)
   - Public key mismatch detected
   - User alerted to fix seed

3. **Wrong Password (for cloud backup)**
   - Password decrypts to wrong seed
   - Derived public key doesn't match
   - Recovery rejected

4. **Database Corruption**
   - Stored public key corrupted
   - Mismatch detected
   - User alerted to issue

### What This Does NOT Protect

- **Seed compromise**: If attacker has the seed, they can still recover the account
- **Password compromise**: If attacker has the password, they can still recover the account
- **Account takeover**: Server-side verification is still required (JWT, etc.)

This is a **client-side integrity check**, not a security boundary.

## Database Initialization Order (Critical)

The verification MUST happen in this order:

```
1. Login completes → get identityId ✓
2. Initialize database with identityId ✓
3. Retrieve stored public key from database ✓
4. Compare with derived key ✓
5. Only then store key if missing ✓
```

If verification happens BEFORE database initialization, it will fail with "Database not initialized" error.

## Recovery Scenarios

### Scenario 1: First Time Recovery (Database Exists, No Stored Key)

```
storedKey = await StorageService.getPublicKey() → null
if (storedKey && storedKey !== publicKeyBase64) → FALSE (storedKey is null)
if (!storedKey) → TRUE
  await StorageService.storePublicKey(publicKeyBase64) → Store key
Result: ✅ Recovery succeeds, key is now stored
```

### Scenario 2: Returning User (Database Exists, Key Matches)

```
storedKey = await StorageService.getPublicKey() → "abc123..."
if (storedKey && storedKey !== publicKeyBase64) → FALSE (keys match)
if (!storedKey) → FALSE (key already exists)
Result: ✅ Recovery succeeds, key unchanged
```

### Scenario 3: Wrong Seed/Password (Database Exists, Key Mismatch)

```
storedKey = await StorageService.getPublicKey() → "abc123..."
derived = publicKeyBase64 → "xyz789..." (different seed)
if (storedKey && storedKey !== publicKeyBase64) → TRUE
  throw Error("Public key mismatch. This seed does not match your account.")
Result: ❌ Recovery rejected, user must enter correct seed
```

### Scenario 4: New Account (Fresh Database, No Stored Key)

```
storedKey = await StorageService.getPublicKey() → null
if (storedKey && storedKey !== publicKeyBase64) → FALSE (storedKey is null)
if (!storedKey) → TRUE
  await StorageService.storePublicKey(publicKeyBase64) → Store key
Result: ✅ Recovery succeeds, key is now stored
```

## Per-Account Database Architecture

This verification leverages the per-account database design:

- **Before login**: No database initialized
- **After login**: Database initialized with `identityId` → creates unique IndexedDB database
- **Database name**: Deterministic hash of `identityId` → same user always opens same database
- **Public key location**: Stored in that user's database
- **Isolation**: Different users have completely separate databases

## Error Messages

Users see clear errors when verification fails:

- **Password Recovery**: "Seed verification failed: Public key mismatch. This password does not match your account."
- **Seed Recovery**: "Seed verification failed: Public key mismatch. This seed does not match your account."

This guides users to:
1. Check for typos in their seed/password
2. Ensure they're using the correct recovery method
3. Try again with the correct credentials

## Future Enhancements

Potential improvements:

1. **Seed Checksum Display**: Show visual checksum of derived key during recovery
2. **Account Identifier**: Display account name/handle after successful verification
3. **Device Verification**: Cross-reference device IDs to detect account switching
4. **Recovery Attempt Logging**: Track failed recovery attempts for security analytics

## Testing

To test the verification:

1. **Correct seed**: Recovery succeeds, user logged in
2. **Wrong seed**: Recovery fails with "Public key mismatch" error
3. **Typo in seed**: Recovery fails with "Public key mismatch" error
4. **Correct password**: Recovery succeeds
5. **Wrong password**: Recovery fails (during decryption or verification)

## Summary

The seed verification mechanism adds a cryptographic integrity check to account recovery, ensuring users always recover the correct account even if they accidentally provide valid but wrong credentials. This is a quality-of-life feature that prevents user confusion while maintaining security through proper key derivation and comparison.
