# Online Status Implementation in BeSafeChat

## Overview

The BeSafeChat application implements a real-time online status tracking system that allows users to see the availability of their contacts. The system uses a combination of WebSocket connections, Redis caching, and periodic heartbeats to maintain accurate online/offline status information.

## Architecture

### Backend Components

#### 1. WebSocket Gateway (`messages.gateway.ts`)

The WebSocket gateway handles real-time communication between clients and manages online status updates.

Key responsibilities:

- Track user connections and disconnections
- Maintain online status in Redis
- Broadcast online/offline notifications to relevant users
- Handle heartbeat messages to keep status current

#### 2. Redis-based Status Tracking

- Online status stored in Redis with TTL (Time To Live)
- Key format: `online:{handleId}` with value `'1'` for online
- TTL set to 120 seconds to handle connection failures gracefully

#### 3. Related Users Detection (`chat-room.service.ts`)

The system determines which users should receive online/offline notifications by identifying users who share chats or contacts:

- Finds handles that participate in common chat rooms
- Only notifies users who have existing relationships (chat connections)

### Frontend Components

#### 1. WebSocket Hook (`use-websocket-notifications.tsx`)

Manages WebSocket connections and handles real-time events:

- Establishes connection to WebSocket server
- Sends heartbeat messages every 20 seconds
- Receives and processes online/offline notifications
- Updates UI when status changes

#### 2. Chats Hook (`use-chats.tsx`)

Manages chat list and online status display:

- Fetches bulk online status for all contacts
- Updates individual chat status when receiving notifications
- Implements periodic refresh of online statuses every 30 seconds

## How It Works

### User Goes Online

1. User connects to WebSocket server
2. Gateway validates session and extracts handle ID
3. Redis key `online:{handleId}` is set with TTL of 120 seconds
4. Gateway identifies related users (those sharing chats/contacts)
5. Online notifications are sent to related users
6. Frontend updates UI to show user as online

### User Goes Offline

1. WebSocket connection is closed (normal or unexpected)
2. Gateway detects disconnection and clears Redis key
3. Gateway identifies related users
4. Offline notifications are sent to related users
5. Frontend updates UI to show user as offline

### Heartbeat Maintenance

1. Frontend sends heartbeat message every 20 seconds
2. Gateway refreshes Redis TTL for user's online status
3. Prevents premature status expiration due to network issues

### Periodic Status Refresh

1. Frontend periodically fetches bulk online status for all contacts
2. Updates UI with most current status information
3. Ensures status accuracy even if WebSocket notifications are missed

## API Endpoints

### Backend Endpoints

- `POST /contacts/bulk-online-status` - Get online status for multiple users
- Parameters: `{ userIds: string[] }`
- Response: `{ statuses: Record<string, boolean> }`

### Frontend Services

- `OnlineStatusService.getOnlineStatus(userId)` - Individual status check
- `OnlineStatusService.getBulkOnlineStatus(userIds)` - Bulk status check

## Data Flow

### Real-time Notifications

```
User A connects → Gateway sets online status → Notifies User B (shared chat) → User B sees User A online
User A disconnects → Gateway clears status → Notifies User B → User B sees User A offline
```

### Periodic Updates

```
Frontend → GET /contacts/bulk-online-status → Backend → Redis → Return statuses → Update UI
```

## Error Handling and Edge Cases

### Connection Failures

- Redis TTL of 120 seconds handles temporary connection drops
- Heartbeat mechanism maintains status during brief network issues
- Disconnection handler ensures immediate status clearing when possible

### Browser Close/Tab Reload

- `beforeunload` events trigger graceful disconnection
- WebSocket `disconnect` event handler clears online status
- If browser closes abruptly, status expires after TTL

### Network Partitions

- Heartbeat keeps status current during stable connections
- TTL ensures status eventually updates if heartbeats fail
- Periodic bulk refresh provides additional accuracy layer

## Performance Considerations

### Redis Optimization

- Efficient key-value storage for fast status lookups
- Automatic expiration prevents stale data accumulation
- Memory-efficient boolean representation

### Notification Filtering

- Only notifies users with existing relationships
- Reduces unnecessary traffic and processing
- Scales well with user base growth

### Batch Operations

- Bulk status requests minimize API round trips
- Periodic refresh reduces real-time notification load
- Efficient WebSocket broadcasting to relevant users only

## Security Aspects

### Access Control

- Only authenticated users can access online status endpoints
- Status information limited to connected/related users
- Handle IDs used instead of sensitive identity information

### Privacy

- Online status respects user privacy settings
- Users can control visibility through profile settings
- Status only shared with established contacts

## Implementation Details

### Redis Keys

- Format: `online:{handleId}`
- Value: `'1'` for online, key absence means offline
- TTL: 120 seconds (extended from original 60s)

### WebSocket Events

- `user_online`: Emitted when user comes online
- `user_offline`: Emitted when user goes offline
- `heartbeat`: Sent by client every 20 seconds

### Frontend UI Updates

- Green dot indicator for online users
- "Online" or "Last seen recently" text
- Immediate updates on WebSocket notifications
- Periodic refresh for accuracy

## Troubleshooting Common Issues

### Status Not Updating

- Check WebSocket connection status
- Verify heartbeat messages are being sent
- Confirm Redis connectivity
- Review related users detection logic

### False Online Status

- Verify disconnection handlers are firing
- Check Redis TTL settings
- Ensure proper cleanup on logout
- Review heartbeat frequency

### Performance Degradation

- Monitor Redis memory usage
- Optimize related users queries
- Adjust bulk refresh intervals
- Consider pagination for large contact lists

## Future Enhancements

### Planned Improvements

- Presence indicators (away, busy, etc.)
- Last seen timestamps
- Mobile app background/foreground detection
- Cross-device status synchronization
- More granular privacy controls
