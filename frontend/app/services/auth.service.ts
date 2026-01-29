import type { ApiResponse, LoginCredentials, LoginResponse, ProfileResponse } from '@/types';

import type {
  BulkOnlineStatusResponse,
  OnlineStatusResponse,
  RefreshTokenResponse,
  Session,
} from '@/types/account';
import type { FullProfile } from '~/types/user';
import { UserService } from './user.service';

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

    // First, request a challenge from the server
    const challengeRes = await fetch(`${this.API_BASE}/auth/login/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        publicKey: credentials.publicKey,
        action: 'login',
      }),
    });

    if (!challengeRes.ok) {
      const error = await challengeRes.text().catch(() => 'Unknown error');
      throw new Error(`Challenge request failed: ${error}`);
    }

    const challengeData: ApiResponse<{
      challengeId: string;
      challenge: string;
      expiresAt: number;
    }> = await challengeRes.json();
    if (!challengeData.success || !challengeData.data) {
      throw new Error(challengeData.error || 'Failed to get challenge');
    }

    const { challengeId, challenge } = challengeData.data!;

    // Get the private key to sign the challenge
    // In the current architecture, the private key is temporarily available
    // through the AccountService when the account is unlocked
    const { getTemporaryPrivateKey } = await import('./account.service');
    const privateKey = getTemporaryPrivateKey();
    console.log('Private key retrieved for signing:', privateKey);

    if (!privateKey) {
      throw new Error('Private key not available. Please log in to your account first.');
    }

    // Sign the challenge using the private key
    const { signMessageToBase64 } = await import('../lib/crypto/core/signatures');
    const signature = await signMessageToBase64(privateKey, challenge);

    // Send the signature back to the server to complete authentication
    const authRes = await fetch(`${this.API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        challengeId,
        publicKey: credentials.publicKey,
        signature,
        deviceName, // Required by backend DTO
        deviceId: finalDeviceId, // Still send deviceId for reference
      }),
    });

    if (!authRes.ok) {
      const error = await authRes.text().catch(() => 'Unknown error');
      throw new Error(`Backend authentication failed: ${error}`);
    }

    const data: ApiResponse<LoginResponse> = await authRes.json();
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
