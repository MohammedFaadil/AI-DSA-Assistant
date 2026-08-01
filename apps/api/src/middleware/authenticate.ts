import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@repo/contracts';
import { verifyAccessToken } from '../lib/jwt.js';
import { forbidden, unauthenticated } from '../lib/errors.js';

function readBearer(req: Request): string | null {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Hard requirement — 401 when absent or invalid. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = readBearer(req);
  if (!token) {
    next(unauthenticated());
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role as Role, username: payload.username };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Soft authentication for endpoints whose response is richer when signed in
 * (problem list showing solved state, for example) but which must still work
 * anonymously. An invalid token is treated as anonymous, not as an error.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readBearer(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, role: payload.role as Role, username: payload.username };
  } catch {
    /* anonymous */
  }
  next();
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(unauthenticated());
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(forbidden('This action requires elevated permissions.'));
      return;
    }
    next();
  };
}
