import { createContext } from 'react';
import type { FullProfile } from '~/types/profile';

interface AuthContextType {
  user: FullProfile | null;
  loading: boolean;
  register: (deviceId: string) => Promise<void>;
  login: (publicKey: string, deviceId: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchToHandle: (handleId: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
export type { AuthContextType };