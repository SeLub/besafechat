/**
 * Handle types and interfaces
 * Centralized definitions for Handle entity used across the application
 */

export type HandleType = 'account' | 'team' | 'channel';

export interface HandleProfile {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl?: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface Handle {
  id: string;
  value: string;
  type: HandleType;
  alias: string | null;
  isPrimary: boolean;
  isSearchable: boolean;
  createdAt: string;
  profile?: HandleProfile;
  ownerIdentityId?: string;
}

/**
 * Partial handle for update operations
 */
export type HandleUpdate = Partial<Omit<Handle, 'id' | 'createdAt'>>;
