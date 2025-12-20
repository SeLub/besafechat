import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
}

export function MessageInput({ onSendMessage }: MessageInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="middle-column-footer border-t border-border p-4">
      {/* items-center — чтобы выровнять по вертикали */}
      <div className="flex items-center">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="
            flex-1
            px-4
            py-2
            h-10
            bg-muted
            rounded-l-lg
            border-0
            outline-none
            ring-0
            focus:outline-none
            focus:ring-0
            placeholder:opacity-70
            box-border
          "
        />
        <Button
          onClick={handleSend}
          className="
            px-4
            py-2
            h-10
            rounded-l-none
            rounded-r-lg
            border-0
            outline-none
            ring-0
            focus:outline-none
            focus:ring-0
            box-border
          "
          disabled={!input.trim()}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
