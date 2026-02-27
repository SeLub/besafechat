// /home/selub/Documents/progs/besafechat/frontend/app/lib/crypto/errors.ts

export class CryptoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
    public readonly metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'CryptoError';
  }
}

export const CRYPTO_ERRORS = {
  // Seed/Key errors
  INVALID_SEED: 'INVALID_SEED',
  INVALID_KEY: 'INVALID_KEY',
  KEY_DERIVATION_FAILED: 'KEY_DERIVATION_FAILED',

  // Encryption/Decryption errors
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  INVALID_CIPHERTEXT: 'INVALID_CIPHERTEXT',

  // Signature errors
  SIGNATURE_FAILED: 'SIGNATURE_FAILED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',

  // Password/Validation errors
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',

  // Storage/IO errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  IMPORT_ERROR: 'IMPORT_ERROR',
  EXPORT_ERROR: 'EXPORT_ERROR',
} as const;

export type CryptoErrorCode = (typeof CRYPTO_ERRORS)[keyof typeof CRYPTO_ERRORS];

/**
 * Create a standardized crypto error
 */
export function createCryptoError(
  message: string,
  code: CryptoErrorCode,
  cause?: Error,
  metadata?: Record<string, any>
): CryptoError {
  return new CryptoError(message, code, cause, metadata);
}

/**
 * Check if an error is a CryptoError
 */
export function isCryptoError(error: unknown): error is CryptoError {
  return error instanceof CryptoError;
}

/**
 * Wrap unknown error into CryptoError
 */
export function wrapCryptoError(
  error: unknown,
  defaultCode: CryptoErrorCode = CRYPTO_ERRORS.ENCRYPTION_FAILED,
  context?: string
): CryptoError {
  if (isCryptoError(error)) {
    return error;
  }

  const message = context
    ? `${context}: ${error instanceof Error ? error.message : String(error)}`
    : error instanceof Error
      ? error.message
      : String(error);

  return createCryptoError(message, defaultCode, error instanceof Error ? error : undefined);
}
