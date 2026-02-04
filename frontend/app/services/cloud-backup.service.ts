import { decryptSeedFromCloud, deriveKeyPairFromSeed, encryptSeedForCloud } from '../lib/crypto';
import type { EncryptedSeedData, KeyPair } from '../lib/crypto/types';
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
   * Backup encrypted seed to cloud storage
   */
  static async backupSeed(
    encryptedSeed: EncryptedSeedData,
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

    try {
      // Create an instance to access fetchWithRetry
      const instance = new CloudBackupService();

      // Get presigned URL for upload
      const presignedResponse = await instance.fetchWithRetry(`${instance.apiBaseUrl}/s3/upload`, {
        method: 'POST',
        body: JSON.stringify({
          path: `users/${userId}`,
          filename: 'encrypted-seed.enc',
          contentType: 'application/json',
          fileType: 'seed',
        }),
      });

      if (!presignedResponse.ok) {
        const error = await presignedResponse.json().catch(() => ({}));
        throw new Error(`Failed to get presigned URL: ${error.message || 'Unknown error'}`);
      }

      const responseJson = await presignedResponse.json();
      const presignedData = responseJson.data || responseJson; // Handle both nested and direct structures
      const uploadUrl = presignedData.uploadUrl;
      const fileKey = presignedData.fileKey;

      if (!uploadUrl) {
        throw new Error('No upload URL provided by the server');
      }

      // Upload the encrypted seed data to S3 using the presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encrypted: encryptedSeed.encrypted,
          salt: encryptedSeed.salt,
          iv: encryptedSeed.iv,
          authTag: encryptedSeed.authTag,
          version: encryptedSeed.version,
          kdfParams: encryptedSeed.kdfParams,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `S3 upload failed: ${uploadResponse.status} - ${uploadResponse.statusText}`
        );
      }

      return {
        success: true,
        backupId: userId,
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
   * Restore seed from cloud backup by userId (requires active session)
   */
  async restoreSeedByUserId(userId: string): Promise<EncryptedSeedData | null> {
    if (!userId) {
      throw new Error('User ID is required for restore');
    }

    try {
      // Get presigned URL for download
      const presignedResponse = await this.fetchWithRetry(`${this.apiBaseUrl}/s3/download`, {
        method: 'POST',
        body: JSON.stringify({
          path: `users/${userId}`,
          filename: 'encrypted-seed.enc',
        }),
      });

      if (!presignedResponse.ok) {
        const error = await presignedResponse.json().catch(() => ({}));
        throw new Error(error.message || 'No cloud backup found for this user');
      }

      const responseJson = await presignedResponse.json();
      const presignedData = responseJson.data || responseJson; // Handle both nested and direct structures
      const downloadUrl = presignedData.downloadUrl;

      if (!downloadUrl) {
        throw new Error('No download URL provided by the server');
      }

      // Download the encrypted seed data from S3 using the presigned URL
      const downloadResponse = await fetch(downloadUrl);

      if (!downloadResponse.ok) {
        throw new Error(
          `S3 download failed: ${downloadResponse.status} - ${downloadResponse.statusText}`
        );
      }

      // The S3 returns the encrypted seed data
      const encryptedSeed: EncryptedSeedData = await downloadResponse.json();
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

      // Get presigned URL for download
      const presignedResponse = await this.fetchWithRetry(`${this.apiBaseUrl}/s3/download`, {
        method: 'POST',
        body: JSON.stringify({
          path: `users/${userId}`,
          filename: 'encrypted-seed.enc',
        }),
      });

      if (!presignedResponse.ok) {
        const error = await presignedResponse.json().catch(() => ({}));
        throw new Error(error.message || 'No cloud backup found');
      }

      const responseJson = await presignedResponse.json();
      const presignedData = responseJson.data || responseJson; // Handle both nested and direct structures
      const downloadUrl = presignedData.downloadUrl;

      if (!downloadUrl) {
        throw new Error('No download URL provided by the server');
      }

      // Download the encrypted seed data from S3 using the presigned URL
      const downloadResponse = await fetch(downloadUrl);

      if (!downloadResponse.ok) {
        throw new Error(
          `S3 download failed: ${downloadResponse.status} - ${downloadResponse.statusText}`
        );
      }

      // The S3 returns the encrypted seed data
      const encryptedSeed: EncryptedSeedData = await downloadResponse.json();
      return encryptedSeed;
    } catch (error) {
      console.error('Restore failed:', error);
      return null;
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
   * Delete cloud backup
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
      // Get presigned URL for deletion
      const deleteResponse = await this.fetchWithRetry(`${this.apiBaseUrl}/s3/delete`, {
        method: 'DELETE',
        body: JSON.stringify({
          path: `users/${userId}`,
          filename: 'encrypted-seed.enc',
        }),
      });

      if (!deleteResponse.ok) {
        const error = await deleteResponse.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to delete backup');
      }
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
      // For S3, we'll try to get a presigned URL to check if the file exists
      const response = await this.fetchWithRetry(`${this.apiBaseUrl}/s3/download`, {
        method: 'POST',
        body: JSON.stringify({
          path: `users/${userId}`,
          filename: 'encrypted-seed.enc',
        }),
      });

      return response.ok;
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
      // For S3, we'll try to get a presigned URL to check if the file exists
      const response = await this.fetchWithRetry(`${this.apiBaseUrl}/s3/download`, {
        method: 'POST',
        body: JSON.stringify({
          path: `users/${userId}`,
          filename: 'encrypted-seed.enc',
        }),
      });

      if (!response.ok) {
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
   * Encrypt and backup seed in one operation
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
   * Restore, decrypt and derive keys from backup (public - no session required)
   * Used for account recovery flow
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
