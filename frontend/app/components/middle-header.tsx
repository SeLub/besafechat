// /home/selub/Documents/progs/besafechat/frontend/app/components/middle-header.tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useOnlineStatusContext } from '@/hooks/use-online-status-context';
import { Info, MoreVertical, Phone, ShieldCheck, Video } from 'lucide-react';

interface MiddleHeaderProps {
  selectedChat: any;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onBackToChats?: () => void; // For mobile navigation
}

export function MiddleHeader({
  selectedChat,
  rightPanelOpen,
  onToggleRightPanel,
  onBackToChats,
}: MiddleHeaderProps) {
  const { getOnlineStatus } = useOnlineStatusContext();
  const isOnline = getOnlineStatus(selectedChat.handleId);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="bg-background/80 backdrop-blur-md border-b border-primary/5 p-4 sticky top-0 z-40">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* User Info Section */}
        <div className="flex items-center">
          {/* Back button for mobile */}
          {onBackToChats && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToChats}
              className="mr-2 rounded-xl hover:bg-primary/5 sm:hidden"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-arrow-left h-5 w-5"
              >
                <path d="m12 19-7-7 7-7"></path>
                <path d="M19 12H5"></path>
              </svg>
            </Button>
          )}

          <div
            className="flex items-center group cursor-pointer"
            onClick={onToggleRightPanel}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                onToggleRightPanel();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Show info for ${selectedChat.name}`}
          >
            <div className="relative">
              <Avatar className="h-11 w-11 transition-transform group-hover:scale-105 duration-300 shadow-sm">
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {getInitials(selectedChat.name)}
                </AvatarFallback>
                {selectedChat.avatarUrl && (
                  <AvatarImage src={selectedChat.avatarUrl} className="object-cover" />
                )}
              </Avatar>
              {isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-[3px] border-background animate-in zoom-in duration-500" />
              )}
            </div>

            <div className="ml-3 flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-[15px]">{selectedChat.name}</span>
                <ShieldCheck size={14} className="text-primary/40" />
              </div>
              <div className="text-[11px] font-medium flex items-center transition-colors">
                {isOnline ? (
                  <span className="text-primary animate-pulse">Online</span>
                ) : (
                  <span className="text-muted-foreground opacity-70">Last seen recently</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <div className="hidden sm:flex items-center gap-1 mr-2 pr-2 border-r border-primary/5">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-primary/5 hover:text-primary transition-all active:scale-90"
            >
              <Phone size={18} strokeWidth={2.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-primary/5 hover:text-primary transition-all active:scale-90"
            >
              <Video size={18} strokeWidth={2.5} />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleRightPanel}
            className={`rounded-xl transition-all duration-300 ${rightPanelOpen ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5'}`}
          >
            <Info size={20} strokeWidth={rightPanelOpen ? 3 : 2} />
          </Button>

          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/5 sm:hidden">
            <MoreVertical size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}
