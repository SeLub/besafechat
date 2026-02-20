// /home/selub/Documents/progs/besafechat/backend/src/common/types/response-with-cookies.ts
export interface ResponseWithCookies {
   cookie(name: string, value: string, options?: CookieOptions): this;
   clearCookie(name: string, options?: CookieOptions): this;
   status(code: number): this;
   json(body: Record<string, unknown>): this;
   send(body: Record<string, unknown> | string): this;
   setHeader?(name: string, value: string | string[]): this;
   getHeader?(name: string): string | string[] | undefined;
 }

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
  domain?: string;
}
