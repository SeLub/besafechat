import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/avatar-utils";
import { Phone, Video, Info } from "lucide-react";

interface MiddleHeaderProps {
  selectedChat: any;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}

export function MiddleHeader({ selectedChat, rightPanelOpen, onToggleRightPanel }: MiddleHeaderProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="MiddleHeader border-b border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(selectedChat.name)}
            </AvatarFallback>
            {selectedChat.userId && <AvatarImage src={getAvatarUrl(selectedChat.userId)} />}
          </Avatar>
          <div className="ml-3">
            <div className="font-medium">{selectedChat.name}</div>
            <div className="text-sm text-muted-foreground flex items-center">
              {selectedChat.isOnline && (
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              )}
              {selectedChat.isOnline ? "Online" : "Last seen recently"}
            </div>
          </div>
        </div>

        {/* Chat Actions */}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onToggleRightPanel}
          >
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}