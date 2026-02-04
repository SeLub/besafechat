// src/types/express/index.d.ts
import 'express';

declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      sessionId: string;
      publicKey: Buffer;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}
