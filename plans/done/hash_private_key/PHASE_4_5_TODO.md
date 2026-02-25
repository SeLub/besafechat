# Phase 4-5 Implementation Checklist

**Status**: Ready to begin  
**Timeline**: 3-5 days remaining  
**Effort**: Low to Medium

---

## Phase 4: Database Isolation Integration (1-2 days)

### Goal
Ensure per-account database isolation works correctly with hash-based encryption.

### Tasks

#### 4.1 Account Service Integration
- [ ] Verify `StorageService.initialize(result.identityId)` is called in:
  - [ ] `createAccountWithCloud()` → ✅ Already added (line 110)
  - [ ] `createAccountWithSelfCustody()` → ✅ Already added (line 181)
- [ ] Add `StorageService.initialize()` calls to recovery methods if needed:
  - [ ] `recoverWithPassword()`
  - [ ] `recoverWithSeed()`
- [ ] Verify logout calls `StorageService.cleanup()`:
  - [ ] Check if logout method exists and calls cleanup

#### 4.2 Database Schema
- [ ] Verify `db.ts` has per-account database setup
- [ ] Confirm database name is based on identityId hash
- [ ] Check schema compatibility with new encryption format

#### 4.3 Cross-Account Testing
- [ ] Manually test: User A logs in → User A logs out
- [ ] Manually test: User B logs in → cannot see User A's messages
- [ ] Manually test: User A logs back in → same messages still there
- [ ] Verify each user has separate IndexedDB database

---

## Phase 5: Testing & Validation (2-3 days)

### Unit Tests

#### 5.1 Crypto Functions
File: `frontend/app/lib/crypto/core/key-derivation.test.ts` (create if needed)

- [ ] Test `hashPrivateKey()`
  - [ ] Same input → same output (deterministic)
  - [ ] Different inputs → different outputs
  - [ ] Output is 32 bytes
  - [ ] Cannot reverse hash to get private key

- [ ] Test `deriveEncryptionKeyFromHash()`
  - [ ] Different hashes → different keys
  - [ ] Different handleIds → different keys
  - [ ] Different purposes → different keys
  - [ ] Same inputs → same output (deterministic)
  - [ ] Returned CryptoKey works with AES-GCM

#### 5.2 Account Service
File: `frontend/app/services/account.service.test.ts` (create if needed)

- [ ] Test `setSessionPrivateKeyHash()` / `getSessionPrivateKeyHash()`
  - [ ] Hash stored correctly
  - [ ] Can retrieve hash
  - [ ] Multiple calls preserve hash

- [ ] Test `clearSessionPrivateKeyHash()`
  - [ ] Hash cleared after logout
  - [ ] Returns null after clear
  - [ ] Data properly overwritten

#### 5.3 Storage Service
File: `frontend/app/services/storage.service.test.ts` (create if needed)

- [ ] Test `encryptTextData()` with hash
  - [ ] Encrypts successfully when hash available
  - [ ] Falls back to passphrase when hash unavailable
  - [ ] Returns version 2 for hash-based
  - [ ] Returns version 1 for passphrase-based

- [ ] Test `decryptTextData()`
  - [ ] Decrypts version 1 messages
  - [ ] Decrypts version 2 messages (hash-based)
  - [ ] Fallback works if hash-based fails

---

### Integration Tests

#### 5.4 Single User Session
- [ ] User A logs in
  - [ ] `getSessionPrivateKeyHash()` returns hash
  - [ ] Can encrypt message
  - [ ] Can decrypt message
- [ ] Refresh page
  - [ ] Hash is still available
  - [ ] Can still decrypt
- [ ] User A logs out
  - [ ] `getSessionPrivateKeyHash()` returns null
  - [ ] Cannot encrypt (error thrown)
  - [ ] Cannot decrypt (error thrown)

#### 5.5 Account Switching (Same Device)
- [ ] User A logs in → hashA set
- [ ] User A sends message M1 → encrypted with hashA
- [ ] User A logs out → hash cleared
- [ ] User B logs in → hashB set
- [ ] Try to decrypt M1 with hashB
  - [ ] ❌ MUST FAIL (cannot decrypt with wrong hash)
- [ ] User B sends message M2 → encrypted with hashB
- [ ] User A logs back in → hashA restored
- [ ] Can decrypt M1 with hashA
  - [ ] ✅ MUST SUCCEED
- [ ] Cannot decrypt M2 with hashA
  - [ ] ❌ MUST FAIL

#### 5.6 Cross-Device Recovery
- [ ] Device A: Create account → send messages
- [ ] Device A: Note the private key hash (for debugging)
- [ ] Device A: Logout, simulate "device lost"
- [ ] Device B: Login with recovered seed → hashB computed
- [ ] Verify hashA === hashB (deterministic)
- [ ] Device B: Can decrypt Device A's messages
  - [ ] ✅ MUST SUCCEED

#### 5.7 Encryption Without Login
- [ ] Create storage service instance
- [ ] Try to call `encryptTextData()` without login
  - [ ] ❌ MUST THROW "Session not initialized" error
- [ ] Try to call `decryptTextData()` without login
  - [ ] ❌ MUST THROW "Session not initialized" error

#### 5.8 Private Key Destruction
- [ ] During account creation:
  - [ ] Set breakpoint after auth succeeds
  - [ ] Inspect memory for privateKey variable
  - [ ] Verify it's undefined/null (destroyed)
  - [ ] Verify only hash is in memory

---

### Performance Tests

#### 5.9 Benchmarking
File: `frontend/app/lib/crypto/core/key-derivation.perf.test.ts` (create if needed)

- [ ] `hashPrivateKey()`
  - [ ] Target: < 5ms per call
  - [ ] Measure 100 iterations
  - [ ] Log average time

- [ ] `deriveEncryptionKeyFromHash()`
  - [ ] Target: < 100ms per call
  - [ ] Measure 100 iterations
  - [ ] Log average time

- [ ] Encrypt 1000 messages
  - [ ] Target: < 50ms per message (average)
  - [ ] Measure total time
  - [ ] Log performance stats

- [ ] Decrypt 1000 messages
  - [ ] Target: < 50ms per message (average)
  - [ ] Measure total time
  - [ ] Log performance stats

---

### Manual Testing

#### 5.10 Feature Testing
- [ ] Create account with password
  - [ ] Hash stored correctly
  - [ ] Messages encrypt/decrypt
  - [ ] Cloud backup works

- [ ] Create account with self-custody
  - [ ] Hash stored correctly
  - [ ] Messages encrypt/decrypt
  - [ ] Can export seed

- [ ] Recover with password
  - [ ] Hash computed from recovered seed
  - [ ] Can decrypt old messages
  - [ ] Can encrypt new messages

- [ ] Recover with seed phrase
  - [ ] Hash computed from seed
  - [ ] Can decrypt old messages
  - [ ] Can encrypt new messages

- [ ] Logout/Login cycle
  - [ ] Hash cleared on logout
  - [ ] Hash restored on login
  - [ ] Messages still decrypt after login

- [ ] Multi-device sync
  - [ ] Same hash derived on both devices
  - [ ] Messages decrypt on both devices
  - [ ] New messages sync correctly

---

### Security Audit

#### 5.11 Security Verification
- [ ] Private key not in window/global scope
- [ ] Hash not logged to console in production
- [ ] No private key in network requests
- [ ] No unencrypted messages stored
- [ ] Secure deletion verified (memory overwrite)
- [ ] Version number correctly set
- [ ] Encryption algorithm (AES-256-GCM) verified
- [ ] PBKDF2 iterations correct (100K)

#### 5.12 Error Handling
- [ ] Graceful fallback to legacy encryption
- [ ] Clear error messages for users
- [ ] No crashes on decryption failure
- [ ] Proper error logging

---

## Test Execution Order

1. **Run Unit Tests** (30-60 min)
   - Hash function tests
   - Key derivation tests
   - Memory management tests

2. **Run Integration Tests** (1-2 hours)
   - Single user session
   - Account switching
   - Cross-device recovery
   - Error scenarios

3. **Run Performance Tests** (30-45 min)
   - Hash performance
   - Key derivation performance
   - Encryption throughput
   - Decryption throughput

4. **Manual Testing** (2-3 hours)
   - Feature testing
   - Edge cases
   - Multi-device scenarios
   - Cloud backup integration

5. **Security Audit** (1-2 hours)
   - Code review
   - Memory inspection
   - Network traffic inspection
   - Error handling verification

---

## Rollout Plan

### Development Branch
- All tests pass on development machine
- Code reviewed by team member
- No TypeScript errors
- No console errors

### Staging Branch
- All tests pass in staging environment
- Performance tests meet targets
- Manual testing complete
- Security audit passed

### Production Release
- Version number bumped (e.g., 1.1.0)
- Release notes prepared
- Changelog updated
- Users notified (if existing data migration needed)

---

## Troubleshooting

### If Hash Not Working
- [ ] Check `getSessionPrivateKeyHash()` returns value
- [ ] Check `deriveEncryptionKeyFromHash()` properly derives key
- [ ] Verify PBKDF2 parameters correct (100K iterations)
- [ ] Check salt format (handleId as text)

### If Decryption Fails
- [ ] Check version number (1 = legacy, 2 = hash-based)
- [ ] Check salt length (0 = hash-based, >0 = legacy)
- [ ] Check IV is not corrupted
- [ ] Fall back to legacy method

### If Memory Leak
- [ ] Check `secureClearUint8Array()` called
- [ ] Check `clearSessionPrivateKeyHash()` called on logout
- [ ] Inspect memory with Chrome DevTools
- [ ] Look for lingering references

---

## Success Criteria

All of the following must be true:

- [ ] ✅ Unit tests: 100% pass
- [ ] ✅ Integration tests: 100% pass
- [ ] ✅ Performance tests: All within targets
- [ ] ✅ Manual testing: All scenarios work
- [ ] ✅ Security audit: No vulnerabilities found
- [ ] ✅ Cross-device recovery: Works correctly
- [ ] ✅ Account isolation: Users cannot access each other's data
- [ ] ✅ Backward compatibility: Old encrypted data still decryptable
- [ ] ✅ No TypeScript errors
- [ ] ✅ No console errors in production mode

---

## Estimated Timeline

| Task | Duration | Status |
|------|----------|--------|
| Unit tests | 30-60 min | ⏳ To do |
| Integration tests | 1-2 hours | ⏳ To do |
| Performance tests | 30-45 min | ⏳ To do |
| Manual testing | 2-3 hours | ⏳ To do |
| Security audit | 1-2 hours | ⏳ To do |
| Bug fixes | 1-2 hours | ⏳ To do |
| **Total** | **3-5 days** | **⏳ To do** |

---

## Notes

- All test files should follow existing test conventions
- Use existing test framework (Jest/Vitest/etc.)
- Mock crypto functions where needed
- Test both happy path and error cases
- Document any deviations from plan
- Keep test results for audit trail

---

**Ready to proceed with Phase 4-5? Let me know when you're ready to start!**
