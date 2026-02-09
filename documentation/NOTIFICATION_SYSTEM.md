# BeSafeChat Notification System

**Document Version:** 1.0  
**Last Updated:** February 9, 2026  
**Status:** Production-ready

---

## Overview

BeSafeChat implements a Redis-based notification system with real-time WebSocket synchronization, multi-device support, and offline recovery. The system provides instant notifications for contact requests, chat events, and team invitations without storing message content.

**Core Innovation:** Ephemeral Redis storage with 30-day TTL, atomic operations for unread counts, and room-based WebSocket broadcasting for instant multi-device synchronization.

---

## Architecture

### Backend Components

**NotificationService** - Core Redis Operations
- `createNotification()` - Create notification with atomic counter increment
- `getUnreadNotifications()` - Fetch unread with pagination
- `markAsRead()` - Mark single notification as read
- `markAllAsRead()` - Bulk mark as read
- `getUnreadCount()` - Get badge count
- `cleanupExpiredNotifications()` - TTL-based cleanup

**NotificationController** - REST API (4 Endpoints)
- `GET /notifications` - List notifications (paginated)
- `POST /notifications/:id/read` - Mark as read
- `POST /notifications/read-all` - Mark all as read
- `GET /notifications/unread-count` - Get unread count

**MessagesGateway** - WebSocket Integration
- `syncNotifications()` - Auto-sync on connect
- `handleRequestSync()` - Manual sync request
- `handleMarkAsRead()` - WebSocket mark as read
- `handleMarkAllAsRead()` - WebSocket mark all as read
- `notifyContactRequest()` - Create notification on events

**NotificationModule** - NestJS Module
- Exports: NotificationService
- Imports: SessionModule, HandleModule, RedisService
- Controllers: NotificationController

### Frontend Components

**useNotificationHistory** - React Hook
- `notifications` - Notification array state
- `unreadCount` - Badge counter state
- `loading` - Loading state
- `markAsRead()` - Mark single as read
- `markAllAsRead()` - Bulk mark as read
- `refresh()` - Manual refresh

**NotificationList** - UI Component
- Notification list display
- Unread indicators (blue dot)
- Time formatting (relative)
- Avatar display
- Mark as read on click
- Empty state handling

**Integration Points**
- `hamburger-menu.tsx` - Red dot badge with count
- `left-panel-pages.tsx` - Notifications page
- `index.tsx` - Navigation state management

---

## Data Flow

### Notification Creation

```
Event Trigger (e.g., Contact Request)
    ↓
ContactRequestService.sendRequest()
    ↓
MessagesGateway.notifyContactRequest()
    ↓
NotificationService.createNotification()
    ↓
Redis Operations:
  - ZADD notifications:{handleId} (sorted set)
  - INCR unread_count:{handleId} (atomic counter)
  - EXPIRE notifications:{handleId} 2592000 (30 days)
    ↓
WebSocket Broadcast:
  - Emit 'notification:created' → room: user:{handleId}
    ↓
All Connected Devices:
  - useNotificationHistory receives event
  - Updates local state
  - UI updates (badge + list)
```

### Mark as Read Flow

```
User Clicks Notification
    ↓
Frontend: markAsRead(notificationId)
    ↓
POST /notifications/{id}/read
    ↓
NotificationService.markAsRead()
    ↓
Redis Operations:
  - SADD notification_read:{handleId} {notificationId}
  - DECR unread_count:{handleId}
    ↓
WebSocket Broadcast:
  - Emit 'notification:read' → room: user:{handleId}
    ↓
All Connected Devices:
  - Update notification.read = true
  - Decrement unread count
  - UI updates
```

### Offline Recovery

```
User Reconnects (WebSocket)
    ↓
MessagesGateway.handleConnection()
    ↓
syncNotifications(handleId)
    ↓
NotificationService.getUnreadNotifications()
    ↓
Redis: ZREVRANGE notifications:{handleId}
    ↓
WebSocket Emit:
  - 'notifications:sync' with full history
    ↓
Frontend:
  - Merge with localStorage (deduplication)
  - Server state = source of truth
  - Update UI
```

---

## Redis Storage Schema

### Primary Storage

**Key**: `notifications:{handleId}`  
**Type**: Sorted Set  
**Score**: Timestamp (milliseconds)  
**Value**: JSON notification object  
**TTL**: 30 days (2,592,000 seconds)

**Notification Object**:
```json
{
  "id": "uuid-v4",
  "type": "contact_request|contact_accepted|contact_rejected|new_chat|team_invite",
  "timestamp": "2026-02-09T12:00:00.000Z",
  "read": false,
  "data": {
    "fromHandle": {
      "id": "handle-uuid",
      "value": "username",
      "displayName": "Display Name"
    },
    "toHandle": {
      "id": "handle-uuid"
    },
    "message": "optional message",
    "chatId": "optional chat id",
    "requestId": "optional request id"
  }
}
```

### Unread Counter

**Key**: `unread_count:{handleId}`  
**Type**: String (integer)  
**Operations**: INCR, DECR, GET, SET  
**Purpose**: Badge count for UI

### Read Tracking

**Key**: `notification_read:{handleId}`  
**Type**: Set  
**Members**: Notification IDs  
**Purpose**: Track read status across devices

---

## Notification Types

### Implemented Types

| Type | Trigger | Data Fields |
|------|---------|-------------|
| `contact_request` | Someone sends contact request | fromHandle, requestId |
| `contact_accepted` | Contact request accepted | fromHandle, requestId |
| `contact_rejected` | Contact request rejected | fromHandle, requestId |
| `new_chat` | New chat created | fromHandle, chatId |
| `team_invite` | Team invitation sent | fromHandle, teamId |

### Excluded Types (By Design)

- `message_received` - Excluded per Variant C strategy
  - Rationale: Prevents notification spam
  - Messages shown only in chat interface
  - Unread counts managed separately

---

## WebSocket Events

### Server → Client

**`notifications:sync`** - Full synchronization
```typescript
{
  notifications: Notification[],
  unreadCount: number
}
```

**`notification:created`** - New notification
```typescript
{
  id: string,
  type: NotificationType,
  timestamp: string,
  read: false,
  data: NotificationData
}
```

**`notification:read`** - Marked as read
```typescript
{
  notificationId: string,
  unreadCount: number
}
```

**`notification:all-read`** - All marked as read
```typescript
{
  unreadCount: 0
}
```

### Client → Server

**`notifications:request-sync`** - Request full sync
```typescript
// No payload
```

**`notification:mark-read`** - Mark single as read
```typescript
{
  notificationId: string
}
```

**`notification:mark-all-read`** - Mark all as read
```typescript
// No payload
```

---

## Multi-Device Synchronization

### Room-Based Broadcasting

All devices connected with same handleId join room: `user:{handleId}`

**Synchronization Guarantees:**
- ✅ New notifications appear on all devices instantly
- ✅ Mark as read on one device updates all devices
- ✅ Unread count synchronized across devices
- ✅ Automatic sync on reconnection

### Conflict Resolution

**Strategy**: Server state is source of truth

1. Client connects → receives full sync
2. Client merges with local state
3. Deduplication by notification ID
4. Server unread count overrides local count

---

## Security & Privacy

### Current Implementation (Phase 1)

**Storage**: Plaintext in Redis
- Rationale: Simplifies initial implementation
- Security: Redis access restricted to backend only
- Transport: All WebSocket/HTTP use TLS

**Access Control**:
- JwtSessionGuard on all endpoints
- Only authenticated users access notifications
- Users can only access their own notifications (handleId-based keys)

### Future Enhancement (Phase 4+)

**Client-Side Encryption**:
- Notification payloads encrypted with handleId-derived key
- Server stores encrypted blobs
- Minimal metadata in plaintext (routing only)

---

## Performance Characteristics

### Redis Operations

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Create | O(log N) | Sorted set insertion |
| Read | O(log N) | Range query |
| Mark as read | O(1) | Set addition + counter |
| Get count | O(1) | String get |

### Memory Usage

**Per User**:
- ~1KB per notification
- 50 notifications average = 50KB
- 10,000 users = 500MB total

**Optimization**:
- 30-day TTL automatic cleanup
- Pagination (50 per page)
- Lazy loading support

### WebSocket Efficiency

- Single connection per device
- Room-based broadcasting (no iteration)
- Minimal payload (~500 bytes per notification)
- Automatic reconnection with sync

---

## API Reference

### REST Endpoints

**GET /notifications**
```typescript
Query: { limit?: number, offset?: number }
Response: Notification[]
Auth: Required (JwtSessionGuard)
```

**POST /notifications/:id/read**
```typescript
Params: { id: string }
Response: { success: boolean }
Auth: Required
```

**POST /notifications/read-all**
```typescript
Response: { success: boolean }
Auth: Required
```

**GET /notifications/unread-count**
```typescript
Response: { count: number }
Auth: Required
```

### WebSocket Events

See "WebSocket Events" section above for detailed schemas.

---

## Testing

### Backend Tests

**Unit Tests** (`tests/unit/notification.service.spec.ts`):
- ✅ createNotification() - 1 test
- ✅ getUnreadNotifications() - 1 test
- ✅ markAsRead() - 1 test
- ✅ getUnreadCount() - 2 tests

**Integration Tests** (`tests/integration/notification.integration.spec.ts`):
- ✅ Create and retrieve - 1 test
- ✅ Track unread count - 1 test
- ✅ Mark as read - 1 test
- ✅ Mark all as read - 1 test

### Frontend Tests

**Unit Tests** (`tests/unit/notification-history.spec.ts`):
- ✅ Type structure validation - 1 test
- ✅ All notification types - 1 test
- ✅ Data structure validation - 1 test

**Total**: 12 tests, 100% pass rate

---

## Configuration

### Environment Variables

**Backend**:
```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6380
REDIS_PASSWORD=redis_secure
```

**Frontend**:
```env
VITE_API_BASE_URL=http://localhost:4000
```

### Constants

**NotificationService**:
- `TTL_DAYS = 30` - Notification expiration
- `DEFAULT_LIMIT = 50` - Pagination limit

---

## Deployment Checklist

- [x] Backend code deployed
- [x] Frontend code deployed
- [x] Redis available and configured
- [x] Environment variables set
- [x] Tests passing (12/12)
- [ ] Performance monitoring enabled
- [ ] Error tracking configured
- [ ] Documentation complete

---

## Monitoring

### Key Metrics

**Backend**:
- Redis memory usage (`notifications:*` keys)
- WebSocket connection count
- Notification creation rate
- API endpoint latency
- Error rate

**Frontend**:
- WebSocket connection stability
- Notification render time
- Badge update latency
- User engagement (click rate)

### Alerts

- Redis memory > 80%
- WebSocket disconnect rate > 5%
- API latency > 500ms
- Error rate > 1%

---

## Known Limitations

1. **No Encryption**: Notifications stored in plaintext (Phase 1)
2. **No Message Notifications**: Variant C implementation (by design)
3. **Fixed TTL**: 30 days hardcoded (could be configurable)
4. **No Actions**: Click doesn't navigate to source (future)
5. **No Grouping**: Each notification separate (Variant A)

---

## Future Enhancements

### Phase 4+ Roadmap

**High Priority**:
- Client-side encryption of notification data
- HandleId-derived encryption keys
- Server stores encrypted blobs only

**Medium Priority**:
- Message notifications (Variant B - grouped)
- Update counter on new messages
- Clear on chat open

**Low Priority**:
- Notification actions (click to navigate)
- Custom notification sounds
- Push notifications (mobile)
- Notification preferences per type
- Bulk operations (delete, archive)

---

## Related Documentation

- **AUTHENTICATION_SYSTEM_ANALYSIS.md** - Auth system details
- **TESTING_SUMMARY.md** - Complete test documentation
- **IMPLEMENTATION_REPORT.md** - Implementation details

---

_Last Updated: February 9, 2026_
