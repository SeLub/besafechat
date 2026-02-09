import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { API_ENDPOINTS } from '@/services/api-gateway';

interface DisplayNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDisplayName?: string;
  onUpdate: () => void;
}

export function DisplayNameModal({
  isOpen,
  onClose,
  currentDisplayName,
  onUpdate,
}: DisplayNameModalProps) {
  const [displayName, setDisplayName] = useState(currentDisplayName || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentDisplayName || '');
    }
  }, [isOpen, currentDisplayName]);

  const handleSave = async () => {
    if (!displayName.trim() || displayName.length > 24) {
      toast.error('Display name must be 1-24 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.PROFILE.DISPLAY_NAME, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      if (!res.ok) throw new Error('Failed to update display name');

      toast.success('Display name updated');
      onUpdate();
      onClose();
    } catch {
      toast.error('Failed to update display name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Display Name</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="display-name-input"
              className="text-sm text-muted-foreground mb-2 block"
            >
              Display Name (1-24 characters, emoji allowed)
            </label>
            <input
              id="display-name-input"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={24}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your display name"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {displayName.length}/24 characters
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading || !displayName.trim()}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
