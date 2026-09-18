import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { UserRole, Permission } from '../src/types';

const JWT_SECRET = process.env.JWT_SECRET || 'swasthai_jwt_super_secret_key_2026_dev';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  USER: [
    'user.profile.read',
    'user.profile.write',
    'user.checkups.run',
    'user.reports.read'
  ],
  OPERATOR: [
    'user.profile.read',
    'user.profile.write',
    'user.checkups.run',
    'user.reports.read',
    'admin.portal.access',
    'admin.patients.list',
    'admin.patients.view_summary',
    'admin.simulation.execute'
  ],
  ADMIN: [
    'user.profile.read',
    'user.profile.write',
    'user.checkups.run',
    'user.reports.read',
    'admin.portal.access',
    'admin.patients.list',
    'admin.patients.view_summary',
    'admin.patients.inspect_full',
    'admin.reports.download',
    'admin.audit.read',
    'admin.simulation.execute',
    'admin.system.reset'
  ],
  SUPER_ADMIN: [
    'user.profile.read',
    'user.profile.write',
    'user.checkups.run',
    'user.reports.read',
    'admin.portal.access',
    'admin.patients.list',
    'admin.patients.view_summary',
    'admin.patients.inspect_full',
    'admin.reports.download',
    'admin.audit.read',
    'admin.simulation.execute',
    'admin.system.reset'
  ]
};

export function normalizeRole(roleInput?: string | null): UserRole {
  if (!roleInput) return 'USER';
  const clean = roleInput.toString().trim().toUpperCase();
  if (clean === 'ADMIN') return 'ADMIN';
  if (clean === 'OPERATOR') return 'OPERATOR';
  if (clean === 'SUPER_ADMIN' || clean === 'SUPERADMIN') return 'SUPER_ADMIN';
  return 'USER';
}

export function getPermissionsForRole(role: UserRole): Permission[] {
  const normalized = normalizeRole(role);
  return [...ROLE_PERMISSIONS[normalized]];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const normalized = normalizeRole(role);
  const perms = ROLE_PERMISSIONS[normalized] || [];
  return perms.includes(permission);
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export interface JwtClaims {
  sub: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  iat: number;
  exp: number;
}

export function createJwtToken(claims: {
  sub: string;
  email: string;
  role: UserRole;
  permissions?: Permission[];
  expiresInSeconds?: number;
}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const normalizedRole = normalizeRole(claims.role);
  const permissions = claims.permissions || getPermissionsForRole(normalizedRole);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (claims.expiresInSeconds || 14 * 24 * 3600); // 14 days default

  const payload: JwtClaims = {
    sub: claims.sub,
    email: claims.email,
    role: normalizedRole,
    permissions,
    iat: now,
    exp
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwtToken(token: string): JwtClaims | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSig) {
    return null;
  }

  try {
    const payloadStr = base64UrlDecode(encodedPayload);
    const payload: JwtClaims = JSON.parse(payloadStr);

    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    payload.role = normalizeRole(payload.role);
    if (!payload.permissions) {
      payload.permissions = getPermissionsForRole(payload.role);
    }
    return payload;
  } catch {
    return null;
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Your session has expired. Please sign in again.'
        }
      });
    }

    const role = normalizeRole(user.role);
    const userPermissions: Permission[] = user.permissions || getPermissionsForRole(role);

    // Super Admin or Admin with permission or matching permission
    if (role === 'SUPER_ADMIN' || userPermissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: "You don't have permission to access this operation.",
        requiredPermission: permission,
        currentRole: role
      }
    });
  };
}

export function requireRoles(...allowedRoles: UserRole[]) {
  const normalizedAllowed = allowedRoles.map(r => normalizeRole(r));
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Your session has expired. Please sign in again.'
        }
      });
    }

    const currentRole = normalizeRole(user.role);
    if (normalizedAllowed.includes(currentRole) || currentRole === 'SUPER_ADMIN') {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: "You don't have permission to access this operation.",
        requiredRoles: allowedRoles,
        currentRole
      }
    });
  };
}
