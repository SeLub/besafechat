import { deriveKeyFromPassword } from './argon2';

export interface EncryptedSeed {
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

/**
 * Encrypt seed phrase for cloud storage
 */
export async function encryptSeedForCloud(
  seed: string[],
  password: string,
  userId: string
): Promise<EncryptedSeed> {
  // 1. Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(32));

  // 2. Derive key with Argon2id
  const key = await deriveKeyFromPassword(password, salt, userId);

  // 3. Import key for AES-GCM
  const aesKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);

  // 4. Encrypt seed
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const seedBytes = new TextEncoder().encode(seed.join(' '));

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, seedBytes);

  // 5. Extract ciphertext and auth tag
  const encryptedArray = new Uint8Array(encrypted);
  const ciphertext = encryptedArray.slice(0, -16);
  const authTag = encryptedArray.slice(-16);

  return {
    encrypted: btoa(String.fromCharCode(...ciphertext)),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    authTag: btoa(String.fromCharCode(...authTag)),
    version: 3,
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
 * Decrypt seed phrase from cloud storage
 */
export async function decryptSeedFromCloud(
  encrypted: string,
  password: string,
  userId: string,
  salt: string,
  iv: string,
  authTag: string
): Promise<string[]> {
  // 1. Decode base64
  const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const ciphertextBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const authTagBytes = Uint8Array.from(atob(authTag), c => c.charCodeAt(0));

  // 2. Combine ciphertext and auth tag
  const encryptedData = new Uint8Array([...ciphertextBytes, ...authTagBytes]);

  // 3. Derive key
  const key = await deriveKeyFromPassword(password, saltBytes, userId);

  // 4. Import key for AES-GCM
  const aesKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);

  // 5. Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    aesKey,
    encryptedData
  );

  // 6. Convert to string and split
  const seedString = new TextDecoder().decode(decrypted);
  return seedString.split(' ');
}
