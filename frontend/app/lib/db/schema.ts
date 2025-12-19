export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  contentType: "text" | "image" | "file";
  encryptedContent: Uint8Array;
  encryptedKey?: Uint8Array;
  timestamp: number;
  isOwn: boolean;
}

export interface Contact {
  id: string;
  displayName?: string;
  isPinned: boolean;
}

export interface PrivateKeys {
  id: string; // "current"
  publicKeyBase64: string; // Публичный ключ в base64
  data: Uint8Array; // Зашифрованный приватный ключ
  createdAt: number;
  source?: 'cloud' | 'seed';
}

export const SCHEMA = {
  messages: "id, chatId, timestamp",
  contacts: "++id",
  publicKey: "id",
};
