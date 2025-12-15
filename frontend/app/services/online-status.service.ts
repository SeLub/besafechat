import { API_CONFIG } from './api-config';
import { handleApiResponse, apiRequest } from './api-utils';
import type {
  OnlineStatusResponse,
  BulkOnlineStatusResponse
} from '@/types/account';
import type { BulkOnlineStatusRequest } from '@/types/account';

export class OnlineStatusService {
  static async getOnlineStatus(userId: string): Promise<OnlineStatusResponse> {
    return apiRequest<OnlineStatusResponse>(`/users/online-status/${userId}`, {
      credentials: 'include'
    });
  }

  static async getBulkOnlineStatus(userIds: string[]): Promise<BulkOnlineStatusResponse[]> {
    return apiRequest<BulkOnlineStatusResponse[]>('/users/bulk-online-status', {
      method: 'POST',
      body: JSON.stringify({ userIds } as BulkOnlineStatusRequest),
    });
  }
}