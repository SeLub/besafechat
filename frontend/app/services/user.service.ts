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

    const result = await handleApiResponse<ProfileResponse>(res);
    console.log('UserService.getProfile: Profile data received', result);
    return result;
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

  static async setUsername(username: string, isSearchable: boolean = true): Promise<void> {
    const res = await fetch(`${API_CONFIG.BASE_URL}/username/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username,
        isSearchable: isSearchable ? 'yes' : 'no',
      }),
    });
    return handleApiResponse(res);
  }

  /**
   * Проверить доступность username
   * Сервер возвращает:
   * - 200 с данными пользователя если username занят
   * - 404 если username свободен
   */
  static async checkUsernameAvailable(username: string): Promise<boolean> {
    try {
      const result = await apiRequest<{ available: boolean; user?: any; username?: string }>(
        `/username/search/${encodeURIComponent(username)}`,
        {
          method: 'GET',
        }
      );

      return result.available;
    } catch (error) {
      // При ошибке сети считаем что не доступен
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
      const result = await apiRequest<{ available: boolean; user?: any; username?: string }>(
        `/username/search/${encodeURIComponent(username)}`,
        {
          method: 'GET',
        }
      );

      if (result.available || !result.user) {
        return null;
      }

      // Map the user data to ProfileResponse format
      return {
        userId: result.user.id,
        publicKey: result.user.publicKey,
        displayName: result.user.displayName,
        // These fields are not returned by the search endpoint, so we set them as optional/undefined
        username: undefined, // Username is not returned in the search response
        createdAt: '', // Not returned in search response
        isSearchable: true, // If we got the user data, they are searchable
        avatarUrl: null, // Not returned in search response
      };
    } catch {
      return null;
    }
  }
}
