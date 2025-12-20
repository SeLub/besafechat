import { db } from './db';

export type MessageRetentionPeriod = '7' | '30' | '90' | 'forever';

const RETENTION_KEY = 'message_retention_days';

// Получить настройку хранения
export function getRetentionPeriod(): MessageRetentionPeriod {
  return (localStorage.getItem(RETENTION_KEY) as MessageRetentionPeriod) || '90';
}

// Установить настройку хранения
export function setRetentionPeriod(period: MessageRetentionPeriod): void {
  localStorage.setItem(RETENTION_KEY, period);
}

// Очистка старых сообщений
export async function cleanupOldMessages(): Promise<number> {
  const period = getRetentionPeriod();

  if (period === 'forever') {
    return 0;
  }

  const days = parseInt(period);
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

  const deleted = await db.messages.where('timestamp').below(cutoffTime).delete();
  return deleted;
}
