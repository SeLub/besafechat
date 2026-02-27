# Notification History System for Anonymous E2E Messenger

## Current Status

**Status**: Implementation Phase 1 - Core Service
**Current Implementation**: WebSocket-based real-time notifications (toast only)
**Storage**: Redis-based persistence (replacing localStorage)
**Encryption**: Plaintext storage (encryption planned for future phases)
**Gaps**: No server-side persistence, offline recovery, or multi-device synchronization

### Existing Implementation
- Real-time WebSocket events via `MessagesGateway`
- Toast notifications for immediate feedback
- Support for: contact requests, contact accepted, contact rejected, new chats
- Online status tracking in Redis (`online:{handleId}`)
- **Note**: localStorage for notifications is deprecated and will be replaced by Redis

## Problem Statement

Implement synchronized notification history across devices while maintaining anonymity in an E2E encrypted messenger. Users should be able to:

- View notification history across all their devices
- See unread notification counts with red dot indicators
- Access notifications from a menu item
- Have notifications synchronized when logged in on different devices
- **Recover missed notifications after being offline**
- **Maintain consistent state across multiple active sessions**

## Constraints

- Must preserve anonymity (server should not have access to notification content)
- Should work across multiple devices simultaneously
- Must not compromise the E2E encryption principles
- Need efficient storage and retrieval mechanisms
- **Must provide offline recovery mechanism**
- **Must deduplicate notifications across devices**

## Solution Overview

### Recommended Approach: Redis-Based Temporary Storage

Redis is the optimal choice for this use case due to its speed, ephemeral nature, and atomic operations that align with privacy requirements.

## Architecture Details

### Core Design

- **Notification Queue**: Each user gets a Redis list/queue keyed by their handleId
- **Ephemeral Nature**: Notifications are temporary and can be expired after read
- **Real-time Access**: Low-latency reads for the UI to display notification counts

### Storage Structure

Use Redis for all notification data with atomic operations:

**Primary Storage**:
- **Key**: `notifications:{handleId}` (JSON sorted set)
  - **Members**: Full notification objects (JSON serialized)
  - **Scores**: Timestamps for chronological ordering
  - **TTL**: 30 days (configurable)

**Supporting Data**:
- **Key**: `unread_count:{handleId}` (integer)
  - Atomic counter for unread notifications
  - Used for badge indicators
  
- **Key**: `notification_read:{handleId}` (set)
  - Contains IDs of read notifications
  - Helps track state across devices

**Notification Object Schema**:
```json
{
  "id": "uuid",
  "type": "contact_request|contact_accepted|contact_rejected|new_chat|team_invite",
  "timestamp": "2026-01-31T19:08:45.333Z",
  "read": false,
  "data": {
    "fromHandle": { "id", "value", "displayName" },
    "toHandle": { "id" },
    "message": "optional message",
    "chatId": "optional chat id",
    "requestId": "optional request id"
  }
}
```

**Note**: `message_received` type is excluded from Phase 1 implementation (see Message Notification Strategy below).

### State Management

- **Read Status Tracking**: `notification_read:{handleId}:{notificationId}`
- **Automatic Cleanup**: Automatic removal of read notifications after configurable period
- **TTL Policies**: Automatic expiration of old notifications using Redis TTL

### Synchronization Mechanism

**Real-Time Synchronization**:
- **WebSocket Emit**: When notification created, emit to all connected devices via `user:{handleId}` room
- **Atomic Operations**: Use Redis INCR/DECR for counters to prevent race conditions
- **Idempotent IDs**: Each notification has unique ID to prevent duplicates

**Offline Recovery (Reconnection)**:
1. On WebSocket connect, fetch all unread notifications from Redis
2. Emit "notifications:sync" event with full history
3. Client compares with localStorage to detect new items
4. Client deduplicates by notification ID
5. Merge server state as source of truth

**Device Synchronization**:
- Maintain `last_sync_timestamp:{handleId}:{sessionId}` in Redis
- Use it to detect stale client state
- Mark notifications as read atomically across devices via server
- Force refresh on all connected sockets when state changes

### Anonymity Preservation

**Current Implementation (Phase 1)**:
- **Plaintext Storage**: Notification data stored in plaintext in Redis
- **Rationale**: Simplifies initial implementation and debugging
- **Security**: Redis access restricted to backend services only
- **Transport Security**: All WebSocket and HTTP communications use TLS

**Future Enhancement (Phase 4+)**:
- **Client-side Encryption**: Notification payloads encrypted with user's handleId-derived key
- **Encrypted Blobs**: Server stores encrypted data without insight into content
- **Minimal Metadata**: Only essential routing information in plaintext
- **Key Derivation**: Use handleId + salt for deterministic encryption keys

## Message Notification Strategy

### Phase 1 Implementation: Variant C (No Message Notifications)

**Current Approach**:
- Notifications created only for: `contact_request`, `contact_accepted`, `contact_rejected`, `new_chat`, `team_invite`
- Messages shown only within chat interface (existing behavior)
- Unread message counts managed separately from notification system
- Simpler implementation with lower Redis load

**Rationale**:
- Reduces notification noise
- Prevents Redis overload from high-frequency messages
- Separates concerns: notifications for events, chats for messages
- Easier to implement and test

### Future Variants (Phase 4+)

#### Variant A: Per-Message Notifications
**Description**: Each incoming message creates a separate notification

**Pros**:
- Complete message history in notifications
- User sees every message sender and preview
- Simple implementation (one notification per message)

**Cons**:
- High notification volume (spam risk)
- Redis storage overhead
- UI clutter with many notifications from same chat

**Use Case**: Low-volume professional communications

**Implementation**:
```typescript
// On message received
await notificationService.createNotification(toHandleId, 'message_received', {
  fromHandle: { id, value, displayName },
  chatId,
  messagePreview: truncate(decryptedMessage, 50)
});
```

#### Variant B: Grouped Chat Notifications
**Description**: First message creates notification, subsequent messages update it

**Pros**:
- Reduced notification count (one per chat)
- Shows aggregate: "3 new messages from John Doe"
- Better UX for active conversations
- Lower Redis storage

**Cons**:
- Complex implementation (grouping logic)
- Need to track "last notification per chat"
- Update operations more expensive than create
- Race conditions with concurrent messages

**Use Case**: High-volume personal messaging

**Implementation**:
```typescript
// On message received
const existingNotification = await notificationService.findByChatId(toHandleId, chatId);

if (existingNotification) {
  // Update existing notification
  await notificationService.updateNotification(existingNotification.id, {
    messageCount: existingNotification.data.messageCount + 1,
    lastMessage: truncate(decryptedMessage, 50),
    timestamp: new Date()
  });
} else {
  // Create new notification
  await notificationService.createNotification(toHandleId, 'message_received', {
    fromHandle: { id, value, displayName },
    chatId,
    messageCount: 1,
    lastMessage: truncate(decryptedMessage, 50)
  });
}
```

**Additional Requirements**:
- Redis key: `notification_by_chat:{handleId}:{chatId}` for quick lookup
- Atomic update operations to prevent race conditions
- Clear notification when user opens chat

#### Variant C: No Message Notifications (Current)
**Description**: Messages not included in notification system

**Pros**:
- Simplest implementation
- Lowest Redis load
- Clear separation: notifications for events, chats for messages
- No notification spam

**Cons**:
- Users must check chats manually for new messages
- No cross-device message alerts via notification center
- Unread counts separate from notification system

**Use Case**: Initial MVP, privacy-focused users

**Implementation**: No changes to message handling, notifications only for events

### Migration Path

To migrate from Variant C to A or B:

1. **Add `message_received` type** to notification schema
2. **Update MessagesGateway** to call `notificationService.createNotification()` on message events
3. **Frontend**: Add message notification rendering in notification list
4. **For Variant B**: Implement grouping logic and update operations
5. **User Settings**: Allow users to toggle message notifications on/off

## Implementation Strategy

### Phase 1: Core Service (Week 1)

**1. Create NotificationService**:
```typescript
// backend/src/domains/notification/notification.service.ts
class NotificationService {
  // Store notification (called by other services)
  async createNotification(toHandleId, type, data)
  
  // Fetch unread notifications
  async getUnreadNotifications(handleId, limit?, offset?)
  
  // Mark single as read
  async markAsRead(handleId, notificationId)
  
  // Mark all as read
  async markAllAsRead(handleId)
  
  // Get unread count
  async getUnreadCount(handleId)
  
  // Cleanup expired (cron job)
  async cleanupExpiredNotifications()
}
```

**2. Update MessagesGateway**:
- Inject NotificationService
- Call `createNotification()` for each event
- On WebSocket connect: emit "notifications:sync" with full history

**3. API Endpoints** (Controller: `NotificationController`):
```
GET  /notifications              - list with pagination
POST /notifications/{id}/read    - mark as read
POST /notifications/read-all     - mark all as read
GET  /notifications/unread-count - badge number
```

### Phase 2: WebSocket Integration (Week 1)

**Update MessagesGateway**:
- Add new event handler: `@SubscribeMessage('notification:sync')`
- Emit `notification:created` when new notification added
- Emit `notification:read-status-changed` on read operations
- Broadcast across all devices in `user:{handleId}` room

### Phase 3: Frontend Integration (Week 2)

**Add useNotificationHistory hook**:
```typescript
// frontend/app/hooks/use-notification-history.tsx
function useNotificationHistory() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  
  // On connect: fetch history
  useEffect(() => {
    socket.emit('notification:sync')
  }, [socket])
  
  // Listen for new notifications
  socket.on('notification:created', handleNewNotification)
  socket.on('notification:read-status-changed', handleStatusChange)
  
  return { notifications, unreadCount, markAsRead, markAllAsRead }
}
```

**Update NotificationProvider**:
- Fetch history on mount (from API)
- Listen to WebSocket events
- Merge server state as source of truth
- **Note**: localStorage no longer used for notification persistence (Redis is source of truth)

### Data Flow

```
External Event (contact request, message, etc.)
    ↓
Service (ContactRequestService, etc.) calls:
    notifyContactRequest() → NotificationService.createNotification()
    ↓
NotificationService stores in Redis:
    - Add to notifications:{handleId} sorted set
    - Increment unread_count:{handleId}
    - Generate unique notification ID (UUID)
    ↓
WebSocket emits 'notification:created' to user:{handleId} room
    ↓
All connected devices receive real-time update
    ↓
On reconnection or app start:
    - WebSocket connect event triggers 'notification:sync'
    - Backend fetches notifications:{handleId} from Redis
    - Emits 'notifications:sync' with full history
    ↓
Frontend merges server state:
    - Deduplicates by notification ID
    - Uses server state as source of truth
    - Updates UI with badge count
    ↓
User clicks notification → mark as read:
    - POST /notifications/{id}/read
    - Backend: remove from notifications set, add to read set
    - Emit 'notification:read' to user:{handleId} room
    - All devices update simultaneously
```

## Advantages of Redis Approach

### Performance

- **Sub-millisecond access times** for notification retrieval
- **Optimized for temporary, frequently accessed data**
- **Native atomic operations** for counter management
- **Built-in TTL mechanisms** for automatic cleanup

### Scalability

- **Handles high-frequency notification updates** across many users
- **Efficient memory usage** for temporary data
- **Horizontal scaling** capabilities with Redis clusters

### Privacy Alignment

- **Temporary buffer model** rather than permanent storage
- **Server never has plaintext access** to notification content
- **Consistent with privacy-first architecture**

## Counter Management

### Unread Count System

- **Key**: `unread_count:{handleId}` storing a simple integer
- **Atomic operations** ensure consistency across devices
- **Reset mechanism** when user views notifications
- **Automatic cleanup** of read notifications

### Red Dot Indicator

- Real-time updates through WebSocket connections
- Efficient querying of unread count
- Visual feedback synchronized across all devices

## Security Considerations

### Encryption Strategy

- **Client-side encryption** of notification content using user's handleId
- **Transport security** via HTTPS/WebSocket Secure
- **Access control** through existing authentication system

### Data Retention

- **Configurable retention policies** based on user preferences
- **Automatic cleanup** of expired notifications
- **Privacy-focused** approach minimizing data persistence

## Potential Challenges and Solutions

### Challenge: Device Synchronization

**Problem**: Multiple devices out of sync when user marks notification as read on one device
**Solution**: 
- Use Redis as source of truth
- Mark as read on server atomically
- Broadcast to all connected sockets immediately
- Client state becomes ephemeral, derived from server

### Challenge: Memory Usage at Scale

**Problem**: Storing full notification objects for all users
**Solution**:
- Implement TTL: 30 days for unread, 7 days for read notifications
- Cron job: `cleanupExpiredNotifications()` runs daily
- Monitor Redis memory: alert if > 85% usage
- Estimate: ~1KB per notification × 1M users × 50 avg notifications = 50GB at scale

### Challenge: Notification Ordering

**Solution**: Use Redis sorted sets with timestamps for chronological ordering (already handles this)

### Challenge: Duplicate Notifications Across Reconnections

**Problem**: User reconnects, gets same notifications twice
**Solution**:
- Each notification has unique UUID generated at creation
- Frontend deduplicates by ID
- Store last processed notification ID in localStorage
- Only fetch newer notifications after reconnect

### Challenge: Handling Large History on Reconnection

**Problem**: User offline for 3 weeks, massive sync payload
**Solution**:
- Paginate: fetch latest 100 notifications by default
- Add `?limit=50&offset=0` query params
- Lazy-load older notifications on scroll
- Show "Load earlier" button in UI

## Migration and Deployment

### Phased Rollout

1. **Phase 1 (Week 1)**: Core Service & WebSocket
   - Create `NotificationService`
   - Update `MessagesGateway` to store notifications
   - Add REST endpoints for history
   - **Testing**: Manual API testing, unit tests for service
   
2. **Phase 2 (Week 2)**: Frontend Integration
   - Add `useNotificationHistory` hook
   - Update UI to fetch on connect
   - Handle offline/reconnection
   - **Testing**: Test offline scenarios, multi-device simulation
   
3. **Phase 3 (Week 3)**: Advanced Features
   - Notification filtering by type
   - Search functionality
   - User preferences (mute, disable)
   - **Testing**: Performance testing with large notification sets

4. **Phase 4 (Ongoing)**: Monitoring & Optimization
   - Redis memory optimization
   - TTL policy tuning
   - Add telemetry

### Backward Compatibility

- **Existing localStorage**: Keep it as L2 cache, don't break current functionality
- **New users**: Use Redis immediately
- **Existing users**: Migrate on next app launch
  - Fetch from Redis
  - Merge with localStorage
  - Prefer server state as source of truth

### Monitoring & Observability

**Key Metrics**:
- `notifications_created_total` - counter by type
- `notification_sync_duration_ms` - histogram
- `redis_memory_notifications_bytes` - gauge
- `notifications_delivered_rate` - success rate
- `device_sync_conflicts` - count of deduplication events

**Alerts**:
- Redis memory > 85% usage
- Notification delivery failure rate > 1%
- Sync latency > 500ms
- Notification cleanup job failures

## Integration with Existing Code

### Changes to Existing Services

**ContactRequestService** (`backend/src/domains/contact/services/contact-request.service.ts`):
```typescript
// In sendRequest() - after creating request
await this.notificationService.createNotification(
  toHandleId,
  'contact_request',
  {
    fromHandle: fromHandle,
    requestId: request.id,
    message: message,
  }
);

// In acceptRequest() - after setting status to ACCEPTED
await this.notificationService.createNotification(
  request.fromHandleId,
  'contact_accepted',
  {
    toHandle: request.toHandle,
    chatId: chat.id,
    requestId: request.id,
  }
);
```

**MessagesGateway** (`backend/src/domains/message/gateways/messages.gateway.ts`):
```typescript
// On handleConnection() - after successful auth
const unreadNotifications = await this.notificationService.getUnreadNotifications(
  session.activeHandleId,
  100  // limit to latest 100
);
client.emit('notifications:sync', {
  notifications: unreadNotifications,
  unreadCount: unreadNotifications.length,
});

// On handleMessage() - after metadata saved
await this.notificationService.createNotification(
  to,
  'message_received',
  {
    fromHandle: { id: client.data.activeHandleId },
    chatId,
    messageId,
  }
);
```

**NotificationProvider** (`frontend/app/hooks/use-notifications.tsx`):
```typescript
// On mount - fetch history from API
useEffect(() => {
  if (user) {
    fetchNotificationHistory();
  }
}, [user]);

// Listen to WebSocket events
useEffect(() => {
  socket?.on('notifications:sync', handleSync);
  socket?.on('notification:created', handleNewNotification);
  socket?.on('notification:read-status-changed', handleStatusChange);
  
  return () => {
    socket?.off('notifications:sync');
    socket?.off('notification:created');
    socket?.off('notification:read-status-changed');
  };
}, [socket]);
```

## Database & Schema

No database changes needed - Redis handles all storage. Optional: Add PostgreSQL table for audit log (separate from notification history):

```sql
CREATE TABLE notification_audit_log (
  id UUID PRIMARY KEY,
  handle_id UUID NOT NULL,
  notification_id UUID,
  notification_type VARCHAR(50),
  action VARCHAR(50),  -- 'created', 'read', 'deleted'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Conclusion

The Redis-based approach provides the optimal balance of performance, privacy, and functionality required for an anonymous E2E messenger. It addresses all constraints while providing the necessary synchronization and state management capabilities for cross-device notification history.

### Success Criteria

- ✅ Users can view notification history after reconnection
- ✅ Unread count syncs across all devices in real-time
- ✅ No duplicate notifications on reconnect
- ✅ Marking as read on one device reflects on all devices instantly
- ✅ Notifications persist for 30 days or until manually deleted
- ✅ System handles 1M+ users without performance degradation
- ✅ Full anonymity maintained (no plaintext content on server)
