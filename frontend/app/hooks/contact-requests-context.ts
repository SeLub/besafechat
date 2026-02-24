import { createContext } from 'react';

interface ContactRequestsCounts {
  pending: number;
  accepted: number;
}

interface ContactRequestsContextType {
  counts: ContactRequestsCounts;
  clearRequests: () => void;
  incrementPending: () => void;
  incrementAccepted: () => void;
}

export const ContactRequestsContext = createContext<ContactRequestsContextType | undefined>(undefined);
export type { ContactRequestsCounts, ContactRequestsContextType };
