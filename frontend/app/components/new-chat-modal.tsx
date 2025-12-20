import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { X, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

interface SearchResult {
  publicKey: string;
  username?: string;
  displayName?: string;
  userId?: string;
  requestStatus?: string;
}

export function NewChatModal({ isOpen, onClose, onChatCreated }: NewChatModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const { checkAuth } = useAuth();

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    // Remove @ if user typed it
    const cleanQuery = searchQuery.replace('@', '');

    setLoading(true);
    setSearchError(null);
    setSearchResults([]); // Clear previous results

    try {
      const res = await fetch(`http://localhost:4000/username/search/${cleanQuery}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        // Only add to results if we have valid data
        if (data && data.publicKey) {
          // Check request status
          const statusRes = await fetch(`http://localhost:4000/contacts/check/${data.id}`, {
            credentials: 'include',
          });

          let requestStatus = 'none';
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            requestStatus = statusData.status;
          }

          setSearchResults([
            {
              publicKey: data.publicKey,
              username: cleanQuery,
              displayName: data.displayName,
              userId: data.id,
              requestStatus,
            },
          ]);
          setSearchError(null);
        } else {
          setSearchResults([]);
          setSearchError('User not found');
        }
      } else {
        setSearchResults([]);
        setSearchError('User not found');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setSearchError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string, username: string) => {
    setCreating(true);
    try {
      const res = await fetch('http://localhost:4000/contacts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          toUserId: userId,
          message: message.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        await checkAuth();
        toast.error('Session expired. Please try again.');
        return;
      }

      if (res.ok) {
        toast.success(`Request sent to @${username}`);
        onClose();
        setMessage('');
        setSearchQuery('');
        setSearchResults([]);
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || 'Failed to send request');
      }
    } catch (error) {
      toast.error('Failed to send request');
    } finally {
      setCreating(false);
    }
  };

  const getInitials = (result: SearchResult) => {
    if (result.displayName) {
      return result.displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (result.username) {
      return result.username.slice(0, 2).toUpperCase();
    }
    return result.publicKey.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 bg-background border border-border rounded-lg shadow-lg z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">New Chat</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="@username"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
              {loading ? '...' : 'Search'}
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto">
          {searchError ? (
            <div className="p-8 text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <div className="text-sm text-red-600">{searchError}</div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <div className="text-sm">Search for users by username</div>
            </div>
          ) : (
            <>
              {searchResults.map(result => (
                <div key={result.publicKey} className="p-4 border-b border-border">
                  <div className="flex items-center space-x-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(result)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {result.displayName || `@${result.username}` || 'Anonymous User'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {result.username && `@${result.username}`}
                      </div>
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="mb-3">
                    <textarea
                      placeholder="Hi! Let's connect (optional)"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      className="w-full p-2 bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      rows={2}
                      maxLength={200}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      {message.length}/200 characters
                    </div>
                  </div>

                  {result.requestStatus === 'connected' ? (
                    <Button className="w-full" disabled>
                      Already Connected
                    </Button>
                  ) : result.requestStatus === 'sent' ? (
                    <Button className="w-full" disabled>
                      Request Sent
                    </Button>
                  ) : result.requestStatus === 'received' ? (
                    <Button className="w-full" disabled>
                      Request Received
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      disabled={creating}
                      onClick={() =>
                        handleSendRequest(result.userId || result.publicKey, result.username || '')
                      }
                    >
                      {creating ? 'Sending...' : 'Send Request'}
                    </Button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
