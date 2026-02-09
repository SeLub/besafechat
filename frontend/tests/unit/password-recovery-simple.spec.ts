import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock crypto API
const mockDigest = vi.fn();
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: mockDigest,
    },
  },
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'test-agent',
  },
});

describe('PasswordRecoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkPasswordAvailability', () => {
    it('should return true when password is available', async () => {
      const { PasswordRecoveryService } = await import('../../app/services/password-recovery.service');

      // Mock hash computation
      const mockHash = new Uint8Array(32).fill(1);
      mockDigest.mockResolvedValue(mockHash.buffer);

      // Mock API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: true }),
      });

      const result = await PasswordRecoveryService.checkPasswordAvailability('testpass');
      expect(result).toBe(true);
    });

    it('should return false when password is already claimed', async () => {
      const { PasswordRecoveryService } = await import('../../app/services/password-recovery.service');

      const mockHash = new Uint8Array(32).fill(1);
      mockDigest.mockResolvedValue(mockHash.buffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ available: false }),
      });

      const result = await PasswordRecoveryService.checkPasswordAvailability('usedpass');
      expect(result).toBe(false);
    });
  });

  describe('claimPasswordWithRetry', () => {
    it('should successfully claim password', async () => {
      const { PasswordRecoveryService } = await import('../../app/services/password-recovery.service');

      const mockHash = new Uint8Array(32).fill(1);
      mockDigest.mockResolvedValue(mockHash.buffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, message: 'Claimed' }),
      });

      const result = await PasswordRecoveryService.claimPasswordWithRetry('newpass');
      expect(result.success).toBe(true);
    });

    it('should return already_claimed when password is taken', async () => {
      const { PasswordRecoveryService } = await import('../../app/services/password-recovery.service');

      const mockHash = new Uint8Array(32).fill(1);
      mockDigest.mockResolvedValue(mockHash.buffer);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Already claimed' }),
      });

      const result = await PasswordRecoveryService.claimPasswordWithRetry('takenpass');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('already_claimed');
    });
  });
});
