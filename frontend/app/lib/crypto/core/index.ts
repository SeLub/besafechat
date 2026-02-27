/**
 * Core cryptography primitives
 *
 * This module exports low-level cryptographic operations.
 * All functions use Web Crypto API where possible.
 *
 * ⚠️ These are building blocks - use the high-level API from ../index.ts
 * for application logic.
 */

// ─────────────────────────────────────────────────────────────
// Existing modules (re-export)
// ─────────────────────────────────────────────────────────────
export * from './key-derivation';
export * from './encryption';
export * from './signatures';

// ─────────────────────────────────────────────────────────────
// New E2EE primitives
// ─────────────────────────────────────────────────────────────
export * from './hkdf';
export * from './ecdh';
export * from './x3dh';
export * from './recording-keys';

// ─────────────────────────────────────────────────────────────
// Security utilities
// ─────────────────────────────────────────────────────────────
export * from './secure-wipe';
