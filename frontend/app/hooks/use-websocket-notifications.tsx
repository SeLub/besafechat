// /home/selub/Documents/progs/besafechat/frontend/app/hooks/use-websocket-notifications.tsx

import { API_ENDPOINTS } from '@/services/api-gateway';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuth } from './use-auth-context';
import { useContactRequests } from './use-contact-requests';
import { useOnlineStatusContext } from './use-online-status-context';
const CACHE_TTL = 1000 * 60 * 5; // 5 минут жизни кеша

export function useWebSocketNotifications(
  onChatCreated?: (chatId: string) => void,
  onMessageReceived?: (message: any) => void,
  onUserOnline?: (handleId: string) => void,
  onUserOffline?: (handleId: string) => void,
  onOnlineStatusChange?: (handleId: string, isOnline: boolean) => void,
  onNewChatAvailable?: (data: { fromHandle: any; chatId?: string }) => void
) {
  const { user } = useAuth();
  const { incrementAccepted, incrementPending } = useContactRequests();
  const { bulkUpdateOnlineStatus } = useOnlineStatusContext();

  const callbacksRef = useRef({
    onChatCreated,
    onMessageReceived,
    onUserOnline,
    onUserOffline,
    onOnlineStatusChange,
    onNewChatAvailable,
  });

  useEffect(() => {
    callbacksRef.current = {
      onChatCreated,
      onMessageReceived,
      onUserOnline,
      onUserOffline,
      onOnlineStatusChange,
      onNewChatAvailable,
    };
  });

  const getCacheKey = (handleId: string | undefined) =>
    handleId ? `online_status_cache:${handleId}` : 'guest';

  // 1. Инициализация из кэша (чтобы не мигало пустым)
  useEffect(() => {
    if (!user?.handle.id) return;
    const cacheKey = getCacheKey(user.handle.id);
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { statuses, updatedAt } = JSON.parse(cached);
        if (Date.now() - updatedAt < CACHE_TTL) {
          Object.entries(statuses).forEach(([handle, isOnline]) => {
            callbacksRef.current.onOnlineStatusChange?.(handle, isOnline as boolean);
          });
        }
      }
    } catch (e) {
      console.warn('❌ Failed to parse cache, clearing...', e);
      sessionStorage.removeItem(cacheKey);
    }
  }, [user?.handle.id]); // ← Зависимость от handleId

  useEffect(() => {
    if (!user?.handle.id) {
      // Удаляем специфичный кэш пользователя при выходе
      // Если id нет, можно просто очистить всё, что начинается с 'online_status_cache'
      const cacheKey = getCacheKey(user?.handle.id);
      sessionStorage.removeItem(cacheKey);
      return;
    }

    const socket: Socket = io(API_ENDPOINTS.WEBSOCKET.MESSAGES, {
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Store socket globally for message sending
    window.socketInstance = socket;

    // ОБРАБОТЧИК presence_sync
    const handlePresenceSync = (data: {
      statuses: Record<string, boolean>;
      error?: boolean;
      reason?: string;
      duration?: string;
      truncated?: boolean;
    }) => {
      // 🛡️ Проверка на ошибку от backend
      if (data.error) {
        console.warn('⚠️ Presence sync returned error:', data.reason);
        return; // Не применяем пустые статусы при ошибке
      }

      // 📊 Опционально: логирование метрик
      if (data.duration) {
        console.log(`📊 [presence_sync] Backend: ${data.duration}, truncated: ${!!data.truncated}`);
      }

      // 1. Обновляем контекст (основное действие)
      bulkUpdateOnlineStatus(data.statuses);

      // 2. Кэшируем в sessionStorage
      const cacheKey = getCacheKey(user?.handle.id);
      if (cacheKey) {
        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ statuses: data.statuses, updatedAt: Date.now() })
          );
        } catch (e) {
          console.warn('Failed to cache statuses:', e);
        }
      }
    };

    socket.on('presence_sync', handlePresenceSync);

    // Contact accepted - WebSocket trigger (real-time notification)
    // WebSocket is trigger only; actual chat loading handled in use-contact-requests-sync
    socket.on('contact_accepted', data => {
      const { otherHandle } = data;
      const displayName = otherHandle?.displayName || `@${otherHandle?.handle}` || 'Someone';

      console.log('✅ contact_accepted - request was accepted (trigger event):', data);

      toast.success(`${displayName} accepted your request`, {
        description: 'Chat is being loaded...',
      });

      incrementAccepted();
      // Note: Chat will be automatically loaded and opened by use-contact-requests-sync
    });

    // Contact request rejected - WebSocket trigger
    socket.on('contact_request_rejected', data => {
      const { byHandle } = data;
      const displayName = byHandle?.displayName || `@${byHandle?.handle}` || 'Someone';

      console.log('❌ contact_request_rejected - showing notification:', data);
      toast.error(`${displayName} declined your request`);
    });

    // Note: new_chat_available removed
    // Acceptor gets chat data from REST response, not WebSocket
    // Sender gets notification from Redis (persistent)

    // Message received
    socket.on('message:new', (payload: any) => {
      // Decode base64 to Unicode
      const binaryString = atob(payload.encryptedContent);
      const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      const decoder = new TextDecoder();
      const text = decoder.decode(bytes);

      const timestampMs = new Date(payload.timestamp).getTime();
      callbacksRef.current.onMessageReceived?.({
        id: `${payload.from}_${timestampMs}`,
        text,
        fromUserId: payload.from,
        chatId: payload.chatId,
        isOwn: false,
      });
    });

    // Online status events
    socket.on('user_online', (data: { handleId: string }) => {
      callbacksRef.current.onUserOnline?.(data.handleId);
      callbacksRef.current.onOnlineStatusChange?.(data.handleId, true);
    });

    socket.on('user_offline', (data: { handleId: string }) => {
      callbacksRef.current.onUserOffline?.(data.handleId);
      callbacksRef.current.onOnlineStatusChange?.(data.handleId, false);
    });

    // Heartbeat to maintain online status
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 20000); // Every 20 seconds - more frequent to ensure online status stays current

    // Listen for disconnect events to update UI appropriately
    socket.on('disconnect', reason => {
      console.log('WebSocket disconnected:', reason);
      // Optionally notify the UI that connection was lost
    });

    // Listen for reconnection
    socket.on('connect', () => {
      console.log('✅ WebSocket reconnected');
    });

    socket.on('connect_error', error => {
      console.error('❌ WebSocket connection error:', error);
    });

    return () => {
      clearInterval(heartbeatInterval);
      socket.off('contact_request_received');
      socket.off('contact_accepted');
      socket.off('contact_request_rejected');
      socket.off('message:new');
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('disconnect');
      socket.off('connect');
      socket.off('connect_error');
      socket.off('presence_sync', handlePresenceSync);
      socket.disconnect();
      window.socketInstance = null;
    };
  }, [user?.handle.id, incrementAccepted, incrementPending, bulkUpdateOnlineStatus]);
}
