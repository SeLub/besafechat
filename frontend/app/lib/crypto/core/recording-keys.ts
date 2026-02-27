/**
 * Recording-specific key management: FileKey wrapping & chunk encryption
 */
import type { WrappedKey } from '../types';
import { generateIV, toArrayBuffer } from '../utils/binary';
import { hkdfWithInfo } from './hkdf';
import { secureWipe } from './secure-wipe';
import { performX3DH, type X3DHParams } from './x3dh';

/**
 * Wrap FileKey for participant access using X3DH-based envelope encryption
 */
export async function wrapFileKeyForParticipant(params: {
  fileKey: CryptoKey;
  participantPublicKeys: {
    identityKey: Uint8Array;
    signedPreKey: Uint8Array;
    oneTimeKey?: Uint8Array;
  };
  myPrivateKeys: {
    identityKey: Uint8Array;
    signedPreKey: { privateKey: Uint8Array; publicKey: Uint8Array };
    oneTimeKey?: { privateKey: Uint8Array; publicKey: Uint8Array };
    ephemeralKey: { privateKey: Uint8Array; publicKey: Uint8Array };
  };
  recordingId: string;
}): Promise<WrappedKey> {
  const fileKeyRaw = await crypto.subtle.exportKey('raw', params.fileKey);

  try {
    const x3dhParams: X3DHParams = {
      myIdentityKey: params.myPrivateKeys.identityKey,
      mySignedPreKey: params.myPrivateKeys.signedPreKey,
      myOneTimeKey: params.myPrivateKeys.oneTimeKey,
      theirIdentityKey: params.participantPublicKeys.identityKey,
      theirSignedPreKey: params.participantPublicKeys.signedPreKey,
      theirEphemeralKey:
        params.participantPublicKeys.oneTimeKey || params.participantPublicKeys.signedPreKey,
      salt: new TextEncoder().encode(params.recordingId),
      info: 'BeChat.FileAccess.v1',
    };

    const fileAccessKeyRaw = await performX3DH(x3dhParams);

    const fileAccessKey = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(fileAccessKeyRaw),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = generateIV();
    const wrapped = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      fileAccessKey,
      fileKeyRaw
    );

    return {
      wrappedKey: new Uint8Array(wrapped),
      iv,
      ephemeralPublicKey: params.myPrivateKeys.ephemeralKey.publicKey,
      usedOtkId: params.myPrivateKeys.oneTimeKey ? crypto.randomUUID() : undefined,
    };
  } finally {
    secureWipe(new Uint8Array(fileKeyRaw)); // ✅ FIX: Convert ArrayBuffer to Uint8Array before wipe
  }
}

/**
 * Derive deterministic nonce for AES-GCM chunk encryption
 */
export async function deriveChunkNonce(
  recordingId: string,
  chunkIndex: number,
  fileKeyRaw: ArrayBuffer | Uint8Array // ✅ FIX: Accept both types
): Promise<Uint8Array> {
  const salt = new TextEncoder().encode(recordingId);
  const info = new TextEncoder().encode(`chunk:${chunkIndex}`);

  // ✅ FIX: Ensure fileKeyRaw is Uint8Array before passing to hkdfWithInfo
  const fileKeyBytes = fileKeyRaw instanceof ArrayBuffer ? new Uint8Array(fileKeyRaw) : fileKeyRaw;

  const fullNonce = await hkdfWithInfo(fileKeyBytes, salt, `chunk:${chunkIndex}`, 16);
  return fullNonce.slice(0, 12);
}

/**
 * Encrypt video/audio chunk with per-chunk nonce
 */
export async function encryptMediaChunk(
  chunk: Uint8Array,
  fileKey: CryptoKey,
  recordingId: string,
  chunkIndex: number
): Promise<{ encrypted: Uint8Array; iv: Uint8Array }> {
  const fileKeyRaw = await crypto.subtle.exportKey('raw', fileKey);

  try {
    const iv = await deriveChunkNonce(recordingId, chunkIndex, fileKeyRaw);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      fileKey,
      toArrayBuffer(chunk)
    );

    return {
      encrypted: new Uint8Array(encrypted),
      iv,
    };
  } finally {
    secureWipe(new Uint8Array(fileKeyRaw)); // ✅ FIX: Convert before wipe
  }
}

/**
 * Decrypt media chunk
 */
export async function decryptMediaChunk(
  encryptedChunk: Uint8Array,
  fileKey: CryptoKey,
  recordingId: string,
  chunkIndex: number,
  iv: Uint8Array
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    fileKey,
    toArrayBuffer(encryptedChunk)
  );

  return new Uint8Array(decrypted);
}
