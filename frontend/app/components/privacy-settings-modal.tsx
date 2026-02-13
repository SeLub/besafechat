import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { X, Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '~/hooks/use-auth-context';
import { API_ENDPOINTS } from '@/services/api-gateway';
import { ResponsiveModal } from './ui/responsive-modal';

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
      if (user?.handle) {
        setIsSearchable(user.handle.isSearchable);
      } else {
        setIsSearchable(true);
      }
    } catch {
      console.error('Failed to load privacy settings');
    } finally {
      setInitialLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      loadCurrentSettings();
    }
  }, [isOpen, user, loadCurrentSettings]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const handleId = user?.handle?.id;
      if (!handleId) throw new Error('Handle not found');

      const res = await fetch(API_ENDPOINTS.HANDLES.SEARCHABLE(handleId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isSearchable }),
      });

      if (res.ok) {
        toast.success('Privacy settings updated');
        await refreshUser();
        onClose();
      } else {
        const errorText = await res.text();
        toast.error(`Failed: ${errorText}`);
      }
    } catch {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Privacy">
      <div className="space-y-6">
        {initialLoading ? (
          // Красивое состояние загрузки в стиле Sky
          <div className="py-10 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-2xl border-2 border-primary/10 border-t-primary animate-spin" />
              <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/30 animate-pulse">
              Fetching Security Layer
            </div>
          </div>
        ) : (
          // Основной контент (показывается только когда данные загружены)
          <>
            <div className="group">
              <div className="px-2 mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-primary/40">
                Visibility Mode
              </div>

              <div className="relative flex items-center justify-between p-6 rounded-[2rem] bg-primary/5 border border-primary/5 hover:border-primary/20 transition-all duration-300">
                <div className="flex items-start space-x-4">
                  <div
                    className={`mt-1 p-2 rounded-xl transition-colors ${
                      isSearchable
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-orange-500/10 text-orange-500'
                    }`}
                  >
                    {isSearchable ? <Eye size={18} /> : <EyeOff size={18} />}
                  </div>
                  <div>
                    <div className="font-bold text-sm">Discoverable</div>
                    <div className="text-[11px] text-muted-foreground font-medium leading-relaxed max-w-[180px]">
                      Allow others to find your profile via username search.
                    </div>
                  </div>
                </div>
                <Switch
                  checked={isSearchable}
                  onCheckedChange={setIsSearchable}
                  className="data-[state=checked]:bg-primary shadow-lg"
                />
              </div>
            </div>

            <div className="relative overflow-hidden p-5 rounded-[1.5rem] bg-background/50 border border-primary/5 transition-all duration-500">
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 transition-colors duration-500 ${
                  isSearchable ? 'bg-green-500/50' : 'bg-orange-500/50'
                }`}
              />

              <p className="text-[11px] font-medium leading-relaxed text-muted-foreground italic">
                <span className="font-black text-primary uppercase not-italic mr-2">Status:</span>
                {isSearchable ? (
                  <span className="text-foreground/80 animate-in fade-in duration-300">
                    You are visible to the community. New people can find and contact you.
                  </span>
                ) : (
                  <span className="text-foreground/80 animate-in fade-in duration-300">
                    You are now a ghost. Only your existing contacts can find and message you.
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={onClose}
                className="flex-1 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-primary/5 h-12"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-xl shadow-primary/20 h-12"
              >
                {loading ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}
