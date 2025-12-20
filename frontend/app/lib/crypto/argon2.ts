import { argon2id } from 'hash-wasm';

export interface Argon2Params {
  password: string;
  salt: Uint8Array;
  timeCost?: number;
  memoryCost?: number;
  parallelism?: number;
  hashLength?: number;
}

/**
 * Derive key using Argon2id
 * Default params: ~1 sec on modern CPU, 64 MB RAM
 */
export async function deriveKeyArgon2id(params: Argon2Params): Promise<Uint8Array> {
  const hashHex = await argon2id({
    password: params.password,
    salt: params.salt,
    iterations: params.timeCost || 3,
    memorySize: params.memoryCost || 65536, // 64 MB (in KB)
    parallelism: params.parallelism || 4,
    hashLength: params.hashLength || 32,
    outputType: 'binary',
  });

  return new Uint8Array(hashHex as ArrayBuffer);
}

/**
 * Derive encryption key from password + salt + userId
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  userId: string
): Promise<Uint8Array> {
  // Combine salt with userId for uniqueness
  const userIdBytes = new TextEncoder().encode(userId);
  const combinedSalt = new Uint8Array([...salt, ...userIdBytes]);

  return await deriveKeyArgon2id({
    password,
    salt: combinedSalt,
    timeCost: 3,
    memoryCost: 65536,
    parallelism: 4,
    hashLength: 32,
  });
}
