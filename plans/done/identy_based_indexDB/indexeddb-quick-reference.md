# IndexedDB Isolation - Quick Reference

## The Problem (1 Minute Summary)

| Aspect | Current | Issue |
|--------|---------|-------|
| **Database** | Single "BeSafeDB" | All users share same database |
| **When User A Logs In** | Messages stored in "BeSafeDB" | User A's messages in shared DB |
| **When User A Logs Out** | Session ends | Data remains in "BeSafeDB" |
| **When User B Logs In** | Accesses "BeSafeDB" | **Can see User A's messages!** |
| **Encryption** | Uses handleId | Good, but shared storage defeats purpose |
| **Result** | 🔴 Security breach | User B can access User A's data |

## The Solution (1 Minute Summary)

| Aspect | Old | New | Benefit |
|--------|-----|-----|---------|
| **Database Name** | Static: "BeSafeDB" | Dynamic: "BeSafeDB_<hash>" | Per-account isolation |
| **Database Instance** | Singleton | Per-account connection | Only one account's DB active |
| **On Login** | Access shared DB | Create/open account-specific DB | Isolated access |
| **On Logout** | Close session, DB stays open | Close DB, clear data | Prevent data leakage |
| **Result** | 🟡 Shared data | 🟢 Isolated data | User B cannot see User A |

## File Changes Summary

### 1. `db.ts` (Database Initialization)

**Add these functions:**
```typescript
// Get current database (must be initialized first)
export function getDb(): BeSafeDB

// Initialize database for a user account
export async function initializeDb(identityId: string): Promise<BeSafeDB>

// Close database connection
export async function closeDb(): Promise<void>

// Generate unique database name from identityId
async function generateDatabaseName(identityId: string): Promise<string>
```

**Update BeSafeDB class:**
```typescript
// Accept database name as parameter
constructor(dbName: string = 'BeSafeDB')
```

### 2. `storage.service.ts` (Use Dynamic Database)

**Find & Replace:**
```
OLD: db.messages    → NEW: getDb().messages
OLD: db.contacts    → NEW: getDb().contacts
OLD: db.publicKey   → NEW: getDb().publicKey
```

**Add to StorageService:**
```typescript
static async initialize(identityId: string): Promise<void>
static async cleanup(): Promise<void>
```

### 3. `routes/index.tsx` or Auth Service (Integration)

**On Login:**
```typescript
await StorageService.initialize(user.identityId)
```

**On Logout:**
```typescript
await StorageService.cleanup()
```

## Implementation Checklist

- [ ] Update `db.ts` constructor to accept `dbName` parameter
- [ ] Add `getDb()` function to `db.ts`
- [ ] Add `initializeDb()` function to `db.ts`
- [ ] Add `closeDb()` function to `db.ts`
- [ ] Add `generateDatabaseName()` function to `db.ts`
- [ ] Replace all `db.` with `getDb().` in `storage.service.ts`
- [ ] Add `initialize()` method to `StorageService`
- [ ] Add `cleanup()` method to `StorageService`
- [ ] Call `StorageService.initialize()` on login
- [ ] Call `StorageService.cleanup()` on logout
- [ ] Test: User A logs in → sends message
- [ ] Test: User A logs out
- [ ] Test: User B logs in → cannot see User A's message
- [ ] Test: User A logs back in → still sees their message

## Code Examples

### Example 1: Login Flow

```typescript
// Before: routes/index.tsx
async function handleLoginSuccess(user) {
  setUser(user);
  // ❌ No database initialization
}

// After: routes/index.tsx
async function handleLoginSuccess(user) {
  // ✅ Initialize user-specific database
  await StorageService.initialize(user.identityId);
  
  setUser(user);
  // Now safe to use storage
}
```

### Example 2: Logout Flow

```typescript
// Before
async function handleLogout() {
  setUser(null);
  // ❌ Database still accessible
}

// After
async function handleLogout() {
  // ✅ Clear and close database
  await StorageService.cleanup();
  
  setUser(null);
}
```

### Example 3: Storage Operation

```typescript
// Before: storage.service.ts
static async saveEncryptedMessage(...) {
  await db.messages.put(message);  // ❌ Global
}

// After: storage.service.ts
static async saveEncryptedMessage(...) {
  await getDb().messages.put(message);  // ✅ Current account's DB
}
```

## Database Names Example

```
identityId: "550e8400-e29b-41d4-a716-446655440000"
     ↓
  SHA-256 hash
     ↓
  "f1c8e45b3d2a97e..." (hex)
     ↓
Database Name: "BeSafeDB_f1c8e45b3d2a"
```

**Result:**
- User A: `BeSafeDB_f1c8e45b3d2a`
- User B: `BeSafeDB_a7f3d2c8e45b`
- User C: `BeSafeDB_c2b9e1f4a5d8`

Each user gets **unique database** based on their identityId.

## Security Impact

### Before ❌
```
BeSafeDB (SINGLE DATABASE)
├── User A's messages
├── User A's contacts
├── User B's messages
├── User B's contacts
└── 🔓 ACCESSIBLE TO EITHER USER
```

### After ✅
```
BeSafeDB_f1c8e45b3d2a (User A)
├── User A's messages
└── User A's contacts

BeSafeDB_a7f3d2c8e45b (User B)
├── User B's messages
└── User B's contacts

🔐 ONLY ACTIVE USER'S DATABASE IS ACCESSIBLE
```

## Testing Commands

### Test 1: Check Database Names
```javascript
// Open DevTools Console
// Login as User A
// Run:
localStorage.getItem('selectedChatId')  // Get a chat

// Check IndexedDB
// DevTools → Application → IndexedDB → BeSafeDB_f1c8e45b...

// Expected: Database name contains hash
```

### Test 2: Verify Data Isolation
```javascript
// Login as User A, send message
// Logout
// Login as User B, open same chat
// Expected: No messages visible

// Login as User A again
// Expected: Original message visible
```

### Test 3: Verify No Performance Impact
```javascript
// Open DevTools → Performance
// Login as User A
// Measure initialization time (should be <100ms)

// Send message
// Measure save time (should be unchanged)

// Load messages
// Measure load time (should be unchanged)
```

## FAQ

**Q: Will this break existing data?**  
A: Product is new, no existing users. Safe to implement.

**Q: Does this change encryption?**  
A: No, encryption algorithm unchanged. Only storage location.

**Q: Performance impact?**  
A: Minimal, <50ms on login. Negligible after.

**Q: How many databases can IndexedDB handle?**  
A: Hundreds per device. 1000+ messages per user.

**Q: What about browser storage quota?**  
A: Multiple 1KB databases use negligible quota increase.

**Q: Can user recover old messages after logout?**  
A: Yes, database persists until cleared. User can login again.

**Q: Does user's identityId hash get stored?**  
A: Only in database name (deterministic hash). Cannot be reversed.

## Rollout Plan

### Phase 1: Development (1 week)
- Implement database isolation
- Test on local machine
- Security review

### Phase 2: Testing (1 week)
- Manual testing with 2+ accounts
- Edge case testing (logout/login rapid)
- Performance testing

### Phase 3: Deployment
- Deploy to production
- Monitor for issues
- Gather user feedback

## Success Criteria

- [ ] User A and User B have separate IndexedDB databases
- [ ] User B cannot see User A's messages (even if they know chat ID)
- [ ] Logging out clears database connection
- [ ] Logging back in restores old messages
- [ ] No performance degradation
- [ ] Encryption/decryption still works correctly

## Priority

🔴 **HIGH** - Security vulnerability that must be fixed before:
- Adding real users
- Exposing to security audit
- Going to production

## Estimated Effort

- Implementation: 2-3 hours
- Testing: 4-6 hours
- Code review: 1 hour
- **Total: ~8-10 hours (1-1.5 days)**
