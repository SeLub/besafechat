import type { ApiResponse, LoginCredentials, LoginResponse, ProfileResponse } from '@/types';

import type {
  BulkOnlineStatusResponse,
  OnlineStatusResponse,
  RefreshTokenResponse,
  Session,
} from '@/types/account';
import { UserService } from './user.service';
import type { FullProfile } from '~/types/user';

/**
 * Базовые операции с бэкендом для аутентификации
 */
export class AuthService {
  private static readonly API_BASE = 'http://localhost:4000';

  /**
   * Логин на бэкенде
   */
  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const finalDeviceId = credentials.deviceId || `web-browser-${Date.now()}`;
    // Generate deviceName from available browser info if not provided
    const deviceName =
      credentials.deviceName ||
      (typeof navigator !== 'undefined' ? `${navigator.platform || 'Web'} Device` : 'Web Device');

    const res = await fetch(`${this.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        publicKey: credentials.publicKey,
        deviceName, // Required by backend DTO
        deviceId: finalDeviceId, // Still send deviceId for reference
      }),
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Backend login failed: ${error}`);
    }

    const data: ApiResponse<LoginResponse> = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }

    return data.data!;
  }

  /**
   * Выход из аккаунта
   */
  static async logout(): Promise<void> {
    try {
      await fetch(`${this.API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Failed to logout from backend:', error);
    }
  }

  /**
   * Получение информации о текущем пользователе
   */
  static async getCurrentUser(): Promise<FullProfile | null> {
    try {
      const res = await fetch(`${this.API_BASE}/auth/profile`, {
        credentials: 'include',
      });

      if (res.ok) {
        const response: ApiResponse<FullProfile> = await res.json();
        return response.success && response.data ? response.data : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Проверка аутентификации
   */
  static async checkAuth(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch {
      return false;
    }
  }

  // ==================== Auth Endpoints ====================

  /**
   * Получение списка активных сессий
   */
  static async getSessions(): Promise<Session[]> {
    const res = await fetch(`${this.API_BASE}/auth/sessions`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get sessions: ${error}`);
    }

    const data: ApiResponse<{ sessions: Session[] }> = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get sessions');
    }

    return data.data?.sessions || [];
  }

  /**
   * Отзыв конкретной сессии (кроме текущей)
   */
  static async revokeSession(sessionId: string): Promise<void> {
    const res = await fetch(`${this.API_BASE}/auth/sessions/revoke/${sessionId}`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to revoke session: ${error}`);
    }

    const data: ApiResponse = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to revoke session');
    }
  }

  /**
   * Закрыть все сессии, кроме текущей
   */
  static async revokeAllOtherSessions(): Promise<void> {
    const res = await fetch(`${this.API_BASE}/auth/sessions/revoke-all`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to revoke all sessions: ${error}`);
    }

    const data: ApiResponse = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to revoke all sessions');
    }
  }

  /**
   * Обновление access и refresh токенов
   */
  static async refreshTokens(): Promise<RefreshTokenResponse> {
    const res = await fetch(`${this.API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data: ApiResponse<RefreshTokenResponse> = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Token refresh failed');
    }

    return data.data!;
  }

  /**
   * Получение публичного ключа пользователя (для отладки)
   */
  static async getUserPublicKey(userId: string): Promise<string> {
    const res = await fetch(`${this.API_BASE}/auth/user/${userId}/public-key`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get public key: ${error}`);
    }

    const data: ApiResponse<{ publicKey: string }> = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get public key');
    }

    return data.data!.publicKey;
  }

  // ==================== Profile Endpoints ====================

  /**
   * Получение профиля текущего пользователя
   */
  static async getProfile(): Promise<ProfileResponse> {
    const res = await fetch(`${this.API_BASE}/auth/profile`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get profile: ${error}`);
    }

    const data: ApiResponse<ProfileResponse> = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get profile');
    }

    return data.data!;
  }

  /**
   * Обновление отображаемого имени
   */
  static async updateDisplayName(displayName: string): Promise<void> {
    const res = await fetch(`${this.API_BASE}/profile/display-name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName }),
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to update display name: ${error}`);
    }

    const data: ApiResponse = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to update display name');
    }
  }

  /**
   * Update username (now calls separate endpoints)
   */
  static async setUsername(username: string, displayName?: string): Promise<void> {
    // Call UserService to update the username properly via the handles endpoint
    await UserService.setUsername(username, displayName);
  }

  // ==================== Online Status Endpoints ====================

  /**
   * Получение онлайн-статуса пользователя
   */
  static async getOnlineStatus(userId: string): Promise<OnlineStatusResponse> {
    const res = await fetch(`${this.API_BASE}/users/online-status/${userId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get online status: ${error}`);
    }

    const data: ApiResponse<OnlineStatusResponse> = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get online status');
    }

    return data.data!;
  }

  /**
   * Массовое получение онлайн-статусов пользователей
   */
  static async getBulkOnlineStatus(userIds: string[]): Promise<BulkOnlineStatusResponse[]> {
    const res = await fetch(`${this.API_BASE}/users/bulk-online-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userIds }),
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to get bulk online status: ${error}`);
    }

    const data: ApiResponse<BulkOnlineStatusResponse[]> = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get bulk online status');
    }

    return data.data || [];
  }
}
