# Quick Reference: Online Status WebSocket Migration

## 📍 Files to Review

```
documentation/
├── ONLINE_STATUS_WEBSOCKET_MIGRATION.md    ← START HERE (Implementation Plan)
├── ONLINE_STATUS_HANDLING.md               ← Architecture Reference
├── IMPLEMENTATION_SUMMARY.md               ← Overview & Checklist
└── QUICK_REFERENCE.md                      ← This file

frontend/tests/unit/hooks/
├── use-online-status-context.test.tsx          ← 8 Unit Test Cases
└── websocket-online-status.integration.test.tsx ← 8 Integration Test Cases
```

---

## 🎯 The Problem (30 seconds)

**What's happening now:**
- Every 30 seconds: `POST /contacts/bulk-online-status`
- ~2,880 requests per user per day
- Browser freezes momentarily from state updates
- 30-second delay before seeing if someone is online

**Why it's bad:**
- Wasted bandwidth and server resources
- Terrible user experience (freezes, delay)
- Not real-time

---

## ✨ The Solution (30 seconds)

**What we're doing:**
- Use WebSocket events: `user_online` and `user_offline`
- These events already exist, just need to listen
- Real-time updates (<100ms)
- Zero polling overhead

**Why it's better:**
- Instant updates when someone connects/disconnects
- No browser freezes
- No wasted network calls
- Reuses existing WebSocket connection

---

## 📊 Before vs After

```
BEFORE (Polling):
Every 30s → Browser makes request → Server queries Redis → Browser updates state → FREEZE

AFTER (WebSocket):
User connects → Server emits event → Browser updates state (minimal) → Real-time
```

---

## 🛠️ Implementation (6-8 hours)

### Phase 1: Create Context (1-2 hours)
```
New file: frontend/app/hooks/use-online-status-context.tsx
- Manages online status for all contacts
- Methods: getOnlineStatus(), updateOnlineStatus(), loadInitialStatuses()
```

### Phase 2: Connect WebSocket (30 min)
```
File: frontend/app/hooks/use-websocket-notifications.tsx
- Forward user_online/user_offline events to context
```

### Phase 3: Remove Polling (30 min)
```
File: frontend/app/hooks/use-chats.tsx
- Delete setInterval() loop (lines 105-117)
- Keep function, call once on load
```

### Phase 4: Main Component (1 hour)
```
File: frontend/app/routes/index.tsx
- Add OnlineStatusProvider wrapper
- Connect WebSocket callback
```

### Phase 5: Update Contacts (30 min)
```
File: frontend/app/components/contacts-page.tsx
- Use getOnlineStatus() instead of chat.isOnline
```

### Phase 6: Test Everything (2-3 hours)
```
Run: npm run test
- 8 unit tests
- 8 integration tests
- Performance validation
```

---

## 📋 What to Read First

### Quick Start (15 min)
1. This file (QUICK_REFERENCE.md)
2. `IMPLEMENTATION_SUMMARY.md` → Overview section

### Full Prep (1 hour)
1. `ONLINE_STATUS_HANDLING.md` → Current/New Architecture
2. `ONLINE_STATUS_WEBSOCKET_MIGRATION.md` → Full Plan
3. Review code locations in `ONLINE_STATUS_HANDLING.md`

### Before Coding (30 min)
1. Review Phase checklist in `ONLINE_STATUS_WEBSOCKET_MIGRATION.md`
2. Read your assigned phase details
3. Check test templates

---

## 🎯 Key Metrics

| Metric | Now | After | Better? |
|--------|-----|-------|---------|
| Requests/min | 2 | 0 | ✅ 100% less |
| Update lag | 30s | <100ms | ✅ 300x faster |
| Freezes/min | 1 | 0 | ✅ None |
| CPU (polling) | 3-5% | 0% | ✅ Better |
| Memory | 2MB+ | 0MB | ✅ Better |

---

## 🔍 Code Locations

| Component | File | Lines | Action |
|-----------|------|-------|--------|
| Polling loop | `use-chats.tsx` | 105-117 | **DELETE** |
| WebSocket events | `use-websocket-notifications.tsx` | 149-155 | **USE EXISTING** |
| Main component | `routes/index.tsx` | 254-265 | **CONNECT** |
| Contacts page | `contacts-page.tsx` | 38-40 | **UPDATE** |
| New context | `use-online-status-context.tsx` | N/A | **CREATE** |

---

## 🚀 Testing Checklist

### Before Coding
- [ ] All 16 test cases reviewed
- [ ] Test template structure understood

### After Phase 1
- [ ] Context created
- [ ] Unit tests passing

### After Phase 4
- [ ] Integration tests passing
- [ ] No console errors

### Final Validation
- [ ] npm run test passes 100%
- [ ] DevTools Network tab: no /bulk-online-status calls
- [ ] No browser freezes observed
- [ ] Online/offline status updates instantly
- [ ] Works with 2+ browser tabs

---

## 💾 Files to Create

```bash
# New file (220 lines)
frontend/app/hooks/use-online-status-context.tsx

# Test files (100+ lines each)
frontend/tests/unit/hooks/use-online-status-context.test.tsx
frontend/tests/unit/hooks/websocket-online-status.integration.test.tsx
```

---

## 🔧 Files to Modify

```bash
# Remove polling (12 lines)
frontend/app/hooks/use-chats.tsx
- Lines 105-117: Delete setInterval loop
- Line 103: Remove 'chats' from dependency

# Add callback parameter
frontend/app/hooks/use-websocket-notifications.tsx
- Add: onOnlineStatusChange parameter
- Forward user_online/user_offline events

# Wire up context
frontend/app/routes/index.tsx
- Import OnlineStatusProvider
- Wrap component tree
- Pass callback to WebSocket hook

# Use context
frontend/app/components/contacts-page.tsx
- Replace chat.isOnline with getOnlineStatus()
```

---

## 🎓 Key Concepts

### Context Pattern
```typescript
// Create global state
const OnlineStatusContext = createContext<...>(...);

// Provide to components
<OnlineStatusProvider>
  <App />
</OnlineStatusProvider>

// Use in components
const { getOnlineStatus } = useOnlineStatusContext();
```

### WebSocket Events
```typescript
// Server emits when user connects/disconnects
socket.emit('user_online', { handleId: 'xxx' })
socket.emit('user_offline', { handleId: 'xxx' })

// Frontend receives
socket.on('user_online', (data) => {
  updateOnlineStatus(data.handleId, true)
})
```

### Initial Sync
```typescript
// On app load, fetch current status
loadInitialStatuses()
  → POST /contacts/bulk-online-status
  → bulkUpdateOnlineStatus(result)
  
// After that, only WebSocket events update status
```

---

## ⚠️ Common Mistakes

### ❌ Don't
- Leave polling interval in place
- Call loadOnlineStatuses() in a loop
- Pass `chats` as dependency when not needed
- Create new context instances on each render

### ✅ Do
- Remove the setInterval
- Use WebSocket events instead
- Wrap app once with OnlineStatusProvider
- Keep context stable with useContext hook

---

## 🐛 Debugging Tips

### Check if context is working
```javascript
// In browser console
useOnlineStatusContext() 
→ Should return { getOnlineStatus, updateOnlineStatus, ... }
```

### Check if WebSocket events are arriving
```javascript
// In browser console, look for logs
"user_online" events in Network tab
"user_offline" events in Network tab
```

### Check if polling is gone
```javascript
// In DevTools Network tab
Search for "bulk-online-status"
→ Should see ZERO requests after initial load
```

### Check performance
```javascript
// In DevTools Performance tab
Look for long tasks when status updates
→ Should be <50ms
→ No main thread blocking
```

---

## 📞 If Stuck

| Issue | Check | Reference |
|-------|-------|-----------|
| Don't understand architecture | `ONLINE_STATUS_HANDLING.md` | See "Architecture Components" |
| Don't know what to code | `ONLINE_STATUS_WEBSOCKET_MIGRATION.md` | See Phase details |
| Tests failing | Test templates | See test files |
| Browser freezing | Check polling removed | Lines 105-117 in use-chats |
| Status not updating | Check WebSocket events | DevTools Network tab |

---

## 🎯 Success Criteria

After implementation, you should see:

1. ✅ Zero `/contacts/bulk-online-status` requests in Network tab
2. ✅ Online/offline status updates in <100ms
3. ✅ No browser freezes when contacts come online/offline
4. ✅ All 16 tests passing
5. ✅ Same visual behavior but instant updates

---

## 📚 Document Map

```
START → QUICK_REFERENCE.md (this file)
  ↓
LEARN → IMPLEMENTATION_SUMMARY.md (overview)
  ↓
UNDERSTAND → ONLINE_STATUS_HANDLING.md (architecture)
  ↓
PLAN → ONLINE_STATUS_WEBSOCKET_MIGRATION.md (detailed plan)
  ↓
CODE → Follow 6 phases + use test templates
  ↓
TEST → All 16 tests passing
  ↓
VALIDATE → Metrics match expected improvements
```

---

**Status:** Ready for implementation
**Estimated Duration:** 6-8 hours
**Risk Level:** Low
**Rollback Time:** <15 minutes
