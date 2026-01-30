/**
 * @jest-environment jsdom
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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
  value: jest.fn().mockImplementation(() => ({
    encode: jest.fn().mockReturnValue(new Uint8Array()),
  })),
});

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PasswordRecoveryService Minimal Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  it('should check password availability successfully', async () => {
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock fetch response for available password
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: true, reason: null }),
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

  it('should return false when password is already claimed', async () => {
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock fetch response for unavailable password
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: false, reason: 'password_already_in_use' }),
    });

    // Mock crypto.digest
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as jest.MockedFunction<any>).mockResolvedValue(mockDigestResult);

    const result = await PasswordRecoveryService.checkPasswordAvailability('usedpassword');
    expect(result).toBe(false);
    expect(result).toBeDefined();
  });

  it('should handle claim password successfully', async () => {
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock fetch response for successful claim
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201, // The controller returns 201 for successful claim
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

  it('should return 409 when trying to claim an already used password', async () => {
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock fetch response for conflict (already claimed)
    mockFetch.mockResolvedValueOnce({
      status: 409, // Conflict status for already claimed
      ok: false,
      json: async () => ({
        message: 'Password already claimed by another user',
        code: 'PASSWORD_CLAIMED',
      }),
    });

    // Mock crypto.digest
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as jest.MockedFunction<any>).mockResolvedValue(mockDigestResult);

    const result = await PasswordRecoveryService.claimPasswordWithRetry('alreadyusedpassword');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_claimed');
  });

  it('should handle network errors during claim', async () => {
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
});
