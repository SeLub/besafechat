// /home/selub/Documents/progs/besafechat/frontend/app/lib/crypto/core/signatures.ts
import * as ed from '@noble/ed25519';
import { pkcs8ToRawPrivateKey } from '../utils/serialization';
import { uint8ToBase64, base64ToUint8 } from '../utils/binary';

/**
 * Sign message with private key
 */
export async function signMessage(
  privateKey: Uint8Array,
  message: string | Uint8Array
): Promise<Uint8Array> {
  let rawPrivateKey: Uint8Array;

  // Detect format: PKCS#8 is 48 bytes, raw is 32 bytes
  if (privateKey.length === 48) {
    rawPrivateKey = pkcs8ToRawPrivateKey(privateKey);
  } else if (privateKey.length === 32) {
    rawPrivateKey = privateKey;
  } else {
    throw new Error(`Invalid private key length: ${privateKey.length}`);
  }

  const messageBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;

  return await ed.sign(messageBytes, rawPrivateKey);
}

/**
 * Verify signature
 */
export async function verifySignature(
  publicKey: Uint8Array,
  message: string | Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  const messageBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;

  return await ed.verify(signature, messageBytes, publicKey);
}

/**
 * Sign message and return base64 encoded signature
 */
export async function signMessageToBase64(
  privateKey: Uint8Array,
  message: string | Uint8Array
): Promise<string> {
  const signature = await signMessage(privateKey, message);
  return uint8ToBase64(signature);
}

/**
 * Verify base64 encoded signature
 */
export async function verifySignatureFromBase64(
  publicKey: Uint8Array,
  message: string | Uint8Array,
  signatureBase64: string
): Promise<boolean> {
  const signature = base64ToUint8(signatureBase64);
  return await verifySignature(publicKey, message, signature);
}

/**
 * Create recovery signature (for cloud recovery authentication)
 */
export async function createRecoverySignature(
  challenge: string,
  privateKey: Uint8Array
): Promise<string> {
  const signature = await signMessage(privateKey, challenge);
  return uint8ToBase64(signature);
}

/**
 * Verify recovery signature
 */
export async function verifyRecoverySignature(
  challenge: string,
  signatureBase64: string,
  publicKey: Uint8Array
): Promise<boolean> {
  return await verifySignatureFromBase64(publicKey, challenge, signatureBase64);
}

/**
 * Batch verify multiple signatures
 */
export async function verifyMultipleSignatures(
  verifications: Array<{
    publicKey: Uint8Array;
    message: string | Uint8Array;
    signature: Uint8Array;
  }>
): Promise<boolean[]> {
  const results = await Promise.all(
    verifications.map(async v => {
      try {
        return await verifySignature(v.publicKey, v.message, v.signature);
      } catch (error) {
        console.error('Signature verification failed:', error);
        return false;
      }
    })
  );

  return results;
}
