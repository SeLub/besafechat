// /home/selub/Documents/progs/besafechat/frontend/app/lib/crypto/utils/serialization.ts
import { toArrayBuffer } from './binary';

/**
 * Convert raw Ed25519 private key (32 bytes) to PKCS#8 format (48 bytes)
 */
export function rawPrivateKeyToPkcs8(rawPrivateKey: Uint8Array): Uint8Array {
  if (rawPrivateKey.length !== 32) {
    throw new Error(`Invalid private key length: ${rawPrivateKey.length}, expected 32`);
  }

  const pkcs8 = new Uint8Array(48);
  const header = new Uint8Array([
    0x30,
    0x2e, // SEQUENCE (46 bytes)
    0x02,
    0x01,
    0x00, // INTEGER version (0)
    0x30,
    0x05, // SEQUENCE AlgorithmIdentifier (5 bytes)
    0x06,
    0x03,
    0x2b,
    0x65,
    0x70, // OID for Ed25519 (1.3.101.112)
    0x04,
    0x22, // OCTET STRING (34 bytes)
    0x04,
    0x20, // OCTET STRING (32 bytes) - the actual private key
  ]);

  pkcs8.set(header);
  pkcs8.set(rawPrivateKey, 16);

  return pkcs8;
}

/**
 * Convert PKCS#8 to raw private key
 */
export function pkcs8ToRawPrivateKey(pkcs8Key: Uint8Array): Uint8Array {
  if (pkcs8Key.length !== 48) {
    throw new Error(`Invalid PKCS#8 key length: ${pkcs8Key.length}, expected 48`);
  }

  return pkcs8Key.slice(16, 48);
}

/**
 * Test if a PKCS#8 key can be imported by Web Crypto API
 */
export async function testKeyImport(pkcs8Key: Uint8Array): Promise<boolean> {
  try {
    // Явное преобразование к ArrayBuffer для совместимости с Web Crypto API
    const keyBuffer = toArrayBuffer(pkcs8Key);

    const key = await crypto.subtle.importKey('pkcs8', keyBuffer, { name: 'Ed25519' }, false, [
      'sign',
    ]);

    return !!key;
  } catch (error) {
    console.error('Key import test failed:', error);
    return false;
  }
}

/**
 * Import PKCS#8 key as Web Crypto API CryptoKey
 */
export async function importPrivateKey(pkcs8Key: Uint8Array): Promise<CryptoKey> {
  try {
    const keyBuffer = toArrayBuffer(pkcs8Key);

    return await crypto.subtle.importKey('pkcs8', keyBuffer, { name: 'Ed25519' }, false, ['sign']);
  } catch (error) {
    console.error('Failed to import private key:', error);
    throw new Error(
      `Failed to import private key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Export CryptoKey to PKCS#8 format
 */
export async function exportPrivateKey(key: CryptoKey): Promise<Uint8Array> {
  try {
    const exported = await crypto.subtle.exportKey('pkcs8', key);
    return new Uint8Array(exported);
  } catch (error) {
    console.error('Failed to export private key:', error);
    throw new Error(
      `Failed to export private key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Convert between different key formats
 */
export function convertKeyFormat(
  key: Uint8Array,
  fromFormat: 'pkcs8' | 'raw',
  toFormat: 'pkcs8' | 'raw'
): Uint8Array {
  if (fromFormat === 'pkcs8' && toFormat === 'raw') {
    return pkcs8ToRawPrivateKey(key);
  }

  if (fromFormat === 'raw' && toFormat === 'pkcs8') {
    return rawPrivateKeyToPkcs8(key);
  }

  // Same format, return as-is
  return key;
}
