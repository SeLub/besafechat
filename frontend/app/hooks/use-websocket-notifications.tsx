import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuth } from './use-auth-context';
import { useContactRequests } from './use-contact-requests';
import { API_ENDPOINTS } from '@/services/api-gateway';

export function useWebSocketNotifications(
  onChatCreated?: (chatId: string) => void,
  onMessageReceived?: (message: any) => void,
  onUserOnline?: (handleId: string) => void,
  onUserOffline?: (handleId: string) => void,
  onOnlineStatusChange?: (handleId: string, isOnline: boolean) => void
) {
  const { user } = useAuth();
  const { incrementAccepted } = useContactRequests();

  const callbacksRef = useRef({
    onChatCreated,
    onMessageReceived,
    onUserOnline,
    onUserOffline,
    onOnlineStatusChange,
  });

  useEffect(() => {
    callbacksRef.current = {
      onChatCreated,
      onMessageReceived,
      onUserOnline,
      onUserOffline,
      onOnlineStatusChange,
    };
  });

  useEffect(() => {
    if (!user) return;

    const socket: Socket = io(API_ENDPOINTS.WEBSOCKET.MESSAGES, {
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Store socket globally for message sending
    window.socketInstance = socket;

    // Contact request received - toast notification only
    // Actual modal handling is in use-contact-requests-sync
    socket.on('contact_request_received', data => {
      const { fromHandle } = data;
      const displayName = fromHandle?.displayName || `@${fromHandle?.value}` || 'Someone';
      console.log('🔔 contact_request_received - toast feedback:', data);
      toast.info(`New contact request from ${displayName}`);
    });

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
      socket.disconnect();
      window.socketInstance = null;
    };
  }, [user, incrementAccepted]);
}
