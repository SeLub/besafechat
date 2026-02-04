import type { ApiResponse, LoginCredentials, LoginResponse, ProfileResponse } from '@/types';

import type {
  BulkOnlineStatusResponse,
  OnlineStatusResponse,
  RefreshTokenResponse,
  Session,
} from '@/types/account';

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

    const res = await fetch(`${this.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        publicKey: credentials.publicKey,
        deviceId: finalDeviceId,
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
  static async getCurrentUser(): Promise<ProfileResponse | null> {
    try {
      const res = await fetch(`${this.API_BASE}/auth/me`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data: ApiResponse<ProfileResponse> = await res.json();
        return data.data || null;
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
   * Регистрация нового пользователя
   */
  static async register(credentials: {
    publicKey: string;
    deviceId?: string;
  }): Promise<{ userId: string }> {
    const finalDeviceId = credentials.deviceId || `web-browser-${Date.now()}`;

    const res = await fetch(`${this.API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        publicKey: credentials.publicKey,
        deviceId: finalDeviceId,
      }),
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Registration failed: ${error}`);
    }

    const data: ApiResponse<{ userId: string }> = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Registration failed');
    }

    if (!data.data || !data.data.userId) {
      throw new Error('Registration response does not contain userId');
    }

    return { userId: data.data.userId };
  }

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
   * Установка username
   */
  static async setUsername(username: string): Promise<void> {
    const res = await fetch(`${this.API_BASE}/username/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username,
        isSearchable: 'yes',
      }),
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Failed to set username: ${error}`);
    }

    const data: ApiResponse = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to set username');
    }
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
