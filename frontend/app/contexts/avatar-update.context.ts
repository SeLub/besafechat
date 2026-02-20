import { createContext } from 'react';

export interface AvatarUpdateContextType {
  lastAvatarUpdateTimestamp: number;
  triggerAvatarUpdate: () => void;
}

export const AvatarUpdateContext = createContext<AvatarUpdateContextType | undefined>(undefined);
