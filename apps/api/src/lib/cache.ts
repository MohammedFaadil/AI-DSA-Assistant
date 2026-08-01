/**
 * L1 in-process cache.
 *
 * This is the hot cache for the entire API (ADR-006). Redis is NOT used for
 * caching: at ~10k commands/day on Upstash Free, a read-through Redis cache
 * would exhaust the daily quota faster than it saved work. When we scale past
 * one instance, this becomes L1 and Redis becomes L2 behind the same interface.
 */
interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class LruCache<V> {
  private readonly map = new Map<string, Entry<V>>();

  constructor(
    private readonly maxSize = 500,
    private readonly defaultTtlMs = 60_000,
  ) {}

  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency: delete + re-insert moves the key to the end of the
    // Map's insertion order, which is what makes eviction LRU rather than FIFO.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, ttlMs = this.defaultTtlMs): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async wrap(key: string, ttlMs: number, factory: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  /** Invalidate every key beginning with `prefix` — used on admin mutations. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) this.map.delete(key);
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

/** Shared caches. Separate instances so one hot domain can't evict another. */
export const problemCache = new LruCache<unknown>(300, 10 * 60_000);
export const metaCache = new LruCache<unknown>(50, 60 * 60_000);
export const leaderboardCache = new LruCache<unknown>(50, 5 * 60_000);
