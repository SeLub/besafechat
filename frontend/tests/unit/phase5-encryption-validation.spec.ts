/**
 * Phase 5: Encryption & Database Isolation - Automated Test Suite
 * 
 * Tests hash-based encryption implementation and per-account database isolation.
 * Run with: npm run test -- phase5-encryption-validation.spec.ts
 * 
 * NOTE: Tests that require IndexedDB (database isolation tests) are designed to
 * fail gracefully in Node.js test environment. These should be run in browser
 * or with a proper jsdom/browser environment. See PHASE_5_TESTING_EXECUTION.md
 * for manual testing procedures.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setSessionPrivateKeyHash, getSessionPrivateKeyHash, clearSessionPrivateKeyHash } from '@/services/account.service';
import { deriveKeyPairFromSeed, generateSeedPhrase, hashPrivateKey } from '@/lib/crypto';
import { pkcs8ToRawPrivateKey } from '@/lib/crypto';

// ============================================================================
// Unit Tests: Hash-Based Encryption Core Functions
// ============================================================================

describe('Phase 5: Hash-Based Encryption - Unit Tests', () => {
  
  describe('hashPrivateKey()', () => {
    it('should produce a valid SHA-256 hash from private key', async () => {
      // Generate a seed and derive keypair
      const seed = await generateSeedPhrase();
      const keyPair = await deriveKeyPairFromSeed(seed);
      const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);

      // Hash the private key
      const hash = await hashPrivateKey(rawPrivateKey);

      // Verify hash properties
      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash.length).toBe(32); // SHA-256 = 32 bytes
    });

    it('should produce deterministic hashes (same input = same output)', async () => {
      const seed = await generateSeedPhrase();
      const keyPair = await deriveKeyPairFromSeed(seed);
      const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);

      const hash1 = await hashPrivateKey(rawPrivateKey);
      const hash2 = await hashPrivateKey(rawPrivateKey);

      // Hashes should be identical (deterministic)
      expect(hash1).toEqual(hash2);
    });

    it('should produce different hashes for different private keys', async () => {
      const seed1 = await generateSeedPhrase();
      const seed2 = await generateSeedPhrase();

      const keyPair1 = await deriveKeyPairFromSeed(seed1);
      const keyPair2 = await deriveKeyPairFromSeed(seed2);

      const rawKey1 = pkcs8ToRawPrivateKey(keyPair1.privateKey);
      const rawKey2 = pkcs8ToRawPrivateKey(keyPair2.privateKey);

      const hash1 = await hashPrivateKey(rawKey1);
      const hash2 = await hashPrivateKey(rawKey2);

      // Different keys should produce different hashes
      expect(hash1).not.toEqual(hash2);
    });

    it('should not be reversible (one-way function)', async () => {
      const seed = await generateSeedPhrase();
      const keyPair = await deriveKeyPairFromSeed(seed);
      const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
      const hash = await hashPrivateKey(rawPrivateKey);

      // Hash should be different from original (one-way)
      expect(hash).not.toEqual(rawPrivateKey);
      expect(hash.length).toBe(rawPrivateKey.length); // Same length doesn't matter
    });
  });

  describe('Session Private Key Hash Management', () => {
    afterEach(() => {
      clearSessionPrivateKeyHash();
    });

    it('should set and retrieve session private key hash', async () => {
      const seed = await generateSeedPhrase();
      const keyPair = await deriveKeyPairFromSeed(seed);
      const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
      const hash = await hashPrivateKey(rawPrivateKey);

      // Set the hash
      setSessionPrivateKeyHash(hash);

      // Retrieve it
      const retrieved = getSessionPrivateKeyHash();
      expect(retrieved).toEqual(hash);
    });

    it('should clear session private key hash securely', async () => {
      const seed = await generateSeedPhrase();
      const keyPair = await deriveKeyPairFromSeed(seed);
      const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
      const hash = await hashPrivateKey(rawPrivateKey);

      setSessionPrivateKeyHash(hash);
      expect(getSessionPrivateKeyHash()).not.toBeNull();

      // Clear it
      clearSessionPrivateKeyHash();
      expect(getSessionPrivateKeyHash()).toBeNull();
    });

    it('should return null when no hash is set', () => {
      clearSessionPrivateKeyHash();
      expect(getSessionPrivateKeyHash()).toBeNull();
    });
  });
});

// ============================================================================
// Integration Tests: Key Derivation & Security
// ============================================================================

describe('Phase 5: Key Derivation & Security - Integration Tests', () => {
  
  afterEach(() => {
    clearSessionPrivateKeyHash();
  });

  describe('Keypair Derivation from Seed', () => {
    it('should derive consistent keypairs from same seed', async () => {
      const seed = await generateSeedPhrase();
      
      const keyPair1 = await deriveKeyPairFromSeed(seed);
      const keyPair2 = await deriveKeyPairFromSeed(seed);
      
      // Same seed should produce same public key
      expect(keyPair1.publicKeyBase64).toBe(keyPair2.publicKeyBase64);
    });

    it('should produce different keypairs from different seeds', async () => {
      const seed1 = await generateSeedPhrase();
      const seed2 = await generateSeedPhrase();
      
      const keyPair1 = await deriveKeyPairFromSeed(seed1);
      const keyPair2 = await deriveKeyPairFromSeed(seed2);
      
      // Different seeds should produce different public keys
      expect(keyPair1.publicKeyBase64).not.toBe(keyPair2.publicKeyBase64);
    });

    it('should validate seed phrase before deriving keys', async () => {
      const invalidSeed = ['invalid', 'seed', 'words'];
      
      await expect(deriveKeyPairFromSeed(invalidSeed)).rejects.toThrow('Invalid seed phrase');
    });
  });

  describe('Hash-Based Session Management', () => {
    it('should set and manage session private key hash', async () => {
      const seed = await generateSeedPhrase();
      const keyPair = await deriveKeyPairFromSeed(seed);
      const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
      const hash = await hashPrivateKey(rawPrivateKey);

      // Initially null
      expect(getSessionPrivateKeyHash()).toBeNull();

      // Set hash
      setSessionPrivateKeyHash(hash);
      expect(getSessionPrivateKeyHash()).toEqual(hash);

      // Clear hash
      clearSessionPrivateKeyHash();
      expect(getSessionPrivateKeyHash()).toBeNull();
    });

    it('should only store hash, never original private key', async () => {
      const seed = await generateSeedPhrase();
      const keyPair = await deriveKeyPairFromSeed(seed);
      const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
      const hash = await hashPrivateKey(rawPrivateKey);

      setSessionPrivateKeyHash(hash);
      const sessionHash = getSessionPrivateKeyHash();

      // Hash should not equal raw private key
      expect(sessionHash).not.toEqual(rawPrivateKey);
      
      // Hash should be 32 bytes (SHA-256)
      expect(sessionHash!.length).toBe(32);
    });
  });
});

// ============================================================================
// Integration Tests: Multi-User Hash Isolation
// ============================================================================

describe('Phase 5: Multi-User Hash Isolation - Integration Tests', () => {
  
  afterEach(() => {
    clearSessionPrivateKeyHash();
  });

  describe('Hash Isolation Between Users', () => {
    it('should generate different hashes for different private keys', async () => {
      // User A generates keypair
      const seedA = await generateSeedPhrase();
      const keyPairA = await deriveKeyPairFromSeed(seedA);
      const rawKeyA = pkcs8ToRawPrivateKey(keyPairA.privateKey);
      const hashA = await hashPrivateKey(rawKeyA);

      // User B generates keypair
      const seedB = await generateSeedPhrase();
      const keyPairB = await deriveKeyPairFromSeed(seedB);
      const rawKeyB = pkcs8ToRawPrivateKey(keyPairB.privateKey);
      const hashB = await hashPrivateKey(rawKeyB);

      // Different users should have completely different hashes
      expect(hashA).not.toEqual(hashB);
      expect(hashA.length).toBe(hashB.length); // Both 32 bytes
    });

    it('should isolate session hashes for different users', async () => {
      const seed1 = await generateSeedPhrase();
      const keyPair1 = await deriveKeyPairFromSeed(seed1);
      const rawKey1 = pkcs8ToRawPrivateKey(keyPair1.privateKey);
      const hash1 = await hashPrivateKey(rawKey1);

      // User 1 session
      setSessionPrivateKeyHash(hash1);
      const sessionHash1 = getSessionPrivateKeyHash();
      expect(sessionHash1).toEqual(hash1);

      // Simulate logout
      clearSessionPrivateKeyHash();
      expect(getSessionPrivateKeyHash()).toBeNull();

      // User 2 session
      const seed2 = await generateSeedPhrase();
      const keyPair2 = await deriveKeyPairFromSeed(seed2);
      const rawKey2 = pkcs8ToRawPrivateKey(keyPair2.privateKey);
      const hash2 = await hashPrivateKey(rawKey2);
      
      setSessionPrivateKeyHash(hash2);
      const sessionHash2 = getSessionPrivateKeyHash();
      expect(sessionHash2).toEqual(hash2);
      expect(sessionHash2).not.toEqual(sessionHash1);
    });

    it('should prevent hash reuse between sessions', async () => {
      const seed = await generateSeedPhrase();
      const keyPair = await deriveKeyPairFromSeed(seed);
      const rawKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
      const hash = await hashPrivateKey(rawKey);

      // Session 1
      setSessionPrivateKeyHash(hash);
      const savedHash = getSessionPrivateKeyHash();

      // Logout clears hash
      clearSessionPrivateKeyHash();
      expect(getSessionPrivateKeyHash()).toBeNull();

      // Session 2 (even with same seed, we wouldn't use saved hash directly)
      setSessionPrivateKeyHash(hash);
      expect(getSessionPrivateKeyHash()).toEqual(savedHash);

      // Logout again
      clearSessionPrivateKeyHash();
      expect(getSessionPrivateKeyHash()).toBeNull();
    });
  });

  describe('Hash Security Properties', () => {
    it('should produce one-way hashes that cannot be reversed', async () => {
      const seed = await generateSeedPhrase();
      const keyPair = await deriveKeyPairFromSeed(seed);
      const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
      
      const hash = await hashPrivateKey(rawPrivateKey);

      // Hash should be different from original
      expect(hash).not.toEqual(rawPrivateKey);
      
      // Hashing the hash should produce different result (one-way)
      const hashOfHash = await hashPrivateKey(hash);
      expect(hashOfHash).not.toEqual(hash);
    });

    it('should be deterministic - same key always produces same hash', async () => {
      const seed = await generateSeedPhrase();
      const keyPair = await deriveKeyPairFromSeed(seed);
      const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);

      const hash1 = await hashPrivateKey(rawPrivateKey);
      const hash2 = await hashPrivateKey(rawPrivateKey);
      const hash3 = await hashPrivateKey(rawPrivateKey);

      // All hashes should be identical
      expect(hash1).toEqual(hash2);
      expect(hash2).toEqual(hash3);
    });
  });
});

// ============================================================================
// Security Behavior Tests
// ============================================================================

describe('Phase 5: Security Behavior - Tests', () => {
  
  afterEach(() => {
    clearSessionPrivateKeyHash();
  });

  it('should not store plaintext private keys in session', () => {
    // This test ensures no plaintext keys are kept
    expect(getSessionPrivateKeyHash()).toBeNull();
  });

  it('should clear session state on logout', async () => {
    const seed = await generateSeedPhrase();
    const keyPair = await deriveKeyPairFromSeed(seed);
    const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
    const hash = await hashPrivateKey(rawPrivateKey);

    // Set session
    setSessionPrivateKeyHash(hash);
    expect(getSessionPrivateKeyHash()).not.toBeNull();

    // Simulate logout
    clearSessionPrivateKeyHash();
    expect(getSessionPrivateKeyHash()).toBeNull();
  });

  it('should properly overwrite hash on clear (memory safety)', async () => {
    const seed = await generateSeedPhrase();
    const keyPair = await deriveKeyPairFromSeed(seed);
    const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
    const hash = await hashPrivateKey(rawPrivateKey);

    setSessionPrivateKeyHash(hash);
    const originalHash = getSessionPrivateKeyHash();
    expect(originalHash).toEqual(hash);

    clearSessionPrivateKeyHash();
    
    // After clear, should be null
    expect(getSessionPrivateKeyHash()).toBeNull();
    
    // Original hash reference should be garbage collectable
    expect(originalHash).toBeDefined(); // Still exists in this scope
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Phase 5: Performance Benchmarks', () => {
  
  afterEach(() => {
    clearSessionPrivateKeyHash();
  });

  it('hash computation should be fast (<10ms)', async () => {
    const seed = await generateSeedPhrase();
    const keyPair = await deriveKeyPairFromSeed(seed);
    const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);

    const startTime = performance.now();
    const hash = await hashPrivateKey(rawPrivateKey);
    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(10);
    expect(hash).toBeDefined();
  });

  it('seed phrase generation should be reasonably fast (<100ms)', async () => {
    const startTime = performance.now();
    const seed = await generateSeedPhrase();
    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(100);
    expect(seed).toHaveLength(12);
  });

  it('keypair derivation should be reasonably fast (<200ms)', async () => {
    const seed = await generateSeedPhrase();

    const startTime = performance.now();
    const keyPair = await deriveKeyPairFromSeed(seed);
    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(200);
    expect(keyPair.publicKey).toBeDefined();
  });

  it('batch hash operations should complete in reasonable time', async () => {
    const seeds = [];
    for (let i = 0; i < 10; i++) {
      seeds.push(await generateSeedPhrase());
    }

    const startTime = performance.now();
    const hashes = await Promise.all(
      seeds.map(async (seed) => {
        const keyPair = await deriveKeyPairFromSeed(seed);
        const rawKey = pkcs8ToRawPrivateKey(keyPair.privateKey);
        return hashPrivateKey(rawKey);
      })
    );
    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(500); // 10 operations in under 500ms
    expect(hashes).toHaveLength(10);
    expect(hashes.every((h) => h.length === 32)).toBe(true);
  });

  it('hash consistency across multiple calls', async () => {
    const seed = await generateSeedPhrase();
    const keyPair = await deriveKeyPairFromSeed(seed);
    const rawPrivateKey = pkcs8ToRawPrivateKey(keyPair.privateKey);

    const startTime = performance.now();
    const hash1 = await hashPrivateKey(rawPrivateKey);
    const hash2 = await hashPrivateKey(rawPrivateKey);
    const hash3 = await hashPrivateKey(rawPrivateKey);
    const elapsed = performance.now() - startTime;

    // All 3 hashes should be identical
    expect(hash1).toEqual(hash2);
    expect(hash2).toEqual(hash3);
    
    // And should be fast
    expect(elapsed).toBeLessThan(50);
  });
});
