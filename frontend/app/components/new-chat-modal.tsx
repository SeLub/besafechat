import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '~/hooks/use-auth-context';
import { apiRequest } from '@/services/api-utils';
import { Search, User, X, Sparkles, Send, ShieldAlert, BadgeCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ResponsiveModal } from './ui/responsive-modal';

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

export function NewChatModal({ isOpen, onClose, onChatCreated }: NewChatModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, checkAuth } = useAuth();

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (value.trim()) {
      debounceTimer.current = setTimeout(() => debouncedSearch(value), 500);
    } else {
      setContact(null);
      setSearchError(null);
    }
  };

  const debouncedSearch = async (value: string) => {
    const cleanQuery = value.replace('@', '').trim();
    if (!cleanQuery) return;

    setLoading(true);
    setSearchError(null);

    try {
      const result = await apiRequest<{ handles: any[] }>(
        `/handles/search?q=${encodeURIComponent(cleanQuery)}`,
        { method: 'GET' }
      );

      if (!result.handles || result.handles.length === 0) {
        setSearchError('User not found in Sky network');
        setContact(null);
        return;
      }

      const handle = result.handles[0];
      const isCurrentUser = user?.identity.id === handle.ownerIdentityId;

      let requestStatus = 'none';
      if (!isCurrentUser) {
        try {
          const statusData = await apiRequest<{ status: string }>(`/contacts/check/${handle.id}`, {
            method: 'GET',
          });
          requestStatus = statusData?.status || 'none';
        } catch {
          /* ignore */
        }
      }

      const profileData = await apiRequest<{ profile: any }>(`/profiles/public/${handle.value}`, {
        method: 'GET',
      }).catch(() => ({ profile: null }));

      const profile = profileData.profile;

      setContact({
        handle: {
          id: handle.id,
          value: handle.value,
          alias: handle.alias || null,
          matchedBy: profile?.handle.matchedBy || 'value',
        },
        displayName: profile?.displayName || handle.value,
        firstName: profile?.firstName || null,
        lastName: profile?.lastName || null,
        avatarUrl: profile?.avatarUrl || null,
        bio: profile?.bio || null,
        requestStatus,
        isCurrentUser,
        ownerIdentityId: handle.ownerIdentityId,
      });
    } catch {
      setSearchError('Search failed. Check your connection.');
    } finally {
      setLoading(false);
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

      toast.success(`Connection request sent!`);
      onClose();
      resetState();
    } catch (error: any) {
      if (error.status === 401) {
        await checkAuth();
        toast.error('Session expired. Retrying...');
      } else {
        toast.error(error.message || 'Failed to send request');
      }
    } finally {
      setCreating(false);
    }
  };

  const resetState = () => {
    setSearchQuery('');
    setContact(null);
    setMessage('');
    setSearchError(null);
  };

  const getDisplayName = (c: ContactProfile) => {
    if (c.firstName || c.lastName) {
      return [c.firstName, c.lastName].filter(Boolean).join(' ');
    }
    return c.displayName;
  };

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="New Conversation">
      <div className="space-y-6 pb-2">
        {/* Search Bar */}
        <div className="relative group">
          <div
            className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${loading ? 'text-primary animate-pulse' : 'text-muted-foreground group-focus-within:text-primary'}`}
          >
            {loading ? <Sparkles size={18} /> : <Search size={18} />}
          </div>
          <input
            type="text"
            placeholder="Search by @username or alias..."
            value={searchQuery}
            onChange={e => handleInputChange(e.target.value)}
            className="w-full pl-12 pr-4 h-14 bg-primary/5 border border-transparent focus:border-primary/20 focus:bg-background rounded-[1.5rem] outline-none transition-all font-medium text-sm"
          />
        </div>

        <div className="min-h-[280px] flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-primary/5 bg-primary/[0.01] px-6 py-8">
          {searchError ? (
            <div className="text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4 text-destructive">
                <ShieldAlert size={32} />
              </div>
              <p className="text-sm font-bold text-destructive/80 mb-1">User Not Found</p>
              <p className="text-[11px] text-muted-foreground">{searchError}</p>
            </div>
          ) : !contact ? (
            <div className="text-center opacity-40">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <User size={32} />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em]">
                Enter Sky Identity
              </p>
            </div>
          ) : (
            <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Profile Card */}
              <div className="flex flex-col items-center text-center space-y-3 mb-6">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-2xl shadow-primary/20">
                    <AvatarImage src={contact.avatarUrl || ''} />
                    <AvatarFallback className="bg-primary text-white text-3xl font-black italic">
                      {getDisplayName(contact).slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 bg-background p-1 rounded-full border-2 border-primary/20">
                    <BadgeCheck size={20} className="text-primary fill-primary/10" />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-black tracking-tight">{getDisplayName(contact)}</h3>
                  <p className="text-xs font-bold text-primary italic opacity-70">
                    @{contact.handle.value}
                  </p>
                </div>

                {contact.bio && (
                  <p className="text-[11px] text-muted-foreground font-medium max-w-[240px] leading-relaxed italic">
                    "{contact.bio}"
                  </p>
                )}
              </div>

              {/* Action Area */}
              <div className="space-y-3 pt-4 border-t border-primary/5">
                {!contact.isCurrentUser && contact.requestStatus === 'none' && (
                  <textarea
                    placeholder="Add a secure intro message..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full p-4 bg-background border border-primary/10 rounded-2xl outline-none focus:border-primary/40 transition-all text-xs font-medium resize-none"
                    rows={2}
                  />
                )}

                <Button
                  className={`w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all duration-500 ${contact.isCurrentUser || contact.requestStatus !== 'none' ? 'opacity-50 grayscale' : 'shadow-xl shadow-primary/20'}`}
                  disabled={creating || contact.isCurrentUser || contact.requestStatus !== 'none'}
                  onClick={handleSendRequest}
                >
                  {creating ? (
                    <Sparkles size={16} className="animate-spin mr-2" />
                  ) : contact.isCurrentUser ? (
                    'That is you'
                  ) : contact.requestStatus !== 'none' ? (
                    contact.requestStatus.replace('_', ' ')
                  ) : (
                    <>
                      <Send size={14} className="mr-2" />
                      Establish Connection
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
