import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { X, AtSign } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

interface UsernameSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername?: string;
  currentSearchable?: boolean;
}

export function UsernameSetupModal({
  isOpen,
  onClose,
  currentUsername = '',
  currentSearchable = false,
}: UsernameSetupModalProps) {
  const [username, setUsername] = useState(currentUsername);
  const [isSearchable, setIsSearchable] = useState(currentSearchable);
  const [loading, setLoading] = useState(false);
  const { checkAuth } = useAuth();

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!username.trim()) {
      toast.error('Username cannot be empty');
      return;
    }

    if (!/^[a-z0-9_]{5,32}$/.test(username)) {
      toast.error('Username must be 5-32 characters (a-z, 0-9, _)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/username/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.toLowerCase(),
          isSearchable: isSearchable ? 'yes' : 'no',
        }),
      });

      if (res.ok) {
        toast.success('Username updated successfully', { duration: 3000 });
        await checkAuth();
        onClose();
      } else {
        const errorData = await res.json().catch(() => ({ message: 'Failed to update username' }));
        toast.error(errorData.message || 'Failed to update username', { duration: 3000 });
      }
    } catch (error) {
      toast.error('Failed to update username', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 bg-background border border-border rounded-lg shadow-lg z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Set Username</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Username</label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="username"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                maxLength={32}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              5-32 characters, lowercase letters, numbers, and underscores only
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Allow others to find me</div>
              <div className="text-sm text-muted-foreground">
                Let others search for you by username
              </div>
            </div>
            <Switch checked={isSearchable} onCheckedChange={setIsSearchable} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !username.trim()}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </>
  );
}
