import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '~/hooks/use-auth-context';
import { apiRequest } from '@/services/api-utils';
import { Search, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => Promise<void>;
}

interface ContactProfile {
  handle: {
    id: string;
    value: string;
    alias: string | null;
    matchedBy: 'value' | 'alias';
  };
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  requestStatus: string;
  isCurrentUser: boolean;
  ownerIdentityId: string;
}

export function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, checkAuth } = useAuth();

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const debouncedSearch = async (value: string) => {
    if (!value.trim()) return;

    const cleanQuery = value.replace('@', '');

    setLoading(true);
    setSearchError(null);
    setContact(null);

    try {
      const result = await apiRequest<{ handles: any[] }>(
        `/handles/search?q=${encodeURIComponent(cleanQuery)}`,
        { method: 'GET' }
      );

      if (!result.handles || result.handles.length === 0) {
        setSearchError('User not found');
        return;
      }

      const handle = result.handles[0];
      const isCurrentUser = user?.identity.id === handle.ownerIdentityId;

      let requestStatus = 'none';
      if (!isCurrentUser) {
        try {
          const statusData = await apiRequest<{ status: string }>(
            `/contacts/check/${handle.id}`,
            { method: 'GET' }
          );
          if (statusData?.status) {
            requestStatus = statusData.status;
          }
        } catch {
          // ignore status check errors
        }
      }

      try {
        const profileData = await apiRequest<{ profile: any }>(
          `/profiles/public/${handle.value}`,
          { method: 'GET' }
        );

        const profile = profileData.profile;
        setContact({
          handle: {
            id: profile.handle.id,
            value: profile.handle.value,
            alias: profile.handle.alias,
            matchedBy: profile.handle.matchedBy,
          },
          displayName: profile.displayName,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
          requestStatus,
          isCurrentUser,
          ownerIdentityId: handle.ownerIdentityId,
        });
      } catch {
        setContact({
          handle: {
            id: handle.id,
            value: handle.value,
            alias: handle.alias || null,
            matchedBy: 'value',
          },
          displayName: handle.value,
          firstName: null,
          lastName: null,
          avatarUrl: null,
          bio: null,
          requestStatus,
          isCurrentUser,
          ownerIdentityId: handle.ownerIdentityId,
        });
      }
    } catch {
      setSearchError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    await debouncedSearch(searchQuery);
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (value.trim()) {
      debounceTimer.current = setTimeout(() => {
        debouncedSearch(value);
      }, 500);
    } else {
      setContact(null);
      setSearchError(null);
    }
  };

  const handleSendRequest = async () => {
    if (!contact) return;
    setCreating(true);
    try {
      await apiRequest('/contacts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toHandleId: contact.handle.id,
          message: message.trim() || undefined,
        }),
      });

      const displayHandle = contact.handle.matchedBy === 'alias' && contact.handle.alias
        ? contact.handle.alias
        : contact.handle.value;
      toast.success(`Request sent to @${displayHandle}`);
      onClose();
      setMessage('');
      setSearchQuery('');
      setContact(null);
    } catch (error: any) {
      if (error.status === 401) {
        await checkAuth();
        toast.error('Session expired. Please try again.');
      } else if (error.status === 409) {
        toast.info('Request already sent to this user');
      } else {
        toast.error(error.message || 'Failed to send request');
      }
    } finally {
      setCreating(false);
    }
  };

  const getDisplayHandle = (c: ContactProfile) => {
    return c.handle.matchedBy === 'alias' && c.handle.alias
      ? c.handle.alias
      : c.handle.value;
  };

  const getDisplayName = (c: ContactProfile) => {
    if (c.firstName || c.lastName) {
      return [c.firstName, c.lastName].filter(Boolean).join(' ');
    }
    return c.displayName;
  };

  const getInitials = (c: ContactProfile) => {
    const name = getDisplayName(c);
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
        }}
        role="button"
        tabIndex={-1}
        aria-label="Close modal"
      />

      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[480px] bg-background border border-border rounded-lg shadow-lg z-50">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">New Chat</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 border-b border-border">
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="@username or alias"
                value={searchQuery}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
              {loading ? '...' : 'Search'}
            </Button>
          </div>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          {searchError ? (
            <div className="p-8 text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <div className="text-sm text-red-600">{searchError}</div>
            </div>
          ) : !contact ? (
            <div className="p-8 text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <div className="text-sm">Search for users by username or alias</div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex flex-col items-center mb-4">
                <Avatar className="h-16 w-16 mb-3">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {getInitials(contact)}
                  </AvatarFallback>
                  {contact.avatarUrl && (
                    <AvatarImage src={contact.avatarUrl} />
                  )}
                </Avatar>
                <div className="text-sm text-muted-foreground">
                  @{getDisplayHandle(contact)}
                </div>
                <div className="text-lg font-semibold mt-1">
                  {getDisplayName(contact)}
                </div>
              </div>

              {contact.bio && (
                <div className="text-sm text-muted-foreground text-center mb-4">
                  {contact.bio}
                </div>
              )}

              <div className="border-t border-border pt-4">
                {!contact.isCurrentUser && contact.requestStatus !== 'connected' && (
                  <>
                    <textarea
                      placeholder="Hi! Let's connect (optional)"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      className="w-full p-2 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      rows={2}
                      maxLength={200}
                    />
                    <div className="text-xs text-muted-foreground mt-1 mb-3">
                      {message.length}/200 characters
                    </div>
                  </>
                )}

                {contact.isCurrentUser ? (
                  <Button className="w-full" disabled>
                    This is you
                  </Button>
                ) : contact.requestStatus === 'connected' ? (
                  <Button className="w-full" disabled>
                    Already Connected
                  </Button>
                ) : contact.requestStatus === 'sent' ? (
                  <Button className="w-full" disabled>
                    Request Sent
                  </Button>
                ) : contact.requestStatus === 'received' ? (
                  <Button className="w-full" disabled>
                    Request Received
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={creating}
                    onClick={handleSendRequest}
                  >
                    {creating ? 'Sending...' : 'Send Request'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
