// /home/selub/Documents/progs/besafechat/frontend/app/hooks/contact-requests-store-context.tsx
import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface ContactRequest {
  id: string;
  from: {
    id: string;
    value: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    alias?: string;
  };
  to: {
    handleId: string;
  };
  message?: string;
  status?: string;
  createdAt: string;
}

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
  contacts: Contact[];
  incomingRequests: ContactRequest[];
  outgoingRequests: ContactRequest[];
  setContacts: (contacts: Contact[]) => void;
  setIncomingRequests: (requests: ContactRequest[]) => void;
  setOutgoingRequests: (requests: ContactRequest[]) => void;
  addIncomingRequest: (request: ContactRequest) => void;
  addContact: (contact: Contact) => void;
  removeIncomingRequest: (requestId: string) => void;
  removeOutgoingRequest: (requestId: string) => void;
  removeContact: (contactId: string) => void;
}

const ContactRequestsStoreContext = createContext<ContactRequestsStoreContextType | undefined>(
  undefined
);

export function ContactRequestsStoreProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<ContactRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ContactRequest[]>([]);

  const addIncomingRequest = useCallback((request: ContactRequest) => {
    setIncomingRequests(prev => {
      // Check if request already exists
      if (prev.some(r => r.id === request.id)) {
        return prev;
      }
      return [request, ...prev];
    });
  }, []);

  const addContact = useCallback((contact: Contact) => {
    setContacts(prev => {
      if (prev.some(c => c.id === contact.id)) {
        return prev;
      }
      return [contact, ...prev];
    });
  }, []);

  const removeIncomingRequest = useCallback((requestId: string) => {
    setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
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
        incomingRequests,
        outgoingRequests,
        setContacts,
        setIncomingRequests,
        setOutgoingRequests,
        addIncomingRequest,
        addContact,
        removeIncomingRequest,
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
