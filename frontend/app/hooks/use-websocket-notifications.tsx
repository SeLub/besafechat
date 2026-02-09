import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuth } from './use-auth-context';
import { useNotifications } from './use-notifications-context';

interface ContactRequestData {
  requestId: string;
  fromHandle: {
    id: string;
    value: string;
    alias: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    bio: string | null;
  };
  message?: string;
}

export function useWebSocketNotifications(
  onChatCreated?: (chatId: string) => void,
  onMessageReceived?: (message: any) => void,
  onUserOnline?: (handleId: string) => void,
  onUserOffline?: (handleId: string) => void,
  onContactRequest?: (request: ContactRequestData) => void
) {
  const { user } = useAuth();
  const { incrementRequests, incrementAccepted } = useNotifications();

  const callbacksRef = useRef({
    onChatCreated,
    onMessageReceived,
    onUserOnline,
    onUserOffline,
    onContactRequest,
  });

  useEffect(() => {
    callbacksRef.current = {
      onChatCreated,
      onMessageReceived,
      onUserOnline,
      onUserOffline,
      onContactRequest,
    };
  });

  useEffect(() => {
    if (!user) return;

    const socket: Socket = io('http://localhost:4000/messages', {
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Store socket globally for message sending
    window.socketInstance = socket;

    // Contact request received
    socket.on('contact_request_received', data => {
      console.log('Contact request received:', data);
      const { requestId, fromHandle, message } = data;

      console.log('Triggering modal with data:', {
        requestId,
        fromHandle,
        message,
      });

      // Trigger modal callback
      callbacksRef.current.onContactRequest?.({
        requestId,
        fromHandle: {
          id: fromHandle.id,
          value: fromHandle.value || fromHandle.handle,
          alias: fromHandle.alias || null,
          displayName: fromHandle.displayName,
          firstName: fromHandle.firstName || null,
          lastName: fromHandle.lastName || null,
          avatarUrl: fromHandle.avatarUrl || null,
          bio: fromHandle.bio || null,
        },
        message,
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
    socket.on('user_online', (data: { handleId: string }) => {
      callbacksRef.current.onUserOnline?.(data.handleId);
    });

    socket.on('user_offline', (data: { handleId: string }) => {
      callbacksRef.current.onUserOffline?.(data.handleId);
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

    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    return () => {
      clearInterval(heartbeatInterval);
      socket.off('contact_request_received');
      socket.off('contact_request_accepted');
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
  }, [user, incrementAccepted, incrementRequests]);
}
