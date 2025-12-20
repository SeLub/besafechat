import { MiddleHeader } from '@/components/middle-header';
import { MessageList } from '@/components/message-list';
import { MessageInput } from '@/components/message-input';

interface MiddleColumnProps {
  selectedChat: any;
  messages: {
    id: string;
    text: string;
    isOwn?: boolean;
    fromUserId?: string;
  }[];
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  onSendMessage: (message: string) => void;
}

export function MiddleColumn({
  selectedChat,
  messages,
  rightPanelOpen,
  onToggleRightPanel,
  onSendMessage,
}: MiddleColumnProps) {
  return (
    <div id="MiddleColumn" className="flex-1 flex flex-col">
      {selectedChat ? (
        <>
          <MiddleHeader
            selectedChat={selectedChat}
            rightPanelOpen={rightPanelOpen}
            onToggleRightPanel={onToggleRightPanel}
          />
          <MessageList messages={messages} selectedChat={selectedChat} />
          <MessageInput onSendMessage={onSendMessage} />
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">Select a chat</div>
            <div className="text-sm">Choose a conversation to start messaging</div>
          </div>
        </div>
      )}
    </div>
  );
}
