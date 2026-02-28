// /home/selub/Documents/progs/besafechat/frontend/app/components/chat-list.tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/utils';
import { Plus, Search, MessageSquareDashed } from 'lucide-react';
import { useOnlineStatusContext } from '@/hooks/use-online-status-context';

interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
  isOnline?: boolean;
  userId?: string;
  avatarUrl?: string;
  handleId?: string;
}

interface ChatListProps {
  chats: Chat[];
  selectedChatId?: string;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
}

export function ChatList({ chats, selectedChatId, onChatSelect, onNewChat }: ChatListProps) {
  const { getOnlineStatus } = useOnlineStatusContext();

  return (
    <div className="flex flex-col h-full bg-background/50 backdrop-blur-xl">
      {/* Header Area */}
      <div className="p-6 pb-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black italic tracking-tighter text-foreground">
            Messages<span className="text-primary not-italic">.</span>
          </h2>
          <Button
            onClick={onNewChat}
            size="icon"
            className="rounded-2xl h-10 w-10 shadow-lg shadow-primary/20 transition-transform active:scale-90"
          >
            <Plus size={20} strokeWidth={3} />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-11 pr-4 py-3 bg-primary/5 border-transparent border focus:border-primary/10 focus:bg-background rounded-[1.25rem] outline-none transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-none">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full animate-in fade-in duration-700">
            <div className="w-20 h-20 bg-primary/5 rounded-[2.5rem] flex items-center justify-center mb-4 border border-primary/10">
              <MessageSquareDashed className="text-primary/30" size={32} />
            </div>
            <p className="text-sm font-black uppercase tracking-widest text-primary/40">
              Silence is golden
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Are you sure?</p>
            <p className="text-[11px] text-muted-foreground mt-1">Start your first secure chat</p>
          </div>
        ) : (
          chats.map(chat => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isSelected={chat.id === selectedChatId}
              isOnline={getOnlineStatus(chat.handleId)}
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
  isOnline: boolean;
  onClick: () => void;
}

function ChatItem({ chat, isSelected, isOnline, onClick }: ChatItemProps) {
  return (
    <div
      onClick={onClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      role="button"
      tabIndex={0}
      className={`
        group flex items-center p-4 rounded-[1.75rem] cursor-pointer transition-all duration-300 outline-none
        ${
          isSelected
            ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02] z-10'
            : 'hover:bg-primary/5 active:scale-[0.98]'
        }
      `}
    >
      <div className="relative shrink-0">
        <Avatar
          className={`h-12 w-12 transition-transform duration-500 ${isSelected ? 'scale-90 ring-2 ring-white/20' : 'group-hover:scale-105'}`}
        >
          <AvatarFallback
            className={
              isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary font-bold'
            }
          >
            {getInitials(chat.name)}
          </AvatarFallback>
          {chat.avatarUrl && <AvatarImage src={chat.avatarUrl} className="object-cover" />}
        </Avatar>

        {/* Индикатор онлайна с эффектом пульсации */}
        {isOnline && (
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${isSelected ? 'bg-white border-primary' : 'bg-green-500 border-background'}`}
          >
            {!isSelected && (
              <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-40" />
            )}
          </div>
        )}
      </div>

      <div className="ml-4 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div
            className={`font-bold truncate text-[15px] ${isSelected ? 'text-white' : 'text-foreground'}`}
          >
            {chat.name}
          </div>
          {chat.timestamp && (
            <div
              className={`text-[10px] font-medium ml-2 uppercase tracking-tighter ${isSelected ? 'text-white/60' : 'text-muted-foreground'}`}
            >
              {chat.timestamp}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-0.5">
          <div
            className={`text-[13px] truncate font-medium ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}
          >
            {chat.lastMessage || 'No messages yet'}
          </div>

          {chat.unreadCount && chat.unreadCount > 0 && (
            <div
              className={`
              ml-2 flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-black
              ${isSelected ? 'bg-white text-primary' : 'bg-primary text-white'}
            `}
            >
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
