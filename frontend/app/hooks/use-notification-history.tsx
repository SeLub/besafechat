import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './use-auth-context';
import { API_CONFIG } from '../services/api-config';

export type Notification = {
  id: string;
  type: 'contact_request' | 'contact_accepted' | 'contact_rejected' | 'new_chat' | 'team_invite';
  timestamp: string;
  read: boolean;
  data: {
    fromHandle?: {
      id: string;
      value: string;
      displayName: string;
    };
    toHandle?: {
      id: string;
    };
    message?: string;
    chatId?: string;
    requestId?: string;
  };
}

export function useNotificationHistory() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/notifications`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/notifications/unread-count`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, []);

  const handleNotificationCreated = useCallback((notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
  }, []);

  const handleNotificationRead = useCallback((data: { notificationId: string; unreadCount: number }) => {
    setNotifications(prev =>
      prev.map(n => (n.id === data.notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount(data.unreadCount);
  }, []);

  const handleAllRead = useCallback((data: { unreadCount: number }) => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(data.unreadCount);
  }, []);

  const handleNotificationsSync = useCallback((data: { notifications: Notification[]; unreadCount: number }) => {
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [user, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    if (!window.socketInstance) return;

    const socket = window.socketInstance;

    socket.on('notification:created', handleNotificationCreated);
    socket.on('notification:read', handleNotificationRead);
    socket.on('notification:all-read', handleAllRead);
    socket.on('notifications:sync', handleNotificationsSync);

    socket.emit('notifications:request-sync');

    return () => {
      socket.off('notification:created', handleNotificationCreated);
      socket.off('notification:read', handleNotificationRead);
      socket.off('notification:all-read', handleAllRead);
      socket.off('notifications:sync', handleNotificationsSync);
    };
  }, [handleNotificationCreated, handleNotificationRead, handleAllRead, handleNotificationsSync]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
