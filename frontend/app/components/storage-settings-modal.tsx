import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { type MessageRetentionPeriod } from '@/lib/db/schema';
import { StorageService } from '@/services/storage.service';
import { Database, Trash2, Clock, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveModal } from './ui/responsive-modal';

interface StorageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StorageSettingsModal({ isOpen, onClose }: StorageSettingsModalProps) {
  const [retention, setRetention] = useState<MessageRetentionPeriod>(
    StorageService.getRetentionPeriod()
  );
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      StorageService.setRetentionPeriod(retention);
      const deleted = await StorageService.cleanupOldMessagesWithSettings();

      if (deleted > 0) {
        toast.success(`Settings saved. ${deleted} messages cleaned up.`);
      } else {
        toast.success('Storage settings updated');
      }
      onClose();
    } catch {
      toast.error('Failed to update storage settings');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    setLoading(true);
    try {
      const count = await StorageService.getTotalMessageCount();
      await StorageService.clearAllMessages();
      toast.success(`Purged ${count} messages successfully`);
      setShowConfirm(false);
      onClose();
      // Даем модалке закрыться плавно перед перезагрузкой
      setTimeout(() => window.location.reload(), 400);
    } catch {
      toast.error('Failed to clear database');
    } finally {
      setLoading(false);
    }
  };

  const options: { value: MessageRetentionPeriod; label: string; description: string }[] = [
    { value: '7', label: '1 Week', description: 'Auto-delete older messages' },
    { value: '30', label: '1 Month', description: 'Balanced storage usage' },
    { value: '90', label: '3 Months', description: 'Keep history longer' },
    { value: 'forever', label: 'Infinite', description: 'Never delete (manual cleanup only)' },
  ];

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Storage">
      <div className="space-y-8 pb-2">
        {/* Header Info */}
        <div className="flex items-start space-x-4 p-4 rounded-[1.5rem] bg-primary/5 border border-primary/10">
          <div className="p-2 bg-background rounded-xl text-primary shadow-sm">
            <Clock size={18} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold leading-none tracking-tight">Retention Policy</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Messages are stored locally on this device. Choose how long they should stay.
            </p>
          </div>
        </div>

        {/* Retention Options */}
        <div className="grid gap-2">
          {options.map(option => {
            const isSelected = retention === option.value;
            return (
              <div
                key={option.value}
                onClick={() => setRetention(option.value)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setRetention(option.value)}
                role="button"
                tabIndex={0}
                className={`
                  relative flex items-center justify-between p-4 rounded-[1.5rem] 
                  border transition-all duration-300 outline-none
                  ${
                    isSelected
                      ? 'border-primary bg-primary/[0.03] translate-x-1'
                      : 'border-primary/5 bg-primary/5 hover:border-primary/20'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full transition-all duration-500 ${isSelected ? 'bg-primary scale-125 shadow-[0_0_8px_rgba(0,163,255,0.5)]' : 'bg-primary/20 scale-100'}`}
                  />
                  <div>
                    <div className="font-bold text-[13px]">{option.label}</div>
                    <div className="text-[10px] text-muted-foreground font-medium">
                      {option.description}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Secondary Info */}
        <div className="px-4 py-3 rounded-2xl bg-background border border-primary/5">
          <div className="flex items-center space-x-2 text-primary/40 mb-1">
            <Database size={12} />
            <span className="text-[9px] font-black uppercase tracking-widest">Local Database</span>
          </div>
          <p className="text-[10px] text-muted-foreground italic leading-relaxed">
            Note: We keep up to <span className="text-foreground font-bold">1000 messages</span> per
            chat to ensure smooth performance on your device.
          </p>
        </div>

        {/* Danger Zone */}
        <div className="pt-4 border-t border-primary/10">
          {!showConfirm ? (
            <Button
              variant="ghost"
              className="w-full rounded-2xl h-12 text-xs font-black uppercase tracking-widest text-destructive hover:bg-destructive/5 hover:text-destructive transition-all"
              onClick={() => setShowConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Purge All Data
            </Button>
          ) : (
            <div className="p-5 rounded-[2rem] bg-destructive/5 border border-destructive/20 animate-in zoom-in-95 duration-300">
              <div className="flex items-center space-x-3 text-destructive mb-4">
                <ShieldAlert size={18} />
                <span className="text-[11px] font-black uppercase tracking-tighter">
                  Extreme Action
                </span>
              </div>
              <p className="text-[11px] text-destructive/80 mb-5 font-medium leading-relaxed">
                This will permanently erase all chat history and media from this device.{' '}
                <span className="underline">This cannot be undone.</span>
              </p>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-10 text-[10px] font-bold border-destructive/20 text-destructive hover:bg-destructive/10"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 rounded-xl h-10 text-[10px] font-bold shadow-lg shadow-destructive/20"
                  onClick={handleClearAll}
                  disabled={loading}
                >
                  {loading ? 'Purging...' : 'Yes, Delete All'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!showConfirm && (
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 rounded-2xl font-bold text-xs uppercase tracking-wider h-12"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-xl shadow-primary/20 h-12"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}
