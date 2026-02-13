import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useNotifications } from '~/hooks/use-notifications-context';
import { useOnlineStatusContext } from '~/hooks/use-online-status-context';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Clock, MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { API_ENDPOINTS } from '@/services/api-gateway';

interface Contact {
  id: string;
  user: {
    id: string;
    displayName?: string;
    handle?: string;
    avatarUrl?: string;
    firstName?: string;
    lastName?: string;
    bio?: string;
  };
  acceptedAt: string;
}

interface ContactRequest {
  id: string;
  from: {
    handleId: string;
    value: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    bio: string | null;
  };
  to: {
    handleId: string;
  };
  message?: string;
  status?: string;
  createdAt: string;
}

interface ContactsPageProps {
  onBack: () => void;
  onChatSelect: (userId: string) => void;
}

export function ContactsPage({ onBack }: ContactsPageProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<ContactRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingExpanded, setPendingExpanded] = useState(true);
  const [sentExpanded, setSentExpanded] = useState(false);
  const { clearNotifications } = useNotifications();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Clear notifications when contacts page is opened
    clearNotifications();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contactsRes, incomingRes, outgoingRes] = await Promise.all([
        fetch(API_ENDPOINTS.CONTACTS.GET_ALL, { credentials: 'include' }),
        fetch(API_ENDPOINTS.CONTACTS.REQUESTS_INCOMING, { credentials: 'include' }),
        fetch(API_ENDPOINTS.CONTACTS.REQUESTS_OUTGOING, { credentials: 'include' }),
      ]);

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setContacts(contactsData.contacts || []);
      }

      if (incomingRes.ok) {
        const incomingData = await incomingRes.json();
        setIncomingRequests(incomingData.requests || []);
      }

      if (outgoingRes.ok) {
        const outgoingData = await outgoingRes.json();
        setOutgoingRequests(outgoingData.requests || []);
      }
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(API_ENDPOINTS.CONTACTS.REQUESTS_ACCEPT(requestId), {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Request accepted');
        loadData();

        // Handle chat creation
      } else {
        toast.error('Failed to accept request');
      }
    } catch {
      toast.error('Failed to accept request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(API_ENDPOINTS.CONTACTS.REQUESTS_REJECT(requestId), {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Request rejected');
        loadData();
      } else {
        toast.error('Failed to reject request');
      }
    } catch {
      toast.error('Failed to reject request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleContactClick = async (userId: string) => {
    try {
      // Find or create chat with this contact
      await fetch(API_ENDPOINTS.CHATS.FIND_OR_CREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otherUserId: userId }),
      });
    } catch {
      toast.error('Failed to open chat');
    }
  };

  const getInitials = (user: { displayName?: string; value?: string }) => {
    if (user.displayName) {
      return user.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user.value) {
      return user.value.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center p-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">Contacts</h2>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card/30 backdrop-blur-xl">
      {/* Sky Header */}
      <div className="flex items-center p-5 mb-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="mr-3 rounded-2xl hover:bg-primary/10 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-black tracking-tight text-foreground italic">
          Contacts<span className="text-primary not-italic">.</span>
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-6">
        {/* Main Contacts Section */}
        <div className="space-y-2">
          <div className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary/40">
            Connections ({contacts.length})
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-primary/5 bg-primary/5 shadow-sm">
            {contacts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground/50 text-sm font-medium">
                No contacts yet. Start a journey!
              </div>
            ) : (
              contacts.map(contact => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between px-5 py-4 hover:bg-primary/5 transition-all cursor-pointer group border-b border-primary/5 last:border-0"
                  onClick={() => onChatSelect(contact.user.id)}
                  onKeyDown={e =>
                    (e.key === 'Enter' || e.key === ' ') && onChatSelect(contact.user.id)
                  }
                  tabIndex={0}
                  role="button"
                >
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                      <AvatarFallback className="bg-primary text-white font-bold text-xs">
                        {getInitials(contact.user)}
                      </AvatarFallback>
                      {contact.user.avatarUrl && <AvatarImage src={contact.user.avatarUrl} />}
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {contact.user.displayName || 'Anonymous'}
                      </div>
                      <div className="text-[10px] font-bold text-primary/30 uppercase tracking-widest truncate">
                        @{contact.user.handle || 'unknown'}
                      </div>
                    </div>
                  </div>
                  <div className="text-primary/10 group-hover:text-primary/40 transition-colors">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Requests Container */}
        <div className="space-y-4">
          <div className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-primary/40">
            Inbox & Requests
          </div>

          {/* Incoming Accordion */}
          <div className="rounded-[2rem] border border-primary/5 bg-primary/5 overflow-hidden shadow-sm">
            <button
              onClick={() => setPendingExpanded(!pendingExpanded)}
              className="flex items-center justify-between w-full px-5 py-4 hover:bg-primary/5 transition-colors"
            >
              <span className="text-sm font-black uppercase tracking-wider text-foreground/70">
                Pending ({incomingRequests.length})
              </span>
              {pendingExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {pendingExpanded && (
              <div className="px-2 pb-2 space-y-1">
                {incomingRequests.length === 0 ? (
                  <div className="px-5 py-6 text-center text-xs text-muted-foreground/40 italic">
                    Quiet in the sky...
                  </div>
                ) : (
                  incomingRequests.map(request => (
                    <div
                      key={request.id}
                      className="bg-background/40 rounded-[1.5rem] p-4 mb-2 border border-primary/5"
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-[10px] font-bold bg-primary/20 text-primary">
                            {getInitials(request.from || {})}
                          </AvatarFallback>
                          {request.from?.avatarUrl && <AvatarImage src={request.from.avatarUrl} />}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">
                            {request.from?.displayName || `@${request.from?.value}`}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-medium">
                            {formatDate(request.createdAt)}
                          </div>
                        </div>
                      </div>
                      {request.message && (
                        <div className="mb-3 p-3 rounded-2xl bg-primary/5 text-xs text-foreground/80 leading-relaxed italic">
                          "{request.message}"
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 rounded-xl h-8 text-[11px] font-bold shadow-lg shadow-primary/20"
                          onClick={() => handleAccept(request.id)}
                          disabled={actionLoading === request.id}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 rounded-xl h-8 text-[11px] font-bold hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleReject(request.id)}
                          disabled={actionLoading === request.id}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Sent Accordion */}
          <div className="rounded-[2rem] border border-primary/5 bg-primary/5 overflow-hidden shadow-sm">
            <button
              onClick={() => setSentExpanded(!sentExpanded)}
              className="flex items-center justify-between w-full px-5 py-4 hover:bg-primary/5 transition-colors"
            >
              <span className="text-sm font-black uppercase tracking-wider text-foreground/70">
                Sent ({outgoingRequests.length})
              </span>
              {sentExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {sentExpanded && (
              <div className="px-2 pb-2 space-y-1">
                {outgoingRequests.map(request => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between px-5 py-4 bg-background/20 rounded-[1.5rem] mb-1"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="text-primary/40">
                        <Clock size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {request.from?.displayName || 'Request'}
                        </div>
                        <div className="text-[9px] font-black uppercase text-yellow-600/60 tracking-tighter">
                          {request.status || 'Waiting'}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground">
                      {formatDate(request.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
