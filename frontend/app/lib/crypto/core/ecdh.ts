/**
 * X25519 Elliptic Curve Diffie-Hellman key agreement
 * Uses @noble/curves for constant-time operations
 */
import { x25519 } from '@noble/curves/ed25519.js';

/**
 * Generate X25519 keypair for ephemeral use
 */
export function generateX25519KeyPair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  // ✅ FIX: randomSecretKey() is the correct method for x25519
  const privateKey = x25519.utils.randomSecretKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Compute ECDH shared secret (X25519)
 */
export async function computeX25519SharedSecret(
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Promise<Uint8Array> {
  if (privateKey.length !== 32 || publicKey.length !== 32) {
    throw new Error('X25519 keys must be exactly 32 bytes');
  }

  const shared = x25519.getSharedSecret(privateKey, publicKey);
  return shared.slice(1); // Skip the prefix byte, return 32-byte shared secret
}

/**
 * Convert Ed25519 identity key to X25519 for key agreement (RFC 7748)
 */
export function ed25519ToX25519(edPrivateKey: Uint8Array): Uint8Array {
  if (edPrivateKey.length !== 32) {
    throw new Error('Ed25519 private key must be 32 bytes');
  }

  const x25519Key = new Uint8Array(edPrivateKey);

  // Clamp the key per RFC 7748
  x25519Key[0] &= 248;
  x25519Key[31] &= 127;
  x25519Key[31] |= 64;

  return x25519Key;
}

/**
 * Derive X25519 public key from converted private key
 */
export function deriveX25519PublicKey(privateKey: Uint8Array): Uint8Array {
  return x25519.getPublicKey(privateKey);
}
