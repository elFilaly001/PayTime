import { Response } from 'express';
import { Request } from 'express';
import { Logger } from '@nestjs/common';

const logger = new Logger('CookieHelper');

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
    domain?: string;
  } = {}
) {
  const defaultOptions = {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/',
  };

  const cookieOptions = { ...defaultOptions, ...options };
  res.cookie(name, value, cookieOptions);
}

export function getCookie(req: Request, name: string): string | undefined {    
    if (req.cookies && req.cookies[name] !== undefined) {
        return req.cookies[name];
    }
    
    const cookieHeader = req.headers.cookie;
    
    if (cookieHeader) {
        const cookieMap = cookieHeader.split(';').reduce((acc, cookie) => {
            const parts = cookie.trim().split('=');
            const key = parts.shift() || '';
            const value = parts.join('=');
            if (key) acc[key] = decodeURIComponent(value || '');
            return acc;
        }, {} as { [key: string]: string });
        
        return cookieMap[name];
    }
    return undefined;
}

export function deleteCookie(res: Response, name: string) {
    res.clearCookie(name, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/'
    });
}