/**
 * BeSafeChat Cryptography Library
 *
 * High-level API for end-to-end encryption.
 */

// ─────────────────────────────────────────────────────────────
// Re-export all core primitives (functions ONLY)
// ─────────────────────────────────────────────────────────────
export * from './core';

// ─────────────────────────────────────────────────────────────
// Re-export utilities
// ─────────────────────────────────────────────────────────────
export * from './utils/binary';
export * from './utils/serialization';
export * from './utils/validation';

// ─────────────────────────────────────────────────────────────
// Re-export errors
// ─────────────────────────────────────────────────────────────
export * from './errors';

// ─────────────────────────────────────────────────────────────
// Re-export types (ONLY from types.ts - explicit to avoid ambiguity)
// ─────────────────────────────────────────────────────────────
export type {
  KeyPair,
  EncryptedData,
  EncryptedSeedData,
  PasswordValidationResult,
  SeedValidationResult,
  DerivationOptions,
  Argon2Params,
  X25519KeyPair,
  X3DHParams,
  X3DHResult,
  WrappedKey,
  EncryptedChunk,
} from './types';

// ─────────────────────────────────────────────────────────────
// IMPORT all functions for default export object
// ─────────────────────────────────────────────────────────────
import { generateSecurePassword } from './utils/validation';
import { randomBytes, uint8ToBase64, base64ToUint8 } from './utils/binary';
import { rawPrivateKeyToPkcs8, pkcs8ToRawPrivateKey } from './utils/serialization';
import { secureWipe, secureWipeMultiple, withSecureWipe } from './core/secure-wipe';

// Key derivation
import {
  generateSeedPhrase,
  deriveKeyPairFromSeed,
  hashPrivateKey,
  deriveEncryptionKeyFromHash,
  encryptSeedForCloud,
  decryptSeedFromCloud,
} from './core/key-derivation';

// Encryption
import {
  encryptWithPassphrase,
  decryptWithPassphrase,
  encryptWithKey,
  decryptWithKey,
} from './core/encryption';

// Signatures
import {
  signMessage,
  verifySignature,
  signMessageToBase64,
  verifySignatureFromBase64,
  createRecoverySignature,
  verifyRecoverySignature,
} from './core/signatures';

// E2EE primitives (NEW)
import { hkdf, hkdfWithInfo } from './core/hkdf';

import {
  generateX25519KeyPair,
  computeX25519SharedSecret,
  ed25519ToX25519,
  deriveX25519PublicKey,
} from './core/ecdh';

import { performX3DH, generateEphemeralKeyPair } from './core/x3dh';

import {
  wrapFileKeyForParticipant,
  encryptMediaChunk,
  decryptMediaChunk,
  deriveChunkNonce,
} from './core/recording-keys';

// ─────────────────────────────────────────────────────────────
// Convenience object for grouped access
// ─────────────────────────────────────────────────────────────
export const CryptoUtils = {
  generateSecurePassword,
  randomBytes,
  uint8ToBase64,
  base64ToUint8,
  rawPrivateKeyToPkcs8,
  pkcs8ToRawPrivateKey,
  secureWipe,
  secureWipeMultiple,
  withSecureWipe,
};

// ─────────────────────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────────────────────
const crypto = {
  ...CryptoUtils,

  // Key management
  generateSeedPhrase,
  deriveKeyPairFromSeed,
  hashPrivateKey,
  deriveEncryptionKeyFromHash,
  encryptSeedForCloud,
  decryptSeedFromCloud,

  // Encryption
  encryptWithPassphrase,
  decryptWithPassphrase,
  encryptWithKey,
  decryptWithKey,

  // Signatures
  signMessage,
  verifySignature,
  signMessageToBase64,
  verifySignatureFromBase64,
  createRecoverySignature,
  verifyRecoverySignature,

  // E2EE (NEW)
  hkdf,
  hkdfWithInfo,
  generateX25519KeyPair,
  computeX25519SharedSecret,
  ed25519ToX25519,
  deriveX25519PublicKey,
  performX3DH,
  generateEphemeralKeyPair,
  wrapFileKeyForParticipant,
  encryptMediaChunk,
  decryptMediaChunk,
  deriveChunkNonce,
};

export default crypto;
