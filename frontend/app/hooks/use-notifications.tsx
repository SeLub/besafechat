import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './use-auth-context';
import { NotificationContext, type NotificationCounts } from './notification-context';
import { API_ENDPOINTS } from '@/services/api-gateway';
import { handleApiResponse } from '@/services/api-utils';

const NOTIFICATION_SYNC_INTERVAL = 30000; // 30 seconds

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<NotificationCounts>({
    newRequests: 0,
    newAccepted: 0,
  });
  const { user } = useAuth();

  // Fetch unread notification counts from server
  const fetchNotificationCounts = async () => {
    if (!user?.identity?.id) return;

    try {
      const response = await fetch(API_ENDPOINTS.NOTIFICATIONS.GET_UNREAD_COUNT, {
        credentials: 'include',
      });

      const data = await handleApiResponse<{ count: number }>(response);

      // Server returns { count: number }
      setCounts({
        newRequests: data.count || 0,
        newAccepted: 0,
      });
    } catch (error) {
      console.error('Error fetching notification counts:', error);
      // Silently fail - will retry in 30 seconds
    }
  };

  // Load counts from server on mount and user change
  useEffect(() => {
    if (user?.identity?.id) {
      // Fetch immediately
      fetchNotificationCounts();

      // Set up periodic refresh (every 30 seconds)
      const interval = setInterval(fetchNotificationCounts, NOTIFICATION_SYNC_INTERVAL);

      return () => clearInterval(interval);
    }
  }, [user?.identity?.id]);

  const clearNotifications = () => {
    setCounts({ newRequests: 0, newAccepted: 0 });
  };

  const incrementRequests = () => {
    setCounts(prev => ({ ...prev, newRequests: prev.newRequests + 1 }));
  };

  const incrementAccepted = () => {
    setCounts(prev => ({ ...prev, newAccepted: prev.newAccepted + 1 }));
  };

  return (
    <NotificationContext.Provider
      value={{
        counts,
        clearNotifications,
        incrementRequests,
        incrementAccepted,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
