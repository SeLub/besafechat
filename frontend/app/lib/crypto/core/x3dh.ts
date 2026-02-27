/**
 * X3DH (Extended Triple Diffie-Hellman) key agreement protocol
 * Adapted for BeSafeChat E2EE architecture
 */
import { hkdfWithInfo } from './hkdf';
import { computeX25519SharedSecret, ed25519ToX25519, generateX25519KeyPair } from './ecdh';
import { concatUint8Arrays, uint8ToBase64 } from '../utils/binary';

export interface X3DHParams {
  // My keys
  myIdentityKey: Uint8Array; // Ed25519 IK (32 bytes raw)
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
  theirEphemeralKey: Uint8Array; // Ed25519 EK public (32 bytes, generated per-session)

  // Context for key separation
  salt: Uint8Array; // e.g., recordingId or chatId
  info: string; // e.g., "BeChat.FileAccess.v1"
}

/**
 * Perform X3DH key agreement
 * Returns shared secret ready for HKDF expansion
 */
export async function performX3DH(params: X3DHParams): Promise<Uint8Array> {
  // Convert Ed25519 keys to X25519 for ECDH operations
  const myIK_x = ed25519ToX25519(params.myIdentityKey);
  const mySPK_x = ed25519ToX25519(params.mySignedPreKey.privateKey);
  const myOTK_x = params.myOneTimeKey ? ed25519ToX25519(params.myOneTimeKey.privateKey) : undefined;

  const theirIK_x = ed25519ToX25519(params.theirIdentityKey);
  const theirSPK_x = ed25519ToX25519(params.theirSignedPreKey);
  const theirEK_x = ed25519ToX25519(params.theirEphemeralKey);

  // Compute DH components (RFC 7748 X25519)
  const dh1 = await computeX25519SharedSecret(myIK_x, theirSPK_x); // DH(IK_A, SPK_B)
  const dh2 = await computeX25519SharedSecret(mySPK_x, theirIK_x); // DH(SPK_A, IK_B)
  const dh3 = await computeX25519SharedSecret(mySPK_x, theirEK_x); // DH(SPK_A, EK_B)

  // OTK is optional but recommended for forward secrecy
  const dh4 =
    myOTK_x && params.myOneTimeKey
      ? await computeX25519SharedSecret(myOTK_x, theirEK_x) // DH(OTK_A, EK_B)
      : new Uint8Array(32); // Fallback: zeros (weakens FS, but allows fallback)

  // Concatenate all DH outputs
  const sharedMaterial = concatUint8Arrays([dh1, dh2, dh3, dh4]);

  // Derive final shared secret via HKDF
  return hkdfWithInfo(
    sharedMaterial,
    params.salt,
    params.info,
    32 // Output 256-bit key
  );
}

/**
 * Generate ephemeral keypair for X3DH initiation
 */
export function generateEphemeralKeyPair(): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyBase64: string;
} {
  const { privateKey, publicKey } = generateX25519KeyPair();
  return {
    privateKey,
    publicKey,
    publicKeyBase64: uint8ToBase64(publicKey),
  };
}

// Re-export for convenience
export { generateX25519KeyPair } from './ecdh';
