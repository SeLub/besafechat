import {
  deriveKeyPairFromSeed,
  encryptSeedForCloud,
  generateSeedPhrase,
  hashPrivateKey,
  pkcs8ToRawPrivateKey,
  validateSeedPhrase,
} from '../lib/crypto';
import { AuthService } from './auth.service';
import { CloudBackupService } from './cloud-backup.service';
import { DeviceService } from './device.service';
import { PasswordRecoveryService } from './password-recovery.service';
import { StorageService } from './storage.service';
console.log('📦 account.service.ts initialized');
// Store seed temporarily in memory only (not in IndexedDB)
let temporarySeed: string[] | null = null;

// Store ONLY hash of private key (never the full key itself)
// The private key is destroyed immediately after authentication
// This hash is used for encryption/decryption operations only
let sessionPrivateKeyHash: Uint8Array | null = null;

/**
 * Set the hashed private key for encryption operations
 * Private key itself should be destroyed immediately after auth
 *
 * CRITICAL: Never store full private key, only its hash
 */
export function setSessionPrivateKeyHash(privateKeyHash: Uint8Array): void {
  console.log('🔐 [SET] sessionPrivateKeyHash:', {
    length: privateKeyHash?.length,
    firstBytes: privateKeyHash?.slice(0, 8),
    timestamp: Date.now(),
  });
  sessionPrivateKeyHash = privateKeyHash;
}

/**
 * Get the hashed private key for encryption/decryption
 */
export function getSessionPrivateKeyHash(): Uint8Array | null {
  return sessionPrivateKeyHash;
}

/**
 * Clear the session private key hash on logout
 * This removes all encryption capability for the account
 */
export function clearSessionPrivateKeyHash(): void {
  if (sessionPrivateKeyHash) {
    crypto.getRandomValues(sessionPrivateKeyHash as Uint8Array<ArrayBuffer>);
    sessionPrivateKeyHash = null;
  }
}

/**
 * Securely clear sensitive Uint8Array data
 * Overwrites with random data before clearing (defense against memory dumps)
 */
function secureClearUint8Array(data: Uint8Array): void {
  // Создаём новую view с явным ArrayBuffer
  const buffer = new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
  crypto.getRandomValues(buffer);
}

export class AccountService {
  /**
   * Unified account creation flow with cloud backup
   * Follows the unified pattern: generate seed → derive keys → store public key → temporarily store private key → login user (creates identity) → backup seed
   */
  static async createAccountWithCloud(password: string) {
    // 1. Validate password strength
    const validation = validatePasswordStrength(password);
    if (!validation.isValid) {
      throw new Error('Password too weak: ' + validation.feedback.join(', '));
    }

    // 2. Check password uniqueness before proceeding
    const isUnique = await PasswordRecoveryService.checkPasswordAvailability(password);
    if (!isUnique) {
      throw new Error(
        'This password is already in use by another account. Please choose a different password.'
      );
    }

    // 3. Generate new seed
    const seed = await generateSeedPhrase();
    const keyPair = await deriveKeyPairFromSeed(seed);
    const publicKeyBase64 = keyPair.publicKeyBase64;

    // 4. Generate client data
    const { deviceId, deviceName } = AccountService.getDeviceInfo();

    // 5. Login (creates identity if first time) on server
    // Private key is used for signing auth challenges
    const result = await AuthService.login({
      publicKey: publicKeyBase64,
      privateKey: keyPair.privateKey,
      deviceId,
      deviceName,
    });

    // 6. Initialize database FIRST with this account's identityId (before storing keys)
    await StorageService.initialize(result.identityId);

    // 7. NOW save public key to IndexedDB (requires initialized database)
    await StorageService.storePublicKey(publicKeyBase64);

    // 8. Authentication successful - now hash the private key and destroy the original
    const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
    const privateKeyHash = await hashPrivateKey(rawPrivateKey);

    // Securely destroy the private key (overwrite with random before clearing)
    secureClearUint8Array(rawPrivateKey);
    secureClearUint8Array(keyPair.privateKey);

    // Store ONLY the hash for encryption operations
    setSessionPrivateKeyHash(privateKeyHash);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const encrypted = await encryptSeedForCloud(seed, password);

    // 8. Claim the password hash before backup
    const claimResult = await PasswordRecoveryService.claimPasswordWithRetry(password);
    if (!claimResult.success) {
      if (claimResult.reason === 'already_claimed') {
        throw new Error(
          'Password became unavailable during account creation. Please try again with a different password.'
        );
      } else {
        throw new Error(`Failed to claim password: ${claimResult.message || 'Unknown error'}`);
      }
    }

    // 9. Proceed with backup using existing mechanism
    const uploadResult = await CloudBackupService.backupSeed(encrypted, password);

    if (!uploadResult.success) {
      throw new Error(`Cloud backup failed: ${uploadResult.message || 'Unknown error'}`);
    }

    AccountService.downloadBackupFile(encrypted, publicKeyBase64);

    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyBase64,
      userId: result.identityId,
    };
  }

  /**
   * Unified account creation flow with self-custody (no cloud backup)
   * Follows the unified pattern: generate seed → derive keys → store public key → hash private key → login user (creates identity)
   */
  static async createAccountWithSelfCustody() {
    // 1. Generate new seed
    const seed = await generateSeedPhrase();
    const keyPair = await deriveKeyPairFromSeed(seed);
    const publicKeyBase64 = keyPair.publicKeyBase64;

    // 2. Generate client data
    const { deviceId, deviceName } = AccountService.getDeviceInfo();

    // 3. Login (creates identity if first time) on server
    // Private key is used for signing auth challenges
    const result = await AuthService.login({
      publicKey: publicKeyBase64,
      privateKey: keyPair.privateKey,
      deviceId,
      deviceName,
    });

    // 4. Initialize database FIRST with this account's identityId (before storing keys)
    await StorageService.initialize(result.identityId);

    // 5. NOW save public key to IndexedDB (requires initialized database)
    await StorageService.storePublicKey(publicKeyBase64);

    // 6. Authentication successful - now hash the private key and destroy the original
    const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
    const privateKeyHash = await hashPrivateKey(rawPrivateKey);

    // Securely destroy the private key
    secureClearUint8Array(rawPrivateKey);
    secureClearUint8Array(keyPair.privateKey);

    // Store ONLY the hash for encryption operations
    setSessionPrivateKeyHash(privateKeyHash);

    // Wait briefly to ensure user profile is created on the backend
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyBase64,
      userId: result.identityId,
    };
  }

  /**
   * Recover account with password
   */
  static async recoverWithPassword(password: string) {
    // Use the PasswordRecoveryService method that handles both download and decryption
    const seed = await PasswordRecoveryService.restoreSeedByPassword(password);

    if (!seed) {
      throw new Error('Recovery failed - no seed found or invalid password');
    }

    // Derive keys from the recovered seed
    const keyPair = await deriveKeyPairFromSeed(seed);

    // Keep a reference to the private key BEFORE clearing
    const privateKeyForLogin = keyPair.privateKey.slice(); // Make a copy to preserve

    // Hash the private key and destroy the original
    const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
    const privateKeyHash = await hashPrivateKey(rawPrivateKey);

    secureClearUint8Array(rawPrivateKey);
    secureClearUint8Array(keyPair.privateKey);

    // Store only the hash for encryption
    setSessionPrivateKeyHash(privateKeyHash);

    return {
      publicKeyBase64: keyPair.publicKeyBase64,
      privateKey: privateKeyForLogin,
    };
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
    const keyPair = await deriveKeyPairFromSeed(seed);

    // Keep a reference to the private key BEFORE clearing
    const privateKeyForLogin = keyPair.privateKey.slice(); // Make a copy to preserve

    // Hash the private key and destroy the original
    const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
    const privateKeyHash = await hashPrivateKey(rawPrivateKey);

    secureClearUint8Array(rawPrivateKey);
    secureClearUint8Array(keyPair.privateKey);

    // Store only the hash for encryption
    setSessionPrivateKeyHash(privateKeyHash);

    return {
      publicKeyBase64: keyPair.publicKeyBase64,
      privateKey: privateKeyForLogin,
    };
  }

  /**
   * Clear temporary seed storage (useful for logout or security cleanup)
   */
  static clearTemporarySeed() {
    temporarySeed = null;
    clearSessionPrivateKeyHash(); // Also clear the session private key hash
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

// Helper function for password strength validation (placeholder)
function validatePasswordStrength(password: string) {
  // This is a placeholder - in a real implementation you'd have proper validation
  return {
    isValid: password.length >= 8,
    score: password.length >= 8 ? 4 : 0,
    feedback: password.length < 8 ? ['Password must be at least 8 characters'] : [],
    suggestions: password.length < 8 ? ['Make your password longer'] : [],
  };
}
