import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  X,
  Phone,
  Video,
  Search,
  Bell,
  BellOff,
  Shield,
  Trash2,
  Archive,
  Volume2,
  VolumeX,
} from 'lucide-react';

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
    avatarUrl?: string;
    bio?: string;
    firstName?: string;
    lastName?: string;
    alias?: string;
  };
}

export function RightPanel({ isOpen, onClose, chatInfo }: RightPanelProps) {
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
    <div
      id="RightColumn-wrapper"
      className={`w-80 border-l border-border bg-background flex flex-col ${isOpen ? 'block' : 'hidden'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold">Profile</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Profile Section */}
      <div className="p-6 text-center border-b border-border">
        <Avatar className="h-20 w-20 mx-auto mb-4">
          <AvatarFallback className="bg-primary text-primary-foreground text-xl">
            {getInitials(chatInfo.name)}
          </AvatarFallback>
          {chatInfo.avatarUrl && (
            <AvatarImage src={chatInfo.avatarUrl} />
          )}
        </Avatar>
        <h2 className="text-xl font-semibold mb-1">{getDisplayName()}</h2>
        <p className="text-sm text-muted-foreground">
          @{chatInfo.alias || chatInfo.username || chatInfo.name}
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          {chatInfo.isOnline ? 'Online' : chatInfo.lastSeen || 'Last seen recently'}
        </p>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          <Button variant="outline" size="icon" className="rounded-full">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-full">
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Info Section */}
      <div className="flex-1 overflow-y-auto">
        {chatInfo.phone && (
          <div className="p-4 border-b border-border">
            <div className="text-sm text-muted-foreground mb-1">Phone</div>
            <div className="font-medium">{chatInfo.phone}</div>
          </div>
        )}

        {chatInfo.bio && (
          <div className="p-4 border-b border-border">
            <div className="text-sm text-muted-foreground mb-1">Bio</div>
            <div className="text-sm">{chatInfo.bio}</div>
          </div>
        )}

        {chatInfo.username && (
          <div className="p-4 border-b border-border">
            <div className="text-sm text-muted-foreground mb-1">Username</div>
            <div className="font-medium">@{chatInfo.username}</div>
          </div>
        )}

        {/* Settings */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span>Notifications</span>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <span>Sound</span>
            </div>
            <Switch defaultChecked />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground">
            <Archive className="h-5 w-5 mr-3" />
            Archive Chat
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground">
            <Shield className="h-5 w-5 mr-3" />
            Block User
          </Button>
          <Button variant="ghost" className="w-full justify-start text-destructive">
            <Trash2 className="h-5 w-5 mr-3" />
            Delete Chat
          </Button>
        </div>
      </div>
    </div>
  );
}
