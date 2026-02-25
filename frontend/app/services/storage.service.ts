import {
  base64ToUint8,
  encryptWithKey,
  decryptWithKey,
  randomBytes,
  testKeyImport,
  toArrayBuffer,
  uint8ToBase64,
  deriveEncryptionKeyFromHash,
} from '@/lib/crypto';
import {
  getSessionCryptoKey,
  // getSessionPrivateKeyHash,
  setSessionCryptoKey,
} from './account.service';
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
  iv: Uint8Array;
  authTag?: Uint8Array;
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
    isCritical: any;
    isLow: any;
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
  // RETENTION_KEY removed - retention period is now in profile.settings
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

  // storage.service.ts

  /**
   * Get base CryptoKey for encryption operations
   * Priority: RAM cache → IndexedDB fallback
   *
   * @param identityId User's identity ID (from AuthContext)
   * @returns CryptoKey or throws if not available
   */
  private static async getBaseKey(identityId: string): Promise<CryptoKey> {
    // 1. Try RAM cache first (fastest)
    const ramKey = getSessionCryptoKey();
    if (ramKey) {
      return ramKey;
    }

    // 2. Fallback: load from IndexedDB (after page refresh)
    const dbKey = await StorageService.loadEncryptionKey(identityId);
    if (dbKey) {
      // Optional: cache in RAM for subsequent calls
      setSessionCryptoKey(dbKey);
      return dbKey;
    }

    // 3. Key not found — user needs to restore access
    throw new Error('Encryption key not available. Please restore access to enable encryption.');
  }

  // ==========================================================================
  // CryptoKey Management (non-extractable keys)
  // ==========================================================================

  /**
   * Сохранение non-extractable CryptoKey для шифрования
   * Ключ нельзя экспортировать — только использовать для операций deriveKey/encrypt/decrypt
   *
   * @param identityId ID пользователя (из профиля)
   * @param key CryptoKey с параметром extractable: false
   */
  static async storeEncryptionKey(identityId: string, key: CryptoKey): Promise<void> {
    try {
      const db = await getDb();

      await db.cryptoKeys.put({
        identityId,
        encryptionKey: key, // Dexie автоматически сериализует CryptoKey
        createdAt: Date.now(),
      });

      console.log(`🔐 Encryption key stored for identity: ${identityId}`);
    } catch (error) {
      console.error('❌ Error storing encryption key:', error);
      throw new Error(
        `Failed to store encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Загрузка non-extractable CryptoKey из хранилища
   *
   * @param identityId ID пользователя
   * @returns CryptoKey или null, если не найден
   */
  static async loadEncryptionKey(identityId: string): Promise<CryptoKey | null> {
    try {
      const db = await getDb();
      const record = await db.cryptoKeys.get(identityId);

      if (!record) {
        console.log(`🔐 No encryption key found for identity: ${identityId}`);
        return null;
      }

      console.log(`🔐 Encryption key loaded for identity: ${identityId}`);
      return record.encryptionKey;
    } catch (error) {
      console.error('❌ Error loading encryption key:', error);
      return null; // Возвращаем null, чтобы caller мог обработать отсутствие ключа
    }
  }

  /**
   * Удаление ключа при logout
   *
   * @param identityId ID пользователя
   */
  static async deleteEncryptionKey(identityId: string): Promise<void> {
    try {
      const db = await getDb();
      await db.cryptoKeys.delete(identityId);

      console.log(`🔐 Encryption key deleted for identity: ${identityId}`);
    } catch (error) {
      console.error('❌ Error deleting encryption key:', error);
      // Не выбрасываем ошибку — logout не должен падать из-за проблем с очисткой
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
   * Шифрование текстовых данных (hash-based, non-extractable CryptoKey)
   */
  static async encryptTextData(
    text: string,
    handleId: string,
    context: 'message' | 'contact' | 'metadata',
    identityId: string // ← Новый параметр
  ): Promise<EncryptedStorage> {
    try {
      const textBytes = new TextEncoder().encode(text);

      // 🔐 Get base key using provided identityId
      const baseKey = await StorageService.getBaseKey(identityId);

      const encryptionKey = await deriveEncryptionKeyFromHash(baseKey, handleId, context);
      const { encrypted: enc, iv } = await encryptWithKey(textBytes, encryptionKey);

      return {
        encrypted: enc,
        iv,
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
        iv,
        authTag,
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
   * Дешифрование данных (hash-based, non-extractable CryptoKey)
   */
  static async decryptData(
    encryptedStorage: EncryptedStorage,
    handleId: string,
    identityId?: string
  ): Promise<Uint8Array> {
    try {
      if (!identityId) {
        throw new Error('Identity ID not available');
      }
      const baseKey = await StorageService.getBaseKey(identityId);

      const encryptionKey = await deriveEncryptionKeyFromHash(
        baseKey,
        handleId,
        encryptedStorage.context
      );

      const decrypted = await decryptWithKey(
        encryptedStorage.encrypted,
        encryptionKey,
        encryptedStorage.iv
      );

      return new Uint8Array(decrypted);
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
    handleId: string,
    identityId?: string
  ): Promise<string> {
    const decryptedBytes = await this.decryptData(encryptedStorage, handleId, identityId);
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
    messageId?: string,
    identityId?: string
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

      // Внутри saveEncryptedMessage, где было получение privateKeyHash:

      if (!identityId) {
        throw new Error('Identity ID not available');
      }
      const baseKey = await StorageService.getBaseKey(identityId);

      const encryptionKey = await deriveEncryptionKeyFromHash(baseKey, handleId, 'message');
      const { encrypted: enc, iv: newIv } = await encryptWithKey(textBytes, encryptionKey);

      const message: Message = {
        id,
        chatId,
        senderId,
        contentType: 'text',
        encryptedContent: convertUint8ToArrayBuffer(enc),
        iv: toArrayBuffer(newIv),
        timestamp: Date.now(),
        isOwn,
        status: 'sent',
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
    handleId: string,
    identityId?: string
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
      // ❌ УДАЛИТЬ: let successfulMessages = 0;
      // ❌ УДАЛИТЬ: let failedMessages = 0;

      for (const msg of messages) {
        try {
          if (!identityId) {
            console.warn(`Message ${msg.id}: identity ID not available`);
            // ❌ УДАЛИТЬ: failedMessages++;
            // Просто добавляем заглушку и продолжаем
            decryptedMessages.push({
              id: msg.id,
              text: `[⚠️ Identity ID not available]`,
              isOwn: msg.isOwn,
              timestamp: msg.timestamp,
              senderId: msg.senderId,
            });
            continue;
          }

          const baseKey = await StorageService.getBaseKey(identityId);

          const encryptedStorage: EncryptedStorage = {
            encrypted: convertArrayBufferToUint8(msg.encryptedContent),
            iv: convertArrayBufferToUint8(msg.iv),
            context: 'message',
            timestamp: msg.timestamp,
          };

          const encryptionKey = await deriveEncryptionKeyFromHash(baseKey, handleId, 'message');
          const decrypted = await decryptWithKey(
            encryptedStorage.encrypted,
            encryptionKey,
            encryptedStorage.iv
          );
          const text = new TextDecoder().decode(decrypted);

          // ✅ Успешно расшифровали — добавляем в результат
          decryptedMessages.push({
            id: msg.id,
            text,
            isOwn: msg.isOwn,
            timestamp: msg.timestamp,
            senderId: msg.senderId,
          });

          // ❌ УДАЛИТЬ: successfulMessages++; (не нужно)
        } catch (decryptError) {
          console.error(`Failed to decrypt message ${msg.id}:`, decryptError);
          // Добавляем заглушку для неудачно расшифрованного сообщения
          decryptedMessages.push({
            id: msg.id,
            text: `[❌ Сообщение не удалось расшифровать]`,
            isOwn: msg.isOwn,
            timestamp: msg.timestamp,
            senderId: msg.senderId,
          });
          // ❌ УДАЛИТЬ: failedMessages++; (не нужно)
        }
      }

      // Опционально: залогировать итог
      console.log(`📚 Loaded ${decryptedMessages.length} messages for chat ${chatId}`);

      return decryptedMessages;
    } catch (error) {
      console.error('Error loading decrypted messages:', error);
      throw new Error(
        `Failed to load messages: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
  /**
   * @deprecated Use useProfileSettings hook instead
   * Retention period is now stored in profile.settings.storage.messageRetentionDays
   */
  static getRetentionPeriod(): MessageRetentionPeriod {
    console.warn(
      'StorageService.getRetentionPeriod() is deprecated. Use useProfileSettings hook instead.'
    );
    return 'forever'; // Default fallback
  }

  /**
   * @deprecated Use useProfileSettings hook instead
   * Retention period is now stored in profile.settings.storage.messageRetentionDays
   */
  static setRetentionPeriod(period: MessageRetentionPeriod): void {
    console.warn(
      'StorageService.setRetentionPeriod() is deprecated. Use useProfileSettings hook instead.'
    );
    // No-op, kept for backwards compatibility
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

      const newestMessages = await getDb()
        .messages.orderBy('timestamp')
        .reverse()
        .limit(1)
        .toArray();

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
   *
   * @param handleId User's handle ID (used for key derivation salt)
   * @param identityId User's identity ID (required for loading encryption key)
   * @returns Statistics about successful/failed decryption attempts
   */
  static async verifyEncryptionIntegrity(
    handleId: string,
    identityId: string
  ): Promise<{
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
          // Skip messages with invalid/empty encrypted content
          const encryptedData = convertArrayBufferToUint8(msg.encryptedContent);
          if (!encryptedData || encryptedData.length < 16) {
            console.warn(
              `Message ${msg.id}: encrypted content too small (${encryptedData?.length || 0} bytes)`
            );
            failedMessages++;
            continue;
          }

          const encryptedStorage: EncryptedStorage = {
            encrypted: encryptedData,
            iv: convertArrayBufferToUint8(msg.iv),
            context: 'message',
            timestamp: msg.timestamp,
          };

          // 🔐 decryptTextData сам загрузит ключ через getBaseKey(identityId)
          await this.decryptTextData(encryptedStorage, handleId, identityId);
          successfulMessages++;
        } catch (error) {
          console.warn(
            `Message ${msg.id}: decryption failed - ${error instanceof Error ? error.message : 'Unknown error'}`
          );
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
      // Note: Retention settings are now in profile.settings, not localStorage
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
      const messages = await getDb()
        .messages.where('chatId')
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
