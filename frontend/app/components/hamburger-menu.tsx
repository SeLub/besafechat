import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '~/hooks/use-notifications-context';
import { useNotificationHistory } from '@/hooks/use-notification-history';
import { ChevronRight, Menu, Moon, Settings, Sun, User, Users, Bell, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useAvatarUpdate } from '~/hooks/avatar-update-context';

interface HamburgerMenuProps {
  userProfile?: {
    identity: {
      id: string;
      publicKey: string;
      createdAt: string;
    };
    handle: {
      id: string;
      value: string;
      alias: string | null;
      isSearchable: boolean;
      isPrimary: boolean;
      createdAt: string;
    };
    profile: {
      displayName: string;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
      bio: string | null;
      settings: Record<string, any>;
    };
  };
  onProfileClick?: () => void;
  onContactsClick?: () => void;
  onSettingsClick?: () => void;
  onNotificationsClick?: () => void;
}

export function HamburgerMenu({
  userProfile,
  onProfileClick,
  onContactsClick,
  onSettingsClick,
  onNotificationsClick,
}: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { counts, clearNotifications } = useNotifications();
  const { unreadCount } = useNotificationHistory();
  const { lastAvatarUpdateTimestamp } = useAvatarUpdate();

  const totalNotifications = counts.newRequests + counts.newAccepted;

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const getInitials = (name?: string) => {
    if (!name) {
      const publicKey = userProfile?.identity?.publicKey;
      return publicKey ? publicKey.slice(0, 2).toUpperCase() : 'U';
    }
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="shrink-0 rounded-xl hover:bg-primary/10 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Overlay - более мягкое размытие */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/40 backdrop-blur-sm z-40 transition-opacity cursor-default"
          onClick={() => setIsOpen(false)}
          onKeyDown={e => {
            if (e.key === 'Escape' || e.key === 'Enter') setIsOpen(false);
          }}
          role="button"
          tabIndex={-1} // Оставляем -1, чтобы на сам оверлей нельзя было попасть табом, но события обрабатывались
          aria-label="Close menu"
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full z-50 transform transition-transform duration-500 ease-out 
    bg-card/95 backdrop-blur-2xl border-r border-primary/5
    /* Устанавливаем ширину, которая соответствует твоей LeftColumn */
    w-full md:w-80
    ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
    shadow-[20px_0_40px_rgba(0,0,0,0.1)]`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-5">
            <h2 className="text-xl font-black tracking-tight italic">
              Leteem<span className="text-primary not-italic">.</span>
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="rounded-full"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          {/* User Profile Card */}
          <div className="px-4 py-2">
            <div
              className="p-4 rounded-[2rem] bg-primary/5 border border-primary/5 cursor-pointer hover:bg-primary/10 transition-all group outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              role="button"
              tabIndex={0} // Делаем элемент доступным для фокусировки через Tab
              onClick={() => {
                setIsOpen(false);
                onProfileClick?.();
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault(); // Предотвращаем скролл при нажатии пробела
                  setIsOpen(false);
                  onProfileClick?.();
                }
              }}
            >
              <div className="flex items-center space-x-4">
                <Avatar className="h-12 w-12 ring-2 ring-background shadow-md">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white font-bold">
                    {getInitials(userProfile?.profile?.displayName)}
                  </AvatarFallback>
                  {userProfile?.profile?.avatarUrl && (
                    <AvatarImage
                      src={`${userProfile.profile.avatarUrl}?v=${lastAvatarUpdateTimestamp}`}
                    />
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm truncate group-hover:text-primary transition-colors">
                    {userProfile?.profile?.displayName || 'Traveler'}
                  </div>
                  <div className="text-[10px] font-bold text-primary/40 uppercase tracking-widest truncate">
                    @{userProfile?.handle?.alias || userProfile?.handle?.value || 'id-unknown'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items Grouped */}
          <div className="flex-1 px-4 py-6 space-y-6">
            <div className="space-y-2">
              <div className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary/40">
                Navigation
              </div>
              <div className="overflow-hidden rounded-[2rem] border border-primary/5 bg-primary/5 shadow-sm">
                <MenuItem
                  icon={<User className="h-4 w-4" />}
                  label="My Profile"
                  onClick={() => {
                    setIsOpen(false);
                    onProfileClick?.();
                  }}
                />
                <MenuItem
                  icon={<Bell className="h-4 w-4" />}
                  label="Notifications"
                  badge={unreadCount}
                  onClick={() => {
                    setIsOpen(false);
                    onNotificationsClick?.();
                  }}
                />
                <MenuItem
                  icon={<Users className="h-4 w-4" />}
                  label="Contacts"
                  badge={totalNotifications}
                  onClick={() => {
                    setIsOpen(false);
                    clearNotifications();
                    onContactsClick?.();
                  }}
                />
                <MenuItem
                  icon={<Settings className="h-4 w-4" />}
                  label="Settings"
                  onClick={() => {
                    setIsOpen(false);
                    onSettingsClick?.();
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary/40">
                Preferences
              </div>
              <div className="overflow-hidden rounded-[2rem] border border-primary/5 bg-primary/5 shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 hover:bg-primary/5 transition-colors group">
                  <div className="flex items-center space-x-4">
                    <div className="text-primary/60 group-hover:text-primary transition-transform group-hover:scale-110">
                      {isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    </div>
                    <span className="text-sm font-bold text-foreground/80">Night Mode</span>
                  </div>
                  <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
                </div>
              </div>
            </div>
          </div>

          {/* Footer App Version */}
          <div className="p-6 text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/20">
              Sky Version 1.0.4
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

interface MenuItemProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

function MenuItem({ icon, label, onClick, badge }: MenuItemProps & { badge?: number }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-primary/5 transition-colors group border-b border-primary/5 last:border-0"
    >
      <div className="flex items-center space-x-4">
        <div className="text-primary/60 group-hover:text-primary transition-transform group-hover:scale-110 duration-200">
          {icon}
        </div>
        <span className="text-sm font-bold text-foreground/80 group-hover:text-foreground">
          {label}
        </span>
      </div>

      {badge && badge > 0 ? (
        <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-primary/20">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : (
        <ChevronRight
          size={14}
          className="text-primary/10 group-hover:text-primary/40 transition-colors"
        />
      )}
    </button>
  );
}
