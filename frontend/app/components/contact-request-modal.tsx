import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from './ui/responsive-modal';
import { type ContactRequest } from '@/types/api';

interface ContactRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ContactRequest | null;
  onAccept: (request: ContactRequest) => void;
  onReject: (request: ContactRequest) => void;
  loading?: boolean;
}

export function ContactRequestModal({
  isOpen,
  onClose,
  request,
  onAccept,
  onReject,
  loading,
}: ContactRequestModalProps) {
  if (!isOpen || !request) return null;

  const getInitials = (from: typeof request.from) => {
    if (!from) return 'U';
    const name = from.displayName || from.value || 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDisplayName = () => {
    if (!request?.from) return 'Unknown User';

    const { displayName, firstName, lastName } = request.from;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    // If both firstName and lastName exist and displayName is different from full name
    if (firstName && lastName && displayName !== fullName) {
      return (
        <>
          <div className="text-lg font-semibold">{displayName}</div>
          <div className="text-sm text-muted-foreground">{fullName}</div>
        </>
      );
    }

    // If only one name exists, show with label
    if (firstName && !lastName) {
      return (
        <>
          <div className="text-lg font-semibold">{displayName}</div>
          <div className="text-sm text-muted-foreground">First name: {firstName}</div>
        </>
      );
    }

    if (lastName && !firstName) {
      return (
        <>
          <div className="text-lg font-semibold">{displayName}</div>
          <div className="text-sm text-muted-foreground">Last name: {lastName}</div>
        </>
      );
    }

    // Only displayName
    return <div className="text-lg font-semibold">{displayName || 'Unknown User'}</div>;
  };

  if (!isOpen || !request) return null;

  const content = (
    <div className="flex flex-col items-center">
      <Avatar className="h-20 w-20 mb-3">
        <AvatarFallback className="bg-primary text-primary-foreground text-xl">
          {getInitials(request.from)}
        </AvatarFallback>
        {request.from?.avatarUrl && <AvatarImage src={request.from.avatarUrl} />}
      </Avatar>
      {getDisplayName()}
      <div className="text-sm text-muted-foreground">
        @{request.from?.alias || request.from?.value || 'unknown'}
      </div>

      {request.from?.bio && (
        <div className="text-sm text-muted-foreground text-center mt-4 mb-4">
          {request.from.bio}
        </div>
      )}

      {request.message && (
        <div className="mb-4 p-3 bg-muted rounded-lg w-full">
          <div className="text-xs text-muted-foreground mb-1">Message:</div>
          <div className="text-sm">{request.message}</div>
        </div>
      )}

      <div className="flex space-x-2 w-full">
        <Button className="flex-1" onClick={() => onAccept(request)} disabled={loading}>
          Accept
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => onReject(request)}
          disabled={loading}
        >
          Reject
        </Button>
      </div>

      <Button variant="ghost" className="w-full mt-2" onClick={onClose} disabled={loading}>
        Later
      </Button>
    </div>
  );

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Contact Request">
      {content}
    </ResponsiveModal>
  );
}
