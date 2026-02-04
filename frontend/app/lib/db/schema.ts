// /home/selub/Documents/progs/besafechat/frontend/app/lib/db/schema.ts

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  contentType: 'text' | 'image' | 'file';

  // Шифрованные данные
  encryptedContent: ArrayBuffer; // Зашифрованное содержимое (ArrayBuffer для IndexedDB)
  salt: ArrayBuffer; // Соль для деривации ключа
  iv: ArrayBuffer; // Вектор инициализации

  // Метаданные
  timestamp: number;
  isOwn: boolean;

  // Опциональные поля
  authTag?: ArrayBuffer; // Тег аутентификации (для AES-GCM)
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  editedAt?: number;
  replyToId?: string;
  metadata?: Record<string, any>;
}

export interface Contact {
  displayName: string;
  contactId: string; // Contact ID
  userId: string; // UUID of contragent
}

export interface PublicKey {
  id: string; // Всегда "current" (только один ключ на устройство)
  publicKeyBase64: string; // Ed25519 публичный ключ в base64 (44 символа)
  createdAt: number;
}

export type MessageRetentionPeriod = '7' | '30' | '90' | 'forever';

// Dexie схема
export const SCHEMA = {
  messages: 'id, chatId, timestamp',
  contacts: '++contactId, userId',
  publicKey: 'id',
};

export type MigrationStep = {
  version: number;
  description: string;
  migrate: (db: any) => Promise<void>;
};

