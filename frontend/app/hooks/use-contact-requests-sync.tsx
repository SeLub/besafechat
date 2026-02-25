// /home/selub/Documents/progs/besafechat/frontend/app/hooks/use-contact-requests-sync.tsx
import { useEffect } from 'react';
import { useContactRequestsStore } from './contact-requests-store-context';

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

/**
 * Hook для WebSocket синхронизации контактных запросов и контактов
 * Слушает события и обновляет глобальное состояние через useContactRequestsStore
 */
export function useContactRequestsSync() {
  const {
    addIncomingRequest,
    removeIncomingRequest,
    removeOutgoingRequest,
    addContact,
    removeContact,
  } = useContactRequestsStore();

  useEffect(() => {
    if (!window.socketInstance) {
      return;
    }

    const socket = window.socketInstance;
    console.log('📡 Setting up contact requests sync');

    // Handle incoming contact request
    const handleContactRequestReceived = (data: ContactRequestData) => {
      console.log('📨 contact_request_received - adding to pending:', data);
      addIncomingRequest({
        id: data.requestId,
        from: data.fromHandle,
        to: { handleId: '' },
        message: data.message,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });

      // Also add to contacts with avatar from the request
      addContact({
        id: data.fromHandle.id,
        user: {
          id: data.fromHandle.id,
          displayName: data.fromHandle.displayName,
          handle: data.fromHandle.value,
          avatarUrl: data.fromHandle.avatarUrl,
        },
        acceptedAt: new Date().toISOString(),
      });
    };

    // Handle contact accepted (unified event)
    const handleContactAccepted = (data: { otherHandle: any; chatId?: string }) => {
      console.log('✅ contact_accepted - adding contact:', data.otherHandle);
      removeOutgoingRequest(data.otherHandle.id);
      addContact({
        id: data.otherHandle.id,
        user: {
          id: data.otherHandle.id,
          displayName: data.otherHandle.displayName,
          handle: data.otherHandle.handle,
          avatarUrl: data.otherHandle.avatarUrl,
          firstName: data.otherHandle.firstName,
          lastName: data.otherHandle.lastName,
          bio: data.otherHandle.bio,
        },
        acceptedAt: new Date().toISOString(),
      });
    };

    // Handle request rejected
    const handleRequestRejected = (data: { byHandle: any }) => {
      console.log('❌ contact_request_rejected - removing from outgoing:', data.byHandle);
      removeOutgoingRequest(data.byHandle.id);
      // Also remove from contacts since request was rejected
      removeContact(data.byHandle.id);
    };

    // Handle new chat available (we accepted their request)
    const handleNewChatAvailable = (data: { fromHandle: any; chatId?: string }) => {
      console.log(
        '💬 new_chat_available - removing from pending and adding to contacts:',
        data.fromHandle
      );
      removeIncomingRequest(data.fromHandle.id);
      addContact({
        id: data.fromHandle.id,
        user: {
          id: data.fromHandle.id,
          displayName: data.fromHandle.displayName,
          handle: data.fromHandle.handle,
          avatarUrl: data.fromHandle.avatarUrl,
          firstName: data.fromHandle.firstName,
          lastName: data.fromHandle.lastName,
          bio: data.fromHandle.bio,
        },
        acceptedAt: new Date().toISOString(),
      });
    };

    // Handle when incoming request is rejected (locally, not from WebSocket)
    // This is handled in contacts-page.tsx by calling removeIncomingRequest directly
    // But we also remove the contact since they're not connected
    const handleIncomingRequestRejected = (contactId: string) => {
      console.log('⛔ Incoming request rejected - removing contact:', contactId);
      removeContact(contactId);
    };

    socket.on('contact_request_received', handleContactRequestReceived);
    socket.on('contact_accepted', handleContactAccepted);
    socket.on('contact_request_rejected', handleRequestRejected);
    socket.on('new_chat_available', handleNewChatAvailable);

    return () => {
      console.log('🔌 Cleaning up contact requests sync');
      socket.off('contact_request_received', handleContactRequestReceived);
      socket.off('contact_accepted', handleContactAccepted);
      socket.off('contact_request_rejected', handleRequestRejected);
      socket.off('new_chat_available', handleNewChatAvailable);
    };
  }, [addIncomingRequest, removeIncomingRequest, removeOutgoingRequest, addContact, removeContact]);
}
