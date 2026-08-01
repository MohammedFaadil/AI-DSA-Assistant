import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { tokenExpired, unauthenticated } from './errors.js';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  username: string;
}

export function signAccessToken(payload: AccessTokenPayload): {
  token: string;
  expiresIn: number;
} {
  const token = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: 'ai-dsa-mentor',
  } as jwt.SignOptions);
  const decoded = jwt.decode(token) as { exp: number; iat: number };
  return { token, expiresIn: decoded.exp - decoded.iat };
}

export function verifyAccessToken(token: string): AccessTokenPayload & { exp: number } {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'ai-dsa-mentor',
    }) as AccessTokenPayload & { exp: number };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw tokenExpired();
    throw unauthenticated('Invalid token.');
  }
}

/**
 * Refresh tokens are opaque random strings, not JWTs. Only their SHA-256 hash
 * is stored, so a database leak does not yield usable tokens.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const REFRESH_COOKIE = 'adm_rt';

export function refreshCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax' | 'none';
  path: string;
  maxAge: number;
} {
  const crossSite = new URL(env.APP_URL).origin !== new URL(env.API_URL).origin;
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    // Cross-origin dev (localhost:3000 → localhost:4000) still counts as
    // same-site for cookie purposes; only a real cross-site prod deploy needs
    // SameSite=None, and that requires Secure.
    sameSite: crossSite && env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/v1/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}
