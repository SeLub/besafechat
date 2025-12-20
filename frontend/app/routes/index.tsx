import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { LeftColumn } from '@/components/left-column';
import { MiddleColumn } from '@/components/middle-column';
import { RightPanel } from '@/components/right-panel';
import { NewChatModal } from '@/components/new-chat-modal';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/hooks/use-auth';
import { useChats } from '@/hooks/use-chats';
import { useWebSocketNotifications } from '@/hooks/use-websocket-notifications';
import { saveMessage, loadMessages } from '@/lib/db/message-storage';
import { cleanupOldMessages } from '@/lib/db/cleanup';

function ChatRouteContent() {
  const [messages, setMessages] = useState<
    { id: string; text: string; isOwn?: boolean; fromUserId?: string }[]
  >([]);
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>();
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [leftPanelPage, setLeftPanelPage] = useState<'profile' | 'settings' | 'contacts' | null>(
    null
  );
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const { chats, addChat, updateChatLastMessage, updateChatOnlineStatus, getChatById } = useChats();

  const handleSendMessage = async (message: string) => {
    if (!socketRef.current || !selectedChatId || !user) return;

    const selectedChat = getChatById(selectedChatId);
    const recipientId = selectedChat?.userId || selectedChat?.id || selectedChatId;

    // Encode Unicode to base64
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);
    const base64Message = btoa(String.fromCharCode(...messageBytes));

    const timestamp = new Date().toISOString();

    socketRef.current.emit('message', {
      to: recipientId,
      type: 'text',
      encryptedContent: base64Message,
      encryptedKey: 'dummy_key',
      timestamp,
    });

    const messageId = `${user.id}_${Date.now()}`;
    const newMessage = {
      id: messageId,
      text: message,
      isOwn: true,
    };

    setMessages(prev => [...prev, newMessage]);

    // Save sent message immediately using recipientId as chatId
    console.log('💾 Saving sent message with recipientId:', recipientId);
    await saveMessage(recipientId, user.id, message, true, messageId);

    // Update chat last message
    updateChatLastMessage(selectedChatId, `You: ${message}`);
  };

  const handleChatSelect = async (chatId: string) => {
    setSelectedChatId(chatId);
    setRightPanelOpen(false);

    // Save to localStorage for persistence
    localStorage.setItem('selectedChatId', chatId);

    // Get chat to find userId
    const chat = getChatById(chatId);
    // Always use userId as the key
    const loadKey = chat?.userId || (chatId.startsWith('chat_') ? chatId.substring(5) : chatId);

    console.log('📚 Loading messages for userId:', loadKey);
    // Load messages from IndexedDB
    const loadedMessages = await loadMessages(loadKey);
    console.log('📚 Loaded', loadedMessages.length, 'messages');
    setMessages(loadedMessages);
  };

  const handleNewChat = () => {
    setNewChatModalOpen(true);
  };

  const handleChatCreated = useCallback(
    async (chatId: string) => {
      try {
        // Load chat info from backend
        const res = await fetch(`http://localhost:4000/chats/${chatId}`, {
          credentials: 'include',
        });

        if (res.ok) {
          const chatData = await res.json();
          // Find the other user in the chat
          const otherMember = chatData.members?.find((m: any) => m.userId !== user?.id);

          const newChatId = addChat({
            id: chatId,
            name:
              otherMember?.user?.displayName ||
              `@${otherMember?.user?.username?.username}` ||
              'Unknown User',
            publicKey: otherMember?.user?.publicKey,
            userId: otherMember?.user?.id,
          });
          setSelectedChatId(newChatId);
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
    [user?.id, addChat, setSelectedChatId, setNewChatModalOpen]
  );

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const handleMessageReceived = useCallback(
    async (message: any) => {
      const selectedChat = chatsRef.current.find(c => c.id === selectedChatId);

      // Check if message is for currently selected chat (by userId or chatId)
      const isSelectedChat =
        selectedChat &&
        (selectedChat.userId === message.fromUserId ||
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

      // Always save to IndexedDB using senderId as chatId (to match sent messages)
      if (message.fromUserId) {
        console.log('💾 Saving received message with senderId:', message.fromUserId);
        await saveMessage(message.fromUserId, message.fromUserId, message.text, false, message.id);
      }
    },
    [selectedChatId]
  );

  const handleUserOnline = useCallback(
    (userId: string) => {
      updateChatOnlineStatus(userId, true);
    },
    [updateChatOnlineStatus]
  );

  const handleUserOffline = useCallback(
    (userId: string) => {
      updateChatOnlineStatus(userId, false);
    },
    [updateChatOnlineStatus]
  );

  // Enable WebSocket notifications and messaging
  useWebSocketNotifications(
    handleChatCreated,
    handleMessageReceived,
    handleUserOnline,
    handleUserOffline
  );

  // Get socket reference for sending messages
  useEffect(() => {
    if (user && window.socketInstance) {
      socketRef.current = window.socketInstance;
    }
  }, [user]);

  // Cleanup old messages on app start
  useEffect(() => {
    cleanupOldMessages();
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
  }, [chats.length]);

  const handleProfileClick = () => {
    setLeftPanelPage('profile');
  };

  const handleContactsClick = () => {
    setLeftPanelPage('contacts');
  };

  const handleSettingsClick = () => {
    setLeftPanelPage('settings');
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
