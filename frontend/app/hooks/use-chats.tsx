import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './use-auth-context';
import { API_CONFIG } from '../services/api-config';

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
  avatarUrl?: string;
  bio?: string;
  firstName?: string;
  lastName?: string;
  alias?: string;
}

export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadChatsFromBackend = useCallback(async () => {
    try {
      // Load actual chats from the chats API
      const chatsRes = await fetch(`${API_CONFIG.BASE_URL}/chats`, {
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
            id: chat.id,
            name:
              otherMember?.user?.displayName || `@${otherMember?.user?.handle}` || 'Unknown User',
            handleId: otherMember?.handleId,
            publicKey: otherMember?.user?.publicKey,
            avatarUrl: otherMember?.user?.avatarUrl || undefined,
            bio: otherMember?.user?.bio || undefined,
            firstName: otherMember?.user?.firstName || undefined,
            lastName: otherMember?.user?.lastName || undefined,
            username: otherMember?.user?.handle || undefined,
            alias: otherMember?.user?.alias || undefined,
            isOnline: false,
          };
        });
        setChats(actualChats);
      } else {
        // Fallback to empty array if no chats or API fails
        setChats([]);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []); // Removed user from dependency array

  useEffect(() => {
    if (user) {
      loadChatsFromBackend();
    }
  }, [user, loadChatsFromBackend]);

  const loadOnlineStatuses = useCallback(async () => {
    const handleIds = chats.map(chat => chat.handleId).filter(Boolean);
    if (handleIds.length === 0) return;

    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/contacts/bulk-online-status`, {
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
  }, [chats]); // Add chats as dependency for useCallback

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
  }, [chats.length, loadOnlineStatuses]);

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

  const getChatById = useCallback((chatId: string) => {
    return chats.find(chat => chat.id === chatId);
  }, [chats]);

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