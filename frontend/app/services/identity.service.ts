import { API_CONFIG } from './api-config';
import type { ApiResponse } from '@/types';

export class IdentityService {
  private static readonly API_BASE = API_CONFIG.BASE_URL;

  /**
   * Soft delete current identity (start 90-day recovery window)
   */
  static async deleteMyIdentity(): Promise<{
    message: string;
    recoveryDeadline: string;
  }> {
    const res = await fetch(`${this.API_BASE}/identities/me`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.text().catch(() => 'Failed to delete account');
      throw new Error(error);
    }

    const data: ApiResponse<{
      message: string;
      recoveryDeadline: string;
    }> = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete account');
    }

    if (!data.data) {
      throw new Error('Missing data in successful response');
    }

    return data.data;
  }
}
