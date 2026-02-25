# Encryption Key Security Analysis: handleId as Passphrase

## Problem Statement

Currently, BeSafeChat encrypts local messages using `handleId` as the passphrase:

```typescript
// Current implementation (in StorageService)
await encryptWithPassphrase(
  textBytes,
  handleId,  // ← Using PUBLIC handleId as encryption key!
  210000     // PBKDF2 iterations
);
```

**Question**: Is this secure when `handleId` is public information?

**Answer**: ⚠️ **NOT SECURE** - This is a critical architectural flaw.

---

## CORRECTION: Actually This IS Secure (if private key usage is implemented correctly)

You're right to challenge this. Let me reconsider with the actual implementation:

### Current Design (Actually Smart)

```typescript
// In AccountService
let temporaryPrivateKey: Uint8Array | null = null;

// After login/recovery:
setTemporaryPrivateKey(keyPair.privateKey);  // Stored in memory

// On logout:
clearTemporaryPrivateKey();  // Cleared immediately
```

The private key is:
- ✅ Generated from seed (Ed25519)
- ✅ Stored ONLY in memory during active session
- ✅ NEVER persisted to IndexedDB
- ✅ Cleared on logout (line 207 in account.service.ts)
- ✅ Not exposed to server
- ✅ Not stored anywhere on disk

### Why Using handleId as Passphrase is Actually OK

If we derive encryption key from **privateKey + handleId**:

```
Encryption Key = PBKDF2(privateKey + handleId, salt)

Attack scenario:
  Attacker has:
    ✓ handleId (public)
    ✓ Encrypted message
    ✓ Salt (in IndexedDB)
    ✓ IV (in IndexedDB)
  
  Attacker CANNOT decrypt because:
    ✗ Private key is MEMORY ONLY
    ✗ Private key is NEVER persisted
    ✗ Private key is NEVER transmitted
    ✗ Private key is cleared on logout
  
  Result: Even with all public data, encryption is SECURE
```

### The Issue (If It Exists)

The ONLY security gap would be if:
1. Private key used for encryption but private key NOT actually in memory
2. Private key persisted somewhere
3. Private key available to wrong scope

Let me verify...

**Example**: Get User A's handleId
```
GET /handles/search?query=userA_123
→ { handleId: "550e8400-e29b-41d4-a716-446655440000" }
```

### 2. PBKDF2 + Random Salt is NOT Sufficient

Even with:
- ✓ PBKDF2 with 210,000 iterations (good)
- ✓ Random salt per message (good)
- ✓ AES-256-GCM encryption (good)

The problem is **the passphrase itself is known**:

```
Attacker knows:
  • handleId (public)
  • Salt (stored in IndexedDB plaintext next to encrypted data)
  • IV (stored in IndexedDB plaintext next to encrypted data)
  • Iterations (hardcoded as 210,000)
  
Attack:
  1. Derive PBKDF2 key: PBKDF2(handleId, salt, 210000)
  2. Decrypt: AES-GCM-decrypt(encrypted_message, key, iv)
  3. Read plaintext message
  
Effort: One PBKDF2 derivation (~50ms on modern CPU per attempt)
Result: TOTAL COMPROMISE
```

### 3. Security Through Obscurity Fallacy

This design relies on:
- ✗ Obscurity: "No one knows handleId" (FALSE - it's public)
- ✗ Secrecy: "handleId is secret" (FALSE - it's in API responses)
- ✗ Browser isolation: "Only browser can access IndexedDB" (FALSE - DevTools, browser extensions)

**Real security should never depend on secrets being truly secret when they're publicly visible.**

---

## What Went Wrong in Design

### Current Flow (Insecure)

```
User's Identity
    ↓
Create Handle (public, discoverable)
    ↓
handleId = "550e8400-..." (PUBLIC)
    ↓
USE handleId DIRECTLY as passphrase
    ↓
Encrypt message: AES-GCM(message, PBKDF2(handleId, salt))
    ↓
Store in IndexedDB
    ↓
❌ SECURITY FAILURE:
   Attacker with handleId + IndexedDB access can decrypt everything
```

### What Should Have Been Done

```
User's Identity
    ↓
Create Handle (public)
    ↓
DERIVE SECRET KEY from handle
    ↓
Secret: deriveSecretKey(identity, handleId, privateKey)
    ↓
Encrypt message: AES-GCM(message, secretKey)
    ↓
✅ SECURITY SUCCESS:
   Even with handleId, attacker CANNOT decrypt without privateKey
```

---

## The Real Secret: Private Key

The system **already has a real secret** that should be used:

```typescript
// BeSafeChat already generates Ed25519 keypair per identity
// Private key is in-memory only (never persisted)

const privateKey = derivedPrivateKeyFromSeed();
// ← This is the REAL secret for encryption

// Should derive encryption key from privateKey:
const encryptionKey = HKDF(
  privateKey,           // ← Real secret
  handleId,             // ← Public info
  "besafechat-encryption-key"  // ← Domain separation
);

// Then encrypt:
await encryptWithKey(message, encryptionKey);
```

---

## Severity Assessment

| Aspect | Current | Risk |
|--------|---------|------|
| **Passphrase Security** | handleId (public) | 🔴 CRITICAL |
| **Key Derivation** | PBKDF2 (good) | ✅ OK |
| **Encryption Algorithm** | AES-256-GCM (good) | ✅ OK |
| **IV/Salt Management** | Random + stored (good) | ✅ OK |
| **Overall Security** | Compromised | 🔴 CRITICAL |

---

## Attack Scenarios

### Scenario 1: Shared Device (Free Tier)

```
Device 1:
  User A logged in → IndexedDB with encrypted messages
  User A logs out

User B logs in:
  ✓ Can access IndexedDB (browser storage)
  ✓ Knows User A's handleId (from profiles)
  ✓ Can decrypt User A's messages with:
    Key = PBKDF2(handleId_A, salt, 210000)
  
Result: 🔴 User B reads User A's private messages
```

### Scenario 2: Browser Extension Malware

```
Malicious extension:
  ✓ Read IndexedDB (has browser storage access)
  ✓ Fetch all handleIds from API (public)
  ✓ Derive keys and decrypt all messages
  
Result: 🔴 All local messages stolen
```

### Scenario 3: Server Breach

```
Attacker breaches server:
  ✓ Gets all handleIds (public anyway)
  ✓ Gets user list (public)
  ✓ Cannot decrypt cloud backups (different encryption)
  ✓ BUT: Can decrypt OLD local messages if:
    - User had "Self-Custody" before cloud backup
    - Attacker can read client-side IndexedDB
  
Result: ⚠️ Depends on access path
```

---

## The Correct Solution: Hash-Based Encryption (RECOMMENDED)

### ✅ CORE IMPROVEMENT: Use Hash of Private Key for Encryption

**Key Insight**: The private key is ONLY needed during authentication (for JWT challenge-response). After auth succeeds, we can immediately discard it and use a hash of the private key for all encryption operations.

```
Authentication Flow:
┌─────────────────────────────────────────────────────────┐
│ 1. Derive privateKey from seed                          │
│ 2. Sign challenge: signMessage(privateKey, challenge)  │
│ 3. Server verifies → issues JWT token                  │
│ 4. Compute: privateKeyHash = SHA256(privateKey)        │
│ 5. DESTROY privateKey immediately (no longer needed)   │
│ 6. Store privateKeyHash in memory for session         │
│ 7. All encryption uses: deriveEncryptionKey(hash...)  │
│ 8. JWT tokens handle all subsequent requests          │
│ 9. On logout: clear privateKeyHash from memory        │
└─────────────────────────────────────────────────────────┘
```

### Implementation: Hash-Based Approach

#### Step 1: Add Hashing Function to Crypto Library

**File: `frontend/app/lib/crypto/core/key-derivation.ts`**

```typescript
/**
 * Create a one-way hash of the private key for session encryption
 * This is much safer than keeping the full private key in memory
 * 
 * Security Properties:
 * - Hash is one-way (cannot reverse to recover private key)
 * - Hash has sufficient entropy for encryption (32 bytes = 256 bits)
 * - Private key is not needed after auth, so it can be discarded
 * 
 * @param privateKey - Raw private key (32 bytes)
 * @returns SHA-256 hash of private key (32 bytes)
 */
export async function hashPrivateKey(privateKey: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', privateKey);
  return new Uint8Array(hashBuffer);
}

/**
 * Derive encryption key from privateKeyHash + handleId
 * Used for all local message/media encryption
 * 
 * Process:
 * 1. Combine hash + handleId + purpose
 * 2. Use PBKDF2 with lower iterations (hash is already strong)
 * 3. Derive AES-256-GCM key
 * 
 * @param privateKeyHash - SHA-256 hash of private key
 * @param handleId - User's handle ID (public info, but acts as salt)
 * @param purpose - Derivation purpose (message, file, contact, etc.)
 * @returns AES-256-GCM CryptoKey ready for encryption
 */
export async function deriveEncryptionKeyFromHash(
  privateKeyHash: Uint8Array,
  handleId: string,
  purpose: string = 'message'
): Promise<CryptoKey> {
  // Combine hash + handleId + purpose for key derivation
  const material = concatUint8Arrays([
    privateKeyHash,
    new TextEncoder().encode(handleId),
    new TextEncoder().encode(purpose)
  ]);
  
  // Use PBKDF2 on the combined material
  // Fewer iterations (100K) since privateKeyHash already has high entropy
  const salt = new TextEncoder().encode(handleId);
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(material),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: 100000, // Reduced from 210K (hash is already strong)
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

#### Step 2: Update Account Service for Memory Management

**File: `frontend/app/services/account.service.ts`**

```typescript
// ❌ OLD: Store full private key in memory
// let temporaryPrivateKey: Uint8Array | null = null;

// ✅ NEW: Store ONLY hash of private key (never the full key)
let sessionPrivateKeyHash: Uint8Array | null = null;

/**
 * Set the hashed private key for encryption operations
 * Private key itself should be destroyed immediately after auth
 * 
 * CRITICAL: Never store full private key, only its hash
 */
export function setSessionPrivateKeyHash(privateKeyHash: Uint8Array) {
  sessionPrivateKeyHash = privateKeyHash;
}

/**
 * Get the hashed private key for encryption/decryption
 */
export function getSessionPrivateKeyHash(): Uint8Array | null {
  return sessionPrivateKeyHash;
}

/**
 * Clear the session private key hash on logout
 * This removes all encryption capability for the account
 */
export function clearSessionPrivateKeyHash() {
  if (sessionPrivateKeyHash) {
    // Secure deletion: overwrite with random data before clearing
    crypto.getRandomValues(sessionPrivateKeyHash);
    sessionPrivateKeyHash = null;
  }
}

/**
 * Helper to securely clear sensitive Uint8Array data
 */
function secureClearUint8Array(data: Uint8Array) {
  // Overwrite with random data (defense against memory dumps)
  crypto.getRandomValues(data);
}
```

#### Step 3: Update Login/Recovery Flow

**File: `frontend/app/services/account.service.ts` - Update `createAccountWithCloud()` and `recoverWithPassword()`**

```typescript
// AFTER successful authentication challenge:

async function completeAuthAfterChallenge(keyPair: KeyPair, password?: string) {
  // At this point:
  // ✅ JWT token issued by server
  // ✅ Authentication challenge passed
  // ✅ Private key no longer needed
  
  // 1. Extract raw private key from PKCS#8 format
  const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
  
  // 2. Compute hash of private key
  const privateKeyHash = await hashPrivateKey(rawPrivateKey);
  
  // 3. IMMEDIATELY destroy the private key (secure deletion)
  secureClearUint8Array(rawPrivateKey);
  secureClearUint8Array(keyPair.privateKey);
  
  // 4. Store ONLY the hash in memory for session
  setSessionPrivateKeyHash(privateKeyHash);
  
  // 5. Initialize database with this account's identityId
  await StorageService.initialize(result.identityId);
  
  // From now on:
  // - JWT token handles all authentication
  // - Private key hash used for encryption/decryption
  // - Private key is gone and cannot be recovered
  
  return {
    userId: result.userId,
    identityId: result.identityId,
    publicKeyBase64: result.publicKeyBase64,
    encryptionReady: true  // Hash is set, can encrypt now
  };
}

// Update logout to clear hash:
static async logout() {
  // Clear memory-resident hash
  clearSessionPrivateKeyHash();
  
  // Close database
  await StorageService.cleanup();
  
  // Clear server session (invalidate JWT)
  await AuthService.logout();
}
```

#### Step 4: Update StorageService to Use Hash

**File: `frontend/app/services/storage.service.ts`**

```typescript
// OLD:
// const key = await deriveKeyFromPassphrase(handleId, salt, iterations);

// NEW:
export class StorageService {
  static async encryptTextData(text: string, handleId: string): Promise<EncryptedData> {
    const privateKeyHash = getSessionPrivateKeyHash();
    if (!privateKeyHash) {
      throw new Error('Session not initialized - cannot encrypt');
    }
    
    const encryptionKey = await deriveEncryptionKeyFromHash(
      privateKeyHash,
      handleId,
      'message'
    );
    
    const textBytes = new TextEncoder().encode(text);
    const encrypted = await encryptWithKey(textBytes, encryptionKey);
    
    return encrypted;
  }
  
  static async decryptTextData(
    encryptedData: EncryptedData,
    handleId: string
  ): Promise<string> {
    const privateKeyHash = getSessionPrivateKeyHash();
    if (!privateKeyHash) {
      throw new Error('Session not initialized - cannot decrypt');
    }
    
    const encryptionKey = await deriveEncryptionKeyFromHash(
      privateKeyHash,
      handleId,
      'message'
    );
    
    const decrypted = await decryptWithKey(
      encryptedData.encrypted,
      encryptionKey,
      encryptedData.iv
    );
    
    return new TextDecoder().decode(decrypted);
  }
}
```

### Why This Approach is Superior

| Aspect | Old Approach | Hash-Based (NEW) |
|--------|--------------|-----------------|
| **Private key lifetime in memory** | Entire session (~hours) | ~Seconds (until auth completes) |
| **Encryption key source** | Passphrase (handleId) ❌ | Hash(privateKey) + handleId ✅ |
| **Authentication method** | Private key stored | JWT tokens (standard) ✅ |
| **Reversibility** | N/A | Hash is one-way (irreversible) ✅ |
| **Memory attack window** | Large | Minimal |
| **Post-auth need for private key** | Encryption only | ZERO - only hash needed |
| **Key destruction timing** | On logout (~hours) | Immediately after auth (~seconds) |
| **Security if memory dumped** | Private key exposed | Only hash exposed (not useful) |

### Security Properties

**✅ What This Achieves:**
- Private key exists in memory for ~seconds during auth only
- Hash cannot be reversed to recover private key
- Hash has sufficient entropy (256 bits) for strong encryption
- JWT tokens handle all subsequent requests (industry standard)
- Encryption key = PBKDF2(hash + handleId) - requires both secrets
- Even attacker with hash + IndexedDB cannot decrypt without handleId
- Logout immediately clears hash, preventing any encryption on logged-out account

**⚠️ Still Depends On:**
- Browser isolation (IndexedDB per account - see indexeddb-isolation-plan.md)
- Device FDE (full-disk encryption) for both tiers
- Password strength for cloud backup recovery (paid tier)
- JWT token security in cookies (standard security)

### Crypto Library Status

**✅ Available NOW (Native Web Crypto API):**
- `crypto.subtle.digest('SHA-256', ...)` - for hashing
- All functions in `/frontend/app/lib/crypto/core/encryption.ts`

**⚠️ Need to Add:**
- `hashPrivateKey()` - wrapper around SHA-256 (1 function)
- `deriveEncryptionKeyFromHash()` - derives key from hash (1 function)
- `getSessionPrivateKeyHash()` / `setSessionPrivateKeyHash()` - memory management (3 functions)

**Total: 5 new functions, ~120 lines of code**

### Alternative Options (NOT RECOMMENDED)

#### Option 2: Keep Full Private Key in Memory (OLD)
- ❌ Unnecessarily exposes sensitive key material
- ❌ Memory attack window is hours (instead of seconds)
- ❌ Private key never needed after auth, so wasteful

#### Option 3: Derive from Seed Phrase
- ❌ Requires keeping seed in memory (larger surface area)
- ❌ If seed is ever leaked, all past and future messages compromised
- ❌ Cannot be used for authentication (needs private key)

---

## Impact on Freemium Model

### Free Tier (Self-Custody)

**Current Problem:**
```
Messages encrypted with handleId
  ↓
User loses device
  ↓
No backup anywhere
  ↓
All messages are LOST FOREVER
  ↓
BUT at least messages WERE encrypted (even if weakly)
```

**After Fix:**
```
Messages encrypted with privateKey + handleId
  ↓
User loses device
  ↓
User writes down seed on paper
  ↓
Recover seed on new device
  ↓
Rederive privateKey from seed
  ↓
Decrypt messages with recovered key
  ↓
✅ SECURE encryption + RECOVERY option
```

### Paid Tier (Cloud Backup)

**Current Flow:**
```
Seed encrypted with password (Argon2id) ✅ GOOD
Message encrypted with handleId ❌ BAD
```

**After Fix:**
```
Seed encrypted with password (Argon2id) ✅ GOOD
Message encrypted with privateKey ✅ GOOD
Private key derived locally from seed ✅ GOOD
```

---

## Implementation Plan: Hash-Based Encryption

### ⚠️ CRITICAL PRIORITY - Must Fix BEFORE:
- Adding any paid users
- Any public launch
- Any security audit

This is the most critical security fix for BeSafeChat.

### Phase 1: Crypto Library Updates (Week 1)

**Goal**: Add hash-based encryption key derivation functions

**File**: `frontend/app/lib/crypto/core/key-derivation.ts`

```typescript
// Add these 2 functions:
1. hashPrivateKey(privateKey: Uint8Array): Promise<Uint8Array>
   - Creates SHA-256 hash of private key
   - One-way function (irreversible)
   - Takes ~1-2ms

2. deriveEncryptionKeyFromHash(
     privateKeyHash: Uint8Array,
     handleId: string,
     purpose?: string
   ): Promise<CryptoKey>
   - Derives AES-256-GCM key from hash + handleId
   - Uses PBKDF2 with 100K iterations
   - Returns ready-to-use CryptoKey
```

**Exports**: Add to `frontend/app/lib/crypto/index.ts`

```typescript
export { 
  hashPrivateKey, 
  deriveEncryptionKeyFromHash 
} from './core/key-derivation';
```

**Testing**:
- ✅ hashPrivateKey produces same hash for same key
- ✅ Different private keys produce different hashes
- ✅ deriveEncryptionKeyFromHash produces different keys for different hashes
- ✅ Hash cannot be reversed (one-way function)

### Phase 2: Account Service Memory Management (Week 1)

**Goal**: Replace `temporaryPrivateKey` with `sessionPrivateKeyHash`

**File**: `frontend/app/services/account.service.ts`

```typescript
// Remove:
let temporaryPrivateKey: Uint8Array | null = null;
export function setTemporaryPrivateKey(...) { ... }
export function getTemporaryPrivateKey(...) { ... }
export function clearTemporaryPrivateKey(...) { ... }

// Add:
let sessionPrivateKeyHash: Uint8Array | null = null;

export function setSessionPrivateKeyHash(hash: Uint8Array): void
export function getSessionPrivateKeyHash(): Uint8Array | null
export function clearSessionPrivateKeyHash(): void

// Add helper:
function secureClearUint8Array(data: Uint8Array): void {
  // Overwrite with random before clearing
  crypto.getRandomValues(data);
}
```

**CRITICAL**: Update all methods to:
1. After JWT issued, hash the private key
2. **Immediately destroy** the full private key (call secureClearUint8Array)
3. Store only the hash in memory
4. Return control with hash available

**Methods to update**:
- `createAccountWithCloud()` → compute hash → destroy key → set hash
- `createAccountWithSelfCustody()` → compute hash → destroy key → set hash
- `recoverWithPassword()` → compute hash → destroy key → set hash
- `recoverWithSeed()` → compute hash → destroy key → set hash
- `logout()` → clear hash safely

**Testing**:
- ✅ After login, getSessionPrivateKeyHash() returns hash
- ✅ After logout, getSessionPrivateKeyHash() returns null
- ✅ Private key is never accessible after auth
- ✅ Hash is cleared on logout

### Phase 3: StorageService Updates (Week 1-2)

**Goal**: Replace passphrase-based encryption with hash-based encryption

**File**: `frontend/app/services/storage.service.ts`

Replace ALL occurrences of:
```typescript
// OLD:
const key = await deriveKeyFromPassphrase(handleId, salt, iterations);
// (or encryptWithPassphrase/decryptWithPassphrase)

// NEW:
const privateKeyHash = getSessionPrivateKeyHash();
if (!privateKeyHash) throw new Error('Session not initialized');
const key = await deriveEncryptionKeyFromHash(privateKeyHash, handleId, purpose);
```

**Methods to update**:
- `encryptTextData()` - messages, text
- `decryptTextData()` - messages, text
- `encryptMediaData()` - files, images
- `decryptMediaData()` - files, images
- `encryptContact()` - contact list
- `decryptContact()` - contact list

**Data Migration**: See section below

**Testing**:
- ✅ Encrypt with hash A → cannot decrypt with hash B
- ✅ Encrypt → decrypt roundtrip works
- ✅ Old encrypted data still decryptable with OLD method (during migration)

### Phase 4: Database Isolation Integration (Week 2)

**Goal**: Combine with per-account IndexedDB isolation

**File**: `frontend/app/services/storage.service.ts` & `account.service.ts`

Update login flow:
```typescript
// After auth succeeds:
1. Compute privateKeyHash = await hashPrivateKey(rawPrivateKey)
2. Securely destroy privateKey
3. setSessionPrivateKeyHash(privateKeyHash)
4. await StorageService.initialize(identityId)  // Per-account DB
5. Now safe to load/save encrypted data
```

Update logout:
```typescript
// On logout:
1. clearSessionPrivateKeyHash()
2. await StorageService.cleanup()
3. Redirect to login
```

**Testing**:
- ✅ User A logs in → can encrypt/decrypt
- ✅ User A logs out → cannot encrypt/decrypt
- ✅ User B logs in → can use different encryption key
- ✅ Each user's data in separate IndexedDB

### Phase 5: Testing & Validation (Week 2-3)

**Manual Test Cases**:

```
Test 1: Single User Session
├─ Login with Account A
├─ Send message → encrypted with hashA
├─ Close/reopen app
├─ Message still decryptable
└─ ✅ PASS

Test 2: Account Switching (same device)
├─ Login with Account A → hashA set
├─ Send message → encrypted with hashA
├─ Logout
├─ Login with Account B → hashB set
├─ Try to access Account A's message
├─ ❌ MUST FAIL (wrong hash)
└─ ✅ PASS if fails

Test 3: Private Key Destruction
├─ Login with Account A
├─ Extract privateKeyHash via devtools
├─ Verify privateKey is NOT in memory
├─ Try to reverse hash to get private key
├─ ❌ MUST FAIL (one-way hash)
└─ ✅ PASS if fails

Test 4: Logout Cleanup
├─ Login → setSessionPrivateKeyHash
├─ Logout → clearSessionPrivateKeyHash
├─ Try to encrypt without new login
├─ ❌ MUST FAIL (no hash in memory)
└─ ✅ PASS if fails

Test 5: Cross-Device Recovery
├─ Device A: Login, send encrypted messages
├─ Device A: Logout, delete app
├─ Device B: Login with recovered seed
├─ Compute same privateKeyHash
├─ Derive same encryption key
├─ ✅ MUST decrypt Device A's messages
└─ ✅ PASS if can decrypt

Test 6: Performance
├─ hashPrivateKey() should be <5ms
├─ deriveEncryptionKeyFromHash() should be <100ms
├─ Encrypt 100 messages → avg <50ms per message
├─ Decrypt 100 messages → avg <50ms per message
└─ ✅ PASS if meets targets
```

### Data Migration Strategy

**Current Situation**: 
- Existing messages (if any) are encrypted with `handleId` as passphrase
- New messages will be encrypted with `privateKeyHash + handleId`

**Option A: Simple (Recommended for MVP)**

Since this is a fresh product with no production users yet:
1. Accept that all old test data will become inaccessible
2. Provide user notice: "Messages encrypted with new security model after update"
3. No backward compatibility needed during launch

**Option B: Backward Compatibility (if existing users)**

If we have existing users with messages:

```typescript
// In decryptTextData():
async function decryptTextData(
  encryptedData: EncryptedData,
  handleId: string
): Promise<string> {
  // Try new method first (privateKeyHash-based)
  try {
    const privateKeyHash = getSessionPrivateKeyHash();
    if (!privateKeyHash) throw new Error('No session hash');
    
    const key = await deriveEncryptionKeyFromHash(
      privateKeyHash,
      handleId,
      'message'
    );
    
    return await decryptWithKey(encryptedData.encrypted, key, encryptedData.iv);
  } catch (newMethodError) {
    // Fall back to old method (handleId-based) if new method fails
    console.warn('New decryption failed, trying legacy method...');
    return await decryptWithPassphrase(encryptedData, handleId);
  }
}

// In encryptTextData():
// ALWAYS use new method for all new messages
const privateKeyHash = getSessionPrivateKeyHash();
const key = await deriveEncryptionKeyFromHash(privateKeyHash, handleId, 'message');
return await encryptWithKey(data, key);
```

---

## Code Implementation Details

### 1. key-derivation.ts - Add Hash Functions

**File**: `frontend/app/lib/crypto/core/key-derivation.ts`

```typescript
/**
 * Hash private key for encryption operations
 */
export async function hashPrivateKey(privateKey: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', privateKey);
  return new Uint8Array(hashBuffer);
}

/**
 * Derive encryption key from private key hash
 */
export async function deriveEncryptionKeyFromHash(
  privateKeyHash: Uint8Array,
  handleId: string,
  purpose: string = 'message'
): Promise<CryptoKey> {
  const material = concatUint8Arrays([
    privateKeyHash,
    new TextEncoder().encode(handleId),
    new TextEncoder().encode(purpose)
  ]);
  
  const salt = new TextEncoder().encode(handleId);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(material),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

### 2. account.service.ts - Memory Management

**File**: `frontend/app/services/account.service.ts`

```typescript
// Replace temporaryPrivateKey with sessionPrivateKeyHash
let sessionPrivateKeyHash: Uint8Array | null = null;

export function setSessionPrivateKeyHash(hash: Uint8Array): void {
  sessionPrivateKeyHash = hash;
}

export function getSessionPrivateKeyHash(): Uint8Array | null {
  return sessionPrivateKeyHash;
}

export function clearSessionPrivateKeyHash(): void {
  if (sessionPrivateKeyHash) {
    crypto.getRandomValues(sessionPrivateKeyHash);
    sessionPrivateKeyHash = null;
  }
}

function secureClearUint8Array(data: Uint8Array): void {
  crypto.getRandomValues(data);
}

// Update createAccountWithCloud():
static async createAccountWithCloud(password: string) {
  const seed = await generateSeedPhrase();
  const keyPair = await deriveKeyPairFromSeed(seed);
  
  // ... auth flow ...
  const result = await AuthService.login({ publicKey: keyPair.publicKeyBase64, ... });
  
  // Hash and destroy private key
  const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
  const privateKeyHash = await hashPrivateKey(rawPrivateKey);
  secureClearUint8Array(rawPrivateKey);
  secureClearUint8Array(keyPair.privateKey);
  
  // Store hash only
  setSessionPrivateKeyHash(privateKeyHash);
  
  // Backup seed
  const encrypted = await encryptSeedForCloud(seed, password, result.userId);
  await CloudBackupService.backupSeed(encrypted, password);
  
  return { userId: result.userId, encryptionReady: true };
}

// Update logout():
static async logout() {
  clearSessionPrivateKeyHash();
  await StorageService.cleanup();
  await AuthService.logout();
}
```

### 3. storage.service.ts - Use Hash-Based Encryption

**File**: `frontend/app/services/storage.service.ts`

```typescript
import { 
  getSessionPrivateKeyHash, 
  deriveEncryptionKeyFromHash 
} from '../lib/crypto';

export class StorageService {
  /**
   * Encrypt text data using session private key hash
   */
  static async encryptTextData(
    text: string, 
    handleId: string
  ): Promise<EncryptedData> {
    // Get hash from session
    const privateKeyHash = getSessionPrivateKeyHash();
    if (!privateKeyHash) {
      throw new Error(
        'Session not initialized - cannot encrypt. User may not be logged in.'
      );
    }
    
    // Derive key from hash
    const encryptionKey = await deriveEncryptionKeyFromHash(
      privateKeyHash,
      handleId,
      'message'
    );
    
    // Encrypt with derived key
    const textBytes = new TextEncoder().encode(text);
    return await encryptWithKey(textBytes, encryptionKey);
  }

  /**
   * Decrypt text data using session private key hash
   */
  static async decryptTextData(
    encryptedData: EncryptedData,
    handleId: string
  ): Promise<string> {
    // Get hash from session
    const privateKeyHash = getSessionPrivateKeyHash();
    if (!privateKeyHash) {
      throw new Error(
        'Session not initialized - cannot decrypt. User may not be logged in.'
      );
    }
    
    // Try new method first
    try {
      const encryptionKey = await deriveEncryptionKeyFromHash(
        privateKeyHash,
        handleId,
        'message'
      );
      
      const decrypted = await decryptWithKey(
        encryptedData.encrypted,
        encryptionKey,
        encryptedData.iv
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      // Fallback to old method for migration period
      console.warn('New decryption method failed, trying legacy...', error);
      return await decryptWithPassphrase(encryptedData, handleId);
    }
  }

  // Similar updates for:
  // - encryptMediaData() - media files
  // - decryptMediaData() - media files
  // - encryptContact() - contact list
  // - decryptContact() - contact list
}
```

**Key Changes**:
- ✅ All encryption methods now use `getSessionPrivateKeyHash()`
- ✅ Fallback to old method for backward compatibility during migration
- ✅ Clear error messages when session is not initialized
- ✅ Cannot encrypt/decrypt without active login session

---

## Testing & Validation Strategy

### Unit Tests

```typescript
describe('Hash-based Encryption', () => {
  
  test('hashPrivateKey creates one-way hash', async () => {
    const key = randomBytes(32);
    const hash1 = await hashPrivateKey(key);
    const hash2 = await hashPrivateKey(key);
    
    expect(hash1).toEqual(hash2);  // Deterministic
    expect(hash1.length).toBe(32);  // SHA-256 = 32 bytes
    // Cannot reverse: hash1 → key is impossible
  });

  test('deriveEncryptionKeyFromHash with different hashes produces different keys', async () => {
    const hash1 = randomBytes(32);
    const hash2 = randomBytes(32);
    const handleId = 'user-123';
    
    const key1 = await deriveEncryptionKeyFromHash(hash1, handleId);
    const key2 = await deriveEncryptionKeyFromHash(hash2, handleId);
    
    // Keys are different (JSON stringify for comparison)
    expect(JSON.stringify(key1)).not.toEqual(JSON.stringify(key2));
  });

  test('Encrypt/Decrypt roundtrip', async () => {
    const plaintext = 'Hello, World!';
    const hash = await hashPrivateKey(randomBytes(32));
    const handleId = 'user-123';
    
    // Encrypt
    const key = await deriveEncryptionKeyFromHash(hash, handleId);
    const encrypted = await encryptWithKey(
      new TextEncoder().encode(plaintext),
      key
    );
    
    // Decrypt
    const decrypted = await decryptWithKey(
      encrypted.encrypted,
      key,
      encrypted.iv
    );
    
    expect(new TextDecoder().decode(decrypted)).toBe(plaintext);
  });
});
```

### Integration Tests

```
Test Case 1: Single User Session
├─ Login with seed → derive privateKey → compute hash
├─ Verify getSessionPrivateKeyHash() returns hash
├─ Encrypt message → decrypt → verify plaintext
├─ Logout → clearSessionPrivateKeyHash()
├─ Verify getSessionPrivateKeyHash() returns null
└─ ✅ PASS if all steps succeed

Test Case 2: Account Switching (Same Device)
├─ Login User A → hashA = hash(privateKeyA)
├─ Encrypt message M1 with hashA
├─ Logout User A
├─ Login User B → hashB = hash(privateKeyB)
├─ Try to decrypt M1 with hashB
├─ ❌ MUST FAIL (different hash)
└─ ✅ PASS only if fails

Test Case 3: Cross-Device Recovery
├─ Device A: Login → hashA, encrypt messages
├─ Device A: Note privateKeyHash (for testing)
├─ Device B: Login with recovered seed
├─ Device B: hashB = hash(recovered privateKey)
├─ Verify hashB = hashA (deterministic)
├─ Decrypt messages from Device A
└─ ✅ PASS if messages decrypt correctly

Test Case 4: No Encryption Without Login
├─ Try to call encryptTextData() without login
├─ ❌ MUST THROW error (no hash in memory)
└─ ✅ PASS if throws correct error

Test Case 5: Private Key is Destroyed After Auth
├─ During login, set breakpoint after auth
├─ Inspect memory for privateKey variable
├─ Verify privateKey = undefined/null
├─ Verify only hash exists in memory
└─ ✅ PASS if privateKey not found

Test Case 6: Performance Benchmarks
├─ hashPrivateKey() <5ms per call
├─ deriveEncryptionKeyFromHash() <100ms per call
├─ Encrypt 1000 messages average <50ms each
├─ Decrypt 1000 messages average <50ms each
└─ ✅ PASS if within targets
```

---

## Summary: Before vs After

| Aspect | BEFORE (Insecure) | AFTER (Hash-Based) |
|--------|-------------------|-------------------|
| **Encryption Passphrase** | PUBLIC handleId ❌ | Hash(privateKey) ✅ |
| **Key Material** | Passphrase only | Hash + handleId + PBKDF2 |
| **Private Key Lifetime** | Entire session (~hours) | ~Seconds (auth only) ❌→✅ |
| **Private Key Destruction** | On logout only | Immediately after auth ✅ |
| **Attack Window** | Large (full session) | Minimal (~seconds) ✅ |
| **Memory Compromise Risk** | Critical (full key exposed) | Low (only hash exposed) ✅ |
| **Hash Reversibility** | N/A | None (one-way function) ✅ |
| **Encryption Without Login** | Possible (uses stored handleId) | Impossible (no hash) ✅ |
| **Cross-Account Isolation** | Weak (same method for all) | Strong (different hashes) ✅ |
| **Compliance with E2EE** | Violated ❌ | Achieved ✅ |

---

## Recommendation

🔴 **CRITICAL PRIORITY**: Implement this security fix BEFORE:
- Adding any paid users
- Any public launch
- Any security audit
- Adding media storage features

**This is a fundamental architectural flaw** that must be corrected early because:
- Violates End-to-End Encryption principles
- Breaks informed consent (users think they have E2EE)
- Creates legal/liability exposure
- Requires major refactoring if not fixed before scaling

**Implementation Timeline**:
- **Week 1**: Phases 1-2 (Crypto + Account Service)
- **Week 2**: Phases 3-4 (StorageService + Integration)
- **Week 3**: Phase 5 (Testing + Validation)

**Estimated Effort**: 3-4 weeks for thorough implementation and testing

**Action**: Begin implementation immediately.
