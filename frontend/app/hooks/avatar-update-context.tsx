import { type ReactNode, useState, useContext, useCallback } from 'react';
import { AvatarUpdateContext } from '../contexts/avatar-update.context';

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

 // eslint-disable-next-line react-refresh/only-export-components
 export const useAvatarUpdate = () => {
   const context = useContext(AvatarUpdateContext);
   if (context === undefined) {
     throw new Error('useAvatarUpdate must be used within an AvatarUpdateProvider');
   }
   return context;
 };
