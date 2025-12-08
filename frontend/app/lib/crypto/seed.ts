import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// Configure sha512 for @noble/ed25519
// @ts-ignore - hashes property exists at runtime
if (!ed.hashes) ed.hashes = {};
// @ts-ignore
ed.hashes.sha512 = sha512;
// @ts-ignore
ed.hashes.sha512Async = (m: Uint8Array) => Promise.resolve(sha512(m));

/**
 * Generate 12-word BIP39 seed phrase
 */
export function generateSeed(): string[] {
  const mnemonic = generateMnemonic(wordlist, 128); // 128 bits = 12 words
  return mnemonic.split(" ");
}

/**
 * Validate seed phrase
 */
export function validateSeed(words: string[]): boolean {
  const mnemonic = words.join(" ");
  return validateMnemonic(mnemonic, wordlist);
}

/**
 * Derive Ed25519 keypair from seed phrase
 */
export async function deriveKeysFromSeed(words: string[]): Promise<{
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyBase64: string;
}> {
  const mnemonic = words.join(" ");
  console.log('[seed.ts] Mnemonic:', mnemonic);
  console.log('[seed.ts] mnemonicToSeed function:', mnemonicToSeed);

  // Convert mnemonic to seed (512 bits)
  console.log('[seed.ts] Calling mnemonicToSeed...');
  const seed = await mnemonicToSeed(mnemonic);
  console.log('[seed.ts] Seed generated:', seed);

  // Use first 32 bytes as Ed25519 private key
  const privateKey = seed.slice(0, 32);
  console.log('[seed.ts] Private key:', privateKey);
  console.log('[seed.ts] ed.etc.sha512Sync:', ed.etc.sha512Sync);
  console.log('[seed.ts] ed.etc.sha512Async:', ed.etc.sha512Async);

  // Derive public key
  console.log('[seed.ts] Calling ed.getPublicKey...');
  try {
    const publicKey = await ed.getPublicKey(privateKey);
    console.log('[seed.ts] Public key generated:', publicKey);

    // Convert to base64
    const publicKeyBase64 = btoa(String.fromCharCode(...publicKey));
    console.log('[seed.ts] Public key base64:', publicKeyBase64);

    return {
      privateKey,
      publicKey,
      publicKeyBase64,
    };
  } catch (error) {
    console.error('[seed.ts] Error in getPublicKey:', error);
    throw error;
  }
}

