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
  recovered?: boolean;
  isNewIdentity?: boolean;
}
export type Theme = 'besafe' | 'leteem' | 'minimal';
export type Language = 'en' | 'ru' | 'de' | 'fr';
export type RetentionPeriod = '7' | '30' | '90' | 'forever';
export type Mode = 'light' | 'dark';

export interface ProfileSettings {
  ui: {
    theme: Theme;
    language: Language;
    mode: Mode;
  };
  storage: {
    messageRetentionDays: RetentionPeriod;
  };
  notifications: boolean;
  sound: boolean;
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

export interface ContactRequest {
  id: string;
  from: {
    id: string;
    handleId?: string;
    value: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    alias?: string | null;
  };
  to?: {
    handleId: string;
  };
  message?: string;
  status?: string;
  createdAt?: string;
}
