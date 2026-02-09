/**
 * Crypto Polyfill for non-HTTPS contexts
 * Provides fallback implementations for Web Crypto API on HTTP (development)
 * 
 * WARNING: This is ONLY for development on HTTP. 
 * In production (HTTPS), the native Web Crypto API will be used.
 */

import { sha256, sha512 } from '@noble/hashes/sha2.js';

// Only add polyfill if crypto.subtle is not available
if (!crypto.subtle) {
  console.warn(
    '⚠️ Web Crypto API not available. Using polyfill for development. Do not use in production!'
  );

  // Create a polyfill object
  const cryptoSubtlePolyfill = {
    digest: async (algorithm: string, data: BufferSource): Promise<ArrayBuffer> => {
      const uint8Data = new Uint8Array(
        data instanceof ArrayBuffer ? data : data.buffer || new ArrayBuffer(0)
      );

      let hash: Uint8Array;

      switch (algorithm.toUpperCase()) {
        case 'SHA-1':
          // SHA-1 not in @noble/hashes, use SHA-256 as fallback
          console.warn('SHA-1 requested but not available, using SHA-256 instead');
          hash = sha256(uint8Data);
          break;

        case 'SHA-256':
          hash = sha256(uint8Data);
          break;

        case 'SHA-384':
          // SHA-384 not in basic @noble/hashes, use SHA-512 and truncate
          const hash512 = sha512(uint8Data);
          hash = hash512.slice(0, 48); // 384 bits = 48 bytes
          break;

        case 'SHA-512':
          hash = sha512(uint8Data);
          break;

        default:
          throw new Error(`Algorithm ${algorithm} not supported in polyfill`);
      }

      return hash.buffer;
    },
  };

  // Assign polyfill to crypto.subtle
  (crypto as any).subtle = cryptoSubtlePolyfill as SubtleCrypto;
}
