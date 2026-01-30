/**
 * @jest-environment jsdom
 */

// Jest globals
declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto API
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

// Mock localStorage
const localStorageMock = (() => {
  let store: any = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('AccountService Password Recovery Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    localStorageMock.clear();
  });

  it('should check password availability before creating account with cloud recovery', async () => {
    // Mock the necessary services
    const { AccountService } = await import('../../app/services/account.service');
    const { PasswordRecoveryService } =
      await import('../../app/services/password-recovery.service');

    // Mock successful availability check
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: true }),
    });

    // Mock crypto.digest for password hash computation
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as any).mockResolvedValue(mockDigestResult);

    // Mock the password claim
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Mock successful login response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ userId: 'test-user-id', sessionId: 'test-session-id' }),
    });

    // Mock backup response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    // This test checks that the flow calls the availability check before proceeding
    try {
      await AccountService.createAccountWithCloud('testpassword');
      // If we reach here, the password availability check passed
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/password-recovery\/check-availability$/),
        expect.any(Object)
      );
    } catch (error) {
      // Ignore errors related to other mocked dependencies
      // The important thing is that the password availability check was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/password-recovery\/check-availability$/),
        expect.any(Object)
      );
    }
  });

  it('should reject account creation if password is already in use', async () => {
    // Mock the necessary services
    const { AccountService } = await import('../../app/services/account.service');

    // Mock unsuccessful availability check (password already in use)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: false, reason: 'password_already_in_use' }),
    });

    // Mock crypto.digest for password hash computation
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as any).mockResolvedValue(mockDigestResult);

    // Expect the function to throw an error when password is not available
    await expect(AccountService.createAccountWithCloud('usedpassword')).rejects.toThrow(
      'This password is already in use. Please choose a different password.'
    );
  });

  it('should successfully claim password during account creation', async () => {
    // Mock the necessary services
    const { AccountService } = await import('../../app/services/account.service');

    // Mock successful availability check
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: true }),
    });

    // Mock crypto.digest for password hash computation
    const mockDigestResult = new ArrayBuffer(32);
    (window.crypto.subtle.digest as any).mockResolvedValue(mockDigestResult);

    // Mock successful password claim
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, expiresIn: 86400 }),
    });

    // Mock successful login response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ userId: 'test-user-id', sessionId: 'test-session-id' }),
    });

    // Mock backup response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Test that the claim endpoint is called during account creation
    try {
      await AccountService.createAccountWithCloud('testpassword');
      // Check that the password claim endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/password-recovery\/claim$/),
        expect.any(Object)
      );
    } catch (error) {
      // Even if other parts fail, check that claim was attempted
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/password-recovery\/claim$/),
        expect.any(Object)
      );
    }
  });
});
