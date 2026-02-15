import { Check, CheckCheck, Clock } from 'lucide-react';

// 1. Объявляем тип (теперь он будет доступен везде)
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

interface MessageStatusProps {
  status?: MessageStatus;
  isOwn?: boolean;
}

export function MessageStatusIcon({ status, isOwn }: MessageStatusProps) {
  // Статусы важны только для наших сообщений
  if (!isOwn) return null;

  switch (status) {
    case 'sending':
      return <Clock size={10} className="animate-pulse opacity-70" />;
    case 'sent':
      return <Check size={10} className="opacity-70" />;
    case 'delivered':
      return <CheckCheck size={10} className="opacity-70" />;
    case 'read':
      // Голубые галочки в стиле Telegram 🔵
      return <CheckCheck size={10} className="text-blue-400" />;
    default:
      return null;
  }
}
