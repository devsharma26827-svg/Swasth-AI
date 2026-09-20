import { Request, Response, NextFunction } from 'express';
import { verifySessionToken, UserRecord } from './auth';
import { UserProfile } from '../src/types';

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  userProfile?: UserProfile;
  sessionToken?: string;
  userId?: string;
}

/**
 * Parses raw Cookie header string into object key-values.
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });

  return list;
}

/**
 * Extracts session token from Cookie header or Authorization Bearer header.
 */
export function extractSessionToken(req: Request): string | null {
  // 1. Try Cookie header (swasthai_session)
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.swasthai_session) {
    return cookies.swasthai_session;
  }

  // 2. Try Authorization header (Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Express middleware requiring a valid active session.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractSessionToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please log in.'
    });
  }

  const sessionResult = verifySessionToken(token);
  if (!sessionResult) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Your session has expired or is invalid. Please log in again.'
    });
  }

  req.user = sessionResult.user;
  req.userProfile = sessionResult.profile;
  req.sessionToken = token;
  req.userId = sessionResult.user.id;
  (req as any).userRole = sessionResult.user.role;

  next();
}
