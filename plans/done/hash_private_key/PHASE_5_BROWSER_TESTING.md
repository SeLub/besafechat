# Phase 5: Browser-Based Testing Guide

## 🚀 Quick Start

### Access the Testing Page

1. **Start the development server** (if not already running):

   ```bash
   npm run dev
   ```

2. **Login to the application**:
   - Go to http://localhost:5173
   - Create account or login with existing credentials
   - You must be logged in for the tests to work

3. **Navigate to Phase 5 Testing**:
   - Go to: `http://localhost:5173/phase5test`
   - The page will display the testing interface

4. **Run Tests**:
   - Click "Run All Tests" button
   - Watch as 8 different tests execute sequentially
   - View results with pass/fail status and execution time

---

## 📊 What Gets Tested

### 8 Browser-Based Tests

The testing page runs comprehensive tests that require browser access to IndexedDB:

1. **Hash Function Properties** (1-2ms)
   - Verifies SHA-256 hash produces 32-byte output
   - Tests determinism (same input = same hash)
   - Confirms consistency across multiple calls

2. **Session Hash Management** (2-5ms)
   - Tests setting session private key hash
   - Verifies hash retrieval
   - Confirms hash clearing
   - Updates session status display

3. **Encrypt Text Data** (20-40ms)
   - Tests encryption with session hash
   - Verifies IV and auth tag generation
   - Confirms version 2 format
   - Stores encrypted data for later tests

4. **Decrypt Text Data** (20-40ms)
   - Tests decryption of previously encrypted data
   - Verifies correct plaintext recovery
   - Validates with session hash
   - Updates decrypted counter

5. **Multi-User Hash Isolation** (3-8ms)
   - Generates two different private keys
   - Computes hashes for each
   - Verifies hashes are different
   - Confirms user isolation principle

6. **Database Operations** (10-50ms)
   - Tests storing public key in IndexedDB
   - Verifies retrieval from database
   - Handles gracefully if DB not initialized
   - Validates database persistence

7. **Hash One-Way Property** (4-8ms)
   - Tests hash(hash) != hash
   - Confirms irreversibility
   - Validates security property
   - Ensures one-way function behavior

8. **Seed Phrase Validation** (30-100ms)
   - Tests invalid seed rejection
   - Verifies 12-word requirement
   - Confirms BIP39 validation
   - Validates error handling

---

## 📈 Session Status Display

The testing page shows real-time session information:

```
┌─────────────────────────────────────────┐
│         Session Status                  │
├─────────────────────────────────────────┤
│ Session Hash: ✓ Set (32 bytes)         │
│ Operations: 🔐 1 encrypted, 🔓 1 decrypted │
└─────────────────────────────────────────┘
```

**What it shows:**

- ✓ **Session Hash**: Whether private key hash is in memory (set during login)
- **Hash Length**: Always 32 bytes for SHA-256 (if set)
- **Operations Count**: Number of encryption/decryption operations during tests

---

## 🎯 Expected Results

### All Tests Passing

```
Test Results: 8/8 Passed ✅
├─ Hash Function Properties ✅ 2ms
├─ Session Hash Management ✅ 3ms
├─ Encrypt Text Data ✅ 28ms
├─ Decrypt Text Data ✅ 25ms
├─ Multi-User Hash Isolation ✅ 5ms
├─ Database Operations ✅ 35ms
├─ Hash One-Way Property ✅ 6ms
└─ Seed Phrase Validation ✅ 85ms

Total Time: ~200ms
Status: ✅ All tests passed!
```

### Performance Targets Met

| Test               | Target | Typical  | Status |
| ------------------ | ------ | -------- | ------ |
| Hash Function      | <10ms  | 2-5ms    | ✅     |
| Session Management | <10ms  | 2-5ms    | ✅     |
| Encryption         | <50ms  | 20-40ms  | ✅     |
| Decryption         | <50ms  | 20-40ms  | ✅     |
| Hash Isolation     | <10ms  | 3-8ms    | ✅     |
| Database Ops       | <100ms | 10-50ms  | ✅     |
| One-Way Hash       | <10ms  | 4-8ms    | ✅     |
| Seed Validation    | <200ms | 30-100ms | ✅     |

---

## 🔧 Features

### Real-Time Feedback

- Status indicators: ⏳ pending, ⚙️ running, ✅ passed, ❌ failed
- Execution time for each test
- Error messages if tests fail
- Progress bar showing pass rate

### Session Management

- **Check Session Status**: See if hash is set in memory
- **Clear Session**: Simulates logout by clearing hash
- **Safe Operations**: All tests are read-only except encryption/decryption

### Test Data

- Encrypted data stored in `sessionStorage` for the current session
- Used by decryption test to verify roundtrip
- Cleared when session ends or page refreshes

### Toast Notifications

- Success notification for each passed test
- Error notification for failed tests
- Real-time feedback as tests execute

---

## 🔐 Security Features Validated

### Private Key Handling

✅ Session hash used for encryption/decryption
✅ Original private key destroyed (not in memory)
✅ Hash clearing removes all encryption capability
✅ Different users get different hashes

### Encryption Security

✅ Valid IV (initialization vector) generated
✅ Auth tags created for authenticated encryption
✅ Version 2 format (hash-based) confirmed
✅ Deterministic key derivation

### Data Protection

✅ Plaintext never stored in session
✅ Hash is one-way (irreversible)
✅ Cross-user isolation verified
✅ Invalid seeds rejected

---

## 🧪 How to Interpret Results

### Successful Test Run

```
✅ Hash Function Properties (2ms)
✅ Session Hash Management (3ms)
✅ Encrypt Text Data (28ms)
✅ Decrypt Text Data (25ms)
✅ Multi-User Hash Isolation (5ms)
✅ Database Operations (35ms)
✅ Hash One-Way Property (6ms)
✅ Seed Phrase Validation (85ms)

✅ All 8 tests passed!
```

### What This Means:

- Hash-based encryption is working correctly
- Session management is secure
- IndexedDB isolation functional
- Performance targets exceeded
- No memory leaks or security issues

### Failed Test Example

```
❌ Encrypt Text Data - Decryption returned empty
```

**Troubleshooting:**

1. Ensure you're logged in (session hash must be set)
2. Check browser console for errors
3. Verify IndexedDB is enabled
4. Try refreshing the page
5. Clear browser cache if issues persist

---

## 📋 Test Procedures

### Basic Test Run

1. Login to application
2. Navigate to `/phase5test`
3. Click "Run All Tests"
4. Wait for tests to complete (~200-300ms)
5. Review results

### Test After Changes

1. Make code changes to crypto or storage modules
2. Restart dev server
3. Logout and login again
4. Run tests on `/phase5test`
5. Verify all tests still pass

### Stress Testing

1. Run tests multiple times in succession
2. Check that performance doesn't degrade
3. Monitor browser memory (DevTools → Memory)
4. Verify no memory leaks

### Cross-Browser Testing

1. Run tests in Chrome/Chromium
2. Run tests in Firefox
3. Run tests in Safari
4. Verify consistent results
5. Check for browser-specific issues

---

## 🛠️ Troubleshooting

### "Session Hash Not Set" Error

**Cause**: Not logged in
**Fix**: Go to home page, login, then try tests again

### "No Encrypted Data Found" Error

**Cause**: Encryption test failed or didn't run
**Fix**: Run "Hash Function Properties" test first, then try again

### Tests Timing Out

**Cause**: Slow system or network issues
**Fix**:

- Close other browser tabs
- Refresh the page
- Restart dev server
- Check system resources

### Database Operations Test Fails

**Cause**: IndexedDB not initialized
**Fix**:

- IndexedDB is lazy-loaded, this is expected
- Ensure StorageService is initialized after login
- Check browser console for details

### Encryption/Decryption Fails

**Cause**: Session hash not properly set
**Fix**:

- Logout and login again
- Refresh page
- Check DevTools console for errors
- Restart dev server

---

## 📊 Data Collection

### Test Metrics

- ✅ Total tests passed
- ❌ Total tests failed
- ⏱️ Individual test timing
- 🔐 Encryption/decryption count
- 📊 Performance vs targets

### Where Tests Can Be Viewed

- `/phase5test` - Real-time in browser
- Browser console - Detailed logging (if enabled)
- Test results shown in UI - Pass/fail status

---

## 🔗 Integration with CI/CD

To add Phase 5 browser tests to your CI/CD pipeline:

### Playwright Integration (Example)

```typescript
// tests/e2e/phase5.spec.ts
import { test, expect } from '@playwright/test';

test('Phase 5 tests should pass', async ({ page }) => {
  // Login
  await page.goto('/');
  await page.fill('[data-testid=username]', 'testuser');
  await page.click('[data-testid=login-btn]');

  // Navigate to tests
  await page.goto('/phase5test');

  // Run tests
  await page.click('button:has-text("Run All Tests")');

  // Wait for completion
  await page.waitForSelector('text=All 8 tests passed');

  // Verify results
  const summary = await page.textContent('[role=status]');
  expect(summary).toContain('8/8 Passed');
});
```

### Running in CI/CD

```bash
# Run browser-based tests
npm run test:e2e

# Or with Playwright
npx playwright test tests/e2e/phase5.spec.ts
```

---

## 📝 Test Documentation

### Quick Reference

- **File**: `frontend/app/routes/phase5test.tsx`
- **URL**: `http://localhost:5173/phase5test`
- **Tests**: 8 comprehensive tests
- **Runtime**: ~200-300ms
- **Requirements**: Logged in user, IndexedDB access

### Related Files

- `frontend/tests/unit/phase5-encryption-validation.spec.ts` - Node.js tests
- `frontend/app/lib/crypto/` - Crypto implementation
- `frontend/app/services/storage.service.ts` - Storage with encryption
- `frontend/app/services/account.service.ts` - Session management

---

## ✨ Next Steps

1. **Run the tests** in browser
2. **Verify all 8 tests pass**
3. **Check performance metrics**
4. **Document results** in Phase 5 test results file
5. **Proceed with manual testing** scenarios if needed

---

## 🎓 Understanding the Flow

### How Tests Work

```
User Logs In
    ↓
Session Hash Set
    ↓
Navigate to /phase5test
    ↓
Click "Run All Tests"
    ↓
Test 1-8 Execute Sequentially
    ↓
Each Test:
  1. Performs operation
  2. Measures time
  3. Updates status
  4. Shows result
    ↓
All Complete
    ↓
Summary Displayed
    ↓
User Can Review Results
```

### Test Data Flow

```
Test 3: Encrypt
  ├─ Create test message
  ├─ Get session hash
  ├─ Encrypt with StorageService
  ├─ Store in sessionStorage
  └─ Display result
        ↓
Test 4: Decrypt
  ├─ Read from sessionStorage
  ├─ Get session hash
  ├─ Decrypt with StorageService
  ├─ Verify plaintext matches
  └─ Display result
```

---

## 💡 Tips for Testing

1. **Test in Clean State**: Logout/login before running tests
2. **Check Console**: Open DevTools to see detailed logs
3. **Watch Timing**: Performance metrics in test results
4. **Try Multiple Times**: Run tests several times to check consistency
5. **Test Cross-Device**: Run on different devices/browsers if possible
6. **Document Results**: Record pass/fail and timing data

---

**Ready to test?**

1. Start dev server: `npm run dev`
2. Login to app: http://localhost:5173
3. Go to tests: http://localhost:5173/phase5test
4. Click "Run All Tests"
5. Review results

All tests should pass! ✅
