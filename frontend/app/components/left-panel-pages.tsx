import { ContactsPage } from '@/components/contacts-page';
import { DevicesSettingsModal } from '@/components/devices-settings-modal';
import { DisplayNameModal } from '@/components/display-name-modal';
import { PrivacySettingsModal } from '@/components/privacy-settings-modal';
import { StorageSettingsModal } from '@/components/storage-settings-modal';
import { ThemeSelectorModal } from '@/components/theme-selector-modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { UsernameSetupModal } from '@/components/username-setup-modal';
import { useAuth } from '@/hooks/use-auth';
import { MediaService } from '@/services/media.service';
import {
  ArrowLeft,
  AtSign,
  Bell,
  Camera,
  Database,
  Edit3,
  Globe,
  HelpCircle,
  Key,
  LogOut,
  Palette,
  Shield,
  User,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { UserService } from '~/services';

interface LeftPanelPageProps {
  page: 'profile' | 'settings' | 'contacts' | null;
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
  const { user, logout, checkAuth, refreshUser } = useAuth();
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [devicesModalOpen, setDevicesModalOpen] = useState(false);
  const [displayNameModalOpen, setDisplayNameModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      // Use the authenticated user's ID from the auth context
      const userId = user?.identity?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Use the MediaService uploadAvatar method which properly handles the upload
      const result = await MediaService.uploadAvatar(file);
      const avatarUrl = result.url;

      toast.success('Avatar updated');
      // Force reload with cache bust
      setTimeout(() => checkAuth(), 500);
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
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
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center p-4 border-b border-border">
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-3">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold">My Profile</h2>
          </div>

          {/* Profile Photo Section */}
          <div className="p-6 text-center border-b border-border">
            <div className="relative inline-block">
              <Avatar className="h-24 w-24 mx-auto">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {getInitials(userProfile?.profile?.displayName)}
                </AvatarFallback>
                {userProfile?.profile?.avatarUrl && (
                  <AvatarImage
                    src={userProfile.profile.avatarUrl + '?' + Math.random().toString(36)}
                  />
                )}
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
              />
              <Button
                size="icon"
                className="absolute -bottom-2 -right-2 rounded-full h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
              <ProfileField
                icon={<User className="h-5 w-5" />}
                label="Display Name"
                value={userProfile?.profile?.displayName || 'Not set'}
                onEdit={() => setDisplayNameModalOpen(true)}
              />

              <ProfileField
                icon={<AtSign className="h-5 w-5" />}
                label="Username"
                value={userProfile?.handle?.value ? `@${userProfile.handle.value}` : 'Not set'}
                onEdit={() => setUsernameModalOpen(true)}
              />

              {userProfile?.handle?.alias && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Alias</div>
                  <div className="font-medium">@{userProfile.handle.alias}</div>
                </div>
              )}

              {userProfile?.profile?.bio && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Bio</div>
                  <div>{userProfile.profile.bio}</div>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm text-muted-foreground">Public Key</div>
                  </div>
                </div>
                <div className="text-xs font-mono bg-muted p-3 rounded-lg break-all">
                  {userProfile?.identity?.publicKey || 'Public Key Not Available'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Username Modal */}
        <UsernameSetupModal
          isOpen={usernameModalOpen}
          onClose={() => setUsernameModalOpen(false)}
          currentUsername={userProfile?.handle?.value}
          onSave={handleSaveUsername}
        />

        {/* Display Name Modal */}
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

  if (page === 'settings') {
    return (
      <>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center p-4 border-b border-border">
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-3">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>

          {/* Settings List */}
          <div className="flex-1 overflow-y-auto">
            <div className="py-2">
              <SettingsSection title="Notifications">
                <SettingsItem
                  icon={<Bell className="h-5 w-5" />}
                  label="Message Notifications"
                  hasSwitch
                  defaultChecked
                />
                <SettingsItem
                  icon={<Bell className="h-5 w-5" />}
                  label="Sound"
                  hasSwitch
                  defaultChecked
                />
              </SettingsSection>

              <SettingsSection title="Privacy & Security">
                <SettingsItem
                  icon={<Shield className="h-5 w-5" />}
                  label="Privacy Settings"
                  onClick={() => setPrivacyModalOpen(true)}
                />
                <SettingsItem
                  icon={<Shield className="h-5 w-5" />}
                  label="Devices"
                  onClick={() => setDevicesModalOpen(true)}
                />
              </SettingsSection>

              <SettingsSection title="Appearance">
                <SettingsItem
                  icon={<Palette className="h-5 w-5" />}
                  label="Theme"
                  onClick={() => setThemeModalOpen(true)}
                />
              </SettingsSection>

              <SettingsSection title="Storage">
                <SettingsItem
                  icon={<Database className="h-5 w-5" />}
                  label="Message History"
                  onClick={() => setStorageModalOpen(true)}
                />
              </SettingsSection>

              <SettingsSection title="Advanced">
                <SettingsItem
                  icon={<Globe className="h-5 w-5" />}
                  label="Language"
                  onClick={() => {}}
                />
                <SettingsItem
                  icon={<HelpCircle className="h-5 w-5" />}
                  label="Help & Support"
                  onClick={() => {}}
                />
              </SettingsSection>

              <div className="p-4 border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Log Out
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Modal */}
        <PrivacySettingsModal
          isOpen={privacyModalOpen}
          onClose={() => setPrivacyModalOpen(false)}
        />

        {/* Theme Modal */}
        <ThemeSelectorModal isOpen={themeModalOpen} onClose={() => setThemeModalOpen(false)} />

        {/* Storage Modal */}
        <StorageSettingsModal
          isOpen={storageModalOpen}
          onClose={() => setStorageModalOpen(false)}
        />

        {/* Devices Modal */}
        <DevicesSettingsModal
          isOpen={devicesModalOpen}
          onClose={() => setDevicesModalOpen(false)}
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
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50">
      <div className="flex items-center space-x-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="font-medium">{value}</div>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onEdit}>
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
    <div className="mb-6">
      <div className="px-4 py-2 text-sm font-medium text-muted-foreground">{title}</div>
      <div>{children}</div>
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
      className="flex items-center justify-between px-4 py-3 hover:bg-accent cursor-pointer"
      onClick={!hasSwitch ? onClick : undefined}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (!hasSwitch && onClick) onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center space-x-3">
        <div className="text-muted-foreground">{icon}</div>
        <span>{label}</span>
      </div>
      {hasSwitch && <Switch defaultChecked={defaultChecked} />}
    </div>
  );
}
