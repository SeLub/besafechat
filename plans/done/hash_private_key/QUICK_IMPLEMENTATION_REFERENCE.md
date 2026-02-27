# Quick Implementation Reference: Hash-Based Encryption

## 🎯 Quick Navigation

Use this as a checklist during implementation. See `encryption-key-analysis.md` for full details.

---

## 📝 Phase 1: Add Crypto Functions (Day 1-2)

### File: `frontend/app/lib/crypto/core/key-derivation.ts`

**Add these 2 functions at the end of the file:**

```typescript
/**
 * Hash private key for encryption operations (SHA-256)
 * - Input: Raw private key (32 bytes)
 * - Output: One-way hash (32 bytes)
 * - Property: Cannot be reversed
 */
export async function hashPrivateKey(privateKey: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', privateKey);
  return new Uint8Array(hashBuffer);
}

/**
 * Derive AES-256-GCM encryption key from private key hash
 * - Combines: hash + handleId + purpose
 * - Uses PBKDF2 with 100K iterations
 * - Returns: Ready-to-use CryptoKey
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

### File: `frontend/app/lib/crypto/index.ts`

**Add to exports (after existing exports):**

```typescript
export { 
  hashPrivateKey, 
  deriveEncryptionKeyFromHash 
} from './core/key-derivation';
```

✅ **Phase 1 Complete**: 2 functions, ~80 lines

---

## 🔐 Phase 2: Update Account Service (Day 3-4)

### File: `frontend/app/services/account.service.ts`

**Step 1: Replace the global variable (Line ~15)**

```typescript
// ❌ REMOVE:
// let temporaryPrivateKey: Uint8Array | null = null;

// ✅ ADD:
let sessionPrivateKeyHash: Uint8Array | null = null;
```

**Step 2: Remove old functions**

```typescript
// ❌ REMOVE these functions:
// export function setTemporaryPrivateKey(privateKey: Uint8Array) { ... }
// export function getTemporaryPrivateKey(): Uint8Array | null { ... }
// export function clearTemporaryPrivateKey() { ... }
```

**Step 3: Add new functions (after class definition)**

```typescript
/**
 * Set hashed private key for encryption (NEVER the full key)
 */
export function setSessionPrivateKeyHash(hash: Uint8Array): void {
  sessionPrivateKeyHash = hash;
}

/**
 * Get hashed private key for encryption/decryption
 */
export function getSessionPrivateKeyHash(): Uint8Array | null {
  return sessionPrivateKeyHash;
}

/**
 * Clear hashed private key on logout
 */
export function clearSessionPrivateKeyHash(): void {
  if (sessionPrivateKeyHash) {
    crypto.getRandomValues(sessionPrivateKeyHash); // Secure deletion
    sessionPrivateKeyHash = null;
  }
}

/**
 * Secure deletion helper
 */
function secureClearUint8Array(data: Uint8Array): void {
  crypto.getRandomValues(data); // Overwrite before clearing
}
```

**Step 4: Update `createAccountWithCloud()` method**

Find the line where JWT is issued and add:

```typescript
// AFTER: const result = await AuthService.login(...)

// Hash and destroy private key
const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
const privateKeyHash = await hashPrivateKey(rawPrivateKey);

// Secure deletion
secureClearUint8Array(rawPrivateKey);
secureClearUint8Array(keyPair.privateKey);

// Store only hash
setSessionPrivateKeyHash(privateKeyHash);

// Continue with existing code...
```

**Step 5: Update `createAccountWithSelfCustody()` method**

Same pattern as above (find where login completes, hash key, destroy key, set hash)

**Step 6: Update `recoverWithPassword()` method**

```typescript
// After: const keyPair = await deriveKeyPairFromSeed(seed);

const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
const privateKeyHash = await hashPrivateKey(rawPrivateKey);
secureClearUint8Array(rawPrivateKey);
secureClearUint8Array(keyPair.privateKey);
setSessionPrivateKeyHash(privateKeyHash);

// Continue...
```

**Step 7: Update `recoverWithSeed()` method**

Same pattern as above.

**Step 8: Update `logout()` method**

```typescript
static async logout() {
  clearSessionPrivateKeyHash();     // ← Add this
  await StorageService.cleanup();
  // ... rest of logout code
}
```

✅ **Phase 2 Complete**: 4 functions + 5 method updates, ~150 lines

---

## 🔒 Phase 3: Update StorageService (Day 5-7)

### File: `frontend/app/services/storage.service.ts`

**Step 1: Add import at top**

```typescript
import { 
  getSessionPrivateKeyHash, 
  deriveEncryptionKeyFromHash 
} from '../lib/crypto';
```

**Step 2: Update `encryptTextData()` method**

```typescript
static async encryptTextData(
  text: string,
  handleId: string
): Promise<EncryptedData> {
  // Get hash from session
  const privateKeyHash = getSessionPrivateKeyHash();
  if (!privateKeyHash) {
    throw new Error('Session not initialized - cannot encrypt');
  }
  
  // Derive key from hash
  const encryptionKey = await deriveEncryptionKeyFromHash(
    privateKeyHash,
    handleId,
    'message'
  );
  
  // Encrypt
  const textBytes = new TextEncoder().encode(text);
  return await encryptWithKey(textBytes, encryptionKey);
}
```

**Step 3: Update `decryptTextData()` method**

```typescript
static async decryptTextData(
  encryptedData: EncryptedData,
  handleId: string
): Promise<string> {
  const privateKeyHash = getSessionPrivateKeyHash();
  if (!privateKeyHash) {
    throw new Error('Session not initialized - cannot decrypt');
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
    // Fallback for migration period
    console.warn('New decryption failed, trying legacy...', error);
    return await decryptWithPassphrase(encryptedData, handleId);
  }
}
```

**Step 4: Repeat for other methods**

Apply same pattern to:
- `encryptMediaData()`
- `decryptMediaData()`
- `encryptContact()`
- `decryptContact()`

✅ **Phase 3 Complete**: 6 method updates, ~200 lines

---

## 🧪 Phase 4-5: Testing (Week 2-3)

See `encryption-key-analysis.md` lines 980-1177 for complete test cases.

**Quick checklist**:
- [ ] hashPrivateKey() produces deterministic output
- [ ] deriveEncryptionKeyFromHash() with different hashes = different keys
- [ ] Encrypt/decrypt roundtrip works
- [ ] Different users have different encryption keys
- [ ] Private key is destroyed after auth (inspect memory)
- [ ] Cannot encrypt without login
- [ ] Performance <100ms per operation

---

## 📊 Implementation Checklist

### Phase 1 (Key Derivation)
- [ ] Add `hashPrivateKey()` to key-derivation.ts
- [ ] Add `deriveEncryptionKeyFromHash()` to key-derivation.ts
- [ ] Export both functions from crypto/index.ts
- [ ] Test both functions individually

### Phase 2 (Account Service)
- [ ] Remove `temporaryPrivateKey` variable
- [ ] Remove old temporary key functions
- [ ] Add `sessionPrivateKeyHash` variable
- [ ] Add 4 new functions
- [ ] Update `createAccountWithCloud()` to hash + destroy + set hash
- [ ] Update `createAccountWithSelfCustody()` to hash + destroy + set hash
- [ ] Update `recoverWithPassword()` to hash + destroy + set hash
- [ ] Update `recoverWithSeed()` to hash + destroy + set hash
- [ ] Update `logout()` to clear hash
- [ ] Test memory contains only hash, not full key

### Phase 3 (StorageService)
- [ ] Add import for new crypto functions
- [ ] Update `encryptTextData()` to use hash-based encryption
- [ ] Update `decryptTextData()` to use hash-based with fallback
- [ ] Update `encryptMediaData()` to use hash-based encryption
- [ ] Update `decryptMediaData()` to use hash-based with fallback
- [ ] Update `encryptContact()` to use hash-based encryption
- [ ] Update `decryptContact()` to use hash-based with fallback
- [ ] Test encryption/decryption roundtrip

### Phase 4 (Integration)
- [ ] Integrate with per-account database isolation
- [ ] Test User A ≠ User B decryption keys
- [ ] Test cross-account switching

### Phase 5 (Testing)
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Performance benchmarks pass
- [ ] Cross-device recovery works
- [ ] Security review passed

---

## 🔍 Quick Verification

After each phase, verify:

```typescript
// Phase 1: Functions exist
import { hashPrivateKey, deriveEncryptionKeyFromHash } from '../lib/crypto';
// ✅ No import errors

// Phase 2: Memory management works
import { getSessionPrivateKeyHash, setSessionPrivateKeyHash } from './account.service';
// ✅ No import errors
// ✅ After login: getSessionPrivateKeyHash() !== null
// ✅ After logout: getSessionPrivateKeyHash() === null

// Phase 3: Encryption works
const encrypted = await StorageService.encryptTextData('hello', handleId);
const decrypted = await StorageService.decryptTextData(encrypted, handleId);
console.assert(decrypted === 'hello'); // ✅ Should pass
```

---

## 📞 Questions During Implementation?

Refer to:
- **Full details**: `encryption-key-analysis.md` lines 242-551
- **Complete code samples**: `encryption-key-analysis.md` lines 878-975
- **Testing strategy**: `encryption-key-analysis.md` lines 980-1177

---

## ⏰ Timeline Estimate

| Phase | Days | Effort |
|-------|------|--------|
| 1. Crypto functions | 1-2 | Easy |
| 2. Account service | 2-3 | Medium |
| 3. StorageService | 3-4 | Medium |
| 4. Integration | 1-2 | Easy |
| 5. Testing | 3-4 | Medium |
| **Total** | **10-15 days** | **3-4 weeks** |

Start immediately to stay on schedule.

---

**Status**: Ready for implementation ✅
