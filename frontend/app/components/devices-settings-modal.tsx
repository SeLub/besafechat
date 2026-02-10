import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QrCode, Smartphone, Monitor, Tablet, X } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINTS } from '@/services/api-gateway';

interface Session {
  id: string;
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  current: boolean;
}

interface DevicesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DevicesSettingsModal({ isOpen, onClose }: DevicesSettingsModalProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const currentSession = sessions.find(s => s.current);
  const otherSessions = sessions.filter(s => !s.current);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

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
    }
  };

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
    if (model.includes('mobile') || model.includes('phone'))
      return <Smartphone className="h-5 w-5" />;
    if (model.includes('tablet') || model.includes('ipad')) return <Tablet className="h-5 w-5" />;
    return <Monitor className="h-5 w-5" />;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Devices</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* QR Code Button */}
          <div className="border border-border rounded-lg p-4">
            <Button variant="outline" className="w-full" disabled>
              <QrCode className="h-5 w-5 mr-2" />
              Connect with QR Code
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Coming soon: Scan QR code to link a new device
            </p>
          </div>

          {/* Current Device */}
          {currentSession && (
            <div>
              <h3 className="text-sm font-medium mb-3">Your Device</h3>
              <div className="border border-primary rounded-lg p-4 bg-primary/5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="text-primary mt-1">
                      {getDeviceIcon(currentSession.deviceName)}
                    </div>
                    <div>
                      <div className="font-medium">{currentSession.deviceId}</div>
                      <div className="text-sm text-muted-foreground">
                        {currentSession.deviceName}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        IP: {currentSession.ipAddress}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Active: {formatDate(currentSession.lastActiveAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-primary">Current</div>
                </div>
              </div>
            </div>
          )}

          {/* Active Sessions */}
          {otherSessions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Active Sessions</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseAllOtherSessions}
                  disabled={loading}
                  className="text-destructive hover:text-destructive"
                >
                  Close All Other Sessions
                </Button>
              </div>
              <div className="space-y-2">
                {otherSessions.map(session => (
                  <div
                    key={session.id}
                    className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="text-muted-foreground mt-1">
                          {getDeviceIcon(session.deviceName)}
                        </div>
                        <div>
                          <div className="font-medium">{session.deviceId}</div>
                          <div className="text-sm text-muted-foreground">{session.deviceName}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            IP: {session.ipAddress}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last active: {formatDate(session.lastActiveAt)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRevokeSession(session.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherSessions.length === 0 && currentSession && (
            <div className="text-center text-sm text-muted-foreground py-4">
              No other active sessions
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
