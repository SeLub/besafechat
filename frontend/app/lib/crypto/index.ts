// Re-export everything from core modules
export * from './core/key-derivation';
export * from './core/encryption';
export * from './core/signatures';

// Re-export from utils
export * from './utils/binary';
export * from './utils/serialization';
export * from './utils/validation';

// Re-export types
export type * from './types';

// Convenience functions
import { generateSecurePassword } from './utils/validation';
import { randomBytes, uint8ToBase64, base64ToUint8 } from './utils/binary';
import { rawPrivateKeyToPkcs8, pkcs8ToRawPrivateKey } from './utils/serialization';

export const CryptoUtils = {
  generateSecurePassword,
  randomBytes,
  uint8ToBase64,
  base64ToUint8,
  rawPrivateKeyToPkcs8,
  pkcs8ToRawPrivateKey
};

// Named exports for frequently used functions
export { generateSeedPhrase, deriveKeyPairFromSeed } from './core/key-derivation';
export { encryptWithPassphrase, decryptWithPassphrase } from './core/encryption';
export { signMessage, verifySignature } from './core/signatures';

// Export as default object for convenience
export default {
  ...CryptoUtils,
  generateSeedPhrase: () => import('./core/key-derivation').then(m => m.generateSeedPhrase()),
  deriveKeyPairFromSeed: (seedWords: string[]) => 
    import('./core/key-derivation').then(m => m.deriveKeyPairFromSeed(seedWords)),
  encryptWithPassphrase: (data: Uint8Array, passphrase: string) => 
    import('./core/encryption').then(m => m.encryptWithPassphrase(data, passphrase)),
  decryptWithPassphrase: (encryptedData: any, passphrase: string) =>
    import('./core/encryption').then(m => m.decryptWithPassphrase(encryptedData, passphrase)),
  signMessage: (privateKey: Uint8Array, message: string | Uint8Array) =>
    import('./core/signatures').then(m => m.signMessage(privateKey, message)),
  verifySignature: (publicKey: Uint8Array, message: string | Uint8Array, signature: Uint8Array) =>
    import('./core/signatures').then(m => m.verifySignature(publicKey, message, signature)),
};