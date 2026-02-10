import { createContext, type ReactNode, useState, useContext, useCallback } from 'react';

interface AvatarUpdateContextType {
  lastAvatarUpdateTimestamp: number;
  triggerAvatarUpdate: () => void;
}

export const AvatarUpdateContext = createContext<AvatarUpdateContextType | undefined>(undefined);

export const AvatarUpdateProvider = ({ children }: { children: ReactNode }) => {
  const [lastAvatarUpdateTimestamp, setLastAvatarUpdateTimestamp] = useState(Date.now());

  const triggerAvatarUpdate = useCallback(() => {
    setLastAvatarUpdateTimestamp(Date.now());
  }, []);

  return (
    <AvatarUpdateContext.Provider value={{ lastAvatarUpdateTimestamp, triggerAvatarUpdate }}>
      {children}
    </AvatarUpdateContext.Provider>
  );
};

export const useAvatarUpdate = () => {
  const context = useContext(AvatarUpdateContext);
  if (context === undefined) {
    throw new Error('useAvatarUpdate must be used within an AvatarUpdateProvider');
  }
  return context;
};
