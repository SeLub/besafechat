export type NotificationType =
  | 'contact_request'
  | 'contact_accepted'
  | 'contact_rejected'
  | 'new_chat'
  | 'team_invite';

export interface NotificationData {
  fromHandle?: {
    id: string;
    value: string;
    displayName: string;
  };
  toHandle?: {
    id: string;
  };
  message?: string;
  chatId?: string;
  requestId?: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  timestamp: string;
  read: boolean;
  data: NotificationData;
}
