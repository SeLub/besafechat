import type { ApiResponse } from '../types/api';
import type { FullProfile } from '../types/profile';

const API_BASE = 'http://localhost:4000';

/**
 * Checks authentication status by fetching user profile
 * @param silent - If true, suppresses console logging for expected 401 responses
 * @returns User profile if authenticated, null otherwise
 */
export async function silentAuthCheck(silent: boolean = false): Promise<FullProfile | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      credentials: 'include',
    });

    if (res.ok) {
      const response: ApiResponse<FullProfile> = await res.json();
      return response.success && response.data ? response.data : null;
    } else if (res.status === 401) {
      // 401 is an expected response for unauthenticated users
      if (!silent) {
        console.debug('User not authenticated (401 response)');
      }
      return null;
    } else {
      // Other errors might indicate actual problems
      if (!silent) {
        console.error(`Auth check failed with status: ${res.status}`);
      }
      return null;
    }
  } catch (error) {
    if (!silent) {
      console.error('Network error during auth check:', error);
    }
    return null;
  }
}

/**
 * Attempts to refresh authentication tokens
 * @returns True if refresh was successful, false otherwise
 */
export async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    return refreshResponse.ok;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

/**
 * Attempts to authenticate user with token refresh fallback
 * @returns User profile if authenticated (directly or after refresh), null otherwise
 */
export async function authenticateUser(): Promise<FullProfile | null> {
  // First try to get profile directly
  let user = await silentAuthCheck(true);

  if (!user) {
    // Try to refresh tokens and then get profile again
    const refreshSuccess = await attemptTokenRefresh();

    if (refreshSuccess) {
      // Retry fetching profile after refresh
      user = await silentAuthCheck(true);
    }
  }

  return user;
}

/**
 * Clears authentication cookies from the browser
 */
export function clearAuthCookies(): void {
  document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

/**
 * Handles authentication errors appropriately
 * @param error - The error that occurred
 * @param silent - If true, suppresses console logging
 */
export function handleAuthError(error: any, silent: boolean = false): void {
  if (!silent) {
    console.error('Authentication error:', error);
  }
}
