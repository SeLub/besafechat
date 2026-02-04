export interface Identity {
  id: string;
  publicKey: string;
  createdAt: string;
}

export interface Handle {
  id: string;
  value: string;
  alias: string | null;
  isSearchable: boolean;
  isPrimary: boolean;
  createdAt: string;
}

export interface Profile {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  settings: Record<string, any>;
}

export interface FullProfile {
  identity: Identity;
  handle: Handle;
  profile: Profile;
}
