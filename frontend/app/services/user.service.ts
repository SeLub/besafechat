import { apiRequest } from './api-utils';

export interface UpdateDisplayNameRequest {
  displayName: string;
}

export class UserService {
  /**
   * Update display name
   */
  static async updateDisplayName(request: UpdateDisplayNameRequest): Promise<void> {
    await apiRequest('/profile/display-name', {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  }

  /**
   * Search for user by username
   */
  static async searchByUsername(username: string) {
    return apiRequest(`/users/search/${username}`);
  }

  /**
   * Get user public key
   */
  static async getUserPublicKey(userId: string) {
    return apiRequest(`/auth/user/${userId}/public-key`);
  }
}
