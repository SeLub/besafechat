import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/utils';
import { Plus, Search } from 'lucide-react';

interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
  isOnline?: boolean;
  userId?: string;
  avatarUrl?: string;
}

interface ChatListProps {
  chats: Chat[];
  selectedChatId?: string;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
}

export function ChatList({ chats, selectedChatId, onChatSelect, onNewChat }: ChatListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search chats..."
            className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3 border-b border-border">
        <Button onClick={onNewChat} variant="outline" className="w-full justify-start">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <div className="text-center p-8">
              <div className="text-lg font-medium mb-2">No chats yet</div>
              <div className="text-sm">Start a new conversation</div>
            </div>
          </div>
        ) : (
          chats.map(chat => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isSelected={chat.id === selectedChatId}
              onClick={() => onChatSelect(chat.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ChatItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
}

function ChatItem({ chat, isSelected, onClick }: ChatItemProps) {
  return (
    <div
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={`flex items-center p-3 cursor-pointer hover:bg-accent/50 ${
        isSelected ? 'bg-accent' : ''
      }`}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(chat.name)}
          </AvatarFallback>
          {chat.avatarUrl ? (
            <AvatarImage
              src={chat.avatarUrl}
              onError={e => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <AvatarImage src="" style={{ display: 'none' }} />
          )}
        </Avatar>
        {chat.isOnline && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
        )}
      </div>

      <div className="ml-3 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="font-medium truncate">{chat.name}</div>
          {chat.timestamp && (
            <div className="text-xs text-muted-foreground ml-2">{chat.timestamp}</div>
          )}
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="text-sm text-muted-foreground truncate">
            {chat.lastMessage || 'No messages yet'}
          </div>
          {chat.unreadCount && chat.unreadCount > 0 && (
            <div className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
