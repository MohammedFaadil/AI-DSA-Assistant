import type { RequestHandler } from 'express';
import { rateLimited } from '../lib/errors.js';
import { redis } from '../lib/redis.js';
import type { ErrorCode } from '@repo/contracts';

/**
 * Two-tier rate limiting.
 *
 * Cheap classes use an in-process token bucket (free, no network). The two
 * expensive classes — execution and AI — additionally consult Redis so the
 * limit survives a restart and, later, spans instances. That split is what
 * keeps us inside Upstash's ~10k commands/day (ADR-006).
 */
export interface RateLimitClass {
  name: string;
  limit: number;
  windowSec: number;
  scope: 'ip' | 'user';
  durable: boolean;
  code?: ErrorCode;
}

export const LIMITS = {
  auth: { name: 'auth', limit: 10, windowSec: 900, scope: 'ip', durable: false },
  read: { name: 'read', limit: 300, windowSec: 60, scope: 'user', durable: false },
  write: { name: 'write', limit: 60, windowSec: 60, scope: 'user', durable: false },
  execution: {
    name: 'execution',
    limit: 20,
    windowSec: 3600,
    scope: 'user',
    durable: true,
    code: 'EXECUTION_QUOTA_EXCEEDED' as ErrorCode,
  },
  executionBurst: { name: 'exec-burst', limit: 5, windowSec: 60, scope: 'user', durable: false },
  aiChat: {
    name: 'ai-chat',
    limit: 40,
    windowSec: 3600,
    scope: 'user',
    durable: true,
    code: 'AI_QUOTA_EXCEEDED' as ErrorCode,
  },
  aiInline: { name: 'ai-inline', limit: 30, windowSec: 60, scope: 'user', durable: false },
  admin: { name: 'admin', limit: 120, windowSec: 60, scope: 'user', durable: false },
} satisfies Record<string, RateLimitClass>;

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

// Bounded sweep — without this the map grows with every distinct IP forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of buckets) if (w.resetAt < now) buckets.delete(key);
}, 60_000).unref();

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function consumeLocal(key: string, limit: number, windowSec: number): ConsumeResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    const w = { count: 1, resetAt: now + windowSec * 1000 };
    buckets.set(key, w);
    return { allowed: true, remaining: limit - 1, resetAt: w.resetAt };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function rateLimit(cls: RateLimitClass): RequestHandler {
  return async (req, res, next) => {
    const identity =
      cls.scope === 'user' && req.auth ? `u:${req.auth.userId}` : `ip:${req.ip ?? 'unknown'}`;
    const key = `rl:${cls.name}:${identity}`;

    const local = consumeLocal(key, cls.limit, cls.windowSec);
    let allowed = local.allowed;
    let remaining = local.remaining;

    if (cls.durable && redis.available) {
      const count = await redis.incrWithTtl(key, cls.windowSec);
      if (count !== null) {
        allowed = allowed && count <= cls.limit;
        remaining = Math.min(remaining, Math.max(0, cls.limit - count));
      }
    }

    res.setHeader('X-RateLimit-Limit', cls.limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(local.resetAt / 1000));

    if (!allowed) {
      const retryAfter = Math.max(1, Math.ceil((local.resetAt - Date.now()) / 1000));
      res.setHeader('Retry-After', retryAfter);
      next(rateLimited(retryAfter, cls.code));
      return;
    }
    next();
  };
}

/** Read the current state of a limit without consuming — powers /quota endpoints. */
export function peek(cls: RateLimitClass, userId: string): ConsumeResult {
  const key = `rl:${cls.name}:u:${userId}`;
  const w = buckets.get(key);
  const now = Date.now();
  if (!w || w.resetAt < now) {
    return { allowed: true, remaining: cls.limit, resetAt: now + cls.windowSec * 1000 };
  }
  return {
    allowed: w.count <= cls.limit,
    remaining: Math.max(0, cls.limit - w.count),
    resetAt: w.resetAt,
  };
}
