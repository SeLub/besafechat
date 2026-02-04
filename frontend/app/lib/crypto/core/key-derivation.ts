import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { argon2id } from 'hash-wasm';

import {
  randomBytes,
  uint8ToBase64,
  toArrayBuffer,
  base64ToUint8,
  uint8ToHex,
  concatUint8Arrays,
} from '../utils/binary';
import { rawPrivateKeyToPkcs8, pkcs8ToRawPrivateKey } from '../utils/serialization';
import type { KeyPair, EncryptedSeedData, Argon2Params } from '../types';

// Configure @noble/ed25519
// @ts-ignore
if (!ed.hashes) ed.hashes = {};
// @ts-ignore
ed.hashes.sha512 = sha512;
// @ts-ignore
ed.hashes.sha512Async = async (m: Uint8Array) => sha512(m);

/**
 * Generate simple checksum for seed validation
 */
async function generateSeedChecksum(seedString: string): Promise<string> {
  const encoder = new TextEncoder();
  const seedBytes = encoder.encode(seedString);

  // Асинхронный хэш
  const hashBuffer = await crypto.subtle.digest('SHA-256', seedBytes);
  const hashArray = new Uint8Array(hashBuffer);

  // Берем первые 4 байта хэша (8 hex символов)
  return uint8ToHex(hashArray.slice(0, 4));
}

/**
 * Validate seed checksum
 */
async function validateSeedChecksum(seedString: string, storedChecksum: string): Promise<boolean> {
  const computedChecksum = await generateSeedChecksum(seedString);
  return storedChecksum === computedChecksum;
}

/**
 * Validate seed phrase words
 */
function validateSeedPhrase(words: string[]): { isValid: boolean; error?: string } {
  const wordCount = words.length;

  if (wordCount !== 12) {
    return {
      isValid: false,
      error: `Seed phrase must be 12 words, got ${wordCount}`,
    };
  }

  // Validate each word against BIP39 wordlist
  const normalizedWords = words.map(word => word.toLowerCase().trim());

  for (const word of normalizedWords) {
    if (!wordlist.includes(word)) {
      return {
        isValid: false,
        error: `Invalid word: ${word}`,
      };
    }
  }

  // Final BIP39 validation
  const mnemonic = normalizedWords.join(' ');
  const isValid = validateMnemonic(mnemonic, wordlist);

  return {
    isValid,
    error: isValid ? undefined : 'Invalid seed phrase checksum',
  };
}

/**
 * Normalize seed phrase (lowercase, trim)
 */
function normalizeSeedPhrase(seedPhrase: string | string[]): string[] {
  const words = Array.isArray(seedPhrase) ? seedPhrase : seedPhrase.trim().split(/\s+/);

  return words.map(word => word.toLowerCase().trim()).filter(word => word.length > 0);
}

/**
 * Generate 12-word BIP39 seed phrase
 */
export async function generateSeedPhrase(): Promise<string[]> {
  const mnemonic = generateMnemonic(wordlist, 128); // 128 bits = 12 words
  return mnemonic.split(' ');
}

/**
 * Derive Ed25519 keypair from seed phrase
 */
export async function deriveKeyPairFromSeed(seedWords: string[]): Promise<KeyPair> {
  const validation = validateSeedPhrase(seedWords);
  if (!validation.isValid) {
    throw new Error(`Invalid seed phrase: ${validation.error}`);
  }

  const normalizedWords = normalizeSeedPhrase(seedWords);
  const mnemonic = normalizedWords.join(' ');
  const seedBytes = await mnemonicToSeed(mnemonic);

  // Use first 32 bytes of BIP39 seed as private key
  const rawPrivateKey = seedBytes.slice(0, 32);
  const publicKey = await ed.getPublicKey(rawPrivateKey);

  // Convert to PKCS#8 format for Web Crypto API
  const privateKey = rawPrivateKeyToPkcs8(rawPrivateKey);
  const publicKeyBase64 = uint8ToBase64(publicKey);

  return {
    privateKey,
    publicKey,
    publicKeyBase64,
    seedBytes,
  };
}

/**
 * Derive key using Argon2id (for cloud seed backup)
 */
async function deriveKeyArgon2id(
  password: string,
  salt: Uint8Array,
  params: Argon2Params = {
    timeCost: 3,
    memoryCost: 65536,
    parallelism: 4,
    hashLength: 32,
  }
): Promise<Uint8Array> {
  // Combine salt with userId for uniqueness
  const combinedSalt = concatUint8Arrays([salt]);

  const hash = await argon2id({
    password,
    salt: combinedSalt,
    iterations: params.timeCost,
    memorySize: params.memoryCost, // in KB
    parallelism: params.parallelism,
    hashLength: params.hashLength,
    outputType: 'binary',
  });

  return hash as Uint8Array;
}

/**
 * Encrypt seed phrase for cloud storage (Argon2id + AES-GCM) WITH CHECKSUM
 */
export async function encryptSeedForCloud(
  seedWords: string[],
  password: string,
  userId: string
): Promise<EncryptedSeedData> {
  // Validate seed first
  const validation = validateSeedPhrase(seedWords);
  if (!validation.isValid) {
    throw new Error(`Invalid seed phrase: ${validation.error}`);
  }

  // Generate random salt (32 bytes)
  const salt = randomBytes(32);

  // Derive key with Argon2id
  const keyMaterial = await deriveKeyArgon2id(password, salt);

  // Import key for AES-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyMaterial),
    'AES-GCM',
    false,
    ['encrypt']
  );

  // Prepare seed string with checksum
  const seedString = seedWords.join(' ');
  const checksum = await generateSeedChecksum(seedString);
  const dataToEncrypt = `${seedString}|${checksum}`;

  // Encrypt seed with checksum
  const iv = randomBytes(12); // 12 bytes for AES-GCM
  const dataBytes = new TextEncoder().encode(dataToEncrypt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    aesKey,
    toArrayBuffer(dataBytes)
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
    version: 1,
    kdfParams: {
      algorithm: 'argon2id',
      timeCost: 3,
      memoryCost: 65536,
      parallelism: 4,
      hashLength: 32,
    },
  };
}

/**
 * Derive encryption key from passphrase using PBKDF2
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = 210000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(passphraseBytes),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Decrypt seed phrase from cloud storage WITH CHECKSUM VALIDATION
 */
export async function decryptSeedFromCloud(
  encryptedData: EncryptedSeedData,
  password: string
): Promise<string[]> {
  try {
    // Validate version - only version 1 is supported
    if (encryptedData.version !== 1) {
      throw new Error('Unsupported backup version');
    }

    // Decode base64
    const salt = base64ToUint8(encryptedData.salt);
    const iv = base64ToUint8(encryptedData.iv);
    const ciphertext = base64ToUint8(encryptedData.encrypted);
    const authTag = base64ToUint8(encryptedData.authTag);

    // Validate data lengths
    if (salt.length !== 32) throw new Error('Invalid salt length');
    if (iv.length !== 12) throw new Error('Invalid IV length');
    if (authTag.length !== 16) throw new Error('Invalid auth tag length');

    // Combine ciphertext and auth tag
    const encryptedBytes = concatUint8Arrays([ciphertext, authTag]);

    // Derive key
    const keyMaterial = await deriveKeyArgon2id(password, salt, encryptedData.kdfParams);

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

    // Convert to string and extract seed with checksum
    const decryptedText = new TextDecoder().decode(decrypted);

    // Validate format - must contain '|'
    if (!decryptedText.includes('|')) {
      throw new Error('Invalid backup format');
    }

    const [seedString, storedChecksum] = decryptedText.split('|');

    // Validate parts exist
    if (!seedString || !storedChecksum) {
      throw new Error('Invalid backup data');
    }

    // Validate checksum length (8 hex characters)
    if (storedChecksum.length !== 8 || !/^[0-9a-f]{8}$/i.test(storedChecksum)) {
      throw new Error('Invalid backup format');
    }

    // Validate checksum - CRITICAL check for password validation
    const isChecksumValid = await validateSeedChecksum(seedString, storedChecksum);

    if (!isChecksumValid) {
      // Checksum doesn't match = WRONG PASSWORD
      throw new Error('Неверный пароль');
    }

    // Validate seed phrase
    const seedWords = seedString.split(' ');
    const validation = validateSeedPhrase(seedWords);

    if (!validation.isValid) {
      throw new Error(`Invalid seed phrase in backup: ${validation.error}`);
    }

    return seedWords;
  } catch (error) {
    // Pass through our custom errors
    if (error instanceof Error && error.message === 'Неверный пароль') {
      throw error;
    }

    // Handle decryption errors
    if (error instanceof DOMException) {
      if (error.name === 'OperationError') {
        throw new Error('Invalid password or corrupted backup');
      }
    }

    // All other errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Backup restoration failed: ${errorMessage}`);
  }
}
