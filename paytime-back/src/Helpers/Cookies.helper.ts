import { Response } from 'express';

export function setCookie(
  res: Response,
  name: string,
  value: string,
  options: {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
  } = {}
) {
  const defaultOptions = {
    maxAge: 24 * 60 * 60 * 1000, // 1 day by default
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  };

  const cookieOptions = { ...defaultOptions, ...options };
  res.cookie(name, value, cookieOptions);
}


export function getCookie(req: any) {
  if (req && req.headers.cookie) {
    return req.headers.cookie.split('=')
  }
  return null;
}


export function deleteCookie(res: Response, name: string) {
  res.clearCookie(name);
}