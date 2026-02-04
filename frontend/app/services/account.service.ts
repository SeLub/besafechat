import {
  decryptSeedFromCloud,
  deriveKeyPairFromSeed,
  encryptSeedForCloud,
  validateSeedPhrase,
} from '../lib/crypto';
import { DeviceService } from './device.service';
import { StorageService } from './storage.service';
import { CloudBackupService } from './cloud-backup.service';

// Store seed temporarily in memory only (not in IndexedDB)
let temporarySeed: string[] | null = null;

export class AccountService {
  /**
   * Create account with cloud backup
   */
  static async createAccountWithCloud(password: string) {
    // 1. Get current key from IndexedDB
    const publicKey = await StorageService.getPublicKey();
    if (!publicKey) {
      throw new Error('No key found in IndexedDB');
    }

    // 2. Get seed from temporary memory storage
    if (!temporarySeed) {
      throw new Error('No seed found in temporary storage');
    }

    const seed = temporarySeed;
    const publicKeyBase64 = publicKey;

    // 3. Encrypt seed for cloud
    console.log('[account-service] Encrypting seed for cloud...');
    const encrypted = await encryptSeedForCloud(seed, password, publicKeyBase64);
    console.log('[account-service] Encrypted data:', encrypted);

    // 4. Upload to S3 via storage service
    console.log('[account-service] Uploading to S3...');
    const uploadResult = await CloudBackupService.backupSeed(encrypted);
    console.log('[account-service] Upload result:', uploadResult);

    if (!uploadResult.success) {
      throw new Error(`Upload failed: ${uploadResult.message || 'Unknown error'}`);
    }

    // 5. Update IndexedDB to mark as cloud backup (this is not needed anymore since we're using StorageService)

    // 6. Download backup file
    AccountService.downloadBackupFile(encrypted, publicKeyBase64);

    // 7. Clear temporary seed storage after successful upload
    temporarySeed = null;
  }

  /**
   * Create account with Self-Custody
   */
  static async createAccountWithSeed(seed: string[]) {
    // Validate seed
    const validation = validateSeedPhrase(seed);
    if (!validation.isValid) {
      throw new Error('Invalid seed phrase');
    }

    // Derive keys
    const { privateKey, publicKey, publicKeyBase64 } = await deriveKeyPairFromSeed(seed);

    // Save public key to IndexedDB
    await StorageService.storePublicKey(publicKeyBase64);

    // Store seed temporarily in memory only (not in IndexedDB)
    temporarySeed = [...seed]; // Create a copy to avoid reference issues

    return { privateKey, publicKey, publicKeyBase64 };
  }

  /**
   * Recover account with password
   */
  static async recoverWithPassword(username: string, password: string) {
    // 1. Use the CloudBackupService method that handles both download and decryption
    const cloudService = new CloudBackupService();
    const seed = await cloudService.restoreAndDecryptSeedByUsername(username, password);

    if (!seed) {
      throw new Error('No cloud backup found for this username or invalid password');
    }

    // 2. Derive keys from the recovered seed
    const { privateKey, publicKey, publicKeyBase64 } = await deriveKeyPairFromSeed(seed);

    // 3. Save to IndexedDB
    await StorageService.storePublicKey(publicKeyBase64);

    return { privateKey, publicKey, publicKeyBase64 };
  }

  /**
   * Recover account with seed phrase
   */
  static async recoverWithSeed(seed: string[]) {
    // For recovery, we don't need to keep the seed in temporary storage
    // So we call createAccountWithSeed which will temporarily store it,
    // but we'll clear it after since it's for recovery, not for cloud backup
    const result = await AccountService.createAccountWithSeed(seed);
    // Clear the temporary seed after recovery since we don't need it for cloud backup
    temporarySeed = null;
    return result;
  }

  /**
   * Clear temporary seed storage (useful for logout or security cleanup)
   */
  static clearTemporarySeed() {
    temporarySeed = null;
  }

  /**
   * Get temporary seed (for internal use)
   */
  static getTemporarySeed(): string[] | null {
    return temporarySeed;
  }

  /**
   * Download backup file
   */
  private static downloadBackupFile(encrypted: any, publicKey: string) {
    const content = JSON.stringify(
      {
        ...encrypted,
        publicKey,
        createdAt: Date.now(),
        note: 'BeSafe Chat - Encrypted Seed Backup. Keep this file safe!',
      },
      null,
      2
    );

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `besafe-backup-${Date.now()}.enc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get device info for registration/login
   */
  static getDeviceInfo() {
    return {
      deviceId: DeviceService.getDeviceId(),
      deviceName: DeviceService.getDeviceName(),
    };
  }
}
