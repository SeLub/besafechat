// /home/selub/Documents/progs/besafechat/backend/src/common/types/authenticated-request.ts
export interface AuthenticatedUser {
  id: string; // identityId (для обратной совместимости)
  identityId: string; // НОВОЕ: явное поле identityId
  handleId?: string; // НОВОЕ: активный Handle ID
  sessionId: string;
  publicKey: Buffer;
}

export interface AuthenticatedRequest {
  cookies?: Record<string, string>;
  ip?: string;
  url: string;
  socket?: { remoteAddress?: string };
  user?: AuthenticatedUser;
  identity?: any; // НОВОЕ: Identity объект из JWT Guard
  handle?: any; // НОВОЕ: Handle объект из JWT Guard
  session?: any; // НОВОЕ: Session объект из JWT Guard
}

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
}

export interface NestResponse {
  cookie(name: string, value: string, options?: CookieOptions): void;
  clearCookie(name: string): void;
}
