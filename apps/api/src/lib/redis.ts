import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Redis holds ONLY durable, low-frequency state (ADR-006):
 *   • refresh-token family denylist
 *   • cron job locks
 *   • counters for the two expensive endpoint classes (execution, AI)
 *
 * It is deliberately optional. With REDIS_URL unset the API runs entirely on
 * in-process state, which is correct for a single instance and is what local
 * development uses. Nothing in the request path may *require* Redis.
 */
let client: Redis | null = null;

if (env.REDIS_URL) {
  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    // A Redis outage must degrade rate limiting, never take the API down.
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
  });

  client.on('error', (err) => {
    logger.warn({ err: err.message }, 'redis error — falling back to in-process state');
  });

  void client.connect().catch((err) => {
    logger.warn({ err: err.message }, 'redis connect failed — continuing without it');
    client = null;
  });
}

export const redis = {
  get available(): boolean {
    return client !== null && client.status === 'ready';
  },

  async get(key: string): Promise<string | null> {
    if (!this.available) return null;
    try {
      return await client!.get(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.available) return;
    try {
      if (ttlSeconds) await client!.set(key, value, 'EX', ttlSeconds);
      else await client!.set(key, value);
    } catch {
      /* non-fatal by design */
    }
  },

  async del(key: string): Promise<void> {
    if (!this.available) return;
    try {
      await client!.del(key);
    } catch {
      /* non-fatal */
    }
  },

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
    if (!this.available) return null;
    try {
      const pipeline = client!.multi();
      pipeline.incr(key);
      pipeline.expire(key, ttlSeconds, 'NX');
      const res = await pipeline.exec();
      const value = res?.[0]?.[1];
      return typeof value === 'number' ? value : null;
    } catch {
      return null;
    }
  },

  /** Best-effort distributed lock for cron jobs on a multi-instance deploy. */
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.available) return true; // single instance: always hold the lock
    try {
      const res = await client!.set(`lock:${key}`, '1', 'EX', ttlSeconds, 'NX');
      return res === 'OK';
    } catch {
      return true;
    }
  },

  async quit(): Promise<void> {
    if (client) await client.quit().catch(() => undefined);
  },
};
