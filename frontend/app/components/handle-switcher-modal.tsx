import * as React from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Check } from 'lucide-react';
import type { Handle } from '~/types/handle';
import { useMediaQuery } from '~/hooks/use-media-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAvatarUpdate } from '~/hooks/avatar-update-context';

interface HandleSwitcherModalProps {
  isOpen: boolean;
  handles: Handle[];
  activeHandleId: string | null;
  onClose: () => void;
  onSwitchHandle: (handleId: string) => Promise<void>;
  isLoading?: boolean;
  onEditHandle?: (handleId: string) => void;
}

export function HandleSwitcherModal({
  isOpen,
  handles,
  activeHandleId,
  onClose,
  onSwitchHandle,
  isLoading,
  onEditHandle,
}: HandleSwitcherModalProps) {
  const { isMobile } = useMediaQuery();
  const [mounted, setMounted] = React.useState(false);
  const [switchingHandleId, setSwitchingHandleId] = React.useState<string | null>(null);
  const { lastAvatarUpdateTimestamp } = useAvatarUpdate();

  React.useEffect(() => setMounted(true), []);

  if (!mounted || !isOpen) return null;

  const getInitials = (name?: string, handle?: Handle) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (handle?.profile?.displayName) {
      return handle.profile.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'H';
  };

  const handleSwitchClick = async (handleId: string) => {
    if (activeHandleId === handleId || isLoading || switchingHandleId) return;

    try {
      setSwitchingHandleId(handleId);
      console.log('[HandleSwitcherModal] Starting switch to handle:', handleId);
      await onSwitchHandle(handleId);
      console.log('[HandleSwitcherModal] Switch completed, closing modal');
      // Small delay to ensure state updates are processed
      await new Promise(resolve => setTimeout(resolve, 100));
      onClose();
    } catch (error) {
      console.error('[HandleSwitcherModal] Failed to switch handle:', error);
    } finally {
      setSwitchingHandleId(null);
    }
  };

  const content = (
    <div className="space-y-3">
      {handles.map(handle => (
        <div key={handle.id} className="flex gap-2">
          <button
            onClick={() => handleSwitchClick(handle.id)}
            disabled={isLoading || switchingHandleId !== null}
            className={`flex-1 flex items-center space-x-4 p-4 rounded-[1.5rem] transition-all border-2 ${
              activeHandleId === handle.id
                ? 'bg-primary/10 border-primary/30'
                : 'bg-background border-primary/10 hover:border-primary/20 hover:bg-primary/5'
            } ${isLoading || switchingHandleId !== null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Avatar className="h-14 w-14 ring-2 ring-background shadow-md flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white font-bold">
                {getInitials(handle.profile?.displayName, handle)}
              </AvatarFallback>
              {handle.profile?.avatarUrl && (
                <AvatarImage src={`${handle.profile.avatarUrl}?v=${lastAvatarUpdateTimestamp}`} />
              )}
            </Avatar>

            <div className="flex-1 min-w-0 text-left">
              <div className="font-black text-sm truncate">
                {handle.profile?.displayName || 'Traveler'}
              </div>
              <div className="text-[10px] font-bold text-primary/40 uppercase tracking-widest truncate">
                @{handle.alias || handle.value}
              </div>
            </div>

            {switchingHandleId === handle.id ? (
              <div className="flex-shrink-0">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              </div>
            ) : activeHandleId === handle.id ? (
              <div className="flex-shrink-0 text-primary">
                <Check className="h-5 w-5" />
              </div>
            ) : null}
          </button>

          {/* Edit button */}
          <button
            onClick={() => {
              onEditHandle?.(handle.id);
              onClose();
            }}
            disabled={isLoading || switchingHandleId !== null}
            className="flex-shrink-0 px-4 py-4 rounded-[1.5rem] bg-primary/10 hover:bg-primary/20 border-2 border-primary/20 transition-all disabled:opacity-50"
            title="Edit handle profile"
          >
            <span className="text-sm font-bold">Edit</span>
          </button>
        </div>
      ))}
    </div>
  );

  // --- МОБИЛЬНАЯ ВЕРСИЯ (Drawer/BottomSheet) ---
  if (isMobile) {
    return createPortal(
      <Dialog.Root open={isOpen} onOpenChange={onClose}>
        <Dialog.Portal>
          <Drawer.Root open={isOpen} onOpenChange={open => !open && onClose()}>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000]" />
              <Drawer.Content className="bg-card fixed bottom-0 left-0 right-0 z-[1001] flex flex-col rounded-t-[2.5rem] border-t border-primary/10 outline-none">
                {/* Dialog Title and Description for accessibility */}
                <Dialog.Title className="sr-only">Switch Handle</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Select a handle to switch to
                </Dialog.Description>

                {/* Decorative swipe bar */}
                <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-primary/20" />

                <div className="p-6 overflow-y-auto max-h-[80vh]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black italic tracking-tight">Switch Handle</h2>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full bg-primary/5"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {content}
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </Dialog.Portal>
      </Dialog.Root>,
      document.body
    );
  }

  // --- ДЕСКТОП/ПЛАНШЕТ ВЕРСИЯ (Центрированная модалка) ---
  return createPortal(
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/60 backdrop-blur-md z-[1000]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[450px] bg-card rounded-[2rem] shadow-2xl z-[1001] overflow-hidden flex flex-col outline-none">
          <div className="p-8">
            <Dialog.Title className="text-xl font-black italic tracking-tight">
              Switch Handle
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Select a handle to switch to
            </Dialog.Description>

            <div className="flex items-center justify-between mb-6 mt-0">
              <div className="flex-1" />
              <Dialog.Close asChild>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-primary/5 hover:bg-primary/10 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">{content}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>,
    document.body
  );
}
