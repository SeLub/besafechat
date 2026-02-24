import { createContext } from 'react';

export interface OnlineStatusContextType {
  getOnlineStatus: (handleId: string | undefined) => boolean;
  updateOnlineStatus: (handleId: string, isOnline: boolean) => void;
  bulkUpdateOnlineStatus: (statuses: Record<string, boolean>) => void;
}

export const OnlineStatusContext = createContext<OnlineStatusContextType | undefined>(undefined);
