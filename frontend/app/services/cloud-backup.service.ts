import { decryptSeedFromCloud, deriveKeyPairFromSeed, encryptSeedForCloud } from '../lib/crypto';
import type { EncryptedSeedData, KeyPair } from '../lib/crypto/types';
import { S3Service } from './s3-service';
import { UserService } from './user.service';

// ============================================================================
// Types
// ============================================================================

export interface BackupResult {
  success: boolean;
  backupId?: string;
  message?: string;
  url?: string;
  timestamp?: number;
}

export interface BackupInfo {
  backupId: string;
  userId: string;
  username?: string;
  createdAt: number;
  updatedAt?: number;
  size: number;
  location: string;
  encryptionAlgorithm: string;
  version: number;
  isActive: boolean;
}

export interface CloudOptions {
  apiBaseUrl?: string;
  autoSync?: boolean;
  maxRetries?: number;
  timeout?: number;
}

export interface PresignedURLResponse {
  url: string;
  method: 'PUT' | 'GET' | 'DELETE';
  expiresAt: number;
  headers?: Record<string, string>;
}

export interface BackupMetadata {
  seedId: string;
  userId: string;
  username?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  encryptedWith: string;
  backupUrl: string;
  iv: string;
  salt: string;
  authTag: string;
  kdfParams: {
    algorithm: string;
    timeCost: number;
    memoryCost: number;
    parallelism: number;
    hashLength: number;
  };
}

// ============================================================================
// CloudBackupService Class
// ============================================================================

export class CloudBackupService {
  private apiBaseUrl: string;
  private autoSync: boolean;
  private maxRetries: number;
  private timeout: number;

  constructor(options: CloudOptions = {}) {
    this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:4000';
    this.autoSync = options.autoSync ?? true;
    this.maxRetries = options.maxRetries ?? 3;
    this.timeout = options.timeout ?? 30000; // 30 seconds
  }

  /**
   * Compute storage path from password using Argon2id
   */
  static async computeStoragePath(password: string): Promise<string> {
    // Use a fixed public salt that's built into the client code
    // This provides protection against rainbow table attacks but doesn't need to be secret
    const encoder = new TextEncoder();
    const publicSalt = encoder.encode('besafe_seed_salt_v1'); // Should be configurable

    // Use Argon2id similar to how it's used in encryptSeedForCloud
    // Import the argon2id function from hash-wasm that's already used in the project
    const { argon2id } = await import('hash-wasm');

    // Combine password with public salt
    const combinedSalt = new Uint8Array([...publicSalt]);

    const hash = await argon2id({
      password,
      salt: combinedSalt,
      iterations: 3, // timeCost
      memorySize: 65536, // memoryCost in KB
      parallelism: 4, // parallelism
      hashLength: 32, // hashLength in bytes
      outputType: 'hex', // Return hex string directly
    });

    return hash;
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  configure(options: CloudOptions): void {
    if (options.apiBaseUrl) this.apiBaseUrl = options.apiBaseUrl;
    if (options.autoSync !== undefined) this.autoSync = options.autoSync;
    if (options.maxRetries !== undefined) this.maxRetries = options.maxRetries;
    if (options.timeout !== undefined) this.timeout = options.timeout;
  }

  // Removed setUserInfo method as service is now stateless

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include' as RequestCredentials,
        signal: controller.signal,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      // Retry on network errors or 5xx status codes
      if (!response.ok && response.status >= 500 && retryCount < this.maxRetries) {
        console.warn(
          `Cloud backup request failed, retrying (${retryCount + 1}/${this.maxRetries})`
        );

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));

        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      if (retryCount < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      throw error;
    }
  }

  // ==========================================================================
  // Backup Operations
  // ==========================================================================

  /**
   * Backup encrypted seed to cloud storage using password-derived storage path
   */
  static async backupSeedWithPassword(
    encryptedSeed: EncryptedSeedData,
    password: string
  ): Promise<BackupResult> {
    try {
      // Compute storage path from password
      const storagePath = await CloudBackupService.computeStoragePath(password);

      // Use frontend S3Service to upload the seed
      await S3Service.uploadFile(
        new Blob([
          JSON.stringify({
            encrypted: encryptedSeed.encrypted,
            salt: encryptedSeed.salt,
            iv: encryptedSeed.iv,
            authTag: encryptedSeed.authTag,
            version: encryptedSeed.version,
            kdfParams: encryptedSeed.kdfParams,
          }),
        ]),
        {
          path: `seeds/${storagePath}`,
          fileName: 'encrypted_seed.bin',
          contentType: 'application/json',
        }
      );

      return {
        success: true,
        message: 'Seed backup created successfully',
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Seed backup failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Backup failed',
      };
    }
  }

  /**
   * Backup encrypted seed to cloud storage (original method for compatibility)
   * Updated to use direct S3Service for proper path handling
   */
  static async backupSeed(
    encryptedSeed: EncryptedSeedData,
    password: string
  ): Promise<BackupResult> {
    if (!password) {
      throw new Error('Password is required for backup');
    }

    // Compute storage path from password
    const storagePath = await CloudBackupService.computeStoragePath(password);

    try {
      // Use frontend S3Service to upload the seed to the correct path
      await S3Service.uploadFile(
        new Blob([
          JSON.stringify({
            encrypted: encryptedSeed.encrypted,
            salt: encryptedSeed.salt,
            iv: encryptedSeed.iv,
            authTag: encryptedSeed.authTag,
            version: encryptedSeed.version,
            kdfParams: encryptedSeed.kdfParams,
          }),
        ]),
        {
          path: `seeds/${storagePath}`,
          fileName: 'encrypted-seed.enc',
          contentType: 'application/json',
        }
      );

      return {
        success: true,
        backupId: storagePath,
        message: 'Backup created successfully',
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('Backup failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Backup failed',
      };
    }
  }

  /**
   * Restore seed from cloud backup by password (new method using storage path)
   */
  static async restoreSeedByPassword(password: string): Promise<EncryptedSeedData | null> {
    try {
      // Compute storage path from password
      const storagePath = await CloudBackupService.computeStoragePath(password);

      // Use frontend S3Service to download the seed
      const blob = await S3Service.downloadFile(`seeds/${storagePath}`, 'encrypted_seed.bin');
      const text = await blob.text();
      const encryptedSeed: EncryptedSeedData = JSON.parse(text);
      return encryptedSeed;
    } catch (error) {
      console.error('Seed restore failed:', error);
      return null;
    }
  }

  /**
   * Restore seed from cloud backup by userId (requires active session)
   */
  async restoreSeedByUserId(userId: string): Promise<EncryptedSeedData | null> {
    if (!userId) {
      throw new Error('User ID is required for restore');
    }

    try {
      // Use frontend S3Service to download the seed
      const blob = await S3Service.downloadFile(`users/${userId}`, 'encrypted-seed.enc');
      const text = await blob.text();
      const encryptedSeed: EncryptedSeedData = JSON.parse(text);
      return encryptedSeed;
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  /**
   * Restore seed from cloud backup (requires active session)
   */
  async restoreSeed(): Promise<EncryptedSeedData | null> {
    try {
      // Get userId from profile
      const profile = await UserService.getProfile();
      const { userId } = profile;

      if (!userId) {
        throw new Error('User ID is required for restore');
      }

      // Use frontend S3Service to download the seed
      const blob = await S3Service.downloadFile(`users/${userId}`, 'encrypted-seed.enc');
      const text = await blob.text();
      const encryptedSeed: EncryptedSeedData = JSON.parse(text);
      return encryptedSeed;
    } catch (error) {
      console.error('Restore failed:', error);
      return null;
    }
  }

  /**
   * Restore seed by password and decrypt it
   * Used for account recovery flow
   */
  static async restoreAndDecryptSeedByPassword(
    password: string,
    userId: string
  ): Promise<string[] | null> {
    // 1. Download encrypted seed by password
    const encryptedSeed = await CloudBackupService.restoreSeedByPassword(password);

    if (!encryptedSeed) {
      throw new Error('No backup found for this password');
    }

    // 2. Decrypt the seed using the password and userId
    try {
      const seed = await decryptSeedFromCloud(encryptedSeed, password, userId);
      return seed;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Invalid password or corrupted backup');
    }
  }

  /**
   * Restore seed by userId and decrypt it (requires active session)
   * Used for account recovery flow
   */
  async restoreAndDecryptSeedByUserId(userId: string, password: string): Promise<string[] | null> {
    if (!userId) {
      throw new Error('User ID is required for restore');
    }

    // 1. Download encrypted seed by userId
    const encryptedSeed = await this.restoreSeedByUserId(userId);

    if (!encryptedSeed) {
      throw new Error('No backup found for this user');
    }

    // 2. Decrypt the seed
    try {
      const seed = await decryptSeedFromCloud(encryptedSeed, password, userId);
      return seed;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Invalid password or corrupted backup');
    }
  }

  /**
   * Update existing backup with new password or seed
   */
  async updateBackup(
    newPassword: string,
    userId?: string,
    newSeed?: string[]
  ): Promise<BackupResult> {
    // If userId is not provided, try to get it from profile
    if (!userId) {
      const profile = await UserService.getProfile();
      userId = profile.userId;
    }

    if (!userId) {
      throw new Error('User ID is required for update');
    }

    try {
      // 1. Get current backup info
      const backupInfo = await this.getBackupInfo(userId);
      if (!backupInfo) {
        throw new Error('No existing backup found to update');
      }

      // 2. Encrypt with new password
      const seedToEncrypt =
        newSeed || (await this.restoreAndDecryptSeedByUserId(userId, newPassword));
      if (!seedToEncrypt) {
        throw new Error('Could not retrieve seed for update');
      }

      const encryptedSeed = await encryptSeedForCloud(seedToEncrypt, newPassword, userId);

      // 3. Create new backup (overwrites old one via same URL)
      const result = await CloudBackupService.backupSeed(encryptedSeed, userId);

      if (result.success) {
        // Update backup timestamp in server (if needed)
        // Note: With S3, we're not using the old storage registry anymore
      }

      return result;
    } catch (error) {
      console.error('Update backup failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Update failed',
      };
    }
  }

  /**
   * Delete seed backup by password
   */
  static async deleteSeedBackupByPassword(password: string): Promise<void> {
    try {
      // Compute storage path from password
      const storagePath = await CloudBackupService.computeStoragePath(password);

      // Use frontend S3Service to delete the seed
      await S3Service.deleteFile(`seeds/${storagePath}`, 'encrypted_seed.bin');
    } catch (error) {
      console.error('Seed backup deletion failed:', error);
      throw error;
    }
  }

  /**
   * Delete cloud backup (original method for compatibility)
   */
  async deleteBackup(userId?: string): Promise<void> {
    // If userId is not provided, try to get it from profile
    if (!userId) {
      const profile = await UserService.getProfile();
      userId = profile.userId;
    }

    if (!userId) {
      throw new Error('User ID is required for deletion');
    }

    try {
      // Use frontend S3Service to delete the seed
      await S3Service.deleteFile(`users/${userId}`, 'encrypted-seed.enc');
    } catch (error) {
      console.error('Delete backup failed:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Backup Status & Info
  // ==========================================================================

  /**
   * Check if user has a cloud backup
   */
  async hasBackup(userId?: string): Promise<boolean> {
    // If userId is not provided, try to get it from profile
    if (!userId) {
      const profile = await UserService.getProfile();
      userId = profile.userId;
    }

    if (!userId) {
      return false;
    }

    try {
      // Use frontend S3Service to check if the file exists by attempting to get its URL
      const url = await S3Service.getFileUrl(`users/${userId}`, 'encrypted-seed.enc');
      return url.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get backup information
   */
  async getBackupInfo(userId?: string): Promise<BackupInfo | null> {
    // If userId is not provided, try to get it from profile
    if (!userId) {
      const profile = await UserService.getProfile();
      userId = profile.userId;
    }

    if (!userId) {
      return null;
    }

    try {
      // Use frontend S3Service to check if the file exists by attempting to get its URL
      const url = await S3Service.getFileUrl(`users/${userId}`, 'encrypted-seed.enc');

      if (!url) {
        return null;
      }

      // Since we don't have the same metadata structure with S3,
      // we'll create a basic backup info structure
      return {
        backupId: userId,
        userId: userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        size: 0, // Size will be unknown without downloading
        location: `users/${userId}/encrypted-seed.enc`,
        encryptionAlgorithm: 'AES-GCM',
        version: 1,
        isActive: true,
      };
    } catch (error) {
      console.error('Failed to get backup info:', error);
      return null;
    }
  }

  /**
   * Verify backup integrity (download and validate structure)
   */
  async verifyBackupIntegrity(userId?: string): Promise<boolean> {
    try {
      if (!userId) {
        // If no userId provided, we can't restore by userId, so return false
        return false;
      }
      const encryptedSeed = await this.restoreSeedByUserId(userId);

      if (!encryptedSeed) {
        return false;
      }

      // Validate encrypted data structure
      const requiredFields = ['encrypted', 'salt', 'iv', 'authTag', 'version', 'kdfParams'];
      for (const field of requiredFields) {
        if (!(field in encryptedSeed)) {
          return false;
        }
      }

      // Validate KDF params
      const kdfRequired = ['algorithm', 'timeCost', 'memoryCost', 'parallelism', 'hashLength'];
      for (const field of kdfRequired) {
        if (!(field in encryptedSeed.kdfParams)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Backup integrity check failed:', error);
      return false;
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private generateBackupId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `backup-${timestamp}-${random}`;
  }

  private async deleteFromS3(url: string): Promise<void> {
    try {
      const path = new URL(url).pathname;
      await fetch(`${this.apiBaseUrl}/storage${path}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Failed to delete from S3:', error);
    }
  }

  /**
   * Encrypt and backup seed in one operation (password-based approach)
   */
  static async encryptAndBackupSeedWithPassword(
    seedWords: string[],
    password: string
  ): Promise<BackupResult> {
    // Generate a temporary userId for encryption (the actual value doesn't matter for the encryption)
    // but we need it for compatibility with the encryptSeedForCloud function
    const tempUserId =
      'temp-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    const encryptedSeed = await encryptSeedForCloud(seedWords, password, tempUserId);

    return CloudBackupService.backupSeedWithPassword(encryptedSeed, password);
  }

  /**
   * Encrypt and backup seed in one operation (original method for compatibility)
   */
  static async encryptAndBackupSeed(
    seedWords: string[],
    password: string,
    userId?: string
  ): Promise<BackupResult> {
    // If userId is not provided, try to get it from profile
    if (!userId) {
      const profile = await UserService.getProfile();
      userId = profile.userId;
    }

    if (!userId) {
      throw new Error('User ID is required for backup');
    }

    const encryptedSeed = await encryptSeedForCloud(seedWords, password, userId);

    return CloudBackupService.backupSeed(encryptedSeed, userId);
  }

  /**
   * Restore, decrypt and derive keys from backup using password-derived path (public - no session required)
   * Used for account recovery flow with password only
   */
  static async restoreAccountWithPassword(password: string, userId: string): Promise<KeyPair> {
    const seedWords = await CloudBackupService.restoreAndDecryptSeedByPassword(password, userId);

    if (!seedWords) {
      throw new Error('Failed to restore seed from backup');
    }

    const keyPair = await deriveKeyPairFromSeed(seedWords);

    return keyPair;
  }

  /**
   * Restore, decrypt and derive keys from backup (public - no session required)
   * Used for account recovery flow with userId
   */
  async restoreAccount(userId: string, password: string): Promise<KeyPair> {
    const seedWords = await this.restoreAndDecryptSeedByUserId(userId, password);

    if (!seedWords) {
      throw new Error('Failed to restore seed from backup');
    }

    const keyPair = await deriveKeyPairFromSeed(seedWords);

    return keyPair;
  }
}
