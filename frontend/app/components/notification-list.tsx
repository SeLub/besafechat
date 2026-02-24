import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check } from 'lucide-react';
import { type Notification } from '@/hooks/use-notifications';
import { formatTime, getInitials } from '~/lib/utils';

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
  if (loading) {
    return (
      <div className="flex flex-col h-full bg-card/30 backdrop-blur-xl">
        <div className="flex items-center p-5">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-3 rounded-2xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-6 w-32 bg-primary/10 animate-pulse rounded-lg" />
        </div>
        <div className="flex-1 flex items-center justify-center text-sm font-bold uppercase tracking-widest text-primary/20">
          Loading Sky...
        </div>
      </div>
    );
  }

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

  return (
    <div className="flex flex-col h-full bg-card/30 backdrop-blur-xl">
      {/* Sky Header */}
      <div className="flex items-center justify-between p-5 mb-2">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="mr-3 rounded-2xl hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="relative">
            <h2 className="text-xl font-black tracking-tight italic">
              Inbox<span className="text-primary not-italic">.</span>
            </h2>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-6 bg-primary text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-lg shadow-primary/30">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllAsRead}
            className="text-[11px] font-black uppercase tracking-wider text-primary hover:bg-primary/10 rounded-xl transition-all"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Clear All
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-6">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-20">
            <div className="text-4xl mb-4">✨</div>
            <div className="text-[11px] font-black uppercase tracking-[0.3em]">Perfectly Clear</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary/40">
              Recent Events
            </div>
            <div className="overflow-hidden rounded-[2.5rem] border border-primary/5 bg-primary/5 shadow-sm">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`relative flex items-start space-x-4 px-5 py-5 transition-all cursor-pointer group border-b border-primary/5 last:border-0 hover:bg-primary/5
                    ${!notification.read ? 'bg-primary/[0.03]' : ''}`}
                  onClick={() => !notification.read && onMarkAsRead(notification.id)}
                  onKeyDown={e =>
                    (e.key === 'Enter' || e.key === ' ') &&
                    !notification.read &&
                    onMarkAsRead(notification.id)
                  }
                  role="button"
                  tabIndex={0}
                >
                  {/* Индикатор непрочитанного в стиле Sky */}
                  {!notification.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[2px_0_10px_rgba(var(--primary),0.5)]" />
                  )}

                  <Avatar className="h-11 w-11 ring-2 ring-background shadow-md shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {getInitials(notification.data.fromHandle?.displayName || 'U')}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div
                        className={`text-sm font-bold truncate transition-colors ${!notification.read ? 'text-foreground' : 'text-foreground/60'}`}
                      >
                        {getNotificationText(notification)}
                      </div>
                      <div className="text-[10px] font-bold text-primary/30 uppercase tracking-tighter whitespace-nowrap ml-2">
                        {formatTime(notification.timestamp)}
                      </div>
                    </div>

                    {notification.data.message && (
                      <div className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 italic mb-1">
                        "{notification.data.message}"
                      </div>
                    )}

                    {!notification.read && (
                      <div className="text-[9px] font-black uppercase tracking-widest text-primary animate-pulse">
                        New
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
