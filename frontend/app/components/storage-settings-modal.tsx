import { Button } from '@/components/ui/button';
import { StorageService } from '@/services/storage.service';
import type { MessageRetentionPeriod } from '@/lib/db/schema';
import { Database, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      StorageService.setRetentionPeriod(retention);

      // Применяем очистку сразу
      const deleted = await StorageService.cleanupOldMessagesWithSettings();

      if (deleted > 0) {
        toast.success(`Settings saved. ${deleted} old messages deleted.`, { duration: 3000 });
      } else {
        toast.success('Settings saved', { duration: 3000 });
      }

      onClose();
    } catch (error) {
      toast.error('Failed to save settings', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const options: { value: MessageRetentionPeriod; label: string; description: string }[] = [
    { value: '7', label: '7 days', description: 'Delete messages older than 1 week' },
    { value: '30', label: '30 days', description: 'Delete messages older than 1 month' },
    { value: '90', label: '90 days', description: 'Delete messages older than 3 months' },
    { value: 'forever', label: 'Forever', description: 'Keep all messages (may use more storage)' },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 bg-background border border-border rounded-lg shadow-lg z-50">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Storage Settings</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-sm text-muted-foreground mb-3">
            Choose how long to keep message history
          </div>

          {options.map(option => (
            <div
              key={option.value}
              onClick={() => setRetention(option.value)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                retention === option.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <div className="font-medium">{option.label}</div>
              <div className="text-sm text-muted-foreground">{option.description}</div>
            </div>
          ))}

          <div className="text-xs text-muted-foreground pt-2 border-t border-border">
            Note: Maximum 1000 messages per chat regardless of time period
          </div>
        </div>

        <div className="p-4 border-t border-border">
          {!showConfirm ? (
            <Button
              variant="outline"
              className="w-full text-destructive hover:bg-destructive/10"
              onClick={() => setShowConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Messages
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-center text-muted-foreground">
                Are you sure? This cannot be undone.
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const count = await StorageService.getTotalMessageCount();
                      await StorageService.clearAllMessages();
                      toast.success(`${count} messages deleted`, { duration: 3000 });
                      setShowConfirm(false);
                      onClose();
                      // Reload page to refresh UI
                      setTimeout(() => window.location.reload(), 500);
                    } catch (error) {
                      toast.error('Failed to delete messages', { duration: 3000 });
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete All'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </>
  );
}
