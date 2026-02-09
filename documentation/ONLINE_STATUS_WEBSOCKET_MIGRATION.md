# Online Status Migration: From Polling to WebSocket Events

## Executive Summary

This document outlines the migration from HTTP polling-based online status updates to WebSocket event-driven architecture. This change eliminates constant network requests (every 30 seconds), resolves browser freezing issues, and provides real-time status updates.

**Current Problem:**
- `/contacts/bulk-online-status` endpoint is called every 30 seconds
- Causes periodic browser freezes due to state updates
- Unnecessary network overhead (~2,880 requests/day per user)
- 30-second delay in status updates

**Solution:**
- Leverage existing `user_online`/`user_offline` WebSocket events
- Implement event-driven status updates in a shared context
- Remove polling interval entirely
- Initial sync on app load only

---

## Architecture Overview

### Before (Current)
```
User A logs in/out
    ↓
Redis updated
    ↓
[Every 30 seconds] Frontend polls /contacts/bulk-online-status
    ↓
Redis → Backend → Frontend
    ↓
State update + re-render (causes freeze)
```

### After (Proposed)
```
User A logs in/out
    ↓
Redis updated + WebSocket event emitted
    ↓
WebSocket received immediately by User B
    ↓
Context updated + minimal re-render
    ↓
Polling removed entirely
```

---

## Implementation Plan

### Phase 1: Create Shared Online Status Context

**File:** `frontend/app/hooks/use-online-status-context.tsx` (NEW)

**Purpose:** Centralized management of online status for all contacts

**Responsibilities:**
- Store online status map: `{ handleId: boolean }`
- Update status via WebSocket events
- Provide `updateOnlineStatus(handleId, isOnline)` function
- Initial sync via bulk API call on app load

**Key Features:**
- Event-driven architecture (real-time updates from WebSocket)
- Fallback polling only if needed (optional graceful degradation)
- No automatic periodic polling

---

### Phase 2: Modify WebSocket Hook

**File:** `frontend/app/hooks/use-websocket-notifications.tsx`

**Changes:**
1. Accept `onOnlineStatusChange` callback as parameter
2. Forward `user_online` and `user_offline` events to callback
3. No changes to existing event handlers

**Code Location:** Lines 149-155 (existing event handlers)

```typescript
// Add new callbacks to hook signature
export function useWebSocketNotifications(
  onChatCreated?: (chatId: string) => void,
  onMessageReceived?: (message: any) => void,
  onUserOnline?: (handleId: string) => void,      // ← Already exists
  onUserOffline?: (handleId: string) => void,     // ← Already exists
  onContactRequest?: (request: ContactRequestData) => void,
  onOnlineStatusChange?: (handleId: string, isOnline: boolean) => void, // ← New
)
```

**Action:** Forward events to context via callback

---

### Phase 3: Update useChats Hook

**File:** `frontend/app/hooks/use-chats.tsx`

**Changes to Remove:**
1. Remove polling interval (lines 105-117)
2. Remove periodic `loadOnlineStatuses()` call
3. Remove `chats` dependency from `loadOnlineStatuses` (line 103)
4. Remove `loadOnlineStatuses` from return export (only export once)

**Changes to Keep:**
1. Keep `loadOnlineStatuses` function (for initial sync)
2. Call it once on mount before intervals are removed
3. Keep `updateChatOnlineStatus` function

**Why:** This hook should focus on chat data, not real-time status updates

---

### Phase 4: Update Main Route Component

**File:** `frontend/app/routes/index.tsx`

**Changes:**
1. Connect online status context
2. Pass `updateOnlineStatus` to WebSocket hook
3. Remove dependency on `loadOnlineStatuses` from periodic calls
4. Keep handlers for direct WebSocket events as fallback

**Code Pattern:**
```typescript
const { updateOnlineStatus } = useOnlineStatusContext();

// This callback will be called by WebSocket hook
const handleOnlineStatusChange = useCallback(
  (handleId: string, isOnline: boolean) => {
    updateOnlineStatus(handleId, isOnline);
  },
  [updateOnlineStatus]
);

// Pass to WebSocket hook
useWebSocketNotifications(
  // ... other callbacks
  handleOnlineStatusChange
);
```

---

### Phase 5: Update Contacts Page

**File:** `frontend/app/components/contacts-page.tsx`

**Changes:**
1. Import `useOnlineStatusContext`
2. Get online status from context instead of chat.isOnline
3. Subscribe to context updates
4. Remove dependency on `loadOnlineStatuses` polling

**Pattern:**
```typescript
const { getOnlineStatus } = useOnlineStatusContext();

// In render:
const isOnline = getOnlineStatus(request.from?.handleId);
```

---

## Removal of Unnecessary Code

### What to Remove:

| File | Lines | Reason |
|------|-------|--------|
| `use-chats.tsx` | 105-117 | Polling interval (move load to initial sync) |
| `use-chats.tsx` | 110-113 | `setInterval` call | Polling removed |
| `use-chats.tsx` | 103 | `chats` dependency in `loadOnlineStatuses` callback | No longer needed |
| `use-chats.tsx` | ~176 | Remove `loadOnlineStatuses` export if unused elsewhere | Consolidate |

### What to Keep:

| File | Lines | Reason |
|------|-------|--------|
| `use-chats.tsx` | 79-103 | `loadOnlineStatuses` function (initial sync) | Still needed |
| `use-chats.tsx` | 162-164 | `updateChatOnlineStatus` | Used by context |
| `messages.gateway.ts` | 327-376 | `notifyContactsUserOnline/Offline` methods | Emit events |

---

## Testing Strategy

### Unit Tests

**File:** `frontend/tests/unit/hooks/use-online-status-context.test.tsx`

**Test Cases:**
1. ✅ Context initializes with empty status map
2. ✅ `updateOnlineStatus()` updates status correctly
3. ✅ `getOnlineStatus()` returns correct status for handleId
4. ✅ Multiple status updates don't cause unnecessary re-renders
5. ✅ Non-existent handleId returns false (offline)
6. ✅ Initial sync fetches all statuses on mount

**Key Assertions:**
```typescript
describe('useOnlineStatusContext', () => {
  it('updates online status for a handleId', () => {
    // Arrange: render hook
    // Act: updateOnlineStatus('handle-1', true)
    // Assert: getOnlineStatus('handle-1') === true
  });

  it('returns false for non-existent handleId', () => {
    // Assert: getOnlineStatus('unknown') === false
  });

  it('calls initial sync on mount', () => {
    // Assert: loadOnlineStatuses was called once
  });
});
```

### Integration Tests

**File:** `frontend/tests/unit/hooks/websocket-online-status.integration.test.tsx`

**Test Cases:**
1. ✅ WebSocket `user_online` event updates context
2. ✅ WebSocket `user_offline` event updates context
3. ✅ Multiple sequential events update correctly
4. ✅ No polling interval is created

**Pattern:**
```typescript
describe('WebSocket Online Status Integration', () => {
  it('updates status when user_online event received', async () => {
    // Arrange: setup WebSocket mock
    // Act: emit 'user_online' with handleId
    // Assert: context reflects new status
  });
});
```

---

## Implementation Checklist

### Step 1: Create New Context
- [ ] Create `use-online-status-context.tsx`
- [ ] Define interface for online status map
- [ ] Implement `useOnlineStatusContext()` hook
- [ ] Implement `updateOnlineStatus(handleId, isOnline)`
- [ ] Implement `getOnlineStatus(handleId)` 
- [ ] Implement initial sync call on provider mount
- [ ] Export provider component

### Step 2: Update WebSocket Hook
- [ ] Add `onOnlineStatusChange` parameter
- [ ] Connect `user_online` event to callback
- [ ] Connect `user_offline` event to callback
- [ ] Test with mock events

### Step 3: Update useChats Hook
- [ ] Remove polling interval (lines 105-117)
- [ ] Remove `chats` dependency from `loadOnlineStatuses`
- [ ] Keep `loadOnlineStatuses` for initial sync only
- [ ] Call initial sync once on mount
- [ ] Remove from periodic updates

### Step 4: Update Main Route
- [ ] Import context provider
- [ ] Wrap component tree with provider
- [ ] Get `updateOnlineStatus` from context
- [ ] Pass to WebSocket hook
- [ ] Remove manual polling setup
- [ ] Test online/offline status updates

### Step 5: Update Contacts Page
- [ ] Import `useOnlineStatusContext`
- [ ] Replace `chat.isOnline` with `getOnlineStatus(handleId)`
- [ ] Remove polling dependencies
- [ ] Test real-time updates

### Step 6: Testing
- [ ] Write unit tests for context
- [ ] Write integration tests for WebSocket → Context
- [ ] Test browser performance (no more freezes)
- [ ] Test with multiple tabs (same WebSocket namespace)

---

## Metrics & Success Criteria

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Network requests/min | 2 per user | 0 (after initial sync) | 0 |
| Browser freeze duration | ~200ms every 30s | None | 0ms |
| Status update latency | 0-30 seconds | <100ms | <100ms |
| CPU usage polling | 3-5% | 0% | 0% |
| Memory leak risk | Polling closure | Low | Low |

---

## Rollback Plan

If issues arise:

1. **Quick Rollback:** Restore polling interval in `use-chats.tsx`
2. **Hybrid Mode:** Keep context but add fallback polling (5min interval)
3. **Debug Mode:** Add logging to track event delivery

---

## Migration Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1 (Context) | 1-2 hours | None |
| Phase 2 (WebSocket) | 30 min | Phase 1 |
| Phase 3 (useChats) | 30 min | Phase 2 |
| Phase 4 (Main Route) | 1 hour | Phase 3 |
| Phase 5 (Contacts) | 30 min | Phase 4 |
| Phase 6 (Testing) | 2-3 hours | Phase 5 |
| **Total** | **~6-8 hours** | Sequential |

---

## References

- Current Implementation: `frontend/app/hooks/use-chats.tsx` (lines 105-117)
- WebSocket Events: `backend/src/domains/message/gateways/messages.gateway.ts` (lines 327-376)
- Frontend WebSocket Hook: `frontend/app/hooks/use-websocket-notifications.tsx` (lines 149-155)
