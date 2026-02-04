import {
  deriveKeyPairFromSeed,
  encryptSeedForCloud,
  validateSeedPhrase,
  generateSeedPhrase,
} from '../lib/crypto';
import { AuthService } from './auth.service';
import { CloudBackupService } from './cloud-backup.service';
import { DeviceService } from './device.service';
import { StorageService } from './storage.service';

// Store seed temporarily in memory only (not in IndexedDB)
let temporarySeed: string[] | null = null;

export class AccountService {
  /**
   * Unified account creation flow with cloud backup
   * Follows the unified pattern: generate seed → derive keys → store public key → register user → backup seed
   */
  static async createAccountWithCloud(password: string) {
    // 1. Generate new seed
    const seed = await generateSeedPhrase();
    const keyPair = await deriveKeyPairFromSeed(seed);
    const publicKeyBase64 = keyPair.publicKeyBase64;

    // 2. Сохранение публичного ключа в локальном хранилище
    await StorageService.storePublicKey(publicKeyBase64);

    // 3. Генерация данных клиента
    const deviceId = DeviceService.getDeviceId();

    // 4. Регистрация на сервере
    const { userId } = await AuthService.register({
      publicKey: publicKeyBase64,
      deviceId,
    });

    // Wait briefly to ensure user profile is created on the backend
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Encrypt and backup seed to cloud
    const encrypted = await encryptSeedForCloud(seed, password, userId);
    const uploadResult = await CloudBackupService.backupSeed(encrypted, password);

    if (!uploadResult.success) {
      throw new Error(`Cloud backup failed: ${uploadResult.message || 'Unknown error'}`);
    }

    // 6. Download backup file for user
    AccountService.downloadBackupFile(encrypted, publicKeyBase64);

    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyBase64,
      userId,
    };
  }

  /**
   * Unified account creation flow with self-custody (no cloud backup)
   * Follows the unified pattern: generate seed → derive keys → store public key → register user
   */
  static async createAccountWithSelfCustody() {
    // 1. Generate new seed
    const seed = await generateSeedPhrase();
    const keyPair = await deriveKeyPairFromSeed(seed);
    const publicKeyBase64 = keyPair.publicKeyBase64;

    // 2. Сохранение публичного ключа в локальном хранилище
    await StorageService.storePublicKey(publicKeyBase64);

    // 3. Генерация данных клиента
    const deviceId = DeviceService.getDeviceId();

    // 4. Регистрация на сервере
    const { userId } = await AuthService.register({
      publicKey: publicKeyBase64,
      deviceId,
    });

    // Wait briefly to ensure user profile is created on the backend
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyBase64,
      userId,
    };
  }

  /**
   * Recover account with password
   */
  static async recoverWithPassword(password: string) {
    // Use the CloudBackupService method that handles both download and decryption
    const seed = await CloudBackupService.restoreAndDecryptSeedByPassword(password);

    if (!seed) {
      throw new Error('No cloud backup found for this user or invalid password');
    }

    // Derive keys from the recovered seed
    const { privateKey, publicKey, publicKeyBase64 } = await deriveKeyPairFromSeed(seed);

    // Save to IndexedDB
    await StorageService.storePublicKey(publicKeyBase64);

    return { privateKey, publicKey, publicKeyBase64 };
  }

  /**
   * Recover account with seed phrase
   */
  static async recoverWithSeed(seed: string[]) {
    // Validate seed
    const validation = validateSeedPhrase(seed);
    if (!validation.isValid) {
      throw new Error('Invalid seed phrase');
    }

    // Derive keys
    const { privateKey, publicKey, publicKeyBase64 } = await deriveKeyPairFromSeed(seed);

    // Save public key to IndexedDB
    await StorageService.storePublicKey(publicKeyBase64);

    return { privateKey, publicKey, publicKeyBase64 };
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
   * Create account with Self-Custody (legacy method for compatibility)
   * @deprecated Use createAccountWithSelfCustody instead
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
   * Get device info for registration/login
   */
  static getDeviceInfo() {
    return {
      deviceId: DeviceService.getDeviceId(),
      deviceName: DeviceService.getDeviceName(),
    };
  }
}
