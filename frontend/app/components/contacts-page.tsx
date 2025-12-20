import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/avatar-utils';
import { ArrowLeft, ChevronDown, ChevronRight, MessageCircle, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/use-notifications';

interface Contact {
  id: string;
  user: {
    id: string;
    displayName?: string;
    username?: string;
  };
  acceptedAt: string;
}

interface ContactRequest {
  id: string;
  fromUser?: {
    id: string;
    displayName?: string;
    username?: string;
  };
  toUser?: {
    id: string;
    displayName?: string;
    username?: string;
  };
  message?: string;
  status?: string;
  createdAt: string;
}

interface ContactsPageProps {
  onBack: () => void;
  onChatSelect: (userId: string) => void;
  onChatCreated?: (chatId: string) => void;
}

export function ContactsPage({ onBack, onChatSelect, onChatCreated }: ContactsPageProps) {
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
    // Clear notifications when contacts page is opened
    clearNotifications();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contactsRes, incomingRes, outgoingRes] = await Promise.all([
        fetch('http://localhost:4000/contacts', { credentials: 'include' }),
        fetch('http://localhost:4000/contacts/requests/incoming', { credentials: 'include' }),
        fetch('http://localhost:4000/contacts/requests/outgoing', { credentials: 'include' }),
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
    } catch (error) {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`http://localhost:4000/contacts/requests/${requestId}/accept`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Request accepted');
        loadData();

        // Handle chat creation
        if (data.chatId && onChatCreated) {
          onChatCreated(data.chatId);
        }
      } else {
        toast.error('Failed to accept request');
      }
    } catch (error) {
      toast.error('Failed to accept request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`http://localhost:4000/contacts/requests/${requestId}/reject`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Request rejected');
        loadData();
      } else {
        toast.error('Failed to reject request');
      }
    } catch (error) {
      toast.error('Failed to reject request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleContactClick = async (userId: string) => {
    try {
      // Find or create chat with this contact
      const res = await fetch('http://localhost:4000/chats/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otherUserId: userId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (onChatCreated) {
          onChatCreated(data.chatId);
        }
      } else {
        toast.error('Failed to open chat');
      }
    } catch (error) {
      toast.error('Failed to open chat');
    }
  };

  const getInitials = (user: { displayName?: string; username?: string }) => {
    if (user.displayName) {
      return user.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user.username) {
      return user.username.slice(0, 2).toUpperCase();
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onBack} className="mr-3">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">Contacts</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Contacts Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-foreground">📱 Contacts ({contacts.length})</h3>
          </div>

          {contacts.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              <div className="text-sm">No contacts yet</div>
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map(contact => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => handleContactClick(contact.user.id)}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(contact.user)}
                      </AvatarFallback>
                      <AvatarImage src={getAvatarUrl(contact.user.id)} />
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {contact.user.displayName ||
                          `@${contact.user.username}` ||
                          'Anonymous User'}
                      </div>
                      {contact.user.username && (
                        <div className="text-sm text-muted-foreground">
                          @{contact.user.username}
                        </div>
                      )}
                    </div>
                  </div>
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Requests Section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-foreground">
              📨 Requests ({incomingRequests.length + outgoingRequests.length})
            </h3>
          </div>

          {/* Pending Requests Accordion */}
          <div className="mb-4">
            <button
              onClick={() => setPendingExpanded(!pendingExpanded)}
              className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-accent"
            >
              <div className="flex items-center space-x-2">
                {pendingExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="font-medium">Pending ({incomingRequests.length})</span>
              </div>
            </button>

            {pendingExpanded && (
              <div className="mt-2 space-y-2">
                {incomingRequests.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    No pending requests
                  </div>
                ) : (
                  incomingRequests.map(request => (
                    <div key={request.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {getInitials(request.fromUser || {})}
                          </AvatarFallback>
                          {request.fromUser?.id && (
                            <AvatarImage src={getAvatarUrl(request.fromUser.id)} />
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-sm">
                              {request.fromUser?.displayName ||
                                `@${request.fromUser?.username}` ||
                                'Anonymous User'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(request.createdAt)}
                            </div>
                          </div>
                          {request.message && (
                            <div className="mt-1 p-2 bg-muted rounded text-xs">
                              {request.message}
                            </div>
                          )}
                          <div className="flex space-x-2 mt-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleAccept(request.id)}
                              disabled={actionLoading === request.id}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleReject(request.id)}
                              disabled={actionLoading === request.id}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Sent Requests Accordion */}
          <div>
            <button
              onClick={() => setSentExpanded(!sentExpanded)}
              className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-accent"
            >
              <div className="flex items-center space-x-2">
                {sentExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="font-medium">Sent ({outgoingRequests.length})</span>
              </div>
            </button>

            {sentExpanded && (
              <div className="mt-2 space-y-2">
                {outgoingRequests.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    No sent requests
                  </div>
                ) : (
                  outgoingRequests.map(request => (
                    <div key={request.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {getInitials(request.toUser || {})}
                          </AvatarFallback>
                          {request.toUser?.id && (
                            <AvatarImage src={getAvatarUrl(request.toUser.id)} />
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-sm">
                              {request.toUser?.displayName ||
                                `@${request.toUser?.username}` ||
                                'Anonymous User'}
                            </div>
                            <div className="flex items-center space-x-2">
                              <div
                                className={`text-xs px-2 py-1 rounded-full ${
                                  request.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : request.status === 'accepted'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {request.status === 'pending' && (
                                  <Clock className="h-3 w-3 inline mr-1" />
                                )}
                                {request.status || 'pending'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(request.createdAt)}
                              </div>
                            </div>
                          </div>
                          {request.message && (
                            <div className="mt-1 p-2 bg-muted rounded text-xs">
                              {request.message}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
