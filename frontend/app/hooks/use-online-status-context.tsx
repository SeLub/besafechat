// /home/selub/Documents/progs/besafechat/frontend/app/hooks/use-online-status-context.tsx
import { useContext, useCallback, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { OnlineStatusContext } from '../contexts/online-status.context';
import { useAuth } from '@/hooks/use-auth-context';

interface OnlineStatusProviderProps {
  children: ReactNode;
}

export function OnlineStatusProvider({ children }: OnlineStatusProviderProps) {
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const activeHandleId = user?.handle?.id;

  // Ref для канала, чтобы не пересоздавать его при каждом рендере
  const channelRef = useRef<BroadcastChannel | null>(null);

  // 1. Инициализация канала
  useEffect(() => {
    if (!activeHandleId) return;

    const channelName = `online_status_${activeHandleId}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    // Слушатель для входящих сообщений с других вкладок
    channel.onmessage = (event: MessageEvent<{ statuses: Record<string, boolean> }>) => {
      setStatuses(prev => ({ ...prev, ...event.data.statuses }));
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [activeHandleId]);

  // 2. Внутренний метод для вещания (приватный)
  const broadcast = useCallback((newStatuses: Record<string, boolean>) => {
    channelRef.current?.postMessage({ statuses: newStatuses });
  }, []);

  const bulkUpdateOnlineStatus = useCallback(
    (newStatuses: Record<string, boolean>) => {
      // Обновляем локально
      setStatuses(prev => ({ ...prev, ...newStatuses }));
      // Вещаем остальным вкладкам (одна вкладка обновила - остальные подхватили)
      broadcast(newStatuses);
    },
    [broadcast]
  );

  const updateOnlineStatus = useCallback(
    (handleId: string, isOnline: boolean) => {
      const newStatus = { [handleId]: isOnline };
      setStatuses(prev => ({ ...prev, ...newStatus }));
      broadcast(newStatus);
    },
    [broadcast]
  );

  const getOnlineStatus = useCallback(
    (handleId: string | undefined): boolean => {
      if (!handleId) return false;
      return statuses[handleId] || false;
    },
    [statuses]
  );

  const clearStatuses = useCallback(() => {
    setStatuses({});
  }, []);

  const value = {
    getOnlineStatus,
    updateOnlineStatus,
    bulkUpdateOnlineStatus,
    clearStatuses,
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
