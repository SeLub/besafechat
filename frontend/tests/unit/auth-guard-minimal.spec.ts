/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../../app/hooks/use-auth';
import { AuthProvider } from '../../app/hooks/use-auth';

// Mock the auth service
jest.mock('../../app/services/auth.service', () => ({
  AuthService: {
    getCurrentUser: jest.fn(),
    refreshTokens: jest.fn(),
  },
}));

// Mock the storage service
jest.mock('../../app/services/storage.service', () => ({
  StorageService: {
    hasStoredPublicKey: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AuthGuard Minimal Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children when authenticated', async () => {
    // Mock that the user is authenticated
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: 'user-id', displayName: 'Test User' } }),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });
  });

  it('should redirect to auth when not authenticated', async () => {
    // Mock that the user is not authenticated
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
    });

    // Mock the refresh attempt which also fails
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });
  });

  it('should attempt token refresh when access expired', async () => {
    // First call to profile fails with 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
    });

    // Then refresh call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        success: true, 
        data: { accessToken: 'new-access', refreshToken: 'new-refresh' } 
      }),
    });

    // Then profile call succeeds after refresh
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: 'user-id', displayName: 'Test User' } }),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await waitFor(() => {
      expect(result.current.user).toBeTruthy();
    });
  });
});