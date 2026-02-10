import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './use-auth-context';
import { NotificationContext, type NotificationCounts } from './notification-context';

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<NotificationCounts>({
    newRequests: 0,
    newAccepted: 0,
  });
  const { user } = useAuth();

  // Load persisted counts on mount
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`notifications_${user.identity.id}`);
      if (stored) {
        try {
          setCounts(JSON.parse(stored));
        } catch (error) {
          console.error('Failed to parse stored notifications:', error);
        }
      }
    }
  }, [user]);

  // Persist counts to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(`notifications_${user.identity.id}`, JSON.stringify(counts));
    }
  }, [counts, user]);

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
