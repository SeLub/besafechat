import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Plus, Smile, Mic, Image as ImageIcon, FileText, Video } from 'lucide-react';
import React from 'react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
}

export function MessageInput({ onSendMessage }: MessageInputProps) {
  const [input, setInput] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
    setIsMenuOpen(false);
  };

  return (
    <div className="p-4 bg-background/80 backdrop-blur-lg border-t border-primary/5">
      <div className="max-w-4xl mx-auto flex items-end gap-2">
        {/* Кнопка "Плюс" для вложений */}
        <div className="relative">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`rounded-2xl transition-all duration-300 ${isMenuOpen ? 'rotate-45 bg-primary/10 text-primary' : 'text-muted-foreground'}`}
          >
            <Plus size={22} />
          </Button>

          {/* Быстрое меню вложений (Floating Menu) */}
          {isMenuOpen && (
            <div className="absolute bottom-14 left-0 bg-card border border-primary/10 p-2 rounded-[2rem] shadow-2xl flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
              <AttachmentButton
                icon={<ImageIcon size={18} />}
                label="Image"
                color="text-blue-500"
              />
              <AttachmentButton icon={<Video size={18} />} label="Video" color="text-purple-500" />
              <AttachmentButton
                icon={<FileText size={18} />}
                label="File"
                color="text-orange-500"
              />
              <AttachmentButton icon={<Mic size={18} />} label="Audio" color="text-red-500" />
            </div>
          )}
        </div>

        {/* Основное поле ввода */}
        <div className="relative flex-1 flex items-center bg-primary/5 rounded-[2rem] border border-transparent focus-within:border-primary/20 focus-within:bg-background transition-all px-2 py-1">
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-primary rounded-full transition-colors"
          >
            <Smile size={20} />
          </Button>

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Write securely..."
            className="flex-1 bg-transparent border-none outline-none focus:ring-0 px-2 py-3 text-sm font-medium placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Кнопка отправки или записи голоса */}
        <Button
          onClick={handleSend}
          disabled={!input.trim()}
          size="icon"
          className={`
            rounded-[1.5rem] h-12 w-12 transition-all duration-500
            ${
              input.trim()
                ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-100'
                : 'bg-primary/5 text-muted-foreground scale-90'
            }
          `}
        >
          {input.trim() ? (
            <Send size={20} className="mr-0.5 mt-0.5" strokeWidth={2.5} />
          ) : (
            <Mic size={20} />
          )}
        </Button>
      </div>
    </div>
  );
}

// Вспомогательный компонент для кнопок меню
function AttachmentButton({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <button className="flex items-center gap-3 p-3 hover:bg-primary/5 rounded-2xl transition-colors group">
      <div className={`${color} group-hover:scale-110 transition-transform`}>{icon}</div>
      <span className="text-[11px] font-black uppercase tracking-widest pr-4 opacity-60">
        {label}
      </span>
    </button>
  );
}
