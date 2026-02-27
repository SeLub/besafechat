// /home/selub/Documents/progs/besafechat/frontend/app/lib/crypto/types.ts
export interface KeyPair {
  privateKey: Uint8Array; // PKCS#8 format for Web Crypto API
  publicKey: Uint8Array; // Raw public key (32 bytes)
  publicKeyBase64: string;
  seedBytes?: Uint8Array; // Full BIP39 seed (64 bytes, only for seed-based keys)
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
  maxScore: number;
  isSecure: boolean;
  feedback: string[];
  suggestions: string[];
  entropy?: number;
  uniqueChars?: number;
  isLeaked?: boolean;
}

export interface SeedValidationResult {
  isValid: boolean;
  error?: string;
  wordCount: number;
  invalidWords: string[];
}

export interface DerivationOptions {
  iterations?: number;
  salt?: Uint8Array;
  purpose?: string;
  index?: number;
  hardening?: boolean;
}

export interface Argon2Params {
  timeCost: number;
  memoryCost: number;
  parallelism: number;
  hashLength: number;
}
// ─────────────────────────────────────────────────────────────
// NEW: E2EE Types (X3DH, Recording, Keys)
// ─────────────────────────────────────────────────────────────

/**
 * X25519 keypair for ECDH key agreement
 */
export interface X25519KeyPair {
  privateKey: Uint8Array; // 32 bytes raw
  publicKey: Uint8Array; // 32 bytes raw
  publicKeyBase64: string;
}

/**
 * X3DH protocol parameters
 */
export interface X3DHParams {
  // My keys (private)
  myIdentityKey: Uint8Array; // Ed25519 IK private (32 bytes raw)
  mySignedPreKey: {
    privateKey: Uint8Array; // Ed25519 SPK private (32 bytes raw)
    publicKey: Uint8Array; // Ed25519 SPK public (32 bytes)
  };
  myOneTimeKey?: {
    privateKey: Uint8Array; // Ed25519 OTK private (optional)
    publicKey: Uint8Array; // Ed25519 OTK public
  };

  // Their keys (public only)
  theirIdentityKey: Uint8Array; // Ed25519 IK public (32 bytes)
  theirSignedPreKey: Uint8Array; // Ed25519 SPK public (32 bytes)
  theirEphemeralKey: Uint8Array; // Ed25519 EK public (32 bytes)

  // Context for key separation
  salt: Uint8Array; // e.g., recordingId or chatId
  info: string; // e.g., "BeChat.FileAccess.v1"
}

/**
 * X3DH handshake result
 */
export interface X3DHResult {
  sharedSecret: Uint8Array; // 32 bytes, must be passed through HKDF
  ephemeralPublicKey: Uint8Array; // For peer to complete handshake
  usedOtkId?: string; // ID of consumed OTK (if any)
}

/**
 * Wrapped key for envelope encryption
 */
export interface WrappedKey {
  wrappedKey: Uint8Array; // AES-GCM encrypted target key
  iv: Uint8Array; // 12 bytes
  ephemeralPublicKey: Uint8Array; // For unwrapping
  usedOtkId?: string;
}

/**
 * Encrypted media chunk (video/audio)
 */
export interface EncryptedChunk {
  data: Uint8Array; // AES-GCM ciphertext
  iv: Uint8Array; // 12 bytes nonce
  index: number; // Chunk sequence number
  recordingId: string; // For verification
}
