import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '@/hooks/use-notifications';
import { Menu, Moon, Settings, Sun, User, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

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
    hasHandle: boolean;
  };
  onProfileClick?: () => void;
  onContactsClick?: () => void;
  onSettingsClick?: () => void;
}

export function HamburgerMenu({
  userProfile,
  onProfileClick,
  onContactsClick,
  onSettingsClick,
}: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { counts, clearNotifications } = useNotifications();

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
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="shrink-0">
        <Menu className="h-5 w-5" />
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
          onKeyDown={e => {
            if (e.key === 'Escape') setIsOpen(false);
          }}
          role="button"
          tabIndex={-1}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-background border-r border-border z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Menu</h2>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* User Profile Section */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(userProfile?.profile?.displayName)}
                </AvatarFallback>
                {userProfile?.profile?.avatarUrl && (
                  <AvatarImage src={userProfile.profile.avatarUrl} />
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {userProfile?.profile?.displayName || 'Anonymous User'}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {(userProfile?.identity?.publicKey || '').slice(0, 16)}...
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="flex-1 py-2">
            <MenuItem
              icon={<User className="h-5 w-5" />}
              label="My Profile"
              onClick={() => {
                setIsOpen(false);
                onProfileClick?.();
              }}
            />
            <div className="relative">
              <MenuItem
                icon={<Users className="h-5 w-5" />}
                label="Contacts"
                onClick={() => {
                  setIsOpen(false);
                  clearNotifications();
                  onContactsClick?.();
                }}
              />
              {totalNotifications > 0 && (
                <div className="absolute top-2 right-4 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {totalNotifications > 9 ? '9+' : totalNotifications}
                </div>
              )}
            </div>
            <MenuItem
              icon={<Settings className="h-5 w-5" />}
              label="Settings"
              onClick={() => {
                setIsOpen(false);
                onSettingsClick?.();
              }}
            />

            {/* Night Mode Toggle */}
            <div className="flex items-center justify-between px-4 py-3 hover:bg-accent cursor-pointer">
              <div className="flex items-center space-x-3">
                {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                <span>Night Mode</span>
              </div>
              <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
            </div>
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

function MenuItem({ icon, label, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-accent text-left"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
