import { apiRequest } from './api-utils';
import { deviceService } from './device.service';

export interface UserProfile {
  id: string;
  publicKey: string;
  displayName?: string;
  username?: string;
}

export interface RegisterRequest {
  publicKey: string;
  deviceId: string;
}

export interface LoginRequest {
  publicKey: string;
  deviceId: string;
}

export interface SetUsernameRequest {
  username: string;
  isSearchable: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  static async register(request: RegisterRequest): Promise<void> {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Login user
   */
  static async login(request: LoginRequest): Promise<void> {
    await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Logout user
   */
  static async logout(): Promise<void> {
    await apiRequest('/auth/logout', {
      method: 'POST',
    });
  }

  /**
   * Get current user profile
   */
  static async getProfile(): Promise<UserProfile> {
    return apiRequest('/auth/profile');
  }

  /**
   * Get active sessions
   */
  static async getSessions() {
    return apiRequest('/auth/sessions');
  }

  /**
   * Revoke specific session
   */
  static async revokeSession(sessionId: string) {
    return apiRequest(`/auth/sessions/revoke/${sessionId}`, {
      method: 'POST',
    });
  }

  /**
   * Revoke all other sessions
   */
  static async revokeAllSessions() {
    return apiRequest('/auth/sessions/revoke-all', {
      method: 'POST',
    });
  }

  /**
   * Refresh tokens
   */
  static async refreshTokens() {
    return apiRequest('/auth/refresh', {
      method: 'POST',
    });
  }

  /**
   * Get user public key (for debugging)
   */
  static async getUserPublicKey(userId: string) {
    return apiRequest(`/auth/user/${userId}/public-key`);
  }

  /**
   * Set username for current user
   */
  static async setUsername(request: SetUsernameRequest): Promise<void> {
    await apiRequest('/username/set', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get device info for authentication
   */
  static getDeviceInfo(): { deviceId: string; deviceName: string } {
    return {
      deviceId: deviceService.getDeviceId(),
      deviceName: deviceService.getDeviceName(),
    };
  }
}