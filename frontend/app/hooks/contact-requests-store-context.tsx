// /home/selub/Documents/progs/besafechat/frontend/app/hooks/contact-requests-store-context.tsx
import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { type ContactRequest } from '@/types/api';

interface Contact {
  id: string;
  user: {
    id: string;
    displayName: string;
    handle: string;
    avatarUrl?: string | null;
    firstName?: string;
    lastName?: string;
    bio?: string;
  };
  acceptedAt: string;
}

interface ContactRequestsStoreContextType {
  [x: string]: any;
  contacts: Contact[];
  outgoingRequests: ContactRequest[];
  setContacts: (contacts: Contact[]) => void;
  setOutgoingRequests: (requests: ContactRequest[]) => void;
  addContact: (contact: Contact) => void;
  removeOutgoingRequest: (requestId: string) => void;
  removeContact: (contactId: string) => void;
}

const ContactRequestsStoreContext = createContext<ContactRequestsStoreContextType | undefined>(
  undefined
);

export function ContactRequestsStoreProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ContactRequest[]>([]);

  const addContact = useCallback((contact: Contact) => {
    setContacts(prev => {
      if (prev.some(c => c.id === contact.id)) {
        return prev;
      }
      return [contact, ...prev];
    });
  }, []);

  const removeOutgoingRequest = useCallback((requestId: string) => {
    setOutgoingRequests(prev => prev.filter(r => r.id !== requestId));
  }, []);

  const removeContact = useCallback((contactId: string) => {
    setContacts(prev => prev.filter(c => c.id !== contactId));
  }, []);

  return (
    <ContactRequestsStoreContext.Provider
      value={{
        contacts,
        outgoingRequests,
        setContacts,
        setOutgoingRequests,
        addContact,
        removeOutgoingRequest,
        removeContact,
      }}
    >
      {children}
    </ContactRequestsStoreContext.Provider>
  );
}

export function useContactRequestsStore() {
  const context = useContext(ContactRequestsStoreContext);
  if (!context) {
    throw new Error('useContactRequestsStore must be used within ContactRequestsStoreProvider');
  }
  return context;
}
