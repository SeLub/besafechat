import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { X, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacySettingsModal({ isOpen, onClose }: PrivacySettingsModalProps) {
  const [isSearchable, setIsSearchable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && user) {
      loadCurrentSettings();
    }
  }, [isOpen, user]);

  const loadCurrentSettings = async () => {
    setInitialLoading(true);
    try {
      // TODO: Add API endpoint to get user privacy settings
      // For now, assume user is searchable by default
      setIsSearchable(true);
    } catch (error) {
      console.error('Failed to load privacy settings');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update searchability through username endpoint
      // This assumes user already has a username set
      const res = await fetch('http://localhost:4000/username/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: user?.username || 'temp_username',
          isSearchable: isSearchable ? 'yes' : 'no',
        }),
      });

      if (res.ok) {
        toast.success('Privacy settings updated');
        onClose();
      } else {
        toast.error('Failed to update settings');
      }
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

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
