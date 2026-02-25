# Phase 5: Verification Checklist

## 🎯 Phase 5 Objective

Validate that Phases 1-4 implementation (hash-based encryption + database isolation) meets all functional, security, and performance requirements through systematic testing.

---

## ✅ Automated Test Verification

### Test Suite Status

- **File**: `frontend/tests/unit/phase5-encryption-validation.spec.ts`
- **Total Tests**: 35
- **Framework**: Vitest

#### Test Categories

<details>
<summary>Unit Tests: Hash Functions (5 tests)</summary>

- [ ] hashPrivateKey() produces valid SHA-256 hash
  - Verify: `hash.length === 32` bytes
  - Verify: `hash instanceof Uint8Array`

- [ ] hashPrivateKey() is deterministic
  - Verify: `hash1 === hash2` for same input
  - Verify: No randomness in output

- [ ] Different private keys produce different hashes
  - Verify: `hash(key1) !== hash(key2)`
  - Verify: One-way function property

- [ ] Hash is not reversible (one-way)
  - Verify: Cannot derive private key from hash
  - Verify: Hash !== original key material

- [ ] Session hash management works
  - Verify: `setSessionPrivateKeyHash()` stores hash
  - Verify: `getSessionPrivateKeyHash()` retrieves hash
  - Verify: `clearSessionPrivateKeyHash()` clears hash

</details>

<details>
<summary>Integration Tests: Account Management (2 tests)</summary>

- [ ] Hash set after account creation (self-custody)
  - Verify: `getSessionPrivateKeyHash()` not null
  - Verify: Hash is 32 bytes (SHA-256)

- [ ] Different users have different hashes
  - Verify: `hashA !== hashB` for User A and User B
  - Verify: Each user has unique session

</details>

<details>
<summary>Integration Tests: Database Isolation (4 tests)</summary>

- [ ] Database created with deterministic name
  - Verify: Name matches pattern `BeSafeDB_[a-f0-9]{16}`
  - Verify: Hash derived from identityId

- [ ] Same identityId reuses same database
  - Verify: `db1.name === db2.name`
  - Verify: Database connection reused

- [ ] Different identityIds create different databases
  - Verify: `nameA !== nameB`
  - Verify: Each user isolated

- [ ] Database switching works correctly
  - Verify: User A's DB closes
  - Verify: User B's DB opens
  - Verify: No data leakage

</details>

<details>
<summary>Integration Tests: Encryption Operations (4 tests)</summary>

- [ ] Encrypt and decrypt with session hash
  - Verify: `plaintext === decrypt(encrypt(plaintext))`
  - Verify: Uses version 2 (hash-based)

- [ ] Decryption fails with wrong hash
  - Verify: User B cannot decrypt User A's message
  - Verify: Appropriate error thrown

- [ ] Uses hash-based encryption (version 2)
  - Verify: `encrypted.version === 2`
  - Verify: `encrypted.salt.length === 0` (empty salt)

- [ ] Encryption keys isolated by handleId
  - Verify: Same message, different handleIds → different ciphertext
  - Verify: Both decrypt to original correctly

</details>

<details>
<summary>Security Verification (2 tests)</summary>

- [ ] No encryption without session hash
  - Verify: Error thrown when hash not set
  - Verify: Cannot encrypt without login

- [ ] Session cleared on logout
  - Verify: Hash set before logout
  - Verify: Hash null after logout
  - Verify: Database closed

</details>

<details>
<summary>Performance Tests (4 tests)</summary>

- [ ] Hash computation <10ms
  - Target: <10ms
  - Verify: Consistent sub-10ms timing

- [ ] Encryption <50ms
  - Target: <50ms
  - Verify: Single message encrypt completes quickly

- [ ] Decryption <50ms
  - Target: <50ms
  - Verify: Single message decrypt completes quickly

- [ ] Database initialization <150ms
  - Target: <150ms
  - Verify: Fast DB creation/opening

</details>

### Running Automated Tests

```bash
cd frontend

# Install dependencies (if needed)
npm install -D vitest @vitest/ui

# Run tests
npm run test:phase5

# Run with UI dashboard
npm run test:ui

# Run with coverage
npm run test -- --coverage
```

**Expected Results**:
- ✅ All 35 tests pass
- ✅ Coverage >85%
- ✅ No timeout errors
- ✅ No memory leaks detected

---

## 🧪 Manual Test Verification

### Test Environment Setup

**Browser Setup**:
- [ ] Clear all browser data (DevTools → Application → Clear site data)
- [ ] Disable browser cache (DevTools → Settings → Network → Disable cache)
- [ ] Open two windows: Main + Private/Incognito (prevents cookie leakage)

**Server Requirements**:
- [ ] Backend running on http://localhost:4000
- [ ] Frontend running on http://localhost:3000
- [ ] Cloud backup service functional (if testing cloud backup)
- [ ] WebSocket service available

### Scenario 1: Single User Encryption Flow

**Objective**: Verify encryption works correctly for one user across sessions.

**Estimated Time**: 15 minutes

- [ ] **Step 1.1**: Create account (Cloud Backup)
  - [ ] Username created successfully
  - [ ] Password accepted
  - [ ] Cloud backup completes
  - [ ] Redirected to chat page

- [ ] **Step 1.2**: Verify session hash active
  - [ ] Open DevTools → Console
  - [ ] Send test message
  - [ ] Check: Session hash should be in memory (not null)
  - [ ] Check: No private key in session

- [ ] **Step 1.3**: Verify encryption on storage
  - [ ] Send message: "Test message 1"
  - [ ] DevTools → Application → IndexedDB
  - [ ] Navigate to messages table
  - [ ] View "encryptedContent" field
  - [ ] Verify: Binary data (not readable text)
  - [ ] Verify: Different IV each time (if you send another message)

- [ ] **Step 1.4**: Verify persistence on refresh
  - [ ] Refresh page (Ctrl+R)
  - [ ] Wait for page to load and decrypt messages
  - [ ] Check: "Test message 1" visible in chat
  - [ ] Verify: Message decrypts without errors
  - [ ] Check console: No decryption errors

- [ ] **Step 1.5**: Logout and verify hash cleared
  - [ ] Click menu → Logout
  - [ ] Check: Redirected to login page
  - [ ] DevTools → Console: Check for "hash cleared" message
  - [ ] DevTools → Application → IndexedDB
  - [ ] Verify: Database still exists (expected)
  - [ ] Verify: No error messages in console

- [ ] **Step 1.6**: Re-login and recover messages
  - [ ] Click "Restore Access"
  - [ ] Enter password: [same password from 1.1]
  - [ ] Wait for decryption
  - [ ] Check: "Test message 1" appears in chat
  - [ ] Verify: Correct decryption (readable text)
  - [ ] Send new message: "Test message 2"
  - [ ] Verify: Both messages visible

**Success Criteria**:
- ✅ Messages encrypt correctly
- ✅ Encryption uses session hash (version 2)
- ✅ Messages persist across refresh
- ✅ Hash cleared on logout
- ✅ Messages recovered on re-login
- ✅ No decryption errors

---

### Scenario 2: Cross-User Database Isolation

**Objective**: Verify User B cannot access User A's encrypted messages.

**Estimated Time**: 20 minutes

**Setup**: Two browser windows (Window A + Window B Private/Incognito)

- [ ] **Step 2.1**: Create User A
  - [ ] Window A: Create account
  - [ ] Username: user_a_[timestamp]
  - [ ] Password: PasswordA123!
  - [ ] Complete cloud backup
  - [ ] Note: Database name from DevTools (e.g., BeSafeDB_abc123...)
  - [ ] Save as DATABASE_A

- [ ] **Step 2.2**: User A sends confidential message
  - [ ] Type message: "CONFIDENTIAL: Account #987654"
  - [ ] Send message
  - [ ] Verify: Message appears in chat
  - [ ] DevTools → IndexedDB → DATABASE_A → messages
  - [ ] View message row → examine "encryptedContent"
  - [ ] Verify: Binary, not readable

- [ ] **Step 2.3**: Logout User A
  - [ ] Click menu → Logout
  - [ ] Verify: Redirected to login page
  - [ ] DevTools: Database still exists

- [ ] **Step 2.4**: Create User B
  - [ ] Window B (Private/Incognito): Go to http://localhost:3000
  - [ ] Create account
  - [ ] Username: user_b_[timestamp]
  - [ ] Password: PasswordB456!
  - [ ] Complete cloud backup
  - [ ] Note: Database name (e.g., BeSafeDB_def456...)
  - [ ] Save as DATABASE_B
  - [ ] Verify: DATABASE_A ≠ DATABASE_B

- [ ] **Step 2.5**: User B sends message
  - [ ] Type message: "User B's safe data"
  - [ ] Send
  - [ ] Verify: Stored in DATABASE_B only

- [ ] **Step 2.6**: Critical security test - User B tries to access User A's database
  - [ ] DevTools → Application → IndexedDB
  - [ ] View list: Should show both DATABASE_A and DATABASE_B
  - [ ] Click DATABASE_A (User A's database)
  - [ ] Click "messages" table
  - [ ] Look for User A's message: "CONFIDENTIAL: Account #987654"
  - [ ] If found, note the "encryptedContent" value

- [ ] **Step 2.7**: Attempt cross-user decryption
  - [ ] DevTools → Console
  - [ ] User B tries to decrypt User A's message with their hash
  - [ ] Expected: Decryption fails (error or garbage output)
  - [ ] Verify: "CONFIDENTIAL: Account #987654" NOT readable
  - [ ] Check: No sensitive data exposed

- [ ] **Step 2.8**: Logout User B, re-login User A
  - [ ] Window B: Logout
  - [ ] Window A: "Restore Access"
  - [ ] Password: PasswordA123!
  - [ ] Wait for decryption
  - [ ] Verify: User A's message appears and decrypts correctly
  - [ ] Verify: User B's message NOT visible
  - [ ] DevTools → DATABASE_A → messages: Only User A's messages

**Success Criteria**:
- ✅ User A and B have different databases
- ✅ User B can see User A's encrypted data (but can't decrypt it)
- ✅ User B cannot decrypt User A's message
- ✅ Sensitive data remains protected
- ✅ User A's messages persist and decrypt correctly
- ✅ No cross-user data leakage

---

### Scenario 3: Multiple Login Cycles

**Objective**: Verify database name is deterministic across multiple sessions.

**Estimated Time**: 15 minutes

- [ ] **Step 3.1**: Create account and note database
  - [ ] Create account: multi_cycle_user_[timestamp]
  - [ ] Password: MultiCycle123!
  - [ ] Complete cloud backup
  - [ ] Send message: "Message in cycle 1"
  - [ ] DevTools → Database name: Save as DATABASE_NAME
  - [ ] Note timestamp in console

- [ ] **Step 3.2**: First logout/login cycle
  - [ ] Logout
  - [ ] Wait 2 seconds
  - [ ] "Restore Access" with same password
  - [ ] DevTools → Check database name
  - [ ] Verify: DATABASE_NAME (same as before)
  - [ ] Verify: "Message in cycle 1" visible and decrypts
  - [ ] Send: "Message in cycle 2"

- [ ] **Step 3.3**: Switch to different user
  - [ ] Logout
  - [ ] Create different account: other_user_[timestamp]
  - [ ] Password: OtherUser456!
  - [ ] Send message: "Other user's data"
  - [ ] Logout

- [ ] **Step 3.4**: Return to first user
  - [ ] "Restore Access" with original password
  - [ ] DevTools → Check database name
  - [ ] Verify: Still DATABASE_NAME (not changed)
  - [ ] Verify: "Message in cycle 1" present
  - [ ] Verify: "Message in cycle 2" present
  - [ ] Verify: "Other user's data" NOT present
  - [ ] Verify: Both messages decrypt without errors

- [ ] **Step 3.5**: Third logout/login cycle
  - [ ] Logout
  - [ ] "Restore Access" with original password
  - [ ] Verify: DATABASE_NAME still same
  - [ ] Verify: All messages still decrypt
  - [ ] Send new message: "Message in cycle 3"
  - [ ] Verify: All three messages visible

**Success Criteria**:
- ✅ Database name deterministic (same across all cycles)
- ✅ Message history preserved
- ✅ Messages decrypt correctly
- ✅ No data corruption
- ✅ Other user's data not leaked
- ✅ No console errors during switching

---

### Scenario 4: Performance Validation

**Objective**: Verify all operations meet performance targets.

**Estimated Time**: 20 minutes

**Tools Needed**: DevTools → Performance tab

- [ ] **Step 4.1**: Setup
  - [ ] Create account: perf_test_[timestamp]
  - [ ] Password: PerfTest123!
  - [ ] Open DevTools → Performance tab

- [ ] **Step 4.2**: Hash computation performance
  - [ ] Console: Record hash computation time
  - [ ] Run: `performance.now()` before/after hash
  - [ ] Verify: <10ms
  - [ ] Record result: _____ ms

- [ ] **Step 4.3**: Encryption performance (large message)
  - [ ] DevTools → Performance → Record
  - [ ] Compose large message (~5KB, ~1000 words)
  - [ ] Send message
  - [ ] Stop recording
  - [ ] Check "Encryption" phase duration
  - [ ] Verify: <50ms
  - [ ] Record result: _____ ms

- [ ] **Step 4.4**: Encryption batch performance
  - [ ] Performance → Record
  - [ ] Send 10 messages rapidly
  - [ ] Stop recording
  - [ ] Total time for 10 encryptions: _____ ms
  - [ ] Verify: <500ms total (or <50ms average)

- [ ] **Step 4.5**: Decryption performance (refresh load)
  - [ ] Performance → Record
  - [ ] Refresh page (Ctrl+R)
  - [ ] Wait for all messages to load and decrypt
  - [ ] Stop recording
  - [ ] Check "Decryption" phase duration
  - [ ] Verify: <500ms for all messages
  - [ ] Record result: _____ ms

- [ ] **Step 4.6**: Database switch performance
  - [ ] Console: Add timing
  - [ ] Logout (record time)
  - [ ] Restore Access (record time)
  - [ ] Total: _____ ms
  - [ ] Verify: <500ms

**Success Criteria**:
- ✅ Hash: <10ms
- ✅ Single encryption: <50ms
- ✅ Batch encryption (10): <500ms
- ✅ Decryption: <50ms per message
- ✅ DB switch: <500ms

**Performance Results**:
```
Hash Computation:        _____ ms (target <10ms)   ✅/❌
Encryption (single):     _____ ms (target <50ms)   ✅/❌
Encryption (batch 10):   _____ ms (target <500ms)  ✅/❌
Decryption (single):     _____ ms (target <50ms)   ✅/❌
Database Init:           _____ ms (target <150ms)  ✅/❌
Database Switch:         _____ ms (target <500ms)  ✅/❌
```

---

### Scenario 5: Error Handling & Edge Cases

**Objective**: Verify graceful error handling in failure scenarios.

**Estimated Time**: 20 minutes

- [ ] **Step 5.1**: Encryption without login
  - [ ] Create account but don't complete
  - [ ] Try to access encryption function
  - [ ] Expected: "Database not initialized" error
  - [ ] Verify: Clear error message
  - [ ] Verify: App doesn't crash
  - [ ] Result: ✅ Handled / ❌ Not handled

- [ ] **Step 5.2**: Invalid encryption data
  - [ ] Create account
  - [ ] Send message
  - [ ] DevTools → Console: Attempt to decrypt empty data
  - [ ] Expected: Graceful error
  - [ ] Verify: No crash
  - [ ] Result: ✅ Handled / ❌ Not handled

- [ ] **Step 5.3**: Corrupted database entry
  - [ ] Send message
  - [ ] DevTools → IndexedDB → messages
  - [ ] Manually edit "iv" field (change bytes)
  - [ ] Refresh page
  - [ ] Expected: Decryption fails gracefully
  - [ ] Verify: Other messages still work
  - [ ] Verify: No app crash
  - [ ] Result: ✅ Handled / ❌ Not handled

- [ ] **Step 5.4**: Session hash cleared mid-session
  - [ ] Send message
  - [ ] DevTools → Console: Clear hash manually
  - [ ] Try to send another message
  - [ ] Expected: Error or fallback behavior
  - [ ] Verify: Clear error message
  - [ ] Result: ✅ Handled / ❌ Not handled

- [ ] **Step 5.5**: Corrupted seed phrase
  - [ ] "Restore Access"
  - [ ] Enter random/corrupted seed
  - [ ] Expected: Clear error message
  - [ ] Verify: Option to retry
  - [ ] Verify: No app crash
  - [ ] Result: ✅ Handled / ❌ Not handled

**Success Criteria**:
- ✅ All error cases handled gracefully
- ✅ Clear error messages displayed
- ✅ No app crashes
- ✅ No sensitive data leaked in errors
- ✅ User can recover from errors

---

## 📋 Code Quality Checks

- [ ] No console errors during test execution
- [ ] No memory leaks detected (DevTools → Memory)
- [ ] No performance degradation over time
- [ ] All error handling paths tested
- [ ] Code coverage >85%
- [ ] No hardcoded secrets in test code

---

## 🔐 Security Validation

- [ ] **Private Key Destruction**: Verified that private key is not in session memory after auth
- [ ] **Hash Security**: Verified that hash is one-way and cannot be reversed
- [ ] **Session Isolation**: Verified that User B cannot decrypt User A's messages
- [ ] **Database Isolation**: Verified that User A and User B have separate databases
- [ ] **Cross-User Prevention**: Verified that different users cannot access each other's data
- [ ] **Deterministic Naming**: Verified that same user always gets same database
- [ ] **Logout Cleanup**: Verified that session hash is cleared on logout
- [ ] **No Plaintext Storage**: Verified that no plaintext keys are stored in IndexedDB

---

## 📊 Final Sign-Off

### Automated Tests
- [ ] All tests pass: _____/35
- [ ] Coverage: _____%
- [ ] No timeouts or crashes

### Manual Testing
- [ ] Scenario 1 (Single User): ✅ / ❌
- [ ] Scenario 2 (Cross-User): ✅ / ❌
- [ ] Scenario 3 (Multi-Cycle): ✅ / ❌
- [ ] Scenario 4 (Performance): ✅ / ❌
- [ ] Scenario 5 (Error Handling): ✅ / ❌

### Performance Targets
- [ ] Hash: <10ms
- [ ] Encryption: <50ms
- [ ] Decryption: <50ms
- [ ] Database init: <150ms
- [ ] Database switch: <500ms

### Security Validation
- [ ] Private key destroyed
- [ ] Cross-user isolation verified
- [ ] Hash one-way confirmed
- [ ] No plaintext leakage

### Overall Assessment

**Phase 5 Status**: ✅ COMPLETE / ⚠️ ISSUES FOUND / ❌ FAILED

**Issues Found** (if any):
1. _______________________
2. _______________________
3. _______________________

**Recommendations**:
- _______________________
- _______________________

**Tested By**: _______________________

**Date**: _______________________

**Approval**: ✅ Approved / ⏳ Pending / ❌ Rejected

---

## 📝 Notes

Use this section to document any additional observations, workarounds, or configuration changes needed:

_________________________________________________
_________________________________________________
_________________________________________________

---

## 🎓 Post-Phase 5 Actions

- [ ] Update release notes with security improvements
- [ ] Brief team on test results
- [ ] Archive test results for compliance
- [ ] Plan Phase 6 (if applicable)
- [ ] Schedule security audit (recommended)
- [ ] Update user documentation
- [ ] Monitor production for issues
