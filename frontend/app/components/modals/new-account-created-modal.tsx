import { AlertCircle } from 'lucide-react';
import { ResponsiveModal } from '../ui/responsive-modal';
import { Button } from '../ui/button';

interface NewAccountCreatedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewAccountCreatedModal({ isOpen, onClose }: NewAccountCreatedModalProps) {
  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="New Account Created">
      <div className="space-y-6 pb-2">
        {/* Warning banner */}
        <div className="flex items-start space-x-4 p-4 rounded-[1.5rem] bg-amber-500/5 border border-amber-500/20">
          <div className="p-2 bg-background rounded-xl text-amber-600 shadow-sm flex-shrink-0 mt-0.5">
            <AlertCircle size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700 mb-1">New account created</p>
            <p className="text-[12px] text-amber-600/80 leading-relaxed">
              Your previous account was deleted or recovery time has expired. A new account has been created with your seed phrase.
            </p>
          </div>
        </div>

        {/* Info section */}
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-primary/5">
            <p className="text-[12px] text-muted-foreground font-medium leading-relaxed">
              <span className="font-semibold">Why this happened:</span> Accounts deleted more than 90 days ago cannot be recovered. Your data has been permanently removed for privacy and security reasons.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-primary/5">
            <p className="text-[12px] text-muted-foreground font-medium leading-relaxed">
              <span className="font-semibold">What to do:</span> If this was a mistake, you can always restore a different account using a different seed phrase. Your new account is empty and ready to use.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button 
            onClick={onClose} 
            className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90"
          >
            Start Using Account
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
