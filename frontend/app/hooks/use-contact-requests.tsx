// /home/selub/Documents/progs/besafechat/frontend/app/hooks/use-contact-requests.tsx
import { useState, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './use-auth-context';
import { ContactRequestsContext, type ContactRequestsCounts } from './contact-requests-context';

export function ContactRequestsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<ContactRequestsCounts>({
    pending: 0,
    accepted: 0,
  });
  const { user } = useAuth();

  // Clear counts when opening Contacts page
  const clearRequests = () => {
    setCounts({ pending: 0, accepted: 0 });
  };

  const incrementPending = () => {
    setCounts(prev => ({ ...prev, pending: prev.pending + 1 }));
  };

  const incrementAccepted = () => {
    setCounts(prev => ({ ...prev, accepted: prev.accepted + 1 }));
  };

  return (
    <ContactRequestsContext.Provider
      value={{
        counts,
        clearRequests,
        incrementPending,
        incrementAccepted,
      }}
    >
      {children}
    </ContactRequestsContext.Provider>
  );
}

export function useContactRequests() {
  const context = useContext(ContactRequestsContext);
  if (!context) {
    throw new Error('useContactRequests must be used within ContactRequestsProvider');
  }
  return context;
}
