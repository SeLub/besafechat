export interface OnlineStatusResponse {
  userId: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface BulkOnlineStatusRequest {
  userIds: string[];
}

export interface BulkOnlineStatusResponse {
  userId: string;
  isOnline: boolean;
  lastSeen?: string;
}
