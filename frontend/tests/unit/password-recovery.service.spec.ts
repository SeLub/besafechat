/**
 * @jest-environment jsdom
 */

// Jest globals
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

// Mock the crypto API
Object.defineProperty(window, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn(),
    },
  },
});

// Mock TextEncoder
Object.defineProperty(window, 'TextEncoder', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    encode: jest.fn().mockReturnValue(new Uint8Array()),
  })),
});

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PasswordRecoveryService Tests', () => {
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should compute password hash correctly', async () => {
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock crypto.digest to return a fixed hash
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as jest.MockedFunction<any>).mockResolvedValue(mockDigestResult);

    const hash = await PasswordRecoveryService['computePasswordHash']('testpassword');

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
  });

  it('should check password availability successfully', async () => {
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock fetch response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: true }),
    });

    // Mock crypto.digest
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as jest.MockedFunction<any>).mockResolvedValue(mockDigestResult);

    const result = await PasswordRecoveryService.checkPasswordAvailability('testpassword');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/password-recovery/check-availability'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should handle already claimed password during availability check', async () => {
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock fetch response for already claimed password
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: false, reason: 'password_already_in_use' }),
    });

    // Mock crypto.digest
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as jest.MockedFunction<any>).mockResolvedValue(mockDigestResult);

    const result = await PasswordRecoveryService.checkPasswordAvailability('alreadyusedpassword');
    expect(result).toBe(false);
  });

  it('should handle claim password successfully', async () => {
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock fetch response for successful claim
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Password claimed successfully' }),
    });

    // Mock crypto.digest
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as jest.MockedFunction<any>).mockResolvedValue(mockDigestResult);

    const result = await PasswordRecoveryService.claimPasswordWithRetry('newpassword');
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/password-recovery/claim'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('should handle already claimed password during claim', async () => {
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock fetch response for conflict (already claimed)
    mockFetch.mockResolvedValueOnce({
      status: 409, // Conflict
      ok: false,
      json: async () => ({
        message: 'Password already claimed by another user',
        code: 'PASSWORD_CLAIMED',
        retry_after: 3600,
      }),
    });

    // Mock crypto.digest
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as jest.MockedFunction<any>).mockResolvedValue(mockDigestResult);

    const result = await PasswordRecoveryService.claimPasswordWithRetry('alreadyclaimedpassword');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_claimed');
  });

  it('should handle network error during claim', async () => {
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock fetch to throw network error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    // Mock crypto.digest
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as jest.MockedFunction<any>).mockResolvedValue(mockDigestResult);

    const result = await PasswordRecoveryService.claimPasswordWithRetry('testpassword');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('network_error');
  });

  it('should generate nonce correctly', () => {
    const { PasswordRecoveryService } = require('../../app/services/password-recovery.service');

    const nonce = PasswordRecoveryService['generateNonce']();
    expect(nonce).toBeDefined();
    expect(typeof nonce).toBe('string');
    expect(nonce.length).toBe(32); // 16 bytes = 32 hex characters
  });
});
