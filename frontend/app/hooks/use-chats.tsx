import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';

interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
  isOnline?: boolean;
  phone?: string;
  username?: string;
  publicKey?: string;
  handleId?: string;
}

export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Mock data for now - will be replaced with real API calls
  const mockChats: Chat[] = [
    // {
    //   id: "6d36bdb6-8651-4d72-94f4-3c9aa13f489d",
    //   name: "John Doe",
    //   lastMessage: "Hello there!",
    //   timestamp: "12:30",
    //   unreadCount: 3,
    //   isOnline: true,
    //   phone: "+1 234 567 8900",
    //   username: "johndoe",
    //   publicKey: "fxhKP0trJd8XJR3IPTVOmA+BFXpFgWtJDRLC8LOZnMI=",
    // },
    // {
    //   id: "saved-messages",
    //   name: "Saved Messages",
    //   lastMessage: "You: Test message",
    //   timestamp: "11:45",
    //   isOnline: false,
    // },
  ];

  useEffect(() => {
    if (user) {
      loadChatsFromBackend();
    }
  }, [user]);
  const loadChatsFromBackend = async () => {
    try {
      // Load actual chats from the chats API
      const chatsRes = await fetch('http://localhost:4000/chats', {
        credentials: 'include',
      });

      let chatData = [];
      if (chatsRes.ok) {
        const chatsJson = await chatsRes.json();
        chatData = chatsJson.chats || chatsJson; // Handle different response formats

        // Transform chat data to our Chat interface
        const actualChats = chatData.map((chat: any) => {
          // Get the first other member (in private chats there's typically one other person)
          const otherMember = chat.otherMembers?.[0];

          return {
            id: chat.id, // Use actual chat ID
            name:
              otherMember?.user?.displayName || `@${otherMember?.user?.handle}` || 'Unknown User',
            handleId: otherMember?.handleId, // Use handleId of the other user
            publicKey: otherMember?.user?.publicKey,
            isOnline: false,
          };
        });
        setChats([...mockChats, ...actualChats]);
      } else {
        // Fallback to mock chats only
        setChats(mockChats);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      setChats(mockChats);
    } finally {
      setLoading(false);
    }
  };
  // Load online statuses after chats are loaded
  useEffect(() => {
    if (chats.length > 0) {
      loadOnlineStatuses();

      // Set up periodic refresh of online statuses every 30 seconds
      const interval = setInterval(() => {
        loadOnlineStatuses();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [chats.length]);

  const addChat = (newChat: Partial<Chat>) => {
    const chat: Chat = {
      id: newChat.id || newChat.publicKey || Date.now().toString(),
      name: newChat.name || newChat.username || 'Unknown User',
      lastMessage: undefined,
      timestamp: undefined,
      unreadCount: 0,
      isOnline: false,
      ...newChat,
    };

    setChats(prev => {
      // Check if chat already exists by handleId or publicKey
      const exists = prev.find(
        c =>
          (c.handleId && c.handleId === chat.handleId) ||
          (c.publicKey && c.publicKey === chat.publicKey)
      );
      if (exists) return prev;

      return [chat, ...prev];
    });

    return chat.id;
  };

  const updateChatLastMessage = (chatId: string, message: string) => {
    setChats(prev =>
      prev.map(chat =>
        chat.id === chatId
          ? {
              ...chat,
              lastMessage: message,
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            }
          : chat
      )
    );
  };

  const updateChatOnlineStatus = (handleId: string, isOnline: boolean) => {
    setChats(prev => prev.map(chat => (chat.handleId === handleId ? { ...chat, isOnline } : chat)));
  };

  const loadOnlineStatuses = async () => {
    const handleIds = chats.map(chat => chat.handleId).filter(Boolean);
    if (handleIds.length === 0) return;

    try {
      const res = await fetch('http://localhost:4000/contacts/bulk-online-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userIds: handleIds }),
      });

      if (res.ok) {
        const { statuses } = await res.json();
        setChats(prev =>
          prev.map(chat => ({
            ...chat,
            isOnline: chat.handleId ? statuses[chat.handleId] || false : false,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load online statuses:', error);
    }
  };

  const getChatById = (chatId: string) => {
    return chats.find(chat => chat.id === chatId);
  };

  return {
    chats,
    loading,
    addChat,
    updateChatLastMessage,
    updateChatOnlineStatus,
    loadOnlineStatuses,
    getChatById,
  };
}
