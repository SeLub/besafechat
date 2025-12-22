export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string; // иногда может быть message вместо error
}
export interface LoginResponse {
  success: boolean;
  userId: string;
  username?: string;
}
export interface ProfileResponse {
  userId: string;
  username?: string;
  displayName?: string;
  publicKey: string;
  createdAt: string;
  isSearchable: boolean;
  avatarUrl?: string | null;
}

export interface UsernameCheckResponse {
  available: boolean;
  suggested?: string;
}
