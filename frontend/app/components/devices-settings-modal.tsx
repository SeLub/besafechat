import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { QrCode, Smartphone, Monitor, Tablet, ShieldCheck, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINTS } from '@/services/api-gateway';
import { ResponsiveModal } from './ui/responsive-modal'; // Используем нашу новую обертку
import { type Session } from '@/types';

interface DevicesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DevicesSettingsModal({ isOpen, onClose }: DevicesSettingsModalProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const currentSession = sessions.find(s => s.current);
  const otherSessions = sessions.filter(s => !s.current);

  const fetchSessions = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.SESSIONS, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.data.sessions);
      }
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.SESSIONS_REVOKE(sessionId), {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        toast.success('Session terminated');
        fetchSessions();
      }
    } catch {
      toast.error('Failed to terminate session');
    }
  };

  const handleCloseAllOtherSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.SESSIONS_REVOKE_ALL, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        toast.success('All other sessions closed');
        fetchSessions();
      }
    } catch {
      toast.error('Failed to close sessions');
    } finally {
      setLoading(false);
    }
  };

  const getDeviceIcon = (deviceModel?: string) => {
    const model = deviceModel?.toLowerCase() || '';
    if (model.includes('mobile') || model.includes('phone') || model.includes('iphone'))
      return <Smartphone className="h-5 w-5" />;
    if (model.includes('tablet') || model.includes('ipad')) return <Tablet className="h-5 w-5" />;
    return <Monitor className="h-5 w-5" />;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Devices">
      <div className="space-y-8 pb-4">
        {/* QR Section - Sky Style */}
        <div className="relative overflow-hidden rounded-[2rem] bg-primary/5 border border-primary/10 p-6 text-center">
          <div className="relative z-10">
            <div className="mx-auto w-12 h-12 bg-background rounded-2xl flex items-center justify-center shadow-sm mb-3">
              <QrCode className="h-6 w-6 text-primary" />
            </div>
            <h4 className="text-sm font-bold mb-1">Link New Device</h4>
            <p className="text-[11px] text-muted-foreground mb-4">
              Scan QR code to securely sync your chats
            </p>
            <Button
              variant="outline"
              className="w-full rounded-xl border-primary/20 bg-background/50 hover:bg-background font-bold text-xs uppercase tracking-widest h-10"
              disabled
            >
              Coming Soon
            </Button>
          </div>
        </div>

        {initialLoading ? (
          <div className="py-12 flex flex-col items-center animate-pulse">
            <div className="h-10 w-10 bg-primary/10 rounded-full mb-4" />
            <div className="h-3 w-24 bg-primary/5 rounded" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Device */}
            {currentSession && (
              <div className="space-y-3">
                <div className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">
                  This Device
                </div>
                <div className="relative group overflow-hidden rounded-[2rem] bg-primary/10 border-2 border-primary/20 p-5 transition-all">
                  <div className="absolute top-0 right-0 p-4">
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary text-[9px] font-black uppercase text-white shadow-lg shadow-primary/20">
                      <ShieldCheck size={10} /> Online
                    </span>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-background rounded-2xl shadow-sm text-primary">
                      {getDeviceIcon(currentSession.deviceName)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate pr-16">
                        {currentSession.deviceName || 'Unknown Browser'}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-medium opacity-70">
                        IP: {currentSession.ipAddress}
                      </div>
                      <div className="text-[10px] font-bold text-primary mt-2 uppercase tracking-wider italic">
                        Active Now
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other Devices */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">
                  Active Sessions
                </div>
                {otherSessions.length > 0 && (
                  <button
                    onClick={handleCloseAllOtherSessions}
                    disabled={loading}
                    className="text-[9px] font-black uppercase tracking-widest text-destructive hover:underline disabled:opacity-50"
                  >
                    Terminate All
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {otherSessions.length > 0
                  ? otherSessions.map(session => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-4 rounded-[1.5rem] bg-card border border-primary/5 hover:border-primary/20 transition-all group"
                      >
                        <div className="flex items-center space-x-4 min-w-0">
                          <div className="p-2.5 bg-primary/5 rounded-xl text-primary/60 group-hover:text-primary transition-colors">
                            {getDeviceIcon(session.deviceName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[13px] truncate">
                              {session.deviceName || 'Linked Device'}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate italic">
                              Last seen: {formatDate(session.lastActiveAt)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevokeSession(session.id)}
                          className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        >
                          <LogOut size={16} />
                        </Button>
                      </div>
                    ))
                  : !initialLoading && (
                      <div className="text-center py-8 rounded-[2rem] border-2 border-dashed border-primary/5">
                        <p className="text-[11px] font-bold text-primary/30 uppercase tracking-[0.2em]">
                          Secure • No other sessions
                        </p>
                      </div>
                    )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}
