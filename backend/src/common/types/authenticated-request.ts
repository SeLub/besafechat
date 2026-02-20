// /home/selub/Documents/progs/besafechat/backend/src/common/types/authenticated-request.ts
export interface AuthenticatedUser {
  id: string; // identityId (для обратной совместимости)
  identityId: string; // НОВОЕ: явное поле identityId
  handleId?: string; // НОВОЕ: активный Handle ID
  sessionId: string;
  publicKey: Buffer;
}

export interface Identity {
   id: string;
   publicKey: string;
   createdAt?: Date;
   [key: string]: unknown;
 }

 export interface Handle {
   id: string;
   value: string;
   alias?: string | null;
   isSearchable?: boolean;
   isPrimary?: boolean;
   ownerIdentityId?: string;
   [key: string]: unknown;
 }

 export interface Session {
   id: string;
   identityId: string;
   handleId: string;
   [key: string]: unknown;
 }

 export interface AuthenticatedRequest {
   cookies?: Record<string, string>;
   ip?: string;
   url: string;
   socket?: { remoteAddress?: string };
   user?: AuthenticatedUser;
   identity?: Identity;
   handle?: Handle;
   session?: Session;
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
