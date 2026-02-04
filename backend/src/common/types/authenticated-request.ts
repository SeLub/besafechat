export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  publicKey: Buffer;
}

export interface AuthenticatedRequest {
  cookies?: Record<string, string>;
  ip?: string;
  url: string;
  socket?: { remoteAddress?: string };
  user?: AuthenticatedUser;
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
