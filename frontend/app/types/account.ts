export interface Session {
  id: string;
  deviceId: string;
  ipAddress?: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent?: boolean;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PublicKeyResponse {
  userId: string;
  publicKey: string;
}
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

export interface UpdateDisplayNameRequest {
  displayName: string;
}
