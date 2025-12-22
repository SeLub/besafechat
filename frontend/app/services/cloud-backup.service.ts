import { CryptoService } from './crypto.service';
import { UserService } from './user.service';
import type { EncryptedSeedData, KeyPair } from './crypto.service';

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
    username?: string
  ): Promise<BackupResult> {
    const profile = await UserService.getProfile();
    const { userId } = profile;

    if (!userId) {
      throw new Error('User ID is required for backup');
    }

    try {
      // Create an instance to access fetchWithRetry
      const instance = new CloudBackupService();

      // Backend handles presigned URL generation and S3 upload internally
      const response = await instance.fetchWithRetry(`${instance.apiBaseUrl}/storage/auth/upload`, {
        method: 'POST',
        body: JSON.stringify({
          encrypted: encryptedSeed.encrypted,
          salt: encryptedSeed.salt,
          iv: encryptedSeed.iv,
          authTag: encryptedSeed.authTag,
          version: encryptedSeed.version,
          kdfParams: encryptedSeed.kdfParams,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Failed to backup seed: ${error.message || 'Unknown error'}`);
      }

      const result = await response.json();

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
   * Restore seed from cloud backup by username (public endpoint - no session required)
   */
  async restoreSeedByUsername(username: string): Promise<EncryptedSeedData | null> {
    if (!username) {
      throw new Error('Username is required for restore');
    }

    try {
      // Download seed backup by username - this is a public endpoint
      const response = await this.fetchWithRetry(
        `${this.apiBaseUrl}/storage/auth/download/by-username/${encodeURIComponent(username)}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'No cloud backup found for this username');
      }

      // The backend returns the encrypted seed data directly (downloads from S3 internally)
      const encryptedSeed: EncryptedSeedData = await response.json();
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
      // Restore by user ID - requires session
      const response = await this.fetchWithRetry(`${this.apiBaseUrl}/storage/auth/download`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('No cloud backup found');
      }

      const encryptedSeed: EncryptedSeedData = await response.json();
      return encryptedSeed;
    } catch (error) {
      console.error('Restore failed:', error);
      return null;
    }
  }

  /**
   * Restore seed by username and decrypt it (public - no session required)
   * Used for account recovery flow
   */
  async restoreAndDecryptSeedByUsername(
    username: string,
    password: string
  ): Promise<string[] | null> {
    // 1. Get userId by looking up the username
    const userResponse = await this.fetchWithRetry(
      `${this.apiBaseUrl}/profile/username/search/${encodeURIComponent(username)}`
    );

    if (!userResponse.ok) {
      if (userResponse.status === 404) {
        throw new Error('Username not found. Please check the spelling and try again.');
      }
      throw new Error('Failed to look up username. Please try again.');
    }

    const userData = await userResponse.json();
    // Backend returns { success: true, data: { id, publicKey, displayName } }
    const userId = userData.data?.id || userData.id;

    if (!userId) {
      throw new Error('Account not found for this username');
    }

    // 2. Download encrypted seed by username
    const encryptedSeed = await this.restoreSeedByUsername(username);

    if (!encryptedSeed) {
      throw new Error('No backup found for this username');
    }

    // 3. Decrypt the seed
    try {
      const seed = await CryptoService.decryptSeedFromCloud(encryptedSeed, password, userId);
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
    username?: string,
    newSeed?: string[]
  ): Promise<BackupResult> {
    const profile = await UserService.getProfile();
    const { userId } = profile;

    if (!userId) {
      throw new Error('User ID is required for update');
    }

    try {
      // 1. Get current backup info
      const backupInfo = await this.getBackupInfo(username);
      if (!backupInfo) {
        throw new Error('No existing backup found to update');
      }

      // 2. Encrypt with new password
      if (!username) {
        throw new Error('Username is required to retrieve existing seed for update');
      }
      const seedToEncrypt =
        newSeed || (await this.restoreAndDecryptSeedByUsername(username, newPassword));
      if (!seedToEncrypt) {
        throw new Error('Could not retrieve seed for update');
      }

      const encryptedSeed = await CryptoService.encryptSeedForCloud(
        seedToEncrypt,
        newPassword,
        userId
      );

      // 3. Create new backup (overwrites old one via same URL)
      const result = await CloudBackupService.backupSeed(encryptedSeed, username);

      if (result.success) {
        // Update backup timestamp in server
        await this.fetchWithRetry(`${this.apiBaseUrl}/storage/auth/upload`, {
          method: 'POST',
          body: JSON.stringify({
            backupId: backupInfo.backupId,
            userId: userId,
            username: username,
            backupUrl: result.url?.split('?')[0],
            metadata: {
              ...encryptedSeed,
              timestamp: Date.now(),
              size: JSON.stringify(encryptedSeed).length,
              updatedAt: Date.now(),
            },
          }),
        });
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
  async deleteBackup(username?: string): Promise<void> {
    const profile = await UserService.getProfile();
    const { userId } = profile;

    if (!userId) {
      throw new Error('User ID is required for deletion');
    }

    try {
      // 1. Get backup info to get the S3 path
      const backupInfo = await this.getBackupInfo(username);
      if (!backupInfo) {
        return; // Nothing to delete
      }

      // 2. Delete from S3
      const path = new URL(backupInfo.location).pathname;
      await this.fetchWithRetry(`${this.apiBaseUrl}/storage${path}`, {
        method: 'DELETE',
      });

      // 3. Delete from server registry
      await this.fetchWithRetry(`${this.apiBaseUrl}/storage/auth/delete`, {
        method: 'DELETE',
        body: JSON.stringify({
          backupId: backupInfo.backupId,
          userId: userId,
        }),
      });
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
  async hasBackup(username?: string): Promise<boolean> {
    const profile = await UserService.getProfile();
    const { userId } = profile;

    if (!userId && !username) {
      return false;
    }

    try {
      const url = username
        ? `${this.apiBaseUrl}/storage/auth/check/by-username/${username}`
        : `${this.apiBaseUrl}/storage/auth/check`;

      const response = await this.fetchWithRetry(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get backup information
   */
  async getBackupInfo(username?: string): Promise<BackupInfo | null> {
    const profile = await UserService.getProfile();
    const { userId } = profile;

    if (!userId && !username) {
      return null;
    }

    try {
      const url = username
        ? `${this.apiBaseUrl}/storage/auth/download/by-username/${username}`
        : `${this.apiBaseUrl}/storage/auth/download`;

      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      return {
        backupId: data.backupId || this.generateBackupId(),
        userId: userId || data.userId,
        username: username || data.username,
        createdAt: data.createdAt || data.timestamp || Date.now(),
        updatedAt: data.updatedAt,
        size: data.size || data.metadata?.size || 0,
        location: data.backupUrl || data.url || data.location,
        encryptionAlgorithm: data.encryptionAlgorithm || data.metadata?.encryptedWith || 'AES-GCM',
        version: data.version || data.metadata?.version || 1,
        isActive: data.isActive !== false,
      };
    } catch (error) {
      console.error('Failed to get backup info:', error);
      return null;
    }
  }

  /**
   * Verify backup integrity (download and validate structure)
   */
  async verifyBackupIntegrity(username?: string): Promise<boolean> {
    try {
      if (!username) {
        // If no username provided, we can't restore by username, so return false
        return false;
      }
      const encryptedSeed = await this.restoreSeedByUsername(username);

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
    username?: string
  ): Promise<BackupResult> {
    const profile = await UserService.getProfile();
    const { userId } = profile;

    const encryptedSeed = await CryptoService.encryptSeedForCloud(seedWords, password, userId);

    return CloudBackupService.backupSeed(encryptedSeed, username);
  }

  /**
   * Restore, decrypt and derive keys from backup (public - no session required)
   * Used for account recovery flow
   */
  async restoreAccount(username: string, password: string): Promise<KeyPair> {
    const seedWords = await this.restoreAndDecryptSeedByUsername(username, password);

    if (!seedWords) {
      throw new Error('Failed to restore seed from backup');
    }

    const keyPair = await CryptoService.deriveKeyPairFromSeed(seedWords);

    return keyPair;
  }
}
