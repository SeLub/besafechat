import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuth } from './use-auth';
import { useNotifications } from './use-notifications';

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
      console.log('Contact request received:', data);
      const { fromHandle, message } = data;
      const displayName = fromHandle.displayName || `@${fromHandle.handle}` || 'Someone';

      toast.success(`${displayName} wants to connect`, {
        description: message || 'New contact request',
      });

      incrementRequests();
    });

    // Contact request accepted
    socket.on('contact_request_accepted', data => {
      const { byHandle, chatId } = data;
      const displayName = byHandle.displayName || `@${byHandle.handle}` || 'Someone';

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
      const { byHandle } = data;
      const displayName = byHandle.displayName || `@${byHandle.handle}` || 'Someone';

      toast.error(`${displayName} declined your request`);
    });

    // New chat available (when user accepts a contact request)
    socket.on('new_chat_available', data => {
      const { fromHandle, chatId } = data;
      const displayName = fromHandle.displayName || `@${fromHandle.handle}` || 'Someone';

      toast.success(`Chat available with ${displayName}`, {
        description: 'You can now start messaging',
      });

      // Handle chat creation/selection
      if (chatId) {
        callbacksRef.current.onChatCreated?.(chatId);
      }
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
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 20000); // Every 20 seconds - more frequent to ensure online status stays current

    // Listen for disconnect events to update UI appropriately
    socket.on('disconnect', reason => {
      console.log('WebSocket disconnected:', reason);
      // Optionally notify the UI that connection was lost
    });

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
