import { useContext, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { API_CONFIG } from '../services/api-config';
import { OnlineStatusContext } from '../contexts/online-status.context';

interface OnlineStatusProviderProps {
  children: ReactNode;
}

export function OnlineStatusProvider({ children }: OnlineStatusProviderProps) {
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});

  const getOnlineStatus = useCallback(
    (handleId: string | undefined): boolean => {
      if (!handleId) return false;
      return statuses[handleId] || false;
    },
    [statuses]
  );

  const updateOnlineStatus = useCallback((handleId: string, isOnline: boolean) => {
    setStatuses(prev => ({
      ...prev,
      [handleId]: isOnline,
    }));
  }, []);

  const bulkUpdateOnlineStatus = useCallback((newStatuses: Record<string, boolean>) => {
    setStatuses(prev => ({
      ...prev,
      ...newStatuses,
    }));
  }, []);

  const loadInitialStatuses = useCallback(
    async (handleIds: string[]) => {
      if (handleIds.length === 0) return;

      try {
        const res = await fetch(`${API_CONFIG.BASE_URL}/contacts/bulk-online-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userIds: handleIds }),
        });

        if (res.ok) {
          const { statuses } = await res.json();
          bulkUpdateOnlineStatus(statuses);
        }
      } catch (error) {
        console.error('Failed to load initial online statuses:', error);
      }
    },
    [bulkUpdateOnlineStatus]
  );

  const value = {
     getOnlineStatus,
     updateOnlineStatus,
     bulkUpdateOnlineStatus,
     loadInitialStatuses,
   };

   return <OnlineStatusContext.Provider value={value}>{children}</OnlineStatusContext.Provider>;
  }

  // eslint-disable-next-line react-refresh/only-export-components
 export function useOnlineStatusContext() {
   const context = useContext(OnlineStatusContext);
   if (context === undefined) {
     throw new Error('useOnlineStatusContext must be used within OnlineStatusProvider');
   }
   return context;
  }
