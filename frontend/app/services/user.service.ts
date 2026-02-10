// app/services/user.service.ts
import type { ProfileResponse } from '@/types/api';
import type { UpdateDisplayNameRequest } from '~/types/account';
import { API_CONFIG } from './api-config';
import { handleApiResponse, apiRequest } from './api-utils';

export class UserService {
  static async getProfile(): Promise<ProfileResponse> {
    console.log('UserService.getProfile: Calling API...');
    const res = await fetch(`${API_CONFIG.BASE_URL}/auth/profile`, {
      credentials: 'include',
    });
    console.log('UserService.getProfile: Response received', { status: res.status, ok: res.ok });

    const result = await handleApiResponse<any>(res); // Get the raw response structure
    console.log('UserService.getProfile: Raw profile data received', result);

    // Transform the response to match ProfileResponse interface
    return {
      identity: {
        id: result.identity.id,
        publicKey: result.identity.publicKey,
        createdAt: result.identity.createdAt,
      },
      handle: {
        id: result.handle.id,
        value: result.handle.value,
        alias: result.handle.alias || null,
        isSearchable: result.handle.isSearchable,
        isPrimary: result.handle.isPrimary,
        createdAt: result.handle.createdAt,
      },
      profile: {
        displayName: result.profile.displayName,
        firstName: result.profile.firstName || null,
        lastName: result.profile.lastName || null,
        avatarUrl: result.profile.avatarUrl || null,
        bio: result.profile.bio || null,
        settings: result.profile.settings || {},
      },
    };
  }

  static async updateDisplayName(displayName: string): Promise<void> {
    const res = await fetch(`${API_CONFIG.BASE_URL}/profile/display-name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName } as UpdateDisplayNameRequest),
    });
    return handleApiResponse(res);
  }

  static async setUsername(
    username: string,
    displayName?: string,
    isSearchable: boolean = true
  ): Promise<void> {
    // Get profile to access the public key
    const profileRes = await fetch(`${API_CONFIG.BASE_URL}/auth/profile`, {
      credentials: 'include',
    });

    if (!profileRes.ok) {
      const error = await profileRes.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get profile: ${error}`);
    }

    const profileData = await profileRes.json();
    if (!profileData.success || !profileData.data) {
      throw new Error('Could not retrieve profile data');
    }

    // Get device info
    const deviceName =
      typeof navigator !== 'undefined' ? `${navigator.platform || 'Web'} Device` : 'Web Device';
    const deviceId = `web-device-${Date.now()}`;

    // Call the complete registration endpoint to update the handle
    const res = await fetch(`${API_CONFIG.BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        publicKey: profileData.data.publicKey,
        handle: username,
        displayName: displayName || profileData.data.displayName || 'Anonym User',
        deviceName,
        isSearchable: isSearchable ? 'yes' : 'no',
        deviceId,
      }),
    });

    return handleApiResponse(res);
  }

  /**
   * Check if username is available
   * Server returns:
   * - 200 with { available: true } if username is available
   * - 200 with { available: false, user: userInfo } if username exists
   */
  static async checkUsernameAvailable(username: string): Promise<boolean> {
    try {
      // First try to find if the handle already exists
      const searchResult = await apiRequest<{ handles: any[] }>(
        `/handles/search?q=${encodeURIComponent(username)}`,
        {
          method: 'GET',
        }
      );

      // If any handles are returned, the username is not available
      return searchResult.handles.length === 0;
    } catch (error) {
      // On network error, consider as not available
      console.error('Error checking username availability:', error);
      return false;
    }
  }

  /**
   * Получить данные пользователя по username
   * Возвращает null если пользователь не найден
   */
  static async getUserByUsername(username: string): Promise<ProfileResponse | null> {
    try {
      const result = await apiRequest<{ handles: any[] }>(
        `/handles/search?q=${encodeURIComponent(username)}`,
        {
          method: 'GET',
        }
      );

      if (!result.handles || result.handles.length === 0) {
        return null;
      }

      // Get the first matching handle
      const handle = result.handles[0];

      // Return the user data based on handle information
      return {
        identity: {
          id: handle.ownerIdentityId,
          publicKey: '', // Public key not returned in search, so empty string or default
          createdAt: handle.createdAt,
        },
        handle: {
          id: handle.id,
          value: handle.value,
          alias: handle.alias || null,
          isSearchable: handle.isSearchable,
          isPrimary: handle.isPrimary || false, // Assuming isPrimary property exists on handle, default to false
          createdAt: handle.createdAt,
        },
        profile: {
          displayName: handle.value, // Use handle value as display name if no profile
          firstName: null,
          lastName: null,
          avatarUrl: null, // No avatar in search result
          bio: null,
          settings: {},
        },
      };
    } catch {
      return null;
    }
  }
}
