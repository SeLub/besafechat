import { useEffect, useRef } from 'react';
import { getUserAccentColor } from '@/lib/colors';

interface MessageListProps {
  messages: {
    id: string;
    text: string;
    isOwn?: boolean;
    fromUserId?: string;
  }[];
  selectedChat?: any;
}

export function MessageList({ messages, selectedChat }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="middle-column relative flex-1">
      {/* НЕСКРОЛЛИМЫЙ ФОН */}
      <div className="middle-column-bg absolute inset-0 pointer-events-none" />

      {/* СКРОЛЛИМЫЙ СЛОЙ С СООБЩЕНИЯМИ */}
      <div className="message-scroll relative z-10 h-full p-4 overflow-y-auto custom-scroll">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">No messages yet</div>
              <div className="text-sm">Start the conversation!</div>
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const accentColor =
              !msg.isOwn && selectedChat?.publicKey
                ? getUserAccentColor(selectedChat.publicKey)
                : undefined;

            const accentStyle = accentColor
              ? {
                  background: `linear-gradient(to right, ${accentColor} 2%, white 2%)`,
                }
              : undefined;

            return (
              <div
                key={msg.id}
                className={`mb-2 p-3 rounded-lg max-w-xs shadow ${
                  msg.isOwn ? 'ml-auto message-own' : 'message-other'
                }`}
                style={accentStyle}
              >
                {!msg.isOwn && (
                  <div className="text-xs text-muted-foreground mb-1">
                    {selectedChat?.name || 'Unknown'}
                  </div>
                )}
                <div>{msg.text}</div>
              </div>
            );
          })
        )}

        {/* авто-скролл вниз */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
