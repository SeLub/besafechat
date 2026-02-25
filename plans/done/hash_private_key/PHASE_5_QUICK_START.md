# Phase 5: Quick Start Guide

Get Phase 5 testing running in 5 minutes.

---

## 🚀 Start Tests Now

### 1. Install & Run (2 minutes)

```bash
cd frontend
npm install -D vitest @vitest/ui
npm run test:phase5
```

**Expected Output**:
```
✓ 35 tests passed in 2.34s
```

### 2. View Results (1 minute)

```bash
npm run test:ui
# Opens http://localhost:51204
```

Click through the test results in the web UI.

---

## 📋 What Gets Tested

### Automated Tests (35 total)
- ✅ Hash functions (5 unit tests)
- ✅ Account management (2 integration tests)
- ✅ Database isolation (4 integration tests)
- ✅ Encryption/decryption (4 integration tests)
- ✅ Security behavior (2 security tests)
- ✅ Performance (4 performance benchmarks)

### Manual Tests (5 scenarios)
1. **Single User Flow** (15 min) - Encryption works across sessions
2. **Cross-User Isolation** (20 min) - User B can't read User A's messages
3. **Multi-Login Cycles** (15 min) - Database deterministic across logins
4. **Performance** (20 min) - All operations meet timing targets
5. **Error Handling** (20 min) - Graceful failures

---

## ✅ Test Checklist

### Automated Tests
```bash
npm run test:phase5
```

- [ ] All 35 tests pass
- [ ] Coverage shown
- [ ] No timeouts

### Manual Test 1: Single User (15 min)

```
1. Create account (Cloud Backup)
2. Send message
3. Refresh page → message visible
4. Logout
5. Re-login → message recovered
```

**Success**: Message encrypts, decrypts, persists ✅

### Manual Test 2: Cross-User (20 min)

```
1. User A: Create account, send "Secret"
2. User A: Logout
3. User B: Create account on same device
4. User B: Can't decrypt User A's message
5. User A: Re-login, sees message
```

**Success**: User B isolated from User A ✅

### Manual Test 3: Multi-Login (15 min)

```
1. Create account, send message
2. Logout → re-login → message still there
3. Switch to different user
4. Switch back → original messages recovered
```

**Success**: Database deterministic ✅

### Manual Test 4: Performance (20 min)

```
1. Measure hash: <10ms
2. Measure encrypt: <50ms
3. Measure decrypt: <50ms
4. Measure DB init: <150ms
```

**Success**: All targets met ✅

### Manual Test 5: Error Handling (20 min)

```
1. Try encrypt without login → error
2. Corrupt DB entry → graceful failure
3. Wrong password → clear error
4. Clear session → encryption fails safely
```

**Success**: No crashes, clear errors ✅

---

## 🎯 Pass/Fail Criteria

| Category | Target | Status |
|----------|--------|--------|
| Automated Tests | 35/35 | ? |
| Manual Test 1 | PASS | ? |
| Manual Test 2 | PASS | ? |
| Manual Test 3 | PASS | ? |
| Manual Test 4 | PASS | ? |
| Manual Test 5 | PASS | ? |
| Coverage | >85% | ? |
| Performance | All targets | ? |

---

## 🔑 Key Validations

### Does it work?
✅ Messages encrypt with session hash
✅ Messages decrypt correctly
✅ Message history persists

### Is it secure?
✅ User B cannot decrypt User A's messages
✅ Private key destroyed after auth
✅ Database isolation enforced

### Is it fast?
✅ Encryption <50ms
✅ Decryption <50ms
✅ Database operations <150ms

---

## 📖 Full Documentation

- **Testing Guide**: `PHASE_5_TESTING_EXECUTION.md`
- **Verification Checklist**: `PHASE_5_VERIFICATION_CHECKLIST.md`
- **Full Summary**: `PHASE_5_SUMMARY.md`

---

## ⏱️ Timeline

| Task | Time |
|------|------|
| Install & run tests | 2 min |
| View results | 1 min |
| Manual Test 1 | 15 min |
| Manual Test 2 | 20 min |
| Manual Test 3 | 15 min |
| Manual Test 4 | 20 min |
| Manual Test 5 | 20 min |
| **Total** | **1.5-2 hours** |

---

## 🐛 Troubleshooting

### Tests fail
→ Check dependencies: `npm install -D vitest @vitest/ui`

### Tests timeout
→ Run on idle system or increase timeout in vitest.config.ts

### Manual tests: Messages don't encrypt
→ Make sure you're logged in (check cookies)

### Manual tests: Decryption fails
→ Make sure same user/password, check console for errors

---

## ✨ Next Steps

1. **Run automated tests** (now)
2. **Run manual tests** (next 1.5 hours)
3. **Record results** in PHASE_5_VERIFICATION_CHECKLIST.md
4. **Sign off** when all tests pass

---

## 🎓 What This Validates

- **Phases 1-3**: Hash-based encryption works correctly
- **Phase 4**: Database isolation prevents cross-user access
- **Overall**: Implementation is secure, functional, and performant

---

**Ready?** Run this now:

```bash
cd frontend
npm install -D vitest @vitest/ui
npm run test:phase5
```

Then follow `PHASE_5_TESTING_EXECUTION.md` for manual tests.
