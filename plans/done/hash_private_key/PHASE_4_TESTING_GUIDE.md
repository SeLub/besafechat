# Phase 4: Database Isolation - Manual Testing Guide

## Quick Start Test (5 minutes)

### Test: User Switching - Can User B see User A's messages?

**Setup**: Fresh browser (or incognito window)

**Step 1: Create User A**
```
1. Go to http://localhost:3000
2. Click "Create Account"
3. Click "Cloud Backup" (easier for testing)
4. Choose username (e.g., user_a_001)
5. Set password (e.g., TestPassword123!)
6. Wait for backup completion
7. Auto-redirects to chat page
```

**Step 2: Send User A's Message**
```
8. Click any chat or create test chat
9. Type message: "Secret message from User A"
10. Send message
11. Verify message appears in chat
12. Check DevTools → Application → IndexedDB
    - Note database name (e.g., BeSafeDB_a3f5c7e2...)
    - Click on it → Messages table
    - Verify your message is there (encrypted)
```

**Step 3: Logout User A**
```
13. Click top-left menu → Logout
14. Verify redirected to login page
15. Check DevTools → IndexedDB
    - BeSafeDB_a3f5c7e2... database still exists (expected)
16. Close DevTools (optional)
```

**Step 4: Create User B (Same Device)**
```
17. Click "Create Account"
18. Click "Cloud Backup"
19. Choose different username (e.g., user_b_001)
20. Set different password (e.g., OtherPassword456!)
21. Wait for backup
22. Auto-redirects to chat page
```

**Step 5: CRITICAL TEST - User B Cannot See User A's Messages**
```
23. Navigate to same chat room if possible
    - Should be empty (different chat ID for User B)
    - User B is a different person
24. Check DevTools → Application → IndexedDB
    - NEW database created: BeSafeDB_f2e9d41b... (different hash)
    - OLD database still visible: BeSafeDB_a3f5c7e2...
    - Switch to old database → Messages table
    - ✅ VERIFY: User B CANNOT decrypt User A's messages
       (or messages appear encrypted/corrupted)
```

**Step 6: Send User B's Message**
```
25. Send test message: "User B's message"
26. Verify it stores in BeSafeDB_f2e9d41b... (new database)
27. Logout
```

**Step 7: Re-login as User A**
```
28. Click "Restore Access"
29. Enter User A's password
30. Auto-opens User A's database: BeSafeDB_a3f5c7e2...
31. Check chat
    - ✅ VERIFY: "Secret message from User A" is there
    - ✅ VERIFY: "User B's message" is NOT there
32. Message decrypts correctly
```

**Expected Outcome**: ✅ PASS

---

## Detailed Testing Scenarios

### Scenario 1: Database Names are Deterministic

**Purpose**: Verify same user always gets same database

**Steps**:
1. Create User A (password: TestPass123)
2. DevTools → IndexedDB → Note database name (e.g., BeSafeDB_abc123...)
3. Logout
4. Login as User A with same password
5. DevTools → IndexedDB
   - ✅ VERIFY: Same database name as step 2
6. Logout
7. Create User B
8. Login as User A again
9. DevTools → IndexedDB
   - ✅ VERIFY: Still same database name (BeSafeDB_abc123...)

---

### Scenario 2: Message Encryption Isolation

**Purpose**: Verify messages encrypted with user's key only

**Setup**:
- User A account with 1 message stored
- User B account with 1 message stored

**Test**:
1. Login as User A
2. Send message: "Hello from User A"
3. Go to DevTools → Application → IndexedDB → BeSafeDB_userA...
4. Click "messages" table
5. Double-click the message row
6. In preview panel, examine "encryptedContent"
   - Should show encrypted binary (not readable)
7. Logout

8. Login as User B
9. Go to DevTools → Application → IndexedDB
10. Notice: Two databases now visible
    - BeSafeDB_userA... (User A's, closed)
    - BeSafeDB_userB... (User B's, open)
11. Click on BeSafeDB_userA → Messages
12. Select User A's message
13. Try to interpret "encryptedContent"
    - ✅ VERIFY: Still encrypted, cannot decrypt without User A's private key
14. Navigate to BeSafeDB_userB → Messages
15. ✅ VERIFY: User B's messages only (User A's message not here)

---

### Scenario 3: Multiple Tabs Same User

**Purpose**: Verify same user can use multiple tabs

**Steps**:
1. Tab 1: Login as User A
2. Tab 1: Send message "Message 1"
3. Tab 2: Open http://localhost:3000
4. Tab 2: Should already be logged in as User A (session cookies)
5. Tab 2: Check chat
   - ✅ VERIFY: "Message 1" visible
6. Tab 2: Send message "Message 2"
7. Tab 1: Refresh page
8. Tab 1: Check chat
   - ✅ VERIFY: Both "Message 1" and "Message 2" visible
9. Tab 1: Logout
   - ✅ VERIFY: Tab 2 still shows User A (session independent)
10. Tab 2: Send message
    - May fail (network error) or succeed depending on implementation

---

### Scenario 4: Corrupted Data Test

**Purpose**: Verify if User B somehow gets User A's encrypted message

**Dangerous Test** (only for security verification):

1. Login as User A
2. Send message: "SENSITIVE: Account number 1234567890"
3. DevTools → IndexedDB → BeSafeDB_userA → Messages
4. Copy the "encryptedContent" value
5. Logout

6. Login as User B
7. DevTools Console:
   ```javascript
   // Attempt to manually access User A's message
   const db = await indexedDB.databases();
   console.log(db); // Should see both databases
   
   // Try to open User A's database
   const oldDb = indexedDB.open('BeSafeDB_a3f5c7e2...');
   oldDb.onsuccess = () => {
     const tx = oldDb.result.transaction(['messages']);
     const store = tx.objectStore('messages');
     const req = store.getAll();
     req.onsuccess = () => console.log(req.result);
   };
   ```
8. If User B can even see the encrypted message: ✅ Still OK (still encrypted)
9. If User B tries to decrypt: ✅ Should fail or get garbage
10. ✅ VERIFIED: Even with manual access, decryption requires User A's private key hash

---

### Scenario 5: Performance - Database Switching

**Purpose**: Measure database initialization overhead

**Steps**:
1. Open DevTools → Performance tab
2. Login as User A - Record performance
   - Note: Database initialization time
   - Should be <100ms
3. Logout - Record performance
   - Database close time <20ms
4. Login as User B - Record performance
   - New database creation
   - Should be similar to User A
5. ✅ VERIFY: No noticeable delay to user

---

## Troubleshooting

### Issue: Database not initializing
**Symptom**: Error "Database not initialized. Call StorageService.initialize()"
**Cause**: Auth flow didn't call `StorageService.initialize()`
**Fix**: Check that `StorageService.initialize(loginResult.identityId)` is called after login

### Issue: Old database still has data
**Symptom**: After logging out User A, can still see their data in User B's session
**Cause**: Database not properly closed on logout
**Fix**: Verify `StorageService.cleanup()` called before clearing cookies

### Issue: Message won't decrypt after switching users back
**Symptom**: User A logs in again, message shows decryption error
**Cause**: Private key hash not restored correctly
**Fix**: Verify `setSessionPrivateKeyHash()` called during recovery flow

### Issue: Multiple tabs conflicts
**Symptom**: User A in tab 1, User B in tab 2, they interfere
**Cause**: Only one database can be open per app instance
**Fix**: This is expected - same app instance can't handle multiple databases
**Workaround**: Use different browsers or profiles for simultaneous multi-user testing

---

## Automated Test Script (Optional)

If you want to script this test:

```typescript
// tests/phase4-isolation.test.ts
describe('Phase 4: Database Isolation', () => {
  
  it('should create separate databases for different users', async () => {
    // User A
    await login('user-a', 'password-a');
    const dbA = await getDb();
    const nameA = dbA.name;
    
    await logout();
    
    // User B
    await login('user-b', 'password-b');
    const dbB = await getDb();
    const nameB = dbB.name;
    
    // Different users = different databases
    expect(nameA).not.toBe(nameB);
  });
  
  it('should prevent cross-user message access', async () => {
    // User A sends message
    await login('user-a', 'pass-a');
    await saveMessage('chat-1', 'Hello from A');
    const messagesA = await getAllMessages('chat-1');
    expect(messagesA.length).toBe(1);
    
    await logout();
    
    // User B logs in
    await login('user-b', 'pass-b');
    const messagesB = await getAllMessages('chat-1');
    
    // User B should not see User A's messages
    expect(messagesB.length).toBe(0);
  });
  
  it('should reopen same database for returning user', async () => {
    // User A
    await login('user-a', 'pass-a');
    await saveMessage('chat-1', 'Message 1');
    const nameA1 = (await getDb()).name;
    
    await logout();
    await login('user-b', 'pass-b');
    await logout();
    
    // User A again
    await login('user-a', 'pass-a');
    const nameA2 = (await getDb()).name;
    const messages = await getAllMessages('chat-1');
    
    // Same database, same data
    expect(nameA1).toBe(nameA2);
    expect(messages.length).toBe(1);
    expect(messages[0].text).toBe('Message 1');
  });
});
```

---

## Verification Checklist

- [ ] User A creates account, sends message
- [ ] User A logout (database closed)
- [ ] User B creates account on same device
- [ ] User B cannot see User A's messages
- [ ] User B sends message
- [ ] DevTools shows 2 IndexedDB databases
- [ ] User A logs back in
- [ ] User A sees only their message, not User B's
- [ ] Message decrypts correctly
- [ ] No errors in console during switching

---

## Performance Baseline

Expected timings:
- Database creation: 50-150ms
- Database reopening: 5-20ms
- Message save: 10-30ms
- Message load: 20-50ms
- Login total (with init): 200-500ms
- Logout total (with cleanup): 50-150ms

If slower, check network requests or crypto operations.

---

## Security Considerations

- ✅ User A's database is not deleted on logout (expected)
- ✅ User A's database is inaccessible when User B logged in (different currentDb instance)
- ✅ Even if User B somehow accesses old database, messages are encrypted
- ✅ User B cannot derive encryption key without User A's private key
- ⚠️ DevTools can access any IndexedDB (browser permission, not our control)
- ⚠️ Malicious browser extensions could access any IndexedDB

Last check: This is expected behavior for web apps. Full data isolation requires native application or browser sandboxing.

