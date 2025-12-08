import { useState, useEffect } from "react";
import { KeyService } from "../lib/db/services/key-service";
import { MessageService } from "../lib/db/services/message-service";

export function useLocalDb(privateKeyBase64: string) {
  const [isReady, setIsReady] = useState(false);
  const keyService = new KeyService();
  const messageService = new MessageService();

  useEffect(() => {
    const init = async () => {
      await keyService.savePrivateKey(
        Uint8Array.from(atob(privateKeyBase64), (c) => c.charCodeAt(0)),
        privateKeyBase64
      );
      setIsReady(true);
    };
    init();
  }, [privateKeyBase64]);

  return { isReady, keyService, messageService };
}
