// /home/selub/Documents/progs/besafechat/frontend/app/lib/db/schema.ts

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  contentType: 'text' | 'image' | 'file';

  // Шифрованные данные
  encryptedContent: ArrayBuffer; // Зашифрованное содержимое (ArrayBuffer для IndexedDB)
  iv: ArrayBuffer; // Вектор инициализации

  // Метаданные
  timestamp: number;
  isOwn: boolean;

  // Опциональные поля
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  editedAt?: number;
  replyToId?: string;
  metadata?: Record<string, any>;
}

export interface Contact {
  displayName: string;
  contactId: string; // Contact ID
  handleId: string; // Handle ID of contragent
}

export interface PublicKey {
  id: string; // Всегда "current" (только один ключ на устройство)
  publicKeyBase64: string; // Ed25519 публичный ключ в base64 (44 символа)
  createdAt: number;
}

export type MessageRetentionPeriod = '7' | '30' | '90' | 'forever';

// 🔐 Новый интерфейс для хранения CryptoKey
export interface CryptoKeyRecord {
  identityId: string; // Primary key: привязка к пользователю
  encryptionKey: CryptoKey; // Сам ключ (неэкспортируемый)
  createdAt: number; // Метаданные для отладки/очистки
}

// Dexie схема
export const SCHEMA = {
  messages: 'id, chatId, timestamp',
  contacts: '++contactId, handleId',
  publicKey: 'id',
  cryptoKeys: 'identityId', // 🔐 Добавляем store для ключей
};

export type MigrationStep = {
  version: number;
  description: string;
  migrate: (db: any) => Promise<void>;
};
