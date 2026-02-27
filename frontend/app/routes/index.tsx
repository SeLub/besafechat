import { AuthGuard } from '@/components/auth-guard';
import { ContactRequestModal } from '@/components/contact-request-modal';
import { type ContactRequest } from '@/types/api';
import { HandleProfilesPanel } from '@/components/handle-profiles-panel';
import { LeftColumn } from '@/components/left-column';
import { MiddleColumn } from '@/components/middle-column';
import { NewChatModal } from '@/components/new-chat-modal';
import { RightPanel } from '@/components/right-panel';
import { useAuth } from '@/hooks/use-auth-context';
import { useChats } from '@/hooks/use-chats';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useOnlineStatusContext } from '@/hooks/use-online-status-context';
import { useWebSocketNotifications } from '@/hooks/use-websocket-notifications';
import { useContactRequestsSync } from '@/hooks/use-contact-requests-sync';
import {
  ContactRequestsStoreProvider,
  useContactRequestsStore,
} from '@/hooks/contact-requests-store-context';
import { API_ENDPOINTS } from '@/services/api-gateway';
import { StorageService } from '@/services/storage.service';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { toast } from 'sonner';

function ChatRouteContent() {
  const [messages, setMessages] = useState<
    { id: string; text: string; isOwn?: boolean; fromHandleId?: string }[]
  >([]);
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>();
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [leftPanelPage, setLeftPanelPage] = useState<
    'profile' | 'settings' | 'contacts' | 'notifications' | null
  >(null);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [contactRequestModal, setContactRequestModal] = useState<{
    isOpen: boolean;
    request: ContactRequest | null;
  }>({ isOpen: false, request: null });
  const [requestActionLoading, setRequestActionLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'chats' | 'chat'>('chats'); // For mobile
  const [handleProfilesOpen, setHandleProfilesOpen] = useState(false);
  const [shownRequestIds, setShownRequestIds] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const { isMobile } = useMediaQuery(); // Add media query hook
  const { user } = useAuth();
  const {
    chats,
    addChat,
    updateChatLastMessage,
    updateChatOnlineStatus,
    getChatById,
    reloadChats,
  } = useChats();
  const { updateOnlineStatus: updateContextOnlineStatus } = useOnlineStatusContext();
  const contactStore = useContactRequestsStore();
  const { addContact } = contactStore;

  // Debug helper - expose store to window for console access
  useEffect(() => {
    (window as any).__debugContactStore = {
      contacts: contactStore.contacts,
      incomingRequests: contactStore.incomingRequests,
      outgoingRequests: contactStore.outgoingRequests,
      chats: chats,
    };
  }, [contactStore, chats]);

  const handleSendMessage = async (message: string) => {
    const socket = socketRef.current || window.socketInstance;
    if (!socket || !socket.connected || !selectedChatId || !user) {
      console.error('❌ Cannot send message: socket not connected or missing data', {
        hasSocket: !!socket,
        isConnected: socket?.connected,
        hasChatId: !!selectedChatId,
        hasUser: !!user,
      });
      return;
    }

    const selectedChat = getChatById(selectedChatId);
    const recipientHandleId = selectedChat?.handleId; // This should be the handleId of the recipient for sending

    // Use actual chat ID for storage, ensuring we have a proper chat ID
    let chatStorageId = selectedChat?.id;
    if (!chatStorageId) {
      // If selectedChat.id is not available, try to extract it from selectedChatId if it starts with 'chat_'
      if (selectedChatId && selectedChatId.startsWith('chat_')) {
        chatStorageId = selectedChatId.substring(5); // Remove 'chat_' prefix to get the actual chat ID
      } else {
        // If we still don't have a proper chat ID, use selectedChatId as fallback
        chatStorageId = selectedChatId;
      }
    }

    // Encode Unicode to base64
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);
    const base64Message = btoa(String.fromCharCode(...messageBytes));

    const timestamp = new Date().toISOString();

    socket.emit('message', {
      to: recipientHandleId,
      type: 'text',
      encryptedContent: base64Message,
      encryptedKey: 'dummy_key',
      timestamp,
    });

    // Generate message ID using handle ID
    const senderIdForMessage = user.handle.id;
    const messageId = `${senderIdForMessage}_${Date.now()}`;
    const newMessage = {
      id: messageId,
      text: message,
      isOwn: true,
    };

    setMessages(prev => [...prev, newMessage]);

    // Save sent message immediately using chatStorageId as chatId (not recipientHandleId)
    if (!chatStorageId) {
      console.error('❌ Cannot save message: no chat ID available');
      return;
    }

    console.log(
      '💾 Saving sent message with chatStorageId:',
      chatStorageId,
      'recipientHandleId:',
      recipientHandleId
    );
    await StorageService.saveEncryptedMessage(
      chatStorageId,
      senderIdForMessage, // Use handle ID if available
      message,
      user.handle.id, // Use handle ID for encryption instead of identity ID
      true,
      undefined, // messageId
      user.identity.id // ← identityId из контекста
    );

    // Update chat last message
    updateChatLastMessage(selectedChatId, `You: ${message}`);
  };

  const handleChatSelect = useCallback(
    async (chatIdOrHandleId: string) => {
      // If it looks like a handleId (UUID format), find the chat by handleId
      const chat = getChatById(chatIdOrHandleId);
      const actualChatId = chat?.id || chatIdOrHandleId;

      // Try to find by handleId if direct lookup fails
      let targetChat = chat;
      if (!targetChat) {
        targetChat = chats.find(c => c.handleId === chatIdOrHandleId);
      }

      const finalChatId = targetChat?.id || actualChatId;

      // If clicking the same chat that's already loading/loaded, allow reload
      // This handles the case where user goes back and clicks the same chat again
      setSelectedChatId(finalChatId);
      setRightPanelOpen(false);

      // On mobile, switch to chat view
      if (isMobile) {
        setCurrentView('chat');
      }

      // Save to localStorage for persistence
      localStorage.setItem('selectedChatId', finalChatId);

      // Get chat to find userId
      // Use chat ID as the key for loading messages (not userId)
      const loadKey =
        targetChat?.id ||
        (finalChatId.startsWith('chat_') ? finalChatId.substring(5) : finalChatId);

      console.log('📚 Loading messages for chatId:', loadKey);
      if (!loadKey) {
        console.error('❌ Cannot load messages: no chat ID available');
        setMessages([]);
        return;
      }
      // Load messages from IndexedDB
      const loadedMessages = user
        ? await StorageService.loadDecryptedMessages(loadKey, user.handle.id, user.identity.id)
        : [];
      console.log('📚 Loaded', loadedMessages.length, 'messages');
      setMessages(loadedMessages);
    },
    [setSelectedChatId, setRightPanelOpen, getChatById, setMessages, user, isMobile, chats]
  );

  const handleNewChat = () => {
    setNewChatModalOpen(true);
  };

  // 🔁 Keep chatsRef synced with latest chats array
  // This allows handleMessageReceived to access fresh chats
  // WITHOUT adding 'chats' to useCallback dependencies (prevents WebSocket re-subscription)
  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const handleMessageReceived = useCallback(
    async (message: any) => {
      // Skip processing if this is our own message (sender should not receive their own messages)
      const currentUserHandleId = user?.handle?.id || user?.identity.id;
      if (message.fromUserId === currentUserHandleId) {
        console.log('🚫 Skipping own message:', message.id);
        return;
      }

      const selectedChat = chatsRef.current.find(c => c.id === selectedChatId);

      // Check if message is for currently selected chat (by handleId or chatId)
      const isSelectedChat =
        selectedChat &&
        (selectedChat.handleId === message.fromHandleId ||
          message.chatId === selectedChatId ||
          message.chatId === selectedChatId?.replace('chat_', ''));

      if (isSelectedChat) {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
      }

      // Always save to IndexedDB using chatId (not senderId) as chatId
      if (message.chatId && user?.identity?.id) {
        console.log('💾 Saving received message with chatId:', message.chatId);
        try {
          // Generate a fallback ID if the message doesn't have one
          const messageId = message.id || `received_${message.fromHandleId}_${Date.now()}`;

          await StorageService.saveEncryptedMessage(
            message.chatId, // Use actual chat ID for storage
            message.fromHandleId,
            message.text,
            user.handle.id,
            false,
            messageId,
            user.identity.id // ← identityId из контекста
          );
        } catch (error) {
          console.error('❌ Error saving received message:', error);
        }
      } else {
        console.warn('⚠️ Received message without chatId or identity ID, skipping storage');
      }
    },
    [selectedChatId, user]
  );

  // Deprecated: Use handleOnlineStatusChange instead
  const handleUserOnline = useCallback(() => {
    // No-op: replaced by handleOnlineStatusChange
  }, []);

  // Deprecated: Use handleOnlineStatusChange instead
  const handleUserOffline = useCallback(() => {
    // No-op: replaced by handleOnlineStatusChange
  }, []);

  const handleOnlineStatusChange = useCallback(
    (handleId: string, isOnline: boolean) => {
      updateChatOnlineStatus(handleId, isOnline);
      updateContextOnlineStatus(handleId, isOnline);
    },
    [updateChatOnlineStatus, updateContextOnlineStatus]
  );

  const handleAcceptRequest = async (request: ContactRequest) => {
    setRequestActionLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONTACTS.REQUESTS_ACCEPT(request.id), {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const result = await res.json();
        setContactRequestModal({ isOpen: false, request: null });
        toast.success('Request accepted');

        // Use data from API response - it has the authoritative contact info
        const fromHandle = result.fromHandle;
        const { chatId } = result;

        console.log('📡 Accept response:', result);
        console.log('fromHandle:', fromHandle);

        if (!fromHandle || !chatId) {
          toast.error('Invalid response from server');
          return;
        }

        // Add contact to store with data from accept response
        const contactData = {
          id: fromHandle.id,
          user: {
            id: fromHandle.id,
            displayName: fromHandle.displayName,
            handle: fromHandle.value,
            avatarUrl: fromHandle.avatarUrl,
            firstName: fromHandle.firstName,
            lastName: fromHandle.lastName,
            bio: fromHandle.bio,
          },
          acceptedAt: new Date().toISOString(),
        };
        addContact(contactData);

        // Add chat with contact data from accept response
        const displayName =
          fromHandle.firstName && fromHandle.lastName
            ? `${fromHandle.firstName} ${fromHandle.lastName}`
            : fromHandle.displayName || `@${fromHandle.value}`;

        const newChatId = addChat({
          id: chatId,
          name: displayName,
          publicKey: undefined,
          handleId: fromHandle.id,
          avatarUrl: fromHandle.avatarUrl,
          bio: fromHandle.bio,
          firstName: fromHandle.firstName,
          lastName: fromHandle.lastName,
          username: fromHandle.value,
          alias: fromHandle.alias,
        });

        setSelectedChatId(newChatId);
        if (isMobile) {
          setCurrentView('chat');
        }

        // Reload chats from backend in the background to ensure consistency
        // Do NOT await this - let it happen asynchronously
        reloadChats().catch(err => console.error('Error reloading chats:', err));
      } else {
        toast.error('Failed to accept request');
      }
    } catch {
      toast.error('Failed to accept request');
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleRejectRequest = async (request: ContactRequest) => {
    setRequestActionLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONTACTS.REQUESTS_REJECT(request.id), {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setContactRequestModal({ isOpen: false, request: null });
        toast.success('Request rejected');
      } else {
        toast.error('Failed to reject request');
      }
    } catch {
      toast.error('Failed to reject request');
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleNewChatAvailable = useCallback(
    (data: { fromHandle: any; chatId?: string }) => {
      console.log('💬 [SENDER] handleNewChatAvailable called with:', data);
      console.log('avatarUrl:', data.fromHandle?.avatarUrl);
      console.log('Current chats before add:', chats.length);

      if (!data.chatId) {
        console.warn('⚠️ No chatId in new_chat_available data');
        return;
      }

      // Add chat with contact data for the request sender
      const displayName =
        data.fromHandle.firstName && data.fromHandle.lastName
          ? `${data.fromHandle.firstName} ${data.fromHandle.lastName}`
          : data.fromHandle.displayName || `@${data.fromHandle.handle}`;

      console.log(
        '📍 Adding chat with displayName:',
        displayName,
        'avatarUrl:',
        data.fromHandle.avatarUrl
      );

      const chatId = addChat({
        id: data.chatId,
        name: displayName,
        handleId: data.fromHandle.id,
        avatarUrl: data.fromHandle.avatarUrl,
        bio: data.fromHandle.bio,
        firstName: data.fromHandle.firstName,
        lastName: data.fromHandle.lastName,
        username: data.fromHandle.handle,
        alias: data.fromHandle.alias,
      });

      console.log('✅ Chat added with ID:', chatId);
      console.log('Chats after add:', chats.length);

      // Reload chats from backend in the background to ensure we have the latest state
      // Do NOT await this - let it happen in background to avoid replacing the chat we just added
      reloadChats().catch(err => console.error('Error reloading chats:', err));

      // Auto-select the chat if on mobile
      if (isMobile) {
        setSelectedChatId(chatId);
        setCurrentView('chat');
      }
    },
    [addChat, isMobile, reloadChats, chats]
  );

  // Enable WebSocket notifications and messaging
  // WebSocket now acts as trigger only; all chat data comes from REST API
  useWebSocketNotifications(
    undefined,
    handleMessageReceived,
    handleUserOnline,
    handleUserOffline,
    handleContactRequest,
    handleOnlineStatusChange,
    handleNewChatAvailable
  );

  // Callback for when contact request is accepted
  // Loads chat data from backend and opens it
  const handleChatAccepted = useCallback(
    async (chatId: string, otherHandle: any) => {
      console.log('📞 handleChatAccepted called for chatId:', chatId, 'otherHandle:', otherHandle);

      try {
        // Build display name
        const displayName =
          otherHandle.firstName && otherHandle.lastName
            ? `${otherHandle.firstName} ${otherHandle.lastName}`
            : otherHandle.displayName || `@${otherHandle.handle}`;

        // Add chat to list with data from WebSocket (has chatId and otherHandle)
        const newChatId = addChat({
          id: chatId,
          name: displayName,
          handleId: otherHandle.id,
          avatarUrl: otherHandle.avatarUrl,
          bio: otherHandle.bio,
          firstName: otherHandle.firstName,
          lastName: otherHandle.lastName,
          username: otherHandle.handle,
          alias: otherHandle.alias,
        });

        // Select the chat (open it)
        setSelectedChatId(newChatId);
        console.log('✅ Chat opened:', newChatId);

        // On mobile, switch to chat view
        if (isMobile) {
          setCurrentView('chat');
        }
      } catch (error) {
        console.error('❌ Error handling chat accepted:', error);
      }
    },
    [addChat, isMobile]
  );

  // Callback for incoming contact request
  // Shows modal when request is received (only once per session)
  const handleIncomingRequest = useCallback(
    (data: any) => {
      // Skip if this request was already shown in this session
      if (shownRequestIds.has(data.requestId)) {
        console.log('⏭️ Request already shown in this session, skipping:', data.requestId);
        return;
      }

      console.log('📨 Incoming request received, showing modal:', data);
      const transformedRequest = {
        id: data.requestId,
        from: {
          id: data.fromHandle.id,
          handleId: data.fromHandle.id,
          value: data.fromHandle.value,
          alias: data.fromHandle.alias,
          displayName: data.fromHandle.displayName,
          firstName: data.fromHandle.firstName,
          lastName: data.fromHandle.lastName,
          avatarUrl: data.fromHandle.avatarUrl,
          bio: data.fromHandle.bio,
        },
        message: data.message,
      };
      setContactRequestModal({ isOpen: true, request: transformedRequest });
      // Mark this request as shown
      setShownRequestIds(prev => new Set([...prev, data.requestId]));
    },
    [shownRequestIds]
  );

  // Enable contact requests sync (handles WebSocket events for contact requests)
  useContactRequestsSync({
    onIncomingRequest: handleIncomingRequest,
    onChatAccepted: handleChatAccepted,
  });

  // Cleanup old messages on app start
  useEffect(() => {
    const cleanup = async () => {
      const { isDbInitialized } = await import('@/lib/db/db');
      if (isDbInitialized()) {
        await StorageService.cleanupOldMessagesWithSettings();
      }
    };
    cleanup().catch(err => console.error('Error cleaning up messages:', err));
  }, []);

  // Restore selected chat on page load
  useEffect(() => {
    const savedChatId = localStorage.getItem('selectedChatId');
    if (savedChatId && chats.length > 0) {
      const chatExists = chats.find(c => c.id === savedChatId);
      if (chatExists) {
        handleChatSelect(savedChatId);
      }
    }
  }, [chats.length, chats, handleChatSelect]);

  const handleHandleClick = () => {
    setHandleProfilesOpen(true);
  };

  const handleProfileClick = () => {
    setLeftPanelPage('profile');
  };

  const handleContactsClick = () => {
    setLeftPanelPage('contacts');
  };

  const handleSettingsClick = () => {
    setLeftPanelPage('settings');
  };

  const handleNotificationsClick = () => {
    setLeftPanelPage('notifications');
  };

  const handleBackToChats = () => {
    if (isMobile && currentView === 'chat') {
      // On mobile, if we're viewing a chat, go back to chat list
      setCurrentView('chats');
    } else {
      // Otherwise, just reset the left panel page
      setLeftPanelPage(null);
    }
  };

  const selectedChat = getChatById(selectedChatId || '');

  return (
    <>
      <motion.div
        id="Main"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex h-screen bg-background text-foreground overflow-hidden"
      >
        {/* Left Column - Show on desktop always, on mobile only when showing chats or left panel page */}
        {(!isMobile || currentView === 'chats' || leftPanelPage !== null) && (
          <LeftColumn
            leftPanelPage={leftPanelPage}
            userProfile={user}
            chats={chats}
            selectedChatId={selectedChatId}
            onHandleClick={handleHandleClick}
            onProfileClick={handleProfileClick}
            onContactsClick={handleContactsClick}
            onSettingsClick={handleSettingsClick}
            onNotificationsClick={handleNotificationsClick}
            onBackToChats={handleBackToChats}
            onChatSelect={chatId => {
              handleChatSelect(chatId);
            }}
            onNewChat={handleNewChat}
          />
        )}

        {/* Middle Column - Show on desktop always, on mobile only when viewing a chat */}
        {(!isMobile || currentView === 'chat') && leftPanelPage === null && (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedChatId || 'empty'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex"
            >
              <MiddleColumn
                selectedChat={selectedChat}
                messages={messages}
                rightPanelOpen={rightPanelOpen}
                onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
                onSendMessage={handleSendMessage}
                onBackToChats={() => {
                  if (isMobile) {
                    setCurrentView('chats');
                  }
                }} // Pass the back function to MiddleColumn
              />
            </motion.div>
          </AnimatePresence>
        )}

        {/* Right Panel - Show on desktop always, on mobile as modal when opened */}
        {(!isMobile || rightPanelOpen) && (
          <RightPanel
            isOpen={rightPanelOpen}
            onClose={() => setRightPanelOpen(false)}
            chatInfo={selectedChat}
          />
        )}
      </motion.div>

      {/* Модалки выносим за пределы анимированного контейнера Main,
        чтобы они не дергались при его появлении */}

      <NewChatModal
        isOpen={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        onChatCreated={async () => {
          // Chat will be added through contact accept flow
          setNewChatModalOpen(false);
        }}
      />

      <ContactRequestModal
        isOpen={contactRequestModal.isOpen}
        onClose={() => setContactRequestModal({ isOpen: false, request: null })}
        request={contactRequestModal.request}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
        loading={requestActionLoading}
      />

      <HandleProfilesPanel
        isOpen={handleProfilesOpen}
        // userProfile={user}
        onClose={() => setHandleProfilesOpen(false)}
        layout="modal"
      />
    </>
  );
}

export default function ChatRoute() {
  return (
    <AuthGuard>
      <ContactRequestsStoreProvider>
        <ChatRouteContent />
      </ContactRequestsStoreProvider>
    </AuthGuard>
  );
}
