export interface Session {
  id: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  lastActiveAt: string | Date;
  createdAt: string | Date;
  activeHandleId?: string;
  current: boolean;
}

export interface RefreshTokenResponse {
  identityId: string;
  activeHandleId: string;
}

export interface UpdateDisplayNameRequest {
  displayName: string;
}
