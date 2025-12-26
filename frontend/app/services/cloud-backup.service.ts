import { decryptSeedFromCloud, deriveKeyPairFromSeed, encryptSeedForCloud } from '../lib/crypto';
import type { EncryptedSeedData, KeyPair } from '../lib/crypto/types';
import { S3Service } from './s3-service';

// ============================================================================
// Types
// ============================================================================

export interface BackupResult {
  success: boolean;
  backupId?: string;
  message?: string;
  timestamp?: number;
}

// ============================================================================
// CloudBackupService Class
// ============================================================================

export class CloudBackupService {
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

      // Direct S3 URL
      const s3Url = `https://s3.tebi.io/besafe.backet/seeds/${storagePath}/encrypted-seed.enc`;

      // Download directly from S3
      const response = await fetch(s3Url);

      if (!response.ok) {
        console.log('Seed restore failed');
        return null;
      }

      const text = await response.text();
      const encryptedSeed: EncryptedSeedData = JSON.parse(text);

      // Basic validation
      if (!encryptedSeed.encrypted || !encryptedSeed.salt || !encryptedSeed.iv) {
        console.log('Invalid seed format');
        return null;
      }

      return encryptedSeed;
    } catch (error) {
      console.log('Seed restore failed');
      return null;
    }
  }

  /**
   * Restore seed from cloud backup by userId (requires active session)
   */
  static async restoreSeedByUserId(userId: string): Promise<EncryptedSeedData | null> {
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
   * Restore seed by password and decrypt it
   * Used for account recovery flow
   */
  static async restoreAndDecryptSeedByPassword(password: string): Promise<string[] | null> {
    // 1. Download encrypted seed by password
    const encryptedSeed = await CloudBackupService.restoreSeedByPassword(password);

    if (!encryptedSeed) {
      throw new Error('No backup found for this password');
    }

    // 2. Decrypt the seed using the password and userId
    try {
      const seed = await decryptSeedFromCloud(encryptedSeed, password);
      return seed;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Invalid password or corrupted backup');
    }
  }
}
