import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useNotifications } from '@/hooks/use-notifications';
import { useContactRequests } from '@/hooks/use-contact-requests';
import { API_ENDPOINTS } from '@/services/api-gateway';
import { apiRequest } from '@/services/api-utils';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import {
  Bell,
  Briefcase,
  ChevronRight,
  Menu,
  Moon,
  Settings,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from '~/hooks/use-auth-context';
import type { Handle } from '~/types/handle';
import { HandleProfilesPanel } from './handle-profiles-panel';
import { HandleSwitcherModal } from './handle-switcher-modal';
import { UserProfileCard } from './user-profile-card';

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
  onHandleClick?: () => void;
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
  const [handleProfilesOpen, setHandleProfilesOpen] = useState(false);
  const [handleSwitcherOpen, setHandleSwitcherOpen] = useState(false);
  const [userHandles, setUserHandles] = useState<Handle[]>([]);
  const [loadingHandles, setLoadingHandles] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHandleForEdit, setSelectedHandleForEdit] = useState<string | null>(null);
  const { counts: contactRequestsCounts, clearRequests } = useContactRequests();
  const { unreadCount: inboxUnreadCount } = useNotifications();
  const { user, switchToHandle } = useAuth();
  const { settings, updateSettings } = useProfileSettings();

  const isDarkMode = settings.ui.mode === 'dark';

  // Show badge only if notifications are enabled
  const showContactRequestsBadge = settings.notifications && (contactRequestsCounts.pending + contactRequestsCounts.accepted) > 0;
  const showInboxBadge = settings.notifications && inboxUnreadCount > 0;

  // Fetch handles when switcher modal opens
  useEffect(() => {
    if (handleSwitcherOpen) {
      const fetchHandles = async () => {
        try {
          setLoadingHandles(true);
          const response = await apiRequest<{ handles: Handle[] }>(API_ENDPOINTS.HANDLES.GET_ALL, {
            method: 'GET',
          });
          setUserHandles(response.handles || []);
        } catch (err) {
          console.error('Error fetching handles:', err);
        } finally {
          setLoadingHandles(false);
        }
      };
      fetchHandles();
    }
  }, [handleSwitcherOpen]);

  const toggleDarkMode = async () => {
    setIsLoading(true);
    try {
      const newMode = isDarkMode ? 'light' : 'dark';
      await updateSettings({
        ui: {
          theme: settings.ui.theme,
          language: settings.ui.language,
          mode: newMode,
        },
      });
      // Update DOM based on mode
      if (newMode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (error) {
      console.error('Failed to update night mode:', error);
    } finally {
      setIsLoading(false);
    }
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
              Liberty<span className="text-primary not-italic">.</span>
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
          <UserProfileCard
            userProfile={userProfile}
            onClick={() => {
              setIsOpen(false);
              setHandleSwitcherOpen(true);
            }}
          />

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
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Handle Setup"
                  onClick={() => {
                    setIsOpen(false);
                    setHandleProfilesOpen(true);
                  }}
                />
                <MenuItem
                  icon={<Bell className="h-4 w-4" />}
                  label="Notifications"
                  badge={showInboxBadge ? inboxUnreadCount : 0}
                  onClick={() => {
                    setIsOpen(false);
                    onNotificationsClick?.();
                  }}
                />
                <MenuItem
                  icon={<Users className="h-4 w-4" />}
                  label="Contacts"
                  badge={showContactRequestsBadge ? (contactRequestsCounts.pending + contactRequestsCounts.accepted) : 0}
                  onClick={() => {
                    setIsOpen(false);
                    clearRequests();
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
                  <Switch 
                    checked={isDarkMode} 
                    onCheckedChange={toggleDarkMode}
                    disabled={isLoading}
                  />
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

      {/* Handle Switcher Modal */}
      <HandleSwitcherModal
        isOpen={handleSwitcherOpen}
        onClose={() => setHandleSwitcherOpen(false)}
        handles={userHandles}
        activeHandleId={user?.handle?.id || null}
        onSwitchHandle={switchToHandle}
        isLoading={loadingHandles}
        onEditHandle={(handleId) => {
          setSelectedHandleForEdit(handleId);
          setHandleProfilesOpen(true);
        }}
      />

      {/* Handle Profiles Modal */}
      <HandleProfilesPanel
        isOpen={handleProfilesOpen}
        onClose={() => {
          setHandleProfilesOpen(false);
          setSelectedHandleForEdit(null);
        }}
        initialSelectedHandleId={selectedHandleForEdit}
      />
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
