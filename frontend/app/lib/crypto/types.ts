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
