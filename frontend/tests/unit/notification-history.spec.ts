import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Notification } from '../../app/hooks/use-notification-history';

// Mock fetch
globalThis.fetch = vi.fn();

describe('useNotificationHistory types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct Notification type structure', () => {
    const notification: Notification = {
      id: '1',
      type: 'contact_request',
      timestamp: new Date().toISOString(),
      read: false,
      data: {
        fromHandle: {
          id: 'handle-1',
          value: 'user1',
          displayName: 'User One',
        },
      },
    };

    expect(notification).toHaveProperty('id');
    expect(notification).toHaveProperty('type');
    expect(notification).toHaveProperty('timestamp');
    expect(notification).toHaveProperty('read');
    expect(notification).toHaveProperty('data');
  });

  it('should support all notification types', () => {
    const types: Notification['type'][] = [
      'contact_request',
      'contact_accepted',
      'contact_rejected',
      'new_chat',
      'team_invite',
    ];

    expect(types).toHaveLength(5);
  });

  it('should validate notification data structure', () => {
    const notification: Notification = {
      id: '2',
      type: 'new_chat',
      timestamp: new Date().toISOString(),
      read: true,
      data: {
        fromHandle: {
          id: 'handle-2',
          value: 'user2',
          displayName: 'User Two',
        },
        chatId: 'chat-123',
        message: 'Hello',
      },
    };

    expect(notification.data.chatId).toBe('chat-123');
    expect(notification.data.message).toBe('Hello');
  });
});
