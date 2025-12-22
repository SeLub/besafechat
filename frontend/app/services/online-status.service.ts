import type {
  BulkOnlineStatusRequest,
  BulkOnlineStatusResponse,
  OnlineStatusResponse,
} from '~/types/account';
import { apiRequest } from './api-utils';

export class OnlineStatusService {
  static async getOnlineStatus(userId: string): Promise<OnlineStatusResponse> {
    return apiRequest<OnlineStatusResponse>(`/users/online-status/${userId}`, {
      credentials: 'include',
    });
  }

  static async getBulkOnlineStatus(userIds: string[]): Promise<BulkOnlineStatusResponse[]> {
    return apiRequest<BulkOnlineStatusResponse[]>('/users/bulk-online-status', {
      method: 'POST',
      body: JSON.stringify({ userIds } as BulkOnlineStatusRequest),
    });
  }
}
