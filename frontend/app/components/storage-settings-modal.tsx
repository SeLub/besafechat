import * as React from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import * as Dialog from '@radix-ui/react-dialog';
import { X, HardDrive, ShieldCheck, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type MessageRetentionPeriod } from '@/lib/db/schema';
import { StorageService, type StorageInfo } from '@/services/storage.service';
import { useProfileSettings } from '@/hooks/use-profile-settings';
import { useAuth } from '@/hooks/use-auth-context';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from 'sonner';
import { useState } from 'react';

interface StorageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StorageSettingsModal({ isOpen, onClose }: StorageSettingsModalProps) {
  const { settings, updateSettings } = useProfileSettings();
  const { user } = useAuth();
  const { isMobile, isTablet } = useMediaQuery();

  const [retention, setRetention] = useState<MessageRetentionPeriod>(
    (settings.storage?.messageRetentionDays as MessageRetentionPeriod) || 'forever'
  );
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      loadStorageInfo();
    }
  }, [isOpen]);

  const loadStorageInfo = async () => {
    try {
      setLoadingInfo(true);
      const info = await StorageService.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Failed to load storage info:', error);
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateSettings({ storage: { messageRetentionDays: retention } });
      const deleted = await StorageService.cleanupOldMessagesWithSettings();
      toast.success(
        deleted > 0 ? `Settings saved. ${deleted} messages cleaned up.` : 'Storage settings updated'
      );
    } catch (error) {
      toast.error('Failed to update storage settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllMessages = async () => {
    setLoading(true);
    try {
      const count = await StorageService.getTotalMessageCount();
      await StorageService.clearAllMessages();
      toast.success(`Deleted ${count} messages successfully`);
      setShowConfirm(false);
      onClose();
      await loadStorageInfo();
    } catch (error) {
      toast.error('Failed to delete messages');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!user?.handle?.id) {
      toast.error('User handle not available');
      return;
    }
    setVerifying(true);
    try {
      const result = await StorageService.verifyEncryptionIntegrity(user.handle.id);
      const { total, successful, failed } = result.messages;
      if (total === 0) toast.info('No messages to verify');
      else if (failed === 0) toast.success(`All ${total} messages verified successfully.`);
      else
        toast.warning(`${successful}/${total} OK. ${failed} failed to decrypt.`, {
          duration: 8000,
        });
    } catch (error) {
      toast.error('Failed to verify encryption integrity');
      console.error(error);
    } finally {
      setVerifying(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const retentionOptions: { value: MessageRetentionPeriod; label: string; description: string }[] =
    [
      { value: '7', label: '7 days', description: 'Delete messages older than 1 week' },
      { value: '30', label: '30 days', description: 'Delete messages older than 1 month' },
      { value: '90', label: '90 days', description: 'Delete messages older than 3 months' },
      {
        value: 'forever',
        label: 'Forever',
        description: 'Keep all messages (may use more storage)',
      },
    ];

  if (!mounted || !isOpen) return null;

  // ─────────────────────────────────────────────────────────────
  // МОБИЛЬНАЯ ВЕРСИЯ (Drawer) - только левая колонка
  // ─────────────────────────────────────────────────────────────
  if (isMobile) {
    return createPortal(
      <Dialog.Root open={isOpen} onOpenChange={onClose}>
        <Dialog.Portal>
          <Drawer.Root open={isOpen} onOpenChange={open => !open && onClose()}>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000]" />
              <Dialog.Title className="sr-only">Storage Settings</Dialog.Title>
              <Dialog.Description className="sr-only">
                Configure message retention and manage local storage
              </Dialog.Description>
              <Drawer.Content className="bg-card fixed bottom-0 left-0 right-0 z-[1001] flex flex-col rounded-t-[2.5rem] border-t border-primary/10 outline-none">
                <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-primary/20" />

                <div className="p-6 overflow-y-auto max-h-[80vh]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black italic tracking-tight">Storage</h2>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full bg-primary/5"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* === MESSAGE RETENTION (Mobile) === */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-primary/70">
                      <Clock size={14} />
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Message Retention
                      </h3>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Choose how long to keep message history on this device.
                    </p>

                    <div className="grid gap-2">
                      {retentionOptions.map(option => {
                        const isSelected = retention === option.value;
                        return (
                          <label
                            key={option.value}
                            className={`relative flex items-start space-x-3 p-3 rounded-xl cursor-pointer border transition-all outline-none ${
                              isSelected
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                : 'border-border hover:border-primary/30 hover:bg-muted/30'
                            }`}
                          >
                            <input
                              type="radio"
                              name="retention"
                              value={option.value}
                              checked={isSelected}
                              onChange={() => setRetention(option.value)}
                              className="sr-only"
                            />
                            <div
                              className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-background" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{option.label}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {option.description}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex items-start space-x-2 p-3 rounded-lg bg-muted/20 text-[10px] text-muted-foreground">
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                      <p>
                        Note: Maximum{' '}
                        <span className="text-foreground font-medium">1000 messages per chat</span>{' '}
                        regardless of time period.
                      </p>
                    </div>
                  </div>

                  {/* === ACTION BUTTONS (Mobile) === */}
                  {!showConfirm ? (
                    <div className="flex gap-3 pt-6">
                      <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1 rounded-xl font-medium text-xs h-11"
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={loading || loadingInfo}
                        className="flex-1 rounded-xl font-medium text-xs shadow-sm h-11"
                      >
                        {loading ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  ) : (
                    <div className="pt-6">
                      <Button
                        variant="ghost"
                        className="w-full rounded-xl h-11 text-xs font-medium text-destructive hover:bg-destructive/10"
                        onClick={() => setShowConfirm(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete All Messages
                      </Button>
                    </div>
                  )}
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </Dialog.Portal>
      </Dialog.Root>,
      document.body
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ДЕСКТОП/ПЛАНШЕТ (2 колонки)
  // ─────────────────────────────────────────────────────────────
  return createPortal(
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/60 backdrop-blur-md z-[1000]" />
        <Dialog.Title className="sr-only">Storage Settings</Dialog.Title>
        <Dialog.Description className="sr-only">
          Configure message retention and manage local storage
        </Dialog.Description>
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full bg-card rounded-[2rem] shadow-2xl z-[1001] overflow-hidden flex flex-col max-h-[85vh] ${isTablet ? 'max-w-[90vw]' : 'max-w-[1000px]'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-primary/10">
            <h2 className="text-xl font-black">Storage</h2>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="text-foreground/60 hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-8 h-full">
              {/* === LEFT COLUMN: Retention + Buttons === */}
              <div className="space-y-6 pr-6 border-r border-primary/10">
                {/* Message Retention */}
                <section className="space-y-3">
                  <div className="flex items-center space-x-2 text-primary/70">
                    <Clock size={14} />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      Message Retention
                    </h3>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Choose how long to keep message history on this device.
                  </p>

                  <div className="grid gap-2">
                    {retentionOptions.map(option => {
                      const isSelected = retention === option.value;
                      return (
                        <label
                          key={option.value}
                          className={`relative flex items-start space-x-3 p-3 rounded-xl cursor-pointer border transition-all outline-none ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/30 hover:bg-muted/30'}`}
                        >
                          <input
                            type="radio"
                            name="retention"
                            value={option.value}
                            checked={isSelected}
                            onChange={() => setRetention(option.value)}
                            className="sr-only"
                          />
                          <div
                            className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-background" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{option.label}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {option.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex items-start space-x-2 p-3 rounded-lg bg-muted/20 text-[10px] text-muted-foreground">
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                    <p>
                      Note: Maximum{' '}
                      <span className="text-foreground font-medium">1000 messages per chat</span>{' '}
                      regardless of time period.
                    </p>
                  </div>
                </section>

                {/* Action Buttons */}
                {!showConfirm ? (
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="ghost"
                      onClick={onClose}
                      className="flex-1 rounded-xl font-medium text-xs h-11"
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={loading || loadingInfo}
                      className="flex-1 rounded-xl font-medium text-xs shadow-sm h-11"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                ) : (
                  <div className="pt-4">
                    <Button
                      variant="ghost"
                      className="w-full rounded-xl h-11 text-xs font-medium text-destructive hover:bg-destructive/10"
                      onClick={() => setShowConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete All Messages
                    </Button>
                  </div>
                )}
              </div>

              {/* === RIGHT COLUMN: Usage + Integrity + Danger === */}
              <div className="space-y-6 pl-6">
                {/* Storage Usage */}
                <section className="space-y-3">
                  <div className="flex items-center space-x-2 text-primary/70">
                    <HardDrive size={14} />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Storage Usage</h3>
                  </div>

                  {loadingInfo ? (
                    <div className="p-4 rounded-xl bg-muted/30 animate-pulse">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-4 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ) : storageInfo ? (
                    <div className="p-4 rounded-xl bg-muted/30 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-2 rounded-lg bg-background/50">
                          <div className="text-lg font-bold text-foreground">
                            {storageInfo.messages.count}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Messages
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-background/50">
                          <div className="text-lg font-bold text-foreground">
                            {storageInfo.contacts.count}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Contacts
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{formatBytes(storageInfo.quota.usage)} used</span>
                          <span>{formatBytes(storageInfo.quota.limit)} limit</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${storageInfo.quota.isCritical ? 'bg-destructive' : storageInfo.quota.isLow ? 'bg-warning' : 'bg-primary'}`}
                            style={{ width: `${Math.min(storageInfo.quota.percentage, 100)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground text-center">
                          {storageInfo.quota.percentage.toFixed(1)}% used
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-destructive/10 text-[11px] text-destructive">
                      Failed to load storage statistics
                    </div>
                  )}
                </section>

                {/* Encryption Integrity */}
                <section className="space-y-3 pt-2 border-t border-primary/10">
                  <div className="flex items-center space-x-2 text-primary/70">
                    <ShieldCheck size={14} />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      Encryption Integrity
                    </h3>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Verify that your encrypted messages can be decrypted properly.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleVerifyIntegrity}
                    disabled={verifying || loadingInfo}
                    className="w-full rounded-xl h-10 text-xs font-medium"
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />{' '}
                    {verifying ? 'Verifying...' : 'Verify Encryption Integrity'}
                  </Button>
                </section>

                {/* Danger Zone */}
                {showConfirm && (
                  <section className="pt-2 border-t border-primary/10">
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 space-y-3">
                      <div className="flex items-center space-x-2 text-destructive">
                        <AlertTriangle size={14} />
                        <span className="text-xs font-bold">Confirm Deletion</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        This will permanently erase all chat history from this device.{' '}
                        <span className="text-destructive font-medium">This cannot be undone.</span>
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9 text-xs"
                          onClick={() => setShowConfirm(false)}
                          disabled={loading}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 h-9 text-xs"
                          onClick={handleDeleteAllMessages}
                          disabled={loading}
                        >
                          {loading ? 'Deleting...' : 'Yes, Delete All'}
                        </Button>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>,
    document.body
  );
}
