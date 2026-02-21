import * as React from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '~/hooks/use-media-query';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteAccountModalProps) {
  const { isMobile } = useMediaQuery();
  const [mounted, setMounted] = React.useState(false);
  const [step, setStep] = React.useState<'warning' | 'confirm'>('warning');
  const [confirmText, setConfirmText] = React.useState('');

  React.useEffect(() => setMounted(true), []);

  if (!mounted || !isOpen) return null;

  const handleContinue = () => {
    if (step === 'warning') {
      setStep('confirm');
    } else {
      if (confirmText !== 'DELETE MY ACCOUNT') return;
      handleDelete();
    }
  };

  const handleDelete = async () => {
    try {
      await onConfirm();
      handleClose();
    } catch (error) {
      console.error('Delete account error:', error);
    }
  };

  const handleClose = () => {
    setStep('warning');
    setConfirmText('');
    onClose();
  };

  const warningContent = (
    <>
      <div className="w-16 h-16 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertTriangle size={32} />
      </div>

      <h2 className="text-2xl font-black text-center text-foreground mb-3">
        Delete Your Account
      </h2>

      <p className="text-center text-muted-foreground font-medium mb-6">
        This action is <span className="text-destructive font-black">irreversible</span> after 90 days.
      </p>

      <div className="space-y-3 mb-8 p-4 rounded-2xl bg-destructive/5 border border-destructive/20">
        <div className="flex gap-3">
          <Lock size={20} className="text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-foreground text-sm">90-Day Recovery Window</p>
            <p className="text-xs text-muted-foreground">
              You can recover your account by logging in with your seed phrase within 90 days.
            </p>
          </div>
        </div>
        <div className="flex gap-3 pt-2 border-t border-destructive/20">
          <AlertTriangle size={20} className="text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-foreground text-sm">After 90 Days</p>
            <p className="text-xs text-muted-foreground">
              All your data will be permanently deleted and cannot be recovered.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Button
          onClick={handleContinue}
          className="w-full py-6 text-base font-black rounded-2xl bg-destructive text-destructive-foreground shadow-xl shadow-destructive/20"
        >
          I Understand, Continue
        </Button>
        <Button
          onClick={handleClose}
          variant="outline"
          className="w-full py-6 text-base font-bold rounded-2xl"
        >
          Cancel
        </Button>
      </div>
    </>
  );

  const confirmContent = (
    <>
      <div className="w-16 h-16 bg-destructive/20 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertTriangle size={32} />
      </div>

      <h2 className="text-2xl font-black text-center text-foreground mb-3">
        Final Confirmation
      </h2>

      <p className="text-center text-muted-foreground font-medium mb-6">
        Type <span className="font-black text-destructive">DELETE MY ACCOUNT</span>
      </p>

      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
        placeholder="Type DELETE MY ACCOUNT"
        className="w-full px-4 py-3 rounded-2xl border-2 border-destructive/20 bg-card/40 focus:border-destructive focus:bg-background outline-none transition-all text-center font-mono text-sm mb-6"
      />

      <div className="space-y-3">
        <Button
          onClick={handleContinue}
          disabled={confirmText !== 'DELETE MY ACCOUNT' || isLoading}
          className="w-full py-6 text-base font-black rounded-2xl bg-destructive text-destructive-foreground shadow-xl shadow-destructive/20 disabled:opacity-30"
        >
          {isLoading ? 'Deleting...' : 'Delete Account Permanently'}
        </Button>
        <Button
          onClick={handleClose}
          variant="outline"
          className="w-full py-6 text-base font-bold rounded-2xl"
        >
          Cancel
        </Button>
      </div>
    </>
  );

  // МОБИЛЬНАЯ ВЕРСИЯ (Drawer)
  if (isMobile) {
    return createPortal(
      <Dialog.Root open={isOpen} onOpenChange={onClose}>
        <Dialog.Portal>
          <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000]" />
              <Drawer.Content className="bg-card fixed bottom-0 left-0 right-0 z-[1001] flex flex-col rounded-t-[2.5rem] border-t border-destructive/10 outline-none">
                <div className="mx-auto mt-4 h-1.5 w-12 shrink-0 rounded-full bg-destructive/20" />

                <div className="p-6 overflow-y-auto max-h-[80vh]">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-black">Account Deletion</h2>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full bg-destructive/5"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {step === 'warning' ? warningContent : confirmContent}
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </Dialog.Portal>
      </Dialog.Root>,
      document.body
    );
  }

  // ДЕСКТОП/ПЛАНШЕТ ВЕРСИЯ (Modal)
  return createPortal(
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/60 backdrop-blur-md z-[1000]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card rounded-[2rem] shadow-2xl z-[1001] p-8">
          <Dialog.Close asChild>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-foreground/60 hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </Dialog.Close>

          {step === 'warning' ? warningContent : confirmContent}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>,
    document.body
  );
}
