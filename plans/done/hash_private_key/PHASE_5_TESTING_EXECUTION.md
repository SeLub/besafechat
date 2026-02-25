# Phase 5: Testing & Validation Execution Guide

## 📋 Overview

Phase 5 validates the hash-based encryption implementation (Phases 1-3) and per-account database isolation (Phase 4) through automated unit tests, integration tests, and manual testing scenarios.

**Total Estimated Time**: 3-4 hours
- Automated Tests: 30 minutes (setup + running)
- Manual Tests: 1.5-2 hours (5 scenarios)
- Performance Verification: 1 hour
- Documentation & Sign-off: 30 minutes

---

## ✅ Phase 5 Success Criteria

### Functional Requirements (Must Pass)
- ✅ Hash-based encryption encodes/decodes messages correctly
- ✅ Private key hash set after login, cleared after logout
- ✅ Database isolation prevents cross-user message access
- ✅ Same user gets same database on re-login
- ✅ Different users get different databases
- ✅ Message recovery works across multiple logins

### Security Requirements (Must Pass)
- ✅ Private key destroyed after auth (not in memory)
- ✅ User A cannot decrypt User B's messages
- ✅ Hash is one-way (not reversible)
- ✅ No plaintext key material in session
- ✅ Session hash cleared on logout
- ✅ Fallback decryption works for legacy messages

### Performance Requirements (Must Pass)
- ✅ Hash computation: <10ms
- ✅ Encryption operation: <50ms
- ✅ Decryption operation: <50ms
- ✅ Database initialization: <150ms
- ✅ Database switch (logout + login): <500ms

---

## 🧪 Part 1: Automated Unit Tests

### Setup

#### 1.1 Install Test Framework (if not already done)

```bash
cd frontend
npm install -D vitest @vitest/ui
```

#### 1.2 Create Vitest Config (if needed)

If `vitest.config.ts` doesn't exist in frontend, create it:

```typescript
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
});
```

#### 1.3 Update package.json

Add test scripts to `frontend/package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:phase5": "vitest run phase5-encryption-validation.spec.ts"
  }
}
```

### Running Automated Tests

#### Test 1: Run All Phase 5 Tests

```bash
cd frontend
npm run test:phase5
```

**Expected Output**:
```
✓ Phase 5: Hash-Based Encryption - Unit Tests (5 tests)
  ✓ hashPrivateKey() should produce valid SHA-256 hash
  ✓ hashPrivateKey() should be deterministic
  ✓ hashPrivateKey() should produce different hashes for different keys
  ✓ hashPrivateKey() should not be reversible
  ✓ Session hash management

✓ Phase 5: Account Management - Integration Tests (2 tests)
  ✓ should hash private key after account creation
  ✓ should have different hashes for different users

✓ Phase 5: Database Isolation - Integration Tests (4 tests)
  ✓ should create database with deterministic name
  ✓ should reuse same database for same identityId
  ✓ should create different databases for different identityIds
  ✓ should switch databases when different user logs in

✓ Phase 5: Encryption Operations - Integration Tests (4 tests)
  ✓ should encrypt and decrypt text correctly
  ✓ should fail to decrypt with wrong session hash
  ✓ should use hash-based encryption (version 2)
  ✓ should isolate encryption keys between handleIds

✓ Phase 5: Security Behavior Verification (2 tests)
  ✓ should not allow encryption without session hash
  ✓ should clear session on logout

✓ Phase 5: Performance Benchmarks (4 tests)
  ✓ hash computation should be fast (<10ms)
  ✓ encryption should complete in reasonable time
  ✓ decryption should complete in reasonable time
  ✓ database initialization should be fast

Test Files  1 passed (1)
     Tests 21 passed (21)
  Duration  2.34s
```

#### Test 2: Run with UI Dashboard

For real-time visualization:

```bash
cd frontend
npm run test:ui
```

This opens `http://localhost:51204` with visual dashboard showing:
- Test results with color-coded pass/fail
- Performance timing for each test
- Code coverage information
- Easy re-run capabilities

#### Test 3: Run with Coverage

```bash
npm run test -- --coverage
```

**Target Coverage**:
- Statements: >90%
- Branches: >85%
- Functions: >90%
- Lines: >90%

---

## 🎯 Part 2: Manual Testing Scenarios

### Scenario 1: Single User Encryption Flow (15 minutes)

**Objective**: Verify hash-based encryption works for a single user across login/logout cycles.

#### Steps:

1. **Clear Browser State**
   ```bash
   # Open DevTools → Application → Storage
   # Delete all cookies, localStorage, IndexedDB
   ```

2. **Create Account (Cloud Backup)**
   ```
   1. Go to http://localhost:3000
   2. Click "Create Account"
   3. Click "Cloud Backup"
   4. Username: test_user_001
   5. Password: TestPass123!
   6. Verify backup completes
   7. Redirect to chat page
   ```

3. **Verify Session Hash Set**
   ```
   8. Open DevTools → Console
   9. Type: window.__DEBUG_SESSION_HASH = true
   10. Send a message: "Test message 1"
   11. Check console for: "Session hash is set"
   12. Open DevTools → Application → IndexedDB → BeSafeDB_... → messages
   13. Verify message is encrypted (binary content)
   ```

4. **Verify Message Persists**
   ```
   14. Refresh page (Ctrl+R)
   15. Check chat - "Test message 1" should still be there
   16. Message should decrypt correctly
   ```

5. **Logout and Verify Hash Cleared**
   ```
   17. Click menu → Logout
   18. Check console: "Session hash cleared" should appear
   19. Verify redirected to login page
   20. IndexedDB database still exists (expected)
   ```

6. **Re-login and Verify Message Recovered**
   ```
   21. Click "Restore Access"
   22. Enter password: TestPass123!
   23. Wait for decryption
   24. Check chat - "Test message 1" should be there and decrypt correctly
   25. Send another message: "Test message 2"
   26. Verify both messages visible
   ```

**Success Criteria**:
- ✅ Messages encrypt on creation
- ✅ Messages decrypt on page refresh
- ✅ Session hash present during session
- ✅ Hash cleared on logout
- ✅ Messages recovered on re-login
- ✅ New messages encrypt with same session

---

### Scenario 2: Cross-User Database Isolation (20 minutes)

**Objective**: Verify User B cannot access User A's encrypted messages.

#### Setup: Two Browser Windows

Open two windows side-by-side:
- **Window A**: Main browser
- **Window B**: Private/Incognito window (prevents cookie sharing)

#### Steps:

1. **Create User A (Window A)**
   ```
   1. Go to http://localhost:3000 (Window A)
   2. Click "Create Account" → "Cloud Backup"
   3. Username: user_a_secure_001
   4. Password: PasswordA123!
   5. Complete backup
   6. Send message: "Secret data: Account#123456"
   7. DevTools → IndexedDB → Copy database name (e.g., BeSafeDB_a3f5c7e2...)
   8. Note this as DATABASE_A
   ```

2. **Verify Message Encrypted (Window A)**
   ```
   9. DevTools → IndexedDB → DATABASE_A → messages
   10. Open message row
   11. View "encryptedContent" - should be binary, not readable
   12. Logout User A
   ```

3. **Create User B (Window B)**
   ```
   13. Go to http://localhost:3000 (Window B, Private/Incognito)
   14. Click "Create Account" → "Cloud Backup"
   15. Username: user_b_isolated_001
   16. Password: PasswordB456!
   17. Complete backup
   18. Send message: "My data: Safe content"
   19. DevTools → IndexedDB → Copy database name (e.g., BeSafeDB_f2e9d41b...)
   20. Note this as DATABASE_B
   21. Verify DATABASE_A ≠ DATABASE_B (different users = different databases)
   ```

4. **User B Attempts to Access User A's Database (Window B)**
   ```
   22. DevTools → Application → IndexedDB
   23. Verify both DATABASE_A and DATABASE_B are visible
   24. Click on DATABASE_A (User A's database)
   25. Click "messages" table
   26. Look for User A's message: "Secret data: Account#123456"
   27. If visible, note its encryptedContent
   28. Logout User B
   ```

5. **Verify Cross-User Decryption Fails (Window B)**
   ```
   29. DevTools → Console
   30. Paste this code:
   ```javascript
   // Try to manually decrypt User A's message
   const encryptedDataFromUserA = { /* the encrypted message */ };
   const userBSessionHash = window.__sessionHash; // User B's hash
   
   // Attempt decryption with User B's hash
   try {
     const decrypted = await decryptWithSessionHash(
       encryptedDataFromUserA,
       userBSessionHash
     );
     console.log("SECURITY ISSUE: Decryption succeeded!", decrypted);
   } catch (e) {
     console.log("✅ Good: Decryption failed -", e.message);
   }
   ```
   ```
   31. Expected result: "✅ Good: Decryption failed"
   ```

6. **Re-login User A and Verify Message Recovered (Window A)**
   ```
   32. Go to http://localhost:3000 (Window A)
   33. Click "Restore Access"
   34. Enter password: PasswordA123!
   35. Verify redirected to original chat
   36. Verify message: "Secret data: Account#123456" is present
   37. Verify it decrypts correctly (readable in chat)
   38. Verify User B's message "My data: Safe content" is NOT visible
   39. DevTools → IndexedDB → DATABASE_A → messages
   40. Verify ONLY User A's messages are in this database
   ```

**Success Criteria**:
- ✅ User A and User B have different database names
- ✅ User B can see encrypted content in User A's database (data is there)
- ✅ User B cannot decrypt User A's message with their hash
- ✅ User A's messages persist and decrypt correctly on re-login
- ✅ User A doesn't see User B's messages in their database

---

### Scenario 3: Multiple Login Cycles (15 minutes)

**Objective**: Verify deterministic database naming across multiple login/logout cycles.

#### Steps:

1. **Create Account**
   ```
   1. Go to http://localhost:3000
   2. Create account: test_multi_cycles_001
   3. Password: CycleTest123!
   4. Send message: "Message in cycle 1"
   5. DevTools → IndexedDB → Copy database name → DATABASE_NAME
   6. Note timestamp in console
   ```

2. **First Logout/Login Cycle**
   ```
   7. Logout
   8. Wait 2 seconds
   9. Restore Access with password: CycleTest123!
   10. DevTools → IndexedDB → Verify same database name (DATABASE_NAME)
   11. Verify message "Message in cycle 1" is there and decrypts
   12. Send new message: "Message in cycle 2"
   ```

3. **Second Logout/Login Cycle**
   ```
   13. Logout
   14. Create a DIFFERENT account: test_other_user_001
   15. Password: OtherTest456!
   16. Logout
   17. Restore Access with original password: CycleTest123!
   18. DevTools → IndexedDB
   19. Verify DATABASE_NAME still there (same hash from identityId)
   20. Verify both messages present: "Message in cycle 1", "Message in cycle 2"
   21. Verify other user's message is NOT present
   ```

4. **Third Logout/Login Cycle**
   ```
   22. Logout
   23. Restore Access with original password: CycleTest123!
   24. Verify messages still decrypt correctly
   ```

**Success Criteria**:
- ✅ Database name deterministic (same across all cycles)
- ✅ Message history preserved across cycles
- ✅ Messages decrypt without decryption errors
- ✅ Other user's data not accessible
- ✅ No console errors during switching

---

### Scenario 4: Performance Under Load (20 minutes)

**Objective**: Verify performance targets are met under realistic load.

#### Setup:

```bash
# Open DevTools → Performance tab
# Have DevTools ready to record
```

#### Test 1: Large Message Encryption

```
1. Go to http://localhost:3000
2. Create account: perf_test_001
3. Password: PerfTest123!
4. Send a LARGE message (copy-paste a long text):
   - 5KB message (~1000 words)
5. DevTools → Performance → Record
6. Send message
7. Stop recording
8. Check Encryption Time: Should be <50ms
```

**Expected**:
```
Encryption took: 30-45ms
Message sent successfully
```

#### Test 2: Multiple Messages in Sequence

```
9. Clear performance recording
10. DevTools → Performance → Record
11. Send 10 messages rapidly (paste different text, send quickly)
12. Stop recording
13. Check: Total time for 10 encryptions should be <500ms
```

**Expected**:
```
10 messages encrypted: 350-450ms total
Average per message: 35-45ms
```

#### Test 3: Refresh and Decryption Load

```
14. Refresh page (Ctrl+R)
15. DevTools → Performance → Record
16. Page loads messages, decrypts them
17. Stop recording
18. Check: Decryption of 10 messages should be <500ms
```

**Expected**:
```
10 messages decrypted: 350-450ms total
Average per message: 35-45ms
```

#### Test 4: Database Switching

```
19. Open DevTools Console
20. Record time for logout + login:
   ```javascript
   console.time("database-switch");
   // Logout happens here
   // Then login
   console.timeEnd("database-switch");
   ```
21. Measure total time
```

**Expected**:
```
database-switch: 250-400ms
(Logout: 30-50ms, Init new DB: 80-150ms, Login: 100-200ms)
```

**Success Criteria**:
- ✅ Single message encryption: <50ms
- ✅ Batch encryption (10 msgs): <500ms
- ✅ Single message decryption: <50ms
- ✅ Batch decryption (10 msgs): <500ms
- ✅ Database switch cycle: <500ms

---

### Scenario 5: Error Handling & Edge Cases (20 minutes)

**Objective**: Verify graceful error handling in edge cases.

#### Test 1: Encryption Without Login

```
1. Go to http://localhost:3000
2. Click "Create Account" but DON'T complete
3. Open DevTools → Console
4. Try to directly call:
   ```javascript
   const StorageService = window.StorageService; // If exposed for testing
   await StorageService.encryptTextData("test", "handle-123", "message");
   ```
5. Expected: Error "Database not initialized" or similar
```

#### Test 2: Decrypt Non-Existent Message

```
6. Create account normally
7. DevTools → Console:
   ```javascript
   await StorageService.decryptTextData(
     { encrypted: new Uint8Array(0), iv: new Uint8Array(12), version: 2 },
     "handle-123"
   );
   ```
8. Expected: Graceful error, not silent failure
```

#### Test 3: Corrupted Message Data

```
9. Send a message normally
10. DevTools → IndexedDB → messages table
11. Select your message
12. In the storage table, MANUALLY modify "iv" value (change first byte)
13. Refresh page
14. Go back to chat
15. Expected: Message fails to decrypt gracefully
    - Shows error or placeholder
    - Doesn't crash app
    - Other messages still work
```

#### Test 4: Session Hash Cleared Prematurely

```
16. Create account
17. Send message
18. DevTools → Console:
    ```javascript
    import { clearSessionPrivateKeyHash } from '@/services/account.service';
    clearSessionPrivateKeyHash(); // Simulate logout while logged in
    ```
19. Try to send another message
20. Expected: Error message or graceful degradation
```

**Success Criteria**:
- ✅ Errors are caught and logged
- ✅ App doesn't crash on decryption failures
- ✅ Clear error messages in console
- ✅ Fallback behavior if available

---

## 📊 Part 3: Documentation & Sign-Off

### Testing Summary Template

Create a file: `plans/PHASE_5_TEST_RESULTS.md`

```markdown
# Phase 5 Test Results - [Date]

## Automated Tests
- ✅ Unit Tests: 21/21 passed
- ✅ Integration Tests: 10/10 passed
- ✅ Performance Tests: 4/4 passed
- **Total**: 35/35 ✅

### Coverage
- Statements: 92%
- Branches: 88%
- Functions: 91%
- Lines: 91%

## Manual Testing Scenarios
- ✅ Scenario 1: Single User Encryption Flow
- ✅ Scenario 2: Cross-User Database Isolation
- ✅ Scenario 3: Multiple Login Cycles
- ✅ Scenario 4: Performance Under Load
- ✅ Scenario 5: Error Handling & Edge Cases

## Performance Verification
- ✅ Hash computation: 2-5ms (target <10ms)
- ✅ Encryption: 30-40ms (target <50ms)
- ✅ Decryption: 35-45ms (target <50ms)
- ✅ DB Init: 80-120ms (target <150ms)
- ✅ DB Switch: 350-450ms (target <500ms)

## Security Validation
- ✅ Private key destroyed after auth
- ✅ Session hash persists during session
- ✅ Cross-user decryption fails appropriately
- ✅ Messages persist across logout/login
- ✅ Database isolation enforced

## Issues Found
- [List any issues found]
- [Empty if all tests pass]

## Conclusion
Phase 5 validation ✅ COMPLETE and ✅ APPROVED

Tested by: [Name]
Date: [Date]
```

---

## 🚀 Running Tests: Quick Start

### For Developers

```bash
# Terminal 1: Start application
npm run dev

# Terminal 2: Run tests
cd frontend
npm run test:phase5

# Or with UI
npm run test:ui
```

### For CI/CD Pipeline

```bash
# In your CI/CD (e.g., GitHub Actions)
cd frontend
npm run test:run
```

---

## ⚠️ Troubleshooting

### Issue: Tests fail with "Database not initialized"

**Fix**: Ensure mock database initialization in tests:

```typescript
beforeEach(async () => {
  const testId = 'test-' + Date.now();
  await initializeDb(testId);
});
```

### Issue: Encryption/Decryption tests fail

**Check**:
1. Is session hash set? `getSessionPrivateKeyHash()` should return non-null
2. Is database initialized? `getDb()` should not throw
3. Are crypto functions available? Check imports

### Issue: Performance tests timeout

**Check**:
1. System load - run on idle system
2. Browser cache - clear cache between tests
3. IndexedDB quota - check if near limits

### Issue: Manual test messages don't encrypt

**Check**:
1. Are you logged in? (Check cookies in DevTools)
2. Is session hash set? (Check console)
3. Is database initialized? (Check IndexedDB)

---

## 📝 Success Checklist

Before declaring Phase 5 complete:

- [ ] All 35 automated tests pass
- [ ] Code coverage >85% across all metrics
- [ ] All 5 manual scenarios pass
- [ ] Performance targets all met
- [ ] Security requirements verified
- [ ] No console errors during testing
- [ ] Database isolation confirmed (User B can't decrypt User A's messages)
- [ ] Message recovery works (User A logs back in, sees messages)
- [ ] Error handling graceful (no crashes on edge cases)
- [ ] Documentation updated with test results

---

## 📖 Next Steps After Phase 5

Once all tests pass:

1. **Code Review**: Have team review test results
2. **Security Audit**: Consider external security review for critical paths
3. **Performance Optimization**: Profile and optimize slow operations if needed
4. **Documentation**: Update user-facing docs with security features
5. **Release Planning**: Schedule release with hash-based encryption
6. **Monitoring**: Set up error tracking for production issues

---

## 🎓 Learning Resources

### Understanding the Implementation

- `frontend/app/lib/crypto/core/key-derivation.ts` - Hash functions
- `frontend/app/services/account.service.ts` - Account management
- `frontend/app/services/storage.service.ts` - Encryption/decryption
- `frontend/app/lib/db/db.ts` - Database isolation

### Related Documentation

- `plans/PHASES_3_4_COMPLETE_SUMMARY.md` - What was implemented
- `plans/QUICK_IMPLEMENTATION_REFERENCE.md` - Code patterns
- `plans/encryption-key-analysis.md` - Security analysis
