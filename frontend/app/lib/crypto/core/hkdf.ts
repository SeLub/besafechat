/**
 * HKDF (HMAC-based Key Derivation Function) per RFC 5869
 * Uses Web Crypto API HMAC-SHA256 for extract/expand steps
 */
import { toArrayBuffer, concatUint8Arrays } from '../utils/binary';

const HKDF_INFO = new TextEncoder().encode('BeSafeChat.HKDF.v1');

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> {
  const saltBuffer = salt.length > 0 ? toArrayBuffer(salt) : new ArrayBuffer(32);

  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(ikm),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 1, hash: 'SHA-256' },
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function hkdfExpand(prk: CryptoKey, info: Uint8Array, length: number): Promise<Uint8Array> {
  const hashLen = 32;
  const n = Math.ceil(length / hashLen);

  if (n > 255) throw new Error('Cannot expand to more than 255 * HashLen bytes');

  let okm = new Uint8Array(0);
  let prev = new Uint8Array(0);

  for (let i = 1; i <= n; i++) {
    const data = concatUint8Arrays([prev, info, new Uint8Array([i])]);
    const signature = await crypto.subtle.sign({ name: 'HMAC' }, prk, toArrayBuffer(data));
    prev = new Uint8Array(signature);
    // ✅ FIX: Explicit type assertion for TypeScript strict mode
    okm = concatUint8Arrays([okm, prev]) as Uint8Array<ArrayBuffer>;
  }

  return okm.slice(0, length);
}

export async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const prk = await hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

export async function hkdfWithInfo(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: string,
  length: number
): Promise<Uint8Array> {
  const infoBytes = new TextEncoder().encode(`${info}:${HKDF_INFO}`);
  return hkdf(ikm, salt, infoBytes, length);
}
