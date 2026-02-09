import {
  base64ToUint8,
  decryptWithPassphrase,
  encryptWithPassphrase,
  encryptWithKey,
  decryptWithKey,
  generateSalt,
  randomBytes,
  testKeyImport,
  toArrayBuffer,
  uint8ToBase64,
  deriveEncryptionKeyFromHash,
} from '@/lib/crypto';
import { getSessionPrivateKeyHash } from './account.service';
import { getDb, initializeDb, closeDb } from '@/lib/db/db';
import type { Contact, Message, MessageRetentionPeriod, PublicKey } from '@/lib/db/schema';
// Conversion utilities for IndexedDB storage
const convertUint8ToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  // Ensure we always return an ArrayBuffer, not SharedArrayBuffer
  const buffer = bytes.buffer;
  if (buffer instanceof ArrayBuffer) {
    return buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } else {
    // Convert SharedArrayBuffer to ArrayBuffer by creating a new ArrayBuffer and copying data
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    const uint8View = new Uint8Array(arrayBuffer);
    uint8View.set(new Uint8Array(buffer, bytes.byteOffset, bytes.byteLength));
    return arrayBuffer;
  }
};

const convertArrayBufferToUint8 = (buffer: ArrayBuffer | SharedArrayBuffer): Uint8Array => {
  return new Uint8Array(buffer);
};

// ============================================================================
// Types
// ============================================================================

export interface EncryptedStorage {
  encrypted: Uint8Array;
  salt: Uint8Array;
  iv: Uint8Array;
  authTag?: Uint8Array;
  version: number;
  context: 'message' | 'contact' | 'metadata' | 'file';
  timestamp: number;
}

export interface StorageInfo {
  totalSize: number;
  messages: {
    count: number;
    estimatedSize: number;
    oldestMessage?: number;
    newestMessage?: number;
  };
  contacts: {
    count: number;
    estimatedSize: number;
  };
  keys: {
    exists: boolean;
    createdAt?: number;
    keySize?: number;
  };
  quota: {
    usage: number;
    limit: number;
    percentage: number;
  };
}

export interface StorageQuota {
  usage: number;
  limit: number;
  percentage: number;
  isLow: boolean;
  isCritical: boolean;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  migratedTables: string[];
  errors: string[];
}

export interface LocalBackup {
  timestamp: number;
  size: number;
  tables: string[];
  backupId: string;
}

// ============================================================================
// StorageService Class (Объединенный)
// ============================================================================

export class StorageService {
  private static readonly RETENTION_KEY = 'message_retention_days';
  private static readonly DEFAULT_KDF_ITERATIONS = 210000;
  private static readonly AES_KEY_LENGTH = 256;

  // ==========================================================================
  // Database Initialization & Cleanup (Phase 4)
  // ==========================================================================

  /**
   * Initialize database for a specific user account
   * Must be called after successful login, before any storage operations
   * 
   * @param identityId User's identity from server (from login response)
   * @throws Error if database initialization fails
   */
  static async initialize(identityId: string): Promise<void> {
    try {
      await initializeDb(identityId);
      console.log(`StorageService initialized for identity: ${identityId}`);
    } catch (error) {
      console.error('Failed to initialize StorageService:', error);
      throw error;
    }
  }

  /**
   * Close and cleanup the current database
   * Should be called on logout or account switch
   */
  static async cleanup(): Promise<void> {
    try {
      await closeDb();
      console.log('StorageService cleaned up');
    } catch (error) {
      console.error('Failed to cleanup StorageService:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Key Management
  // ==========================================================================

  /**
   * Проверка наличия ключа в хранилище
   */
  static async hasStoredPublicKey(): Promise<boolean> {
    try {
      const count = await getDb().publicKey.count();
      return count > 0;
    } catch (error) {
      console.error('Error checking for stored key:', error);
      return false;
    }
  }

  /**
   * Сохранение public key в хранилище
   */
  static async storePublicKey(publicKeyBase64: string): Promise<void> {
    try {
      const record: PublicKey = {
        id: 'current',
        publicKeyBase64,
        createdAt: Date.now(),
      };

      await getDb().publicKey.put(record);
      console.log('Public key stored successfully');
    } catch (error) {
      console.error('Error storing public key:', error);
      throw new Error(
        `Error storing public key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Очистка хранилища ключей
   */
  static async clearStoredKey(): Promise<void> {
    try {
      await getDb().publicKey.clear();
      console.log('Key cleared');
    } catch (error) {
      console.error('Error clearing key:', error);
      throw new Error(
        `Failed to clear key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Получение записи ключа
   */
  static async getKeyRecord(): Promise<PublicKey | null> {
    try {
      const record = await getDb().publicKey.get('current');
      return record || null;
    } catch (error) {
      console.error('Error getting key record:', error);
      return null;
    }
  }

  /**
   * Получение публичного ключа
   */
  static async getPublicKey(): Promise<string | null> {
    const record = await this.getKeyRecord();
    return record?.publicKeyBase64 || null;
  }

  // ==========================================================================
  // Encryption/Decryption Operations
  // ==========================================================================

  /**
   * Шифрование текстовых данных
   */
  static async encryptTextData(
    text: string,
    handleId: string,
    context: 'message' | 'contact' | 'metadata'
  ): Promise<EncryptedStorage> {
    try {
      const textBytes = new TextEncoder().encode(text);

      // Try new method first (hash-based encryption)
      const privateKeyHash = getSessionPrivateKeyHash();
      if (privateKeyHash) {
        try {
          const encryptionKey = await deriveEncryptionKeyFromHash(
            privateKeyHash,
            handleId,
            context
          );

          const { encrypted: enc, iv } = await encryptWithKey(textBytes, encryptionKey);

          return {
            encrypted: enc,
            salt: new Uint8Array(0), // Not used with hash-based approach
            iv,
            version: 2, // Version 2 = hash-based
            context,
            timestamp: Date.now(),
          };
        } catch (newMethodError) {
          console.warn(
            `Hash-based encryption failed for ${context}, falling back to legacy method:`,
            newMethodError
          );
        }
      }

      // Fallback to old method (passphrase-based) for backward compatibility
      const { encrypted: encBytes, salt, iv, version } = await encryptWithPassphrase(
        textBytes,
        handleId,
        this.DEFAULT_KDF_ITERATIONS
      );

      return {
        encrypted: encBytes,
        salt,
        iv,
        version,
        context,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`Error encrypting ${context}:`, error);
      throw new Error(
        `Failed to encrypt ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Шифрование бинарных данных
   */
  static async encryptBinaryData(
    data: Uint8Array,
    handleId: string,
    context: 'file'
  ): Promise<EncryptedStorage> {
    try {
      const salt = await this.generateFileSalt(handleId);
      const key = await this.deriveFileKey(handleId, salt);
      const iv = randomBytes(12);

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        key,
        toArrayBuffer(data)
      );

      const encryptedArray = new Uint8Array(encrypted);
      const ciphertext = encryptedArray.slice(0, -16);
      const authTag = encryptedArray.slice(-16);

      return {
        encrypted: ciphertext,
        salt,
        iv,
        authTag,
        version: 2,
        context,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Error encrypting binary data:', error);
      throw new Error(
        `Failed to encrypt file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Дешифрование данных
   */
  static async decryptData(
    encryptedStorage: EncryptedStorage,
    handleId: string
  ): Promise<Uint8Array> {
    try {
      if (encryptedStorage.version === 1) {
        return await decryptWithPassphrase(
          {
            encrypted: encryptedStorage.encrypted,
            salt: encryptedStorage.salt,
            iv: encryptedStorage.iv,
            version: 1,
          },
          handleId,
          this.DEFAULT_KDF_ITERATIONS
        );
      }

      // Version 2 can be either:
      // - Hash-based encryption (new method, no salt needed, salt.length === 0)
      // - File-based with auth tag (old method)

      if (encryptedStorage.version === 2) {
        // Try hash-based decryption first (new method)
        if (encryptedStorage.salt.length === 0) {
          try {
            const privateKeyHash = getSessionPrivateKeyHash();
            if (privateKeyHash) {
              const encryptionKey = await deriveEncryptionKeyFromHash(
                privateKeyHash,
                handleId,
                encryptedStorage.context
              );

              const decrypted = await decryptWithKey(
                encryptedStorage.encrypted,
                encryptionKey,
                encryptedStorage.iv
              );

              return new Uint8Array(decrypted);
            }
          } catch (hashMethodError) {
            console.warn(
              'Hash-based decryption failed, trying file-based method:',
              hashMethodError
            );
          }
        }

        // Fall back to file-based decryption (old method)
        if (encryptedStorage.authTag) {
          const key = await this.deriveFileKey(handleId, encryptedStorage.salt);

          const combined = new Uint8Array([
            ...encryptedStorage.encrypted,
            ...encryptedStorage.authTag,
          ]);

          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: toArrayBuffer(encryptedStorage.iv) },
            key,
            toArrayBuffer(combined)
          );

          return new Uint8Array(decrypted);
        }
      }

      throw new Error(`Unsupported encryption version: ${encryptedStorage.version}`);
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw new Error(
        `Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Дешифрование текстовых данных
   */
  static async decryptTextData(
    encryptedStorage: EncryptedStorage,
    handleId: string
  ): Promise<string> {
    const decryptedBytes = await this.decryptData(encryptedStorage, handleId);
    return new TextDecoder().decode(decryptedBytes);
  }

  // ==========================================================================
  // Message Operations (Encrypted)
  // ==========================================================================

  /**
   * Сохранение зашифрованного сообщения
   */
  /**
   * Сохранение зашифрованного сообщения
   */
  static async saveEncryptedMessage(
    chatId: string,
    senderId: string,
    content: string,
    handleId: string,
    isOwn: boolean = false,
    messageId?: string
  ): Promise<string> {
    try {
      const id =
        messageId || `${senderId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Check if message already exists to prevent duplicates
      const existingMessage = await getDb().messages.get(id);
      if (existingMessage) {
        console.log(`⚠️ Message ${id} already exists, skipping save`);
        return id;
      }

      const textBytes = new TextEncoder().encode(content);

      let encryptedContent: ArrayBuffer;
      let salt: ArrayBuffer;
      let iv: Uint8Array;
      let authTag: ArrayBuffer | undefined;

      // Try hash-based encryption first
      const privateKeyHash = getSessionPrivateKeyHash();
      if (privateKeyHash) {
        try {
          const encryptionKey = await deriveEncryptionKeyFromHash(
            privateKeyHash,
            handleId,
            'message'
          );

          const { encrypted: enc, iv: newIv } = await encryptWithKey(textBytes, encryptionKey);

          encryptedContent = convertUint8ToArrayBuffer(enc);
          salt = convertUint8ToArrayBuffer(new Uint8Array(0)); // No salt needed
          iv = newIv;
          // authTag is undefined (not used in hash-based)
        } catch (hashError) {
          console.warn('Hash-based message encryption failed, using legacy method:', hashError);

          // Fall back to passphrase-based
          const encrypted = await encryptWithPassphrase(
            textBytes,
            handleId,
            this.DEFAULT_KDF_ITERATIONS
          );

          const encryptedArray = new Uint8Array(encrypted.encrypted);
          const ciphertext = encryptedArray.slice(0, -16);
          const tag = encryptedArray.slice(-16);

          encryptedContent = convertUint8ToArrayBuffer(ciphertext);
          salt = convertUint8ToArrayBuffer(encrypted.salt);
          iv = encrypted.iv;
          authTag = convertUint8ToArrayBuffer(tag);
        }
      } else {
        // No hash available, use legacy method
        const encrypted = await encryptWithPassphrase(
          textBytes,
          handleId,
          this.DEFAULT_KDF_ITERATIONS
        );

        const encryptedArray = new Uint8Array(encrypted.encrypted);
        const ciphertext = encryptedArray.slice(0, -16);
        const tag = encryptedArray.slice(-16);

        encryptedContent = convertUint8ToArrayBuffer(ciphertext);
        salt = convertUint8ToArrayBuffer(encrypted.salt);
        iv = encrypted.iv;
        authTag = convertUint8ToArrayBuffer(tag);
      }

      const message: Message = {
        id,
        chatId,
        senderId,
        contentType: 'text',
        encryptedContent,
        salt,
        iv: toArrayBuffer(iv),
        timestamp: Date.now(),
        isOwn,
        status: 'sent',
        authTag,
      };

      await getDb().messages.put(message);

      return id;
    } catch (error) {
      console.error('Error saving encrypted message:', error);
      throw new Error(
        `Failed to save message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Загрузка и дешифрование сообщений
   */
  static async loadDecryptedMessages(
    chatId: string,
    handleId: string
  ): Promise<
    Array<{
      id: string;
      text: string;
      isOwn: boolean;
      timestamp: number;
      senderId: string;
    }>
  > {
    try {
      const messages = await getDb().messages.where('chatId').equals(chatId).sortBy('timestamp');

      const decryptedMessages = [];

      for (const msg of messages) {
        try {
          const encryptedContent = convertArrayBufferToUint8(msg.encryptedContent);
          const salt = convertArrayBufferToUint8(msg.salt);
          const iv = convertArrayBufferToUint8(msg.iv);
          const authTag = msg.authTag ? convertArrayBufferToUint8(msg.authTag) : undefined;

          const decrypted = await decryptWithPassphrase(
            {
              encrypted: encryptedContent,
              salt,
              iv,
              authTag,
              version: 1,
            },
            handleId,
            this.DEFAULT_KDF_ITERATIONS
          );

          const text = new TextDecoder().decode(decrypted);

          decryptedMessages.push({
            id: msg.id,
            text,
            isOwn: msg.isOwn,
            timestamp: msg.timestamp,
            senderId: msg.senderId,
          });
        } catch (decryptError) {
          console.error(`Failed to decrypt message ${msg.id}:`, decryptError);
          decryptedMessages.push({
            id: msg.id,
            text: `[Сообщение не удалось расшифровать]`,
            isOwn: msg.isOwn,
            timestamp: msg.timestamp,
            senderId: msg.senderId,
          });
        }
      }

      return decryptedMessages;
    } catch (error) {
      console.error('Error loading decrypted messages:', error);
      throw new Error(
        `Failed to load messages: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Временное шифрование приватного ключа для сессии
   */
  static async encryptPrivateKeyForSession(
    privateKey: Uint8Array,
    handleId: string
  ): Promise<EncryptedStorage> {
    try {
      return await this.encryptTextData(uint8ToBase64(privateKey), handleId, 'metadata');
    } catch (error) {
      console.error('Error encrypting private key for session:', error);
      throw new Error(
        `Failed to encrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Дешифрование приватного ключа из сессии
   */
  static async decryptPrivateKeyFromSession(
    encryptedStorage: EncryptedStorage,
    handleId: string
  ): Promise<Uint8Array> {
    try {
      const base64Key = await this.decryptTextData(encryptedStorage, handleId);
      return base64ToUint8(base64Key);
    } catch (error) {
      console.error('Error decrypting private key from session:', error);
      throw new Error(
        `Failed to decrypt private key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Проверка возможности импорта ключа
   */
  static async verifyPrivateKeyImport(privateKey: Uint8Array): Promise<boolean> {
    return await testKeyImport(privateKey);
  }

  // ==========================================================================
  // Message Operations (General)
  // ==========================================================================

  /**
   * Очистка старых сообщений
   */
  static async cleanupOldMessages(retentionDays: number = 90): Promise<number> {
    try {
      if (retentionDays <= 0) {
        return 0;
      }

      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const deleted = await getDb().messages.where('timestamp').below(cutoffTime).delete();

      console.log(`Cleaned up ${deleted} old messages`);
      return deleted;
    } catch (error) {
      console.error('Error cleaning up old messages:', error);
      return 0;
    }
  }

  /**
   * Получение настроек периода хранения
   */
  static getRetentionPeriod(): MessageRetentionPeriod {
    return (localStorage.getItem(StorageService.RETENTION_KEY) as MessageRetentionPeriod) || '90';
  }

  /**
   * Установка настроек периода хранения
   */
  static setRetentionPeriod(period: MessageRetentionPeriod): void {
    localStorage.setItem(StorageService.RETENTION_KEY, period);
    console.log(`Retention period set to: ${period}`);
  }

  /**
   * Очистка старых сообщений с учетом настроек
   */
  static async cleanupOldMessagesWithSettings(): Promise<number> {
    const period = StorageService.getRetentionPeriod();

    if (period === 'forever') {
      console.log('Retention set to forever, skipping cleanup');
      return 0;
    }

    const days = parseInt(period);
    return await StorageService.cleanupOldMessages(days);
  }

  /**
   * Получение общего количества сообщений
   */
  static async getTotalMessageCount(): Promise<number> {
    try {
      return await getDb().messages.count();
    } catch (error) {
      console.error('Error getting total message count:', error);
      return 0;
    }
  }

  /**
   * Очистка всех сообщений
   */
  static async clearAllMessages(): Promise<void> {
    try {
      const count = await getDb().messages.count();
      await getDb().messages.clear();
      console.log(`Cleared all ${count} messages`);
    } catch (error) {
      console.error('Error clearing all messages:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Contact Operations
  // ==========================================================================

  /**
   * Сохранение контакта
   */
  static async saveContact(
    contactId: string,
    handleId: string,
    displayName?: string
  ): Promise<void> {
    try {
      const contact: Contact = {
        contactId,
        handleId,
        displayName: displayName || '',
      };

      await getDb().contacts.put(contact);
    } catch (error) {
      console.error('Error saving contact:', error);
      throw error;
    }
  }

  /**
   * Удаление контакта
   */
  static async removeContact(contactId: string, handleId: string): Promise<void> {
    try {
      await getDb().contacts.where('handleId').equals(handleId).delete();
    } catch (error) {
      console.error('Error removing contact:', error);
      throw error;
    }
  }

  /**
   * Получение всех контактов
   */
  static async getAllContacts(): Promise<Contact[]> {
    try {
      return await getDb().contacts.toArray();
    } catch (error) {
      console.error('Error getting all contacts:', error);
      throw error;
    }
  }

  /**
   * Проверка существования контакта
   */
  static async contactExists(id: string): Promise<boolean> {
    try {
      const count = await getDb().contacts.where('id').equals(id).count();
      return count > 0;
    } catch (error) {
      console.error(`Error checking if contact exists ${id}:`, error);
      return false;
    }
  }

  /**
   * Получение количества контактов
   */
  static async getContactCount(): Promise<number> {
    try {
      return await getDb().contacts.count();
    } catch (error) {
      console.error('Error getting contact count:', error);
      return 0;
    }
  }

  /**
   * Очистка всех контактов
   */
  static async clearAllContacts(): Promise<void> {
    try {
      const count = await getDb().contacts.count();
      await getDb().contacts.clear();
      console.log(`Cleared ${count} contacts`);
    } catch (error) {
      console.error('Error clearing all contacts:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Storage Utilities
  // ==========================================================================

  /**
   * Проверка доступности IndexedDB
   */
  static async isAvailable(): Promise<boolean> {
    try {
      await getDb().open();
      return true;
    } catch (error) {
      console.error('IndexedDB is not available:', error);
      return false;
    }
  }

  /**
   * Получение информации о хранилище
   */
  static async getStorageInfo(): Promise<StorageInfo> {
    try {
      const messagesCount = await getDb().messages.count();
      const contactsCount = await getDb().contacts.count();
      const hasKey = await StorageService.hasStoredPublicKey();
      const keyRecord = await getDb().publicKey.get('current');

      const estimatedMessageSize = messagesCount * 500;
      const estimatedContactSize = contactsCount * 200;
      const estimatedKeySize = hasKey ? 200 : 0;

      const totalSize = estimatedMessageSize + estimatedContactSize + estimatedKeySize;

      const quota = await this.getQuotaUsage();

      const messages = await getDb().messages.orderBy('timestamp').limit(1).toArray();

      const newestMessages = await getDb().messages.orderBy('timestamp').reverse().limit(1).toArray();

      return {
        totalSize,
        messages: {
          count: messagesCount,
          estimatedSize: estimatedMessageSize,
          oldestMessage: messages[0]?.timestamp,
          newestMessage: newestMessages[0]?.timestamp,
        },
        contacts: {
          count: contactsCount,
          estimatedSize: estimatedContactSize,
        },
        keys: {
          exists: hasKey,
          createdAt: keyRecord?.createdAt,
        },
        quota,
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      throw error;
    }
  }

  /**
   * Получение информации о квоте хранилища
   */
  static async getQuotaUsage(): Promise<StorageQuota> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return {
        usage: 0,
        limit: 0,
        percentage: 0,
        isLow: false,
        isCritical: false,
      };
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const limit = estimate.quota || 0;
      const percentage = limit > 0 ? (usage / limit) * 100 : 0;

      return {
        usage,
        limit,
        percentage,
        isLow: percentage > 80,
        isCritical: percentage > 95,
      };
    } catch (error) {
      console.error('Error getting quota usage:', error);
      return {
        usage: 0,
        limit: 0,
        percentage: 0,
        isLow: false,
        isCritical: false,
      };
    }
  }

  /**
   * Проверка целостности зашифрованных данных
   */
  static async verifyEncryptionIntegrity(handleId: string): Promise<{
    messages: { total: number; successful: number; failed: number };
    contacts: { total: number; successful: number; failed: number };
  }> {
    try {
      const messages = await getDb().messages.toArray();
      const contacts = await getDb().contacts.toArray();

      let successfulMessages = 0;
      let failedMessages = 0;

      for (const msg of messages) {
        try {
          const encryptedStorage: EncryptedStorage = {
            encrypted: convertArrayBufferToUint8(msg.encryptedContent),
            salt: msg.salt ? convertArrayBufferToUint8(msg.salt) : generateSalt(32),
            iv: convertArrayBufferToUint8(msg.iv),
            authTag: msg.authTag ? convertArrayBufferToUint8(msg.authTag) : undefined,
            version: 1,
            context: 'message',
            timestamp: msg.timestamp,
          };

          await this.decryptTextData(encryptedStorage, handleId);
          successfulMessages++;
        } catch {
          failedMessages++;
        }
      }

      const totalContacts = contacts.length;
      const successfulContacts = totalContacts;
      const failedContacts = 0;

      return {
        messages: {
          total: messages.length,
          successful: successfulMessages,
          failed: failedMessages,
        },
        contacts: {
          total: totalContacts,
          successful: successfulContacts,
          failed: failedContacts,
        },
      };
    } catch (error) {
      console.error('Error verifying encryption integrity:', error);
      throw new Error(
        `Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Очистка всех данных
   */
  static async clearAllData(): Promise<void> {
    try {
      await getDb().messages.clear();
      await getDb().contacts.clear();
      await getDb().publicKey.clear();
      localStorage.removeItem(StorageService.RETENTION_KEY);
      console.log('All storage data cleared');
    } catch (error) {
      console.error('Error clearing storage data:', error);
      throw new Error(
        `Failed to clear data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Генерация соли для файлов
   */
  private static async generateFileSalt(handleId: string): Promise<Uint8Array> {
    const handleIdBytes = base64ToUint8(handleId);
    const timestampBytes = new TextEncoder().encode(Date.now().toString());

    const combined = new Uint8Array(handleIdBytes.length + timestampBytes.length);
    combined.set(handleIdBytes);
    combined.set(timestampBytes, handleIdBytes.length);

    const hash = await crypto.subtle.digest('SHA-256', combined);
    return new Uint8Array(hash);
  }

  /**
   * Деривация ключа для файлов
   */
  private static async deriveFileKey(handleId: string, salt: Uint8Array): Promise<CryptoKey> {
    const handleIdBytes = base64ToUint8(handleId);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(handleIdBytes),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: toArrayBuffer(salt),
        iterations: this.DEFAULT_KDF_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: this.AES_KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private static async enforceMessageLimit(chatId: string, limit: number): Promise<void> {
    try {
      const messages = await getDb().messages
        .where('chatId')
        .equals(chatId)
        .reverse()
        .sortBy('timestamp');

      if (messages.length > limit) {
        const toDelete = messages.slice(limit).map(m => m.id);
        await getDb().messages.bulkDelete(toDelete);
        console.log(`Enforced limit: deleted ${toDelete.length} messages from chat ${chatId}`);
      }
    } catch (error) {
      console.error(`Error enforcing message limit for chat ${chatId}:`, error);
    }
  }
}