import { createContext } from 'react';

interface NotificationCounts {
  newRequests: number;
  newAccepted: number;
}

interface NotificationContextType {
  counts: NotificationCounts;
  clearNotifications: () => void;
  incrementRequests: () => void;
  incrementAccepted: () => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
export type { NotificationCounts, NotificationContextType };