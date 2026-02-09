import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check } from 'lucide-react';
import { type Notification } from '@/hooks/use-notification-history';

interface NotificationListProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  onBack: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export function NotificationList({
  notifications,
  unreadCount,
  loading,
  onBack,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationListProps) {
  const getNotificationText = (notification: Notification) => {
    const displayName = notification.data.fromHandle?.displayName || 'Someone';

    switch (notification.type) {
      case 'contact_request':
        return `${displayName} wants to connect`;
      case 'contact_accepted':
        return `${displayName} accepted your request`;
      case 'contact_rejected':
        return `${displayName} declined your request`;
      case 'new_chat':
        return `Chat available with ${displayName}`;
      case 'team_invite':
        return `${displayName} invited you to a team`;
      default:
        return 'New notification';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center p-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}>
            <Check className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl mb-2">🔔</div>
              <div>No notifications</div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-accent cursor-pointer ${
                  !notification.read ? 'bg-primary/5' : ''
                }`}
                onClick={() => !notification.read && onMarkAsRead(notification.id)}
              >
                <div className="flex items-start space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(notification.data.fromHandle?.displayName || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{getNotificationText(notification)}</div>
                      {!notification.read && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full ml-2" />
                      )}
                    </div>
                    {notification.data.message && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {notification.data.message}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatTime(notification.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
