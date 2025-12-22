import { 
  toArrayBuffer, 
  generateSalt, 
  generateIV,
  uint8ToBase64,
  base64ToUint8,
  concatUint8Arrays 
} from '../utils/binary';
import { deriveKeyFromPassphrase } from './key-derivation';

/**
 * Encrypt data with passphrase using AES-GCM
 */
export async function encryptWithPassphrase(
  data: Uint8Array,
  passphrase: string,
  iterations: number = 210000
): Promise<{
  encrypted: Uint8Array;
  salt: Uint8Array;
  iv: Uint8Array;
  version: number;
}> {
  const salt = generateSalt();
  const key = await deriveKeyFromPassphrase(passphrase, salt, iterations);
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
export async function decryptWithPassphrase(
  encryptedData: {
    encrypted: Uint8Array;
    salt: Uint8Array;
    iv: Uint8Array;
    version: number;
    authTag?: Uint8Array;
  },
  passphrase: string,
  iterations: number = 210000
): Promise<Uint8Array> {
  const key = await deriveKeyFromPassphrase(passphrase, encryptedData.salt, iterations);
  
  let encryptedBytes = encryptedData.encrypted;
  
  // Если есть отдельный authTag, объединяем его с ciphertext
  if (encryptedData.authTag) {
    encryptedBytes = concatUint8Arrays([encryptedData.encrypted, encryptedData.authTag]);
  }
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(encryptedData.iv) },
    key,
    toArrayBuffer(encryptedBytes)
  );
  
  return new Uint8Array(decrypted);
}

/**
 * Encrypt data with raw key (already derived)
 */
export async function encryptWithKey(
  data: Uint8Array,
  key: CryptoKey,
  iv?: Uint8Array
): Promise<{
  encrypted: Uint8Array;
  iv: Uint8Array;
}> {
  const encryptionIv = iv || generateIV();
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(encryptionIv) },
    key,
    toArrayBuffer(data)
  );
  
  return {
    encrypted: new Uint8Array(encrypted),
    iv: encryptionIv
  };
}

/**
 * Decrypt data with raw key
 */
export async function decryptWithKey(
  encryptedData: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encryptedData)
  );
  
  return new Uint8Array(decrypted);
}

/**
 * Export private key to string format (for backup)
 */
export function exportPrivateKeyToString(privateKey: Uint8Array): string {
  return uint8ToBase64(privateKey);
}

/**
 * Import private key from string format
 */
export function importPrivateKeyFromString(keyString: string): Uint8Array {
  return base64ToUint8(keyString);
}