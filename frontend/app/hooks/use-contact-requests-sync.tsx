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

interface UseContactRequestsSyncOptions {
  onIncomingRequest?: (data: ContactRequestData) => void;
  onChatAccepted?: (chatId: string, otherHandle: any) => void;
}

/**
 * Hook для WebSocket синхронизации контактных запросов и контактов
 * Слушает события и обновляет глобальное состояние через useContactRequestsStore
 */
export function useContactRequestsSync(options?: UseContactRequestsSyncOptions) {
  const {
    removeOutgoingRequest,
    removeContact,
  } = useContactRequestsStore();

  useEffect(() => {
    if (!window.socketInstance) {
      return;
    }

    const socket = window.socketInstance;
    console.log('📡 Setting up contact requests sync');

    // Handle incoming contact request
    // Note: incomingRequests now stored locally in contacts-page component
    // Store is responsible for trigger callback only
    const handleContactRequestReceived = (data: ContactRequestData) => {
      console.log('📨 contact_request_received - triggering modal:', data);

      // Notify parent to show modal
      if (options?.onIncomingRequest) {
        options.onIncomingRequest(data);
      }
    };

    // Handle contact accepted (WebSocket trigger only)
    // Contact data comes from REST response, not WebSocket
    const handleContactAccepted = (data: { otherHandle: any; chatId?: string }) => {
      console.log('✅ contact_accepted - removing from outgoing, triggering chat load:', data.otherHandle.id);
      removeOutgoingRequest(data.otherHandle.id);
      // Note: addContact NOT called here - data comes from REST response instead
      // WebSocket is trigger only, not data source

      // Notify parent to load and open chat
      if (data.chatId && options?.onChatAccepted) {
        console.log('📊 Notifying parent to load chat:', data.chatId);
        options.onChatAccepted(data.chatId, data.otherHandle);
      }
    };

    // Handle request rejected
    const handleRequestRejected = (data: { byHandle: any }) => {
      console.log('❌ contact_request_rejected - removing from outgoing:', data.byHandle);
      removeOutgoingRequest(data.byHandle.id);
      // Also remove from contacts since request was rejected
      removeContact(data.byHandle.id);
    };

    // Setup listeners for contact state synchronization
    socket.on('contact_request_received', handleContactRequestReceived);
    socket.on('contact_accepted', handleContactAccepted);
    socket.on('contact_request_rejected', handleRequestRejected);

    return () => {
      console.log('🔌 Cleaning up contact requests sync');
      socket.off('contact_request_received', handleContactRequestReceived);
      socket.off('contact_accepted', handleContactAccepted);
      socket.off('contact_request_rejected', handleRequestRejected);
    };
  }, [removeOutgoingRequest, removeContact, options]);
}
