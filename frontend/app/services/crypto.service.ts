import { generateSeed, deriveKeysFromSeed, validateSeed } from '../lib/crypto/seed';
import { encryptSeedForCloud, decryptSeedFromCloud } from '../lib/crypto/encryption';

export class CryptoService {
  /**
   * Generate a new seed phrase
   */
  static generateSeed(): string[] {
    return generateSeed();
  }

  /**
   * Validate a seed phrase
   */
  static validateSeed(seed: string[]): boolean {
    return validateSeed(seed);
  }

  /**
   * Derive keys from a seed phrase
   */
  static async deriveKeysFromSeed(seed: string[]) {
    return deriveKeysFromSeed(seed);
  }

  /**
   * Encrypt seed for cloud storage
   */
  static async encryptSeedForCloud(
    seed: string[],
    password: string,
    userId: string
  ) {
    return encryptSeedForCloud(seed, password, userId);
  }

  /**
   * Decrypt seed from cloud storage
   */
  static async decryptSeedFromCloud(
    encrypted: string,
    password: string,
    userId: string,
    salt: string,
    iv: string,
    authTag: string
  ) {
    return decryptSeedFromCloud(encrypted, password, userId, salt, iv, authTag);
  }
}