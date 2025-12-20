import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './use-auth';
import { useNotifications } from './use-notifications';
import { toast } from 'sonner';

interface WebSocketNotificationsProps {
  onChatCreated?: (chatId: string) => void;
  onMessageReceived?: (message: any) => void;
  onUserOnline?: (userId: string) => void;
  onUserOffline?: (userId: string) => void;
}

export function useWebSocketNotifications(
  onChatCreated?: (chatId: string) => void,
  onMessageReceived?: (message: any) => void,
  onUserOnline?: (userId: string) => void,
  onUserOffline?: (userId: string) => void
) {
  const { user } = useAuth();
  const { incrementRequests, incrementAccepted } = useNotifications();

  const callbacksRef = useRef({ onChatCreated, onMessageReceived, onUserOnline, onUserOffline });

  useEffect(() => {
    callbacksRef.current = { onChatCreated, onMessageReceived, onUserOnline, onUserOffline };
  });

  useEffect(() => {
    if (!user) return;

    const socket: Socket = io('http://localhost:4000/messages', {
      withCredentials: true,
    });

    // Store socket globally for message sending
    window.socketInstance = socket;

    // Contact request received
    socket.on('contact_request_received', data => {
      const { fromUser, message } = data;
      const displayName = fromUser.displayName || `@${fromUser.username}` || 'Someone';

      toast.success(`${displayName} wants to connect`, {
        description: message || 'New contact request',
      });

      incrementRequests();
    });

    // Contact request accepted
    socket.on('contact_request_accepted', data => {
      const { byUser, chatId } = data;
      const displayName = byUser.displayName || `@${byUser.username}` || 'Someone';

      toast.success(`${displayName} accepted your request`, {
        description: 'You can now start chatting',
      });

      incrementAccepted();

      // Handle chat creation
      if (chatId) {
        callbacksRef.current.onChatCreated?.(chatId);
      }
    });

    // Contact request rejected
    socket.on('contact_request_rejected', data => {
      const { byUser } = data;
      const displayName = byUser.displayName || `@${byUser.username}` || 'Someone';

      toast.error(`${displayName} declined your request`);
    });

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
    socket.on('user_online', (data: { userId: string }) => {
      callbacksRef.current.onUserOnline?.(data.userId);
    });

    socket.on('user_offline', (data: { userId: string }) => {
      callbacksRef.current.onUserOffline?.(data.userId);
    });

    // Heartbeat to maintain online status
    const heartbeatInterval = setInterval(() => {
      socket.emit('heartbeat');
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(heartbeatInterval);
      socket.off('contact_request_received');
      socket.off('contact_request_accepted');
      socket.off('contact_request_rejected');
      socket.off('message:new');
      socket.off('user_online');
      socket.off('user_offline');
      socket.disconnect();
      window.socketInstance = null;
    };
  }, [user]);
}
