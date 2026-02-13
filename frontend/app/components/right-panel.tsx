import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { X, Phone, Video, Search, Bell, Shield, Trash2, Archive, Volume2 } from 'lucide-react';
import { useOnlineStatusContext } from '@/hooks/use-online-status-context';

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  chatInfo?: {
    id: string;
    name: string;
    isOnline?: boolean;
    lastSeen?: string;
    phone?: string;
    username?: string;
    handleId?: string;
    avatarUrl?: string;
    bio?: string;
    firstName?: string;
    lastName?: string;
    alias?: string;
  };
}

export function RightPanel({ isOpen, onClose, chatInfo }: RightPanelProps) {
  const { getOnlineStatus } = useOnlineStatusContext();
  if (!isOpen || !chatInfo) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDisplayName = () => {
    if (chatInfo.firstName || chatInfo.lastName) {
      return [chatInfo.firstName, chatInfo.lastName].filter(Boolean).join(' ');
    }
    return chatInfo.name;
  };

  return (
    <div className="w-80 border-l border-primary/5 bg-card/50 backdrop-blur-2xl flex flex-col animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-5">
        <h3 className="font-black uppercase tracking-widest text-[10px] text-muted-foreground">
          Identity Profile
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full hover:bg-primary/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-6 py-8 text-center">
        <div className="relative inline-block mb-4">
          <Avatar className="h-24 w-24 border-4 border-background shadow-xl">
            <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white text-2xl font-black">
              {getInitials(chatInfo.name)}
            </AvatarFallback>
            {chatInfo.avatarUrl && <AvatarImage src={chatInfo.avatarUrl} />}
          </Avatar>
          {getOnlineStatus(chatInfo.handleId) && (
            <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-background rounded-full" />
          )}
        </div>

        <h2 className="text-xl font-black text-foreground">{getDisplayName()}</h2>
        <p className="text-sm font-bold text-primary/60 mb-6 italic">
          @{chatInfo.alias || chatInfo.username || 'identity'}
        </p>

        <div className="grid grid-cols-3 gap-2">
          <ActionButton icon={<Phone size={18} />} label="Audio" />
          <ActionButton icon={<Video size={18} />} label="Video" />
          <ActionButton icon={<Search size={18} />} label="Find" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        {/* Карточки информации вместо просто списка */}
        <InfoCard label="Bio" value={chatInfo.bio || 'No bio set in the Sky'} />
        <InfoCard label="Handle ID" value={chatInfo.handleId} isMono />

        <div className="pt-4 px-2 space-y-4">
          <div className="flex items-center justify-between text-sm font-bold text-foreground/70">
            <span>Notifications</span>
            <Switch className="data-[state=checked]:bg-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Вспомогательные мини-компоненты для чистоты
const ActionButton = ({ icon, label }: { icon: any; label: string }) => (
  <button className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-primary/5 transition-colors group">
    <div className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</div>
    <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground/50">
      {label}
    </span>
  </button>
);

const InfoCard = ({
  label,
  value,
  isMono,
}: {
  label: string;
  value?: string;
  isMono?: boolean;
}) => (
  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/5">
    <div className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-1">
      {label}
    </div>
    <div
      className={`text-sm font-medium text-foreground ${isMono ? 'font-mono text-[11px] break-all' : ''}`}
    >
      {value}
    </div>
  </div>
);
