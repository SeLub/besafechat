import { useContext, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
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

  const value = {
    getOnlineStatus,
    updateOnlineStatus,
    bulkUpdateOnlineStatus,
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
