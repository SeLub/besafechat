// app/services/user.service.ts
import type { ProfileResponse } from '@/types/api';
import type { UpdateDisplayNameRequest } from '~/types/account';
import { API_CONFIG } from './api-config';
import { handleApiResponse } from './api-utils';

export class UserService {
  static async getProfile(): Promise<ProfileResponse> {
    console.log('UserService.getProfile: Calling API...');
    const res = await fetch(`${API_CONFIG.BASE_URL}/profile`, {
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
    const res = await fetch(`${API_CONFIG.BASE_URL}/profile/username`, {
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
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/profile/username/search/${encodeURIComponent(username)}`,
        { credentials: 'include' }
      );

      // Если статус 404 - username свободен
      if (res.status === 404) {
        return true;
      }

      // Если статус 200 - username занят
      if (res.status === 200) {
        return false;
      }

      // Для других статусов считаем что не доступен
      return false;
    } catch {
      // При ошибке сети считаем что не доступен
      return false;
    }
  }

  /**
   * Получить данные пользователя по username
   * Возвращает null если пользователь не найден
   */
  static async getUserByUsername(username: string): Promise<ProfileResponse | null> {
    try {
      const res = await fetch(
        `${API_CONFIG.BASE_URL}/profile/username/search/${encodeURIComponent(username)}`,
        { credentials: 'include' }
      );

      if (res.status === 404) {
        return null;
      }

      if (res.status === 200) {
        const data = await res.json();
        return data.data;
      }

      return null;
    } catch {
      return null;
    }
  }
}
