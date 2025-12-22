import { argon2id } from 'hash-wasm';
import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// Configure @noble/ed25519
// @ts-ignore
if (!ed.hashes) ed.hashes = {};
// @ts-ignore
ed.hashes.sha512 = sha512;
// @ts-ignore
ed.hashes.sha512Async = async (m: Uint8Array) => sha512(m);

// ============================================================================
// Types
// ============================================================================

export interface KeyPair {
  privateKey: Uint8Array; // PKCS#8 format for Web Crypto API
  publicKey: Uint8Array;  // Raw public key (32 bytes)
  publicKeyBase64: string;
  seedBytes?: Uint8Array;  // Full BIP39 seed (64 bytes, only for seed-based keys)
}

export interface EncryptedData {
  encrypted: Uint8Array;
  salt: Uint8Array;
  iv: Uint8Array;
  authTag?: Uint8Array;
  version: number;
}

export interface EncryptedSeedData {
  encrypted: string;
  salt: string;
  iv: string;
  authTag: string;
  version: number;
  kdfParams: {
    algorithm: string;
    timeCost: number;
    memoryCost: number;
    parallelism: number;
    hashLength: number;
  };
}

export interface PasswordValidationResult {
  score: number; // 0-4
  isSecure: boolean;
  feedback: string[];
  suggestions: string[];
}

export interface SeedValidationResult {
  isValid: boolean;
  error?: string;
  wordCount: number;
  invalidWords: string[];
}

// ============================================================================
// Utils
// ============================================================================

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(buffer);
  view.set(bytes);
  return buffer;
}

function uint8ToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToUint8(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

function uint8ToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function generateSalt(length: number = 32): Uint8Array {
  return randomBytes(length);
}

function generateIV(): Uint8Array {
  return randomBytes(12); // AES-GCM standard IV length
}

// ============================================================================
// Main CryptoService Class
// ============================================================================

export class CryptoService {
  // ==========================================================================
  // Seed & Key Generation
  // ==========================================================================

  /**
   * Generate 12-word BIP39 seed phrase
   */
  static async generateSeedPhrase(): Promise<string[]> {
    const mnemonic = generateMnemonic(wordlist, 128); // 128 bits = 12 words
    return mnemonic.split(" ");
  }

  /**
   * Validate seed phrase words
   */
  static validateSeedPhrase(words: string[]): SeedValidationResult {
    const wordCount = words.length;
    
    // Check word count
    if (wordCount !== 12 && wordCount !== 24) {
      return {
        isValid: false,
        error: `Seed phrase must be 12 or 24 words, got ${wordCount}`,
        wordCount,
        invalidWords: []
      };
    }

    // Validate each word against BIP39 wordlist
    const invalidWords: string[] = [];
    const normalizedWords = words.map(word => word.toLowerCase().trim());
    
    for (const word of normalizedWords) {
      if (!wordlist.includes(word)) {
        invalidWords.push(word);
      }
    }

    // Check if all words are valid
    if (invalidWords.length > 0) {
      return {
        isValid: false,
        error: `Invalid words found: ${invalidWords.join(', ')}`,
        wordCount,
        invalidWords
      };
    }

    // Final BIP39 validation
    const mnemonic = normalizedWords.join(" ");
    const isValid = validateMnemonic(mnemonic, wordlist);

    return {
      isValid,
      error: isValid ? undefined : 'Invalid seed phrase checksum',
      wordCount,
      invalidWords: []
    };
  }

  /**
   * Normalize seed phrase (lowercase, trim)
   */
  normalizeSeedPhrase(seedPhrase: string): string {
    return seedPhrase
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.trim())
      .join(' ');
  }

  /**
   * Derive Ed25519 keypair from seed phrase
   */
  static async deriveKeyPairFromSeed(seedWords: string[]): Promise<KeyPair> {
    const validation = this.validateSeedPhrase(seedWords);
    if (!validation.isValid) {
      throw new Error(`Invalid seed phrase: ${validation.error}`);
    }

    const mnemonic = seedWords.join(" ");
    const seedBytes = await mnemonicToSeed(mnemonic);
    
    // Use first 32 bytes of BIP39 seed as private key
    const rawPrivateKey = seedBytes.slice(0, 32);
    const publicKey = await ed.getPublicKey(rawPrivateKey);
    
    // Convert to PKCS#8 format for Web Crypto API
    const privateKey = this.rawPrivateKeyToPkcs8(rawPrivateKey);
    const publicKeyBase64 = uint8ToBase64(publicKey);
    
    return {
      privateKey,
      publicKey,
      publicKeyBase64,
      seedBytes
    };
  }

  /**
   * Generate random Ed25519 key pair (not from seed)
   */
  static async generateRandomKeyPair(): Promise<KeyPair> {
    const rawPrivateKey = randomBytes(32);
    const publicKey = await ed.getPublicKey(rawPrivateKey);
    const privateKey = this.rawPrivateKeyToPkcs8(rawPrivateKey);
    const publicKeyBase64 = uint8ToBase64(publicKey);
    
    return {
      privateKey,
      publicKey,
      publicKeyBase64
    };
  }

  /**
   * Convert raw private key to PKCS#8 format
   */
  static rawPrivateKeyToPkcs8(rawPrivateKey: Uint8Array): Uint8Array {
    if (rawPrivateKey.length !== 32) {
      throw new Error(`Invalid private key length: ${rawPrivateKey.length}, expected 32`);
    }
    
    const pkcs8 = new Uint8Array(48);
    const header = new Uint8Array([
      0x30, 0x2E, // SEQUENCE (46 bytes)
      0x02, 0x01, 0x00, // INTEGER version (0)
      0x30, 0x05, // SEQUENCE AlgorithmIdentifier (5 bytes)
      0x06, 0x03, 0x2B, 0x65, 0x70, // OID for Ed25519 (1.3.101.112)
      0x04, 0x22, // OCTET STRING (34 bytes)
      0x04, 0x20  // OCTET STRING (32 bytes) - the actual private key
    ]);
    
    pkcs8.set(header);
    pkcs8.set(rawPrivateKey, 16);
    
    return pkcs8;
  }

  /**
   * Convert PKCS#8 to raw private key
   */
  static pkcs8ToRawPrivateKey(pkcs8Key: Uint8Array): Uint8Array {
    if (pkcs8Key.length !== 48) {
      throw new Error(`Invalid PKCS#8 key length: ${pkcs8Key.length}, expected 48`);
    }
    
    return pkcs8Key.slice(16, 48);
  }

  // ==========================================================================
  // Signatures
  // ==========================================================================

  /**
   * Sign message with private key
   */
  static async signMessage(
    privateKey: Uint8Array,
    message: string | Uint8Array
  ): Promise<Uint8Array> {
    let rawPrivateKey: Uint8Array;
    
    // Detect format: PKCS#8 is 48 bytes, raw is 32 bytes
    if (privateKey.length === 48) {
      rawPrivateKey = this.pkcs8ToRawPrivateKey(privateKey);
    } else if (privateKey.length === 32) {
      rawPrivateKey = privateKey;
    } else {
      throw new Error(`Invalid private key length: ${privateKey.length}`);
    }
    
    const messageBytes = typeof message === 'string' 
      ? new TextEncoder().encode(message)
      : message;
    
    return await ed.sign(messageBytes, rawPrivateKey);
  }

  /**
   * Verify signature
   */
  static async verifySignature(
    publicKey: Uint8Array,
    message: string | Uint8Array,
    signature: Uint8Array
  ): Promise<boolean> {
    const messageBytes = typeof message === 'string'
      ? new TextEncoder().encode(message)
      : message;
    
    return await ed.verify(signature, messageBytes, publicKey);
  }

  // ==========================================================================
  // Password-based Encryption (PBKDF2)
  // ==========================================================================

  /**
   * Derive encryption key from passphrase using PBKDF2
   */
  static async deriveKeyFromPassphrase(
    passphrase: string,
    salt: Uint8Array,
    iterations: number = 210000
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passphraseBytes = encoder.encode(passphrase);
    
    const baseKey = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(passphraseBytes),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: toArrayBuffer(salt),
        iterations,
        hash: "SHA-256"
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypt data with passphrase
   */
  static async encryptWithPassphrase(
    data: Uint8Array,
    passphrase: string
  ): Promise<EncryptedData> {
    const salt = generateSalt();
    const key = await this.deriveKeyFromPassphrase(passphrase, salt);
    const iv = generateIV();
    
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(data)
    );
    
    return {
      encrypted: new Uint8Array(encrypted),
      salt,
      iv,
      version: 1
    };
  }

  /**
   * Decrypt data with passphrase
   */
  static async decryptWithPassphrase(
    encryptedData: EncryptedData,
    passphrase: string
  ): Promise<Uint8Array> {
    const key = await this.deriveKeyFromPassphrase(passphrase, encryptedData.salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(encryptedData.iv) },
      key,
      toArrayBuffer(encryptedData.encrypted)
    );
    
    return new Uint8Array(decrypted);
  }

  // ==========================================================================
  // Argon2-based Encryption (for Cloud Recovery)
  // ==========================================================================

  /**
   * Derive key using Argon2id (for cloud seed backup)
   */
  static async deriveKeyArgon2id(
    password: string,
    salt: Uint8Array,
    userId: string,
    timeCost: number = 3,
    memoryCost: number = 65536,
    parallelism: number = 4,
    hashLength: number = 32
  ): Promise<Uint8Array> {
    // Combine salt with userId for uniqueness
    const userIdBytes = new TextEncoder().encode(userId);
    const combinedSalt = new Uint8Array(salt.length + userIdBytes.length);
    combinedSalt.set(salt);
    combinedSalt.set(userIdBytes, salt.length);
    
    const hash = await argon2id({
      password,
      salt: combinedSalt,
      iterations: timeCost,
      memorySize: memoryCost, // in KB
      parallelism,
      hashLength,
      outputType: 'binary'
    });
    
    return hash as Uint8Array;
  }

  /**
   * Encrypt seed phrase for cloud storage (Argon2id + AES-GCM)
   */
  static async encryptSeedForCloud(
    seedWords: string[],
    password: string,
    userId: string
  ): Promise<EncryptedSeedData> {
    // Generate random salt
    const salt = generateSalt();
    
    // Derive key with Argon2id
    const keyMaterial = await this.deriveKeyArgon2id(password, salt, userId);
    
    // Import key for AES-GCM
    const aesKey = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(keyMaterial),
      'AES-GCM',
      false,
      ['encrypt']
    );
    
    // Encrypt seed
    const iv = generateIV();
    const seedBytes = new TextEncoder().encode(seedWords.join(' '));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      aesKey,
      toArrayBuffer(seedBytes)
    );
    
    // Extract ciphertext and auth tag
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);
    
    return {
      encrypted: uint8ToBase64(ciphertext),
      salt: uint8ToBase64(salt),
      iv: uint8ToBase64(iv),
      authTag: uint8ToBase64(authTag),
      version: 3,
      kdfParams: {
        algorithm: 'argon2id',
        timeCost: 3,
        memoryCost: 65536,
        parallelism: 4,
        hashLength: 32
      }
    };
  }

  /**
   * Decrypt seed phrase from cloud storage
   */
  static async decryptSeedFromCloud(
    encryptedData: EncryptedSeedData,
    password: string,
    userId: string
  ): Promise<string[]> {
    // Decode base64
    const salt = base64ToUint8(encryptedData.salt);
    const iv = base64ToUint8(encryptedData.iv);
    const ciphertext = base64ToUint8(encryptedData.encrypted);
    const authTag = base64ToUint8(encryptedData.authTag);
    
    // Combine ciphertext and auth tag
    const encryptedBytes = new Uint8Array([...ciphertext, ...authTag]);
    
    // Derive key
    const keyMaterial = await this.deriveKeyArgon2id(
      password,
      salt,
      userId,
      encryptedData.kdfParams.timeCost,
      encryptedData.kdfParams.memoryCost,
      encryptedData.kdfParams.parallelism,
      encryptedData.kdfParams.hashLength
    );
    
    // Import key for AES-GCM
    const aesKey = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(keyMaterial),
      'AES-GCM',
      false,
      ['decrypt']
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      aesKey,
      toArrayBuffer(encryptedBytes)
    );
    
    // Convert to string and split
    const seedString = new TextDecoder().decode(decrypted);
    return seedString.split(' ');
  }

  // ==========================================================================
  // Password Validation
  // ==========================================================================

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): PasswordValidationResult {
    const feedback: string[] = [];
    const suggestions: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 12) {
      score += 1;
    } else {
      feedback.push("Password should be at least 12 characters long");
      suggestions.push("Use a longer password (12+ characters)");
    }

    // Character variety checks
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const varietyCount = [hasLowercase, hasUppercase, hasNumbers, hasSpecial].filter(Boolean).length;
    
    if (varietyCount >= 3) {
      score += 1;
    } else {
      feedback.push("Use a mix of different character types");
      suggestions.push("Include lowercase, uppercase, numbers, and special characters");
    }

    // Entropy/pattern checks
    const hasRepeating = /(.)\1\1/.test(password);
    const hasSequential = /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password);

    if (!hasRepeating && !hasSequential) {
      score += 1;
    } else {
      feedback.push("Avoid repeating or sequential characters");
      suggestions.push("Don't use patterns like 'aaa' or '123'");
    }

    // Dictionary/common password check (simplified)
    const commonPasswords = ['password', '123456', 'qwerty', 'letmein', 'welcome'];
    const isCommon = commonPasswords.some(common => 
      password.toLowerCase().includes(common) || common.includes(password.toLowerCase())
    );

    if (!isCommon) {
      score += 1;
    } else {
      feedback.push("Avoid common passwords");
      suggestions.push("Don't use dictionary words or common sequences");
    }

    return {
      score,
      isSecure: score >= 3,
      feedback,
      suggestions
    };
  }

  /**
   * Generate secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    // Ensure at least one of each character type
    const requirements = [
      () => charset.match(/[a-z]/g)?.[Math.floor(Math.random() * 26)] || 'a',
      () => charset.match(/[A-Z]/g)?.[Math.floor(Math.random() * 26)] || 'A',
      () => charset.match(/\d/g)?.[Math.floor(Math.random() * 10)] || '0',
      () => charset.match(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/g)?.[Math.floor(Math.random() * 28)] || '!'
    ];
    
    // Add required characters
    requirements.forEach(req => {
      password += req();
    });
    
    // Fill remaining characters randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // ==========================================================================
  // Recovery Keys
  // ==========================================================================

  /**
   * Derive recovery-specific key (used for recovery challenges)
   */
  async deriveRecoveryKey(password: string, username: string): Promise<Uint8Array> {
    // Use a fixed salt for recovery to ensure consistency
    const encoder = new TextEncoder();
    const fixedSalt = encoder.encode(`recovery-salt-${username}`);
    
    return await CryptoService.deriveKeyArgon2id(
      password,
      fixedSalt,
      username,
      4, // Higher time cost for recovery
      131072, // Higher memory cost (128MB)
      2, // Lower parallelism
      32
    );
  }

  /**
   * Create recovery signature (for cloud recovery authentication)
   */
  async createRecoverySignature(
    challenge: string,
    keyPair: KeyPair
  ): Promise<string> {
    const signature = await CryptoService.signMessage(keyPair.privateKey, challenge);
    return uint8ToBase64(signature);
  }

  // ==========================================================================
  // Key Import/Export Utilities
  // ==========================================================================

  /**
   * Test if a PKCS#8 key can be imported by Web Crypto API
   */
  async testKeyImport(pkcs8Key: Uint8Array): Promise<boolean> {
    try {
      const key = await crypto.subtle.importKey(
        "pkcs8",
        toArrayBuffer(pkcs8Key),
        { name: "Ed25519" },
        false,
        ["sign"]
      );
      
      return !!key;
    } catch (error) {
      console.error('Key import test failed:', error);
      return false;
    }
  }

  /**
   * Export private key to string format (for backup)
   */
  exportPrivateKeyToString(privateKey: Uint8Array): string {
    return uint8ToBase64(privateKey);
  }

  /**
   * Import private key from string format
   */
  importPrivateKeyFromString(keyString: string): Uint8Array {
    return base64ToUint8(keyString);
  }

  // ==========================================================================
  // Utility Methods (exposed for convenience)
  // ==========================================================================

  static getRandomBytes = randomBytes;
  static toBase64 = uint8ToBase64;
  static fromBase64 = base64ToUint8;
  toHex = uint8ToHex;
  fromHex = hexToUint8;
}