import { CheckCircle2 } from 'lucide-react';
import { ResponsiveModal } from '../ui/responsive-modal';
import { Button } from '../ui/button';

interface AccountRecoveredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountRecoveredModal({ isOpen, onClose }: AccountRecoveredModalProps) {
  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Account Recovered">
      <div className="space-y-6 pb-2">
        {/* Success banner */}
        <div className="flex items-start space-x-4 p-4 rounded-[1.5rem] bg-green-500/5 border border-green-500/20">
          <div className="p-2 bg-background rounded-xl text-green-600 shadow-sm flex-shrink-0 mt-0.5">
            <CheckCircle2 size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-700 mb-1">Your account has been restored</p>
            <p className="text-[12px] text-green-600/80 leading-relaxed">
              Your account was inactive, but all your data—chats, contacts, and messages—have been successfully recovered.
            </p>
          </div>
        </div>

        {/* Info section */}
        <div className="space-y-3 text-sm">
          <div className="p-3 rounded-xl bg-primary/5">
            <p className="text-[12px] text-muted-foreground font-medium leading-relaxed">
              You can now access all your previous conversations and contacts. If you notice anything unusual, please check your account settings.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button 
            onClick={onClose} 
            className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90"
          >
            Continue to Chat
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
