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
    <div
      id="MiddleColumn"
      className="flex-1 flex flex-col bg-gradient-to-b from-background to-primary/5 relative"
    >
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
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <div className="w-20 h-20 mb-6 rounded-[2.5rem] bg-primary/10 flex items-center justify-center text-primary animate-pulse">
            {/* Вариант А твоей птицы Leteem здесь */}
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 12C3 12 7 14 10 11C13 8 18 4 21 5C18 6 15 9 13 12C11 15 10 19 10 19C9 16 6 14 3 12Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2">Your Sky is Clear</h2>
          <p className="max-w-[280px] text-muted-foreground font-medium italic">
            Select a conversation to start encrypted messaging or create a new Identity link.
          </p>
        </div>
      )}
    </div>
  );
}
