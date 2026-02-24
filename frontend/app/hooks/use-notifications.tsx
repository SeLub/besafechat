import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './use-auth-context';
import { useProfileSettings } from './use-profile-settings';
import { toast } from 'sonner';
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

// Helper function to get notification text
function getNotificationText(notification: Notification): string {
  const displayName = notification.data.fromHandle?.displayName || 'Someone';

  switch (notification.type) {
    case 'contact_request':
      return `${displayName} wants to connect`;
    case 'contact_accepted':
      return `${displayName} accepted your request`;
    case 'contact_rejected':
      return `${displayName} declined your request`;
    case 'new_chat':
      return `Chat available with ${displayName}`;
    case 'team_invite':
      return `${displayName} invited you to a team`;
    default:
      return 'New notification';
  }
}

// Helper function to play notification sound
function playNotificationSound(): void {
  try {
    // Use Web Audio API to generate a simple beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Hz
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.warn('Could not play notification sound:', error);
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { settings } = useProfileSettings();

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
    // ВСЕГДА добавляем в Inbox (независимо от settings)
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Показываем toast ТОЛЬКО если notifications включены
    if (settings.notifications) {
      const notificationText = getNotificationText(notification);
      toast.info(notificationText, {
        description: notification.data.message || undefined,
      });

      // Проигрываем звук ТОЛЬКО если оба условия выполнены
      if (settings.sound) {
        playNotificationSound();
      }
    }
  }, [settings]);

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
    }
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!window.socketInstance) return;

    const socket = window.socketInstance;

    socket.on('notification:created', handleNotificationCreated);
    socket.on('notification:read', handleNotificationRead);
    socket.on('notification:all-read', handleAllRead);
    socket.on('notifications:sync', handleNotificationsSync);

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
