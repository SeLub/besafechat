import { ContactsPage } from '@/components/contacts-page';
import { NotificationList } from '@/components/notification-list';
import { DevicesSettingsModal } from '@/components/devices-settings-modal';
import { DisplayNameModal } from '@/components/display-name-modal';
import { PrivacySettingsModal } from '@/components/privacy-settings-modal';
import { StorageSettingsModal } from '@/components/storage-settings-modal';
import { ThemeSelectorModal } from '@/components/theme-selector-modal';
import { HelpSupportModal } from '@/components/help-support-modal';
import { LanguageSettingsModal } from '@/components/language-settings-modal';
import { DeleteAccountModal } from '@/components/modals/delete-account-modal';
import { AvatarUpload } from '@/components/avatar-upload';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { UsernameSetupModal } from '@/components/username-setup-modal';
import { useAuth } from '~/hooks/use-auth-context';
import { useNotificationHistory } from '@/hooks/use-notification-history';
import {
  ArrowLeft,
  AtSign,
  Bell,
  ChevronRight,
  Database,
  Edit3,
  Globe,
  HelpCircle,
  Key,
  LogOut,
  Palette,
  Shield,
  Trash2,
  User,
  Volume2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserService } from '~/services';
import { IdentityService } from '~/services/identity.service';

interface LeftPanelPageProps {
  page: 'profile' | 'settings' | 'contacts' | 'notifications' | null;
  onBack: () => void;
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
  onChatCreated?: (chatId: string) => void;
}

export function LeftPanelPages({ page, onBack, userProfile, onChatCreated }: LeftPanelPageProps) {
  const { logout, checkAuth, refreshUser } = useAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotificationHistory();
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [devicesModalOpen, setDevicesModalOpen] = useState(false);
  const [displayNameModalOpen, setDisplayNameModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  if (!page) return null;

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

  const handleLogout = async () => {
    await logout();
    window.location.href = '/auth';
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await IdentityService.deleteMyIdentity();
      toast.success('Account deletion initiated. You have 90 days to recover.');
      // Logout and redirect to auth
      await logout();
      window.location.href = '/auth';
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleAvatarUploadSuccess = async () => {
    await refreshUser();
  };

  const handleSaveUsername = async (username: string, isSearchable: boolean) => {
    try {
      // Обновляем username на сервере с isSearchable
      await UserService.setUsername(username, userProfile?.profile?.displayName, isSearchable);

      // Обновляем данные пользователя без перезагрузки страницы
      await refreshUser();

      toast.success('Settings updated successfully');
      setUsernameModalOpen(false);
    } catch (error) {
      console.error('Failed to update username:', error);
      toast.error('Failed to update username');
    }
  };

  if (page === 'profile') {
    return (
      <>
        <div className="flex flex-col h-full bg-card/30 backdrop-blur-xl">
          {/* Sky Header */}
          <div className="flex items-center p-5">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="mr-3 rounded-2xl hover:bg-primary/10 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-black tracking-tight text-foreground italic">
              Identity<span className="text-primary not-italic">.</span>
            </h2>
          </div>

          {/* Profile Photo Section */}
          <div className="px-6 py-8 text-center relative overflow-hidden">
            {/* Декоративный эффект "облака" на фоне */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-primary/10 blur-[60px] rounded-full -z-10" />

            <AvatarUpload
              avatarUrl={userProfile?.profile?.avatarUrl}
              fallback={getInitials(userProfile?.profile?.displayName)}
              size="lg"
              showLabel={false}
              onUploadSuccess={handleAvatarUploadSuccess}
            />

            <h3 className="mt-4 text-xl font-black text-foreground">
              {userProfile?.profile?.displayName || 'Unknown Traveler'}
            </h3>
            <p className="text-sm font-bold text-primary/60 italic">
              @{userProfile?.handle?.value || 'no-handle'}
            </p>
          </div>

          {/* Profile Info - Чистые карточки */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
            <div className="space-y-2">
              <div className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary/40">
                Identity
              </div>
              <div className="overflow-hidden rounded-[2rem] border border-primary/5 bg-primary/5 shadow-sm">
                <ProfileField
                  icon={<User className="h-4 w-4" />}
                  label="Display Name"
                  value={userProfile?.profile?.displayName || 'Set your name'}
                  onEdit={() => setDisplayNameModalOpen(true)}
                />
                <ProfileField
                  icon={<AtSign className="h-4 w-4" />}
                  label="Handle ID"
                  value={
                    userProfile?.handle?.value ? `@${userProfile.handle.value}` : 'Set username'
                  }
                  onEdit={() => setUsernameModalOpen(true)}
                />
              </div>
            </div>

            {userProfile?.profile?.bio && (
              <div className="space-y-2">
                <div className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary/40">
                  About
                </div>
                <div className="p-5 rounded-[2rem] border border-primary/5 bg-primary/5 shadow-sm">
                  <div className="text-sm font-medium leading-relaxed text-foreground/80 italic">
                    "{userProfile.profile.bio}"
                  </div>
                </div>
              </div>
            )}

            {/* Public Key - Сделаем более "технологичным" */}
            <div className="space-y-2">
              <div className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary/40">
                Security Key
              </div>
              <div className="p-5 rounded-[2rem] border border-primary/5 bg-primary/5 shadow-sm">
                <div className="text-[11px] font-mono break-all text-muted-foreground leading-tight">
                  {userProfile?.identity?.publicKey || 'Key not generated'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <UsernameSetupModal
          isOpen={usernameModalOpen}
          onClose={() => setUsernameModalOpen(false)}
          currentUsername={userProfile?.handle?.value}
          onSave={handleSaveUsername}
        />

        <DisplayNameModal
          isOpen={displayNameModalOpen}
          onClose={() => setDisplayNameModalOpen(false)}
          currentDisplayName={userProfile?.profile?.displayName}
          onUpdate={checkAuth}
        />
      </>
    );
  }

  if (page === 'contacts') {
    return (
      <ContactsPage
        onBack={onBack}
        onChatSelect={userId => {
          onChatCreated?.(userId);
          onBack();
        }}
      />
    );
  }

  if (page === 'notifications') {
    return (
      <NotificationList
        notifications={notifications}
        unreadCount={unreadCount}
        loading={loading}
        onBack={onBack}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      />
    );
  }

  if (page === 'settings') {
    return (
      <>
        <div className="flex flex-col h-full bg-card/30 backdrop-blur-xl">
          {/* Sky Header */}
          <div className="flex items-center p-5 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="mr-3 rounded-2xl hover:bg-primary/10 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-black tracking-tight text-foreground italic">
              Settings<span className="text-primary not-italic">.</span>
            </h2>
          </div>

          {/* Settings List */}
          <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-6">
            <SettingsSection title="Notifications">
              <SettingsItem
                icon={<Bell className="h-4 w-4" />}
                label="Message Notifications"
                hasSwitch
                defaultChecked
              />
              <SettingsItem
                icon={<Volume2 className="h-4 w-4" />} // Добавь импорт Volume2 из lucide-react
                label="Sound Effects"
                hasSwitch
                defaultChecked
              />
            </SettingsSection>

            <SettingsSection title="Privacy & Security">
              <SettingsItem
                icon={<Shield className="h-4 w-4" />}
                label="Privacy Settings"
                onClick={() => setPrivacyModalOpen(true)}
              />
              <SettingsItem
                icon={<Key className="h-4 w-4" />}
                label="Devices & Sessions"
                onClick={() => setDevicesModalOpen(true)}
              />
            </SettingsSection>

            <SettingsSection title="Appearance & Data">
              <SettingsItem
                icon={<Palette className="h-4 w-4" />}
                label="Sky Theme"
                onClick={() => setThemeModalOpen(true)}
              />
              <SettingsItem
                icon={<Database className="h-4 w-4" />}
                label="Storage & History"
                onClick={() => setStorageModalOpen(true)}
              />
            </SettingsSection>

            <SettingsSection title="Advanced">
              <SettingsItem
                icon={<Globe className="h-4 w-4" />}
                label="Interface Language"
                onClick={() => setLanguageModalOpen(true)}
              />
              <SettingsItem
                icon={<HelpCircle className="h-4 w-4" />}
                label="Help & Support"
                onClick={() => setHelpModalOpen(true)}
              />
            </SettingsSection>

            {/* Danger Zone */}
            <SettingsSection title="Danger Zone">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 p-4 rounded-[1.5rem] text-destructive hover:bg-destructive/10 transition-all font-bold group border-b border-primary/5"
              >
                <div className="p-2 rounded-xl bg-destructive/5 group-hover:scale-110 transition-transform">
                  <LogOut className="h-5 w-5" />
                </div>
                <span>Exit the Sky</span>
              </button>

              <button
                onClick={() => setDeleteAccountModalOpen(true)}
                className="w-full flex items-center gap-4 p-4 rounded-[1.5rem] text-destructive hover:bg-destructive/10 transition-all font-bold group"
              >
                <div className="p-2 rounded-xl bg-destructive/5 group-hover:scale-110 transition-transform">
                  <Trash2 className="h-5 w-5" />
                </div>
                <span>Delete My Account</span>
              </button>
            </SettingsSection>
          </div>
        </div>

        {/* Сохраняем все модальные окна, они управляются теми же стейтами */}
        <PrivacySettingsModal
          isOpen={privacyModalOpen}
          onClose={() => setPrivacyModalOpen(false)}
        />
        <ThemeSelectorModal isOpen={themeModalOpen} onClose={() => setThemeModalOpen(false)} />
        <StorageSettingsModal
          isOpen={storageModalOpen}
          onClose={() => setStorageModalOpen(false)}
        />
        <DevicesSettingsModal
          isOpen={devicesModalOpen}
          onClose={() => setDevicesModalOpen(false)}
        />

        <LanguageSettingsModal
          isOpen={languageModalOpen}
          onClose={() => setLanguageModalOpen(false)}
        />
        <HelpSupportModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
        <DeleteAccountModal
          isOpen={deleteAccountModalOpen}
          onClose={() => setDeleteAccountModalOpen(false)}
          onConfirm={handleDeleteAccount}
          isLoading={isDeletingAccount}
        />
      </>
    );
  }

  return null;
}

interface ProfileFieldProps {
  icon: ReactNode;
  label: string;
  value: string;
  onEdit: () => void;
}

function ProfileField({ icon, label, value, onEdit }: ProfileFieldProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 hover:bg-primary/5 transition-colors group border-b border-primary/5 last:border-0">
      <div className="flex items-center space-x-4">
        <div className="text-primary/60 group-hover:text-primary transition-colors group-hover:scale-110 transition-transform duration-200">
          {icon}
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-0.5">
            {label}
          </div>
          <div className="text-sm font-bold text-foreground/80 group-hover:text-foreground truncate max-w-[160px]">
            {value}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onEdit}
        className="rounded-full hover:bg-primary/20 text-primary/40 hover:text-primary transition-colors"
      >
        <Edit3 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="space-y-2">
      <div className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary/40">
        {title}
      </div>
      <div className="overflow-hidden rounded-[2rem] border border-primary/5 bg-primary/5 shadow-sm">
        {children}
      </div>
    </div>
  );
}

interface SettingsItemProps {
  icon: ReactNode;
  label: string;
  hasSwitch?: boolean;
  defaultChecked?: boolean;
  onClick?: () => void;
}

function SettingsItem({ icon, label, hasSwitch, defaultChecked, onClick }: SettingsItemProps) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4 hover:bg-primary/5 transition-colors cursor-pointer group border-b border-primary/5 last:border-0"
      onClick={!hasSwitch ? onClick : undefined}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (!hasSwitch && onClick) onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center space-x-4">
        <div className="text-primary/60 group-hover:text-primary transition-colors group-hover:scale-110 transition-transform duration-200">
          {icon}
        </div>
        <span className="text-sm font-bold text-foreground/80 group-hover:text-foreground">
          {label}
        </span>
      </div>
      {hasSwitch ? (
        <Switch defaultChecked={defaultChecked} className="data-[state=checked]:bg-primary" />
      ) : (
        <div className="text-primary/20 group-hover:text-primary/60 transition-colors">
          <ChevronRight size={16} /> {/* Добавь импорт ChevronRight */}
        </div>
      )}
    </div>
  );
}
