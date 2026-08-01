import argon2 from 'argon2';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Argon2id for new passwords. Seed data and any environment where the native
 * argon2 binding is unavailable fall back to scrypt (Node core) — both formats
 * are verifiable, and a scrypt hash is transparently upgraded to argon2 on the
 * next successful login.
 */
const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024, // 19 MiB — OWASP floor, and safe on a 512 MB instance
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON_OPTS);
}

export function hashPasswordScrypt(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (hash.startsWith('scrypt$')) {
    const [, salt, expected] = hash.split('$');
    if (!salt || !expected) return false;
    const derived = scryptSync(plain, salt, 64);
    const expectedBuf = Buffer.from(expected, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return timingSafeEqual(derived, expectedBuf);
  }
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function needsRehash(hash: string): boolean {
  return hash.startsWith('scrypt$');
}
