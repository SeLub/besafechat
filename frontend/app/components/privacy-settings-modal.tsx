import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { X, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '~/hooks/use-auth-context';
import { API_ENDPOINTS } from '@/services/api-gateway';

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacySettingsModal({ isOpen, onClose }: PrivacySettingsModalProps) {
  const [isSearchable, setIsSearchable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { user, refreshUser } = useAuth();

  const loadCurrentSettings = useCallback(async () => {
    setInitialLoading(true);
    try {
      // Load current searchable status from user profile
      if (user?.handle) {
        setIsSearchable(user.handle.isSearchable);
      } else {
        // Default to true if not set
        setIsSearchable(true);
      }
    } catch {
      console.error('Failed to load privacy settings');
    } finally {
      setInitialLoading(false);
    }
  }, [user, setIsSearchable, setInitialLoading]);

  useEffect(() => {
    if (isOpen && user) {
      loadCurrentSettings();
    }
  }, [isOpen, user, loadCurrentSettings]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update searchability through handles endpoint
      // Use the handle ID to update searchable status
      const handleId = user?.handle?.id;
      if (!handleId) {
        throw new Error('Handle not found');
      }

      const res = await fetch(API_ENDPOINTS.HANDLES.SEARCHABLE(handleId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isSearchable: isSearchable,
        }),
      });

      if (res.ok) {
        toast.success('Privacy settings updated');
        // Refresh the user profile data after successful update
        await refreshUser();
        onClose();
      } else {
        const errorText = await res.text();
        toast.error(`Failed to update settings: ${errorText}`);
      }
    } catch {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
        }}
        role="button"
        tabIndex={-1}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 bg-background border border-border rounded-lg shadow-lg z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Privacy Settings</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {initialLoading ? (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">Loading settings...</div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Discovery</h3>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <div className="font-medium">Allow others to find me</div>
                      <div className="text-sm text-muted-foreground">
                        Let others search for you by username
                      </div>
                    </div>
                    <Switch checked={isSearchable} onCheckedChange={setIsSearchable} />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <strong>Note:</strong> When disabled, others won't be able to find you through
                  username search, but existing contacts can still message you.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!initialLoading && (
          <div className="flex justify-end space-x-2 p-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
