export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string; // иногда может быть message вместо error
}
export interface LoginResponse {
  identityId: string;
  sessionId: string;
  handleId: string;
}
export interface ProfileResponse {
  identity: {
    id: string;
    publicKey: string;
    createdAt: string;
  };
  handle: {
    id: string;
    value: string;
    alias?: string | null;
    isSearchable: boolean;
    isPrimary: boolean;
    createdAt: string;
  };
  profile: {
    displayName?: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    settings: Record<string, any>;
  };
}

export interface HandleCheckResponse {
  available: boolean;
  suggested?: string;
}
