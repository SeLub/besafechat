import { ContactRequestModal } from '@/components/contact-request-modal';
import { AuthGuard } from '@/components/auth-guard';
import { LeftColumn } from '@/components/left-column';
import { MiddleColumn } from '@/components/middle-column';
import { NewChatModal } from '@/components/new-chat-modal';
import { RightPanel } from '@/components/right-panel';
import { useAuth } from '@/hooks/use-auth-context';
import { useChats } from '@/hooks/use-chats';
import { useWebSocketNotifications } from '@/hooks/use-websocket-notifications';
import { useOnlineStatusContext } from '@/hooks/use-online-status-context';
import { StorageService } from '@/services/storage.service';
import { API_ENDPOINTS } from '@/services/api-gateway';
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
    request: any;
  }>({ isOpen: false, request: null });
  const [requestActionLoading, setRequestActionLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const lastLoadedChatRef = useRef<string | undefined>(undefined);
  const { user } = useAuth();
  const {
    chats,
    addChat,
    updateChatLastMessage,
    updateChatOnlineStatus,
    getChatById,
    loadOnlineStatuses,
  } = useChats();
  const { updateOnlineStatus: updateContextOnlineStatus, loadInitialStatuses } =
    useOnlineStatusContext();

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
      messageId
    );

    // Update chat last message
    updateChatLastMessage(selectedChatId, `You: ${message}`);
  };

  const handleChatSelect = useCallback(
    async (chatId: string) => {
      if (lastLoadedChatRef.current === chatId) return; // Prevent reload of same chat
      lastLoadedChatRef.current = chatId;
      setSelectedChatId(chatId);
      setRightPanelOpen(false);

      // Save to localStorage for persistence
      localStorage.setItem('selectedChatId', chatId);

      // Get chat to find userId
      const chat = getChatById(chatId);
      // Use chat ID as the key for loading messages (not userId)
      const loadKey = chat?.id || (chatId.startsWith('chat_') ? chatId.substring(5) : chatId);

      console.log('📚 Loading messages for chatId:', loadKey);
      if (!loadKey) {
        console.error('❌ Cannot load messages: no chat ID available');
        setMessages([]);
        return;
      }
      // Load messages from IndexedDB
      const loadedMessages = user
        ? await StorageService.loadDecryptedMessages(loadKey, user.handle.id)
        : [];
      console.log('📚 Loaded', loadedMessages.length, 'messages');
      setMessages(loadedMessages);
    },
    [setSelectedChatId, setRightPanelOpen, getChatById, setMessages, user]
  );

  const handleNewChat = () => {
    setNewChatModalOpen(true);
  };

  const handleChatCreated = useCallback(
    async (chatId: string) => {
      try {
        // Load chat info from backend
        const res = await fetch(API_ENDPOINTS.CHATS.GET_ONE(chatId), {
          credentials: 'include',
        });

        if (res.ok) {
          const chatData = await res.json();
          // Find the other user in the chat
          const otherMember = chatData.members?.find((m: any) => m.user.id !== user?.identity.id);

          const newChatId = addChat({
            id: chatId,
            name:
              otherMember?.user?.displayName ||
              `@${otherMember?.user?.username?.username}` ||
              'Unknown User',
            publicKey: otherMember?.user?.publicKey,
            handleId: otherMember?.handleId, // Use handleId instead of identityId
          });
          setSelectedChatId(newChatId);

          // Load online status for the newly added chat
          await loadOnlineStatuses();
        } else {
          // Fallback if API fails
          const newChatId = addChat({ id: chatId });
          setSelectedChatId(newChatId);
        }
      } catch (error) {
        // Fallback if API fails
        const newChatId = addChat({ id: chatId });
        setSelectedChatId(newChatId);
        console.log(error);
      }
      setNewChatModalOpen(false);
    },
    [user?.identity.id, addChat, setSelectedChatId, setNewChatModalOpen, loadOnlineStatuses]
  );

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  // Load initial online statuses to context when chats are loaded
  useEffect(() => {
    const handleIds = chats.map(chat => chat.handleId).filter(Boolean) as string[];
    if (handleIds.length > 0) {
      loadInitialStatuses(handleIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats.length, loadInitialStatuses]);

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
      if (message.chatId && user) {
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
            messageId
          );
        } catch (error) {
          console.error('❌ Error saving received message:', error);
        }
      } else {
        console.warn('⚠️ Received message without chatId or user, skipping storage');
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

  const handleContactRequest = useCallback((request: any) => {
    console.log('handleContactRequest called with:', request);
    console.log('request.fromHandle:', request.fromHandle);

    // Transform data to match modal expectations
    const transformedRequest = {
      id: request.requestId,
      from: {
        handleId: request.fromHandle.id,
        value: request.fromHandle.value,
        alias: request.fromHandle.alias,
        displayName: request.fromHandle.displayName,
        firstName: request.fromHandle.firstName,
        lastName: request.fromHandle.lastName,
        avatarUrl: request.fromHandle.avatarUrl,
        bio: request.fromHandle.bio,
      },
      message: request.message,
    };

    console.log('Transformed request:', transformedRequest);
    setContactRequestModal({ isOpen: true, request: transformedRequest });
  }, []);

  const handleOnlineStatusChange = useCallback(
    (handleId: string, isOnline: boolean) => {
      updateChatOnlineStatus(handleId, isOnline);
      updateContextOnlineStatus(handleId, isOnline);
    },
    [updateChatOnlineStatus, updateContextOnlineStatus]
  );

  const handleAcceptRequest = async (requestId: string) => {
    setRequestActionLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONTACTS.REQUESTS_ACCEPT(requestId), {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setContactRequestModal({ isOpen: false, request: null });
        toast.success('Request accepted');
      } else {
        toast.error('Failed to accept request');
      }
    } catch {
      toast.error('Failed to accept request');
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setRequestActionLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.CONTACTS.REQUESTS_REJECT(requestId), {
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

  // Enable WebSocket notifications and messaging
  useWebSocketNotifications(
    handleChatCreated,
    handleMessageReceived,
    handleUserOnline,
    handleUserOffline,
    handleContactRequest,
    handleOnlineStatusChange
  );

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
    setLeftPanelPage(null);
  };

  const selectedChat = getChatById(selectedChatId || '');

  return (
    <div id="Main" className="flex h-screen bg-background text-foreground">
      <LeftColumn
        leftPanelPage={leftPanelPage}
        userProfile={user}
        chats={chats}
        selectedChatId={selectedChatId}
        onProfileClick={handleProfileClick}
        onContactsClick={handleContactsClick}
        onSettingsClick={handleSettingsClick}
        onNotificationsClick={handleNotificationsClick}
        onBackToChats={handleBackToChats}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
        onChatCreated={handleChatCreated}
      />

      <MiddleColumn
        selectedChat={selectedChat}
        messages={messages}
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
        onSendMessage={handleSendMessage}
      />

      {/* Right Panel */}
      <RightPanel
        isOpen={rightPanelOpen}
        onClose={() => setRightPanelOpen(false)}
        chatInfo={selectedChat}
      />

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        onChatCreated={handleChatCreated}
      />

      {/* Contact Request Modal */}
      <ContactRequestModal
        isOpen={contactRequestModal.isOpen}
        onClose={() => setContactRequestModal({ isOpen: false, request: null })}
        request={contactRequestModal.request}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
        loading={requestActionLoading}
      />
    </div>
  );
}

export default function ChatRoute() {
  return (
    <AuthGuard>
      <ChatRouteContent />
    </AuthGuard>
  );
}
