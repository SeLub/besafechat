import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Check, Clock, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { API_ENDPOINTS } from '@/services/api-gateway';
import { ResponsiveModal } from './ui/responsive-modal';
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

interface ContactRequestsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactRequests({ isOpen, onClose }: ContactRequestsProps) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [incomingRequests, setIncomingRequests] = useState<ContactRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const [incomingRes, outgoingRes] = await Promise.all([
        fetch(API_ENDPOINTS.CONTACTS.REQUESTS_INCOMING, {
          credentials: 'include',
        }),
        fetch(API_ENDPOINTS.CONTACTS.REQUESTS_OUTGOING, {
          credentials: 'include',
        }),
      ]);

      if (incomingRes.ok) {
        const incomingData = await incomingRes.json();
        setIncomingRequests(incomingData.requests || []);
      }

      if (outgoingRes.ok) {
        const outgoingData = await outgoingRes.json();
        setOutgoingRequests(outgoingData.requests || []);
      }
    } catch {
      toast.error('Failed to load requests');
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
        loadRequests();
        // TODO: Handle chat creation when backend implements it
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
        loadRequests();
      } else {
        toast.error('Failed to reject request');
      }
    } catch {
      toast.error('Failed to reject request');
    } finally {
      setActionLoading(null);
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

  const contentJSX = (
    <>
      {/* Tabs */}
      <div className="flex border-b border-border -mx-6 px-6 mb-4">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`flex-1 p-3 text-sm font-medium ${activeTab === 'incoming'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Incoming ({incomingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`flex-1 p-3 text-sm font-medium ${activeTab === 'outgoing'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Sent ({outgoingRequests.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading requests...</div>
          </div>
        ) : (
          <>
            {activeTab === 'incoming' ? (
              incomingRequests.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <div>No incoming requests</div>
                </div>
              ) : (
                incomingRequests.map(request => (
                  <div key={request.id} className="p-4 border border-border rounded-lg">
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(request.from || {})}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {request.from?.displayName ||
                              `@${request.from?.value}` ||
                              'Anonymous User'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(request.createdAt)}
                          </div>
                        </div>
                        {request.from?.value && (
                          <div className="text-sm text-muted-foreground">@{request.from.value}</div>
                        )}
                        {request.message && (
                          <div className="mt-2 p-2 bg-muted rounded text-sm">{request.message}</div>
                        )}
                        <div className="flex space-x-2 mt-3">
                          <Button
                            size="sm"
                            onClick={() => handleAccept(request.id)}
                            disabled={actionLoading === request.id}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(request.id)}
                            disabled={actionLoading === request.id}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : outgoingRequests.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <div>No sent requests</div>
              </div>
            ) : (
              outgoingRequests.map(request => (
                <div key={request.id} className="p-4 border border-border rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(request.from || {})}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          {request.from?.displayName ||
                            `@${request.from?.value}` ||
                            'Anonymous User'}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div
                            className={`text-xs px-2 py-1 rounded-full ${request.status === 'pending'
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
                      {request.from?.value && (
                        <div className="text-sm text-muted-foreground">@{request.from.value}</div>
                      )}
                      {request.message && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">{request.message}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Contact Requests">
      {contentJSX}
    </ResponsiveModal>
  );
}
