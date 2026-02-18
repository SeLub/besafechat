import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAvatarUpdate } from '~/hooks/avatar-update-context';

interface UserProfileCardProps {
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
  onClick?: () => void;
  disabled?: boolean;
}

export function UserProfileCard({ userProfile, onClick, disabled }: UserProfileCardProps) {
  const { lastAvatarUpdateTimestamp } = useAvatarUpdate();

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
    <div className="px-4 py-2">
      <div
        className={`p-4 rounded-[2rem] bg-primary/5 border border-primary/5 cursor-pointer hover:bg-primary/10 transition-all group outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onClick?.()}
        onKeyDown={e => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick?.();
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
  );
}
