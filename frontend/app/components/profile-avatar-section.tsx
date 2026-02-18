import { useState } from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { AvatarUpload } from './avatar-upload';

interface Handle {
  id: string;
  value: string;
  alias: string | null;
  type: 'account' | 'team' | 'channel';
  isPrimary: boolean;
  isSearchable: boolean;
  createdAt: string;
  profile?: {
    displayName: string;
    avatarUrl?: string | null;
  };
}

interface ProfileAvatarSectionProps {
  handle?: Handle;
  onUpdateHandle: (handleId: string, updates: Partial<Handle>) => Promise<void>;
  onSetPrimary: (handleId: string) => Promise<void>;
  isLoading?: boolean;
  onAvatarUploaded?: () => void;
}

export function ProfileAvatarSection({
  handle,
  onUpdateHandle,
  onSetPrimary,
  isLoading,
  onAvatarUploaded,
}: ProfileAvatarSectionProps) {
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [localAlias, setLocalAlias] = useState(handle?.alias || '');
  const [isSearchable, setIsSearchable] = useState(handle?.isSearchable || false);

  if (!handle) {
    return (
      <div className="flex items-center justify-center h-full text-foreground/60">
        Select a handle to view details
      </div>
    );
  }

  const getInitials = (value: string): string => {
    return value
      .split('-')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSaveAlias = async () => {
    try {
      setIsSavingSettings(true);
      await onUpdateHandle(handle.id, {
        alias: localAlias || null,
      });
      toast.success('Alias updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update alias');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveSearchable = async () => {
    try {
      setIsSavingSettings(true);
      await onUpdateHandle(handle.id, {
        isSearchable,
      });
      toast.success('Searchable status updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update searchable status');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSetPrimary = async () => {
    try {
      setIsSavingSettings(true);
      await onSetPrimary(handle.id);
      toast.success('Primary handle changed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to set primary handle');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Profile Photo Section */}
      <div className="flex flex-col items-center gap-3 relative overflow-hidden px-6 py-8">
        {/* Decorative cloud effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-primary/10 blur-[60px] rounded-full -z-10" />

        <AvatarUpload
          avatarUrl={handle.profile?.avatarUrl}
          fallback={getInitials(handle.value)}
          size="md"
          onUploadSuccess={onAvatarUploaded}
        />

        <div className="text-center">
          <h3 className="font-bold text-sm">@{handle.value}</h3>
          {handle.profile?.displayName && (
            <p className="text-xs text-foreground/60">{handle.profile.displayName}</p>
          )}
        </div>
      </div>

      {/* Handle Settings */}
      <div className="space-y-3 pt-4 border-t border-primary/10">
        {/* Alias Field */}
        <div>
          <label className="block text-xs font-bold mb-1">Alias (optional)</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={localAlias}
              onChange={e => setLocalAlias(e.target.value)}
              placeholder="e.g. john-doe"
              className="flex-1 rounded border border-primary/20 px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={handleSaveAlias}
              disabled={isSavingSettings}
              className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Searchable Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold">Searchable</label>
          <button
            onClick={handleSaveSearchable}
            disabled={isSavingSettings}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              isSearchable ? 'bg-green-600' : 'bg-primary/20'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                isSearchable ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Primary Toggle */}
        {!handle.isPrimary && (
          <button
            onClick={handleSetPrimary}
            disabled={isSavingSettings}
            className="w-full px-3 py-2 rounded text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            Set as Primary
          </button>
        )}

        {handle.isPrimary && (
          <div className="px-3 py-2 rounded text-xs font-bold bg-primary/20 text-primary text-center">
            Primary Handle
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-foreground/50 space-y-1 pt-4 border-t border-primary/10">
        <div>
          Type: <span className="font-mono">{handle.type}</span>
        </div>
        <div>
          Created:{' '}
          <span className="font-mono">{new Date(handle.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
