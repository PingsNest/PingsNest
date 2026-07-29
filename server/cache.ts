import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client: Redis | null = null;
let connected = false;

function getClient(): Redis | null {
  if (client) return client;
  try {
    client = new Redis(REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    client.on('connect', () => {
      connected = true;
      console.log('[Cache] Redis connected');
    });

    client.on('error', (err: any) => {
      if (connected) console.warn('[Cache] Redis error:', err.message);
      connected = false;
    });

    client.connect().catch(() => {
      console.warn('[Cache] Redis unavailable — running without cache');
    });
  } catch {
    console.warn('[Cache] Redis init failed — running without cache');
    client = null;
  }
  return client;
}

// Initialise on import
getClient();

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  try {
    const c = getClient();
    if (!c || !connected) return null;
    const val = await c.get(key);
    if (!val) return null;
    console.log(`[Cache] HIT  ${key}`);
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  try {
    const c = getClient();
    if (!c || !connected) return;
    await c.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    console.log(`[Cache] SET  ${key}  (TTL ${ttlSeconds}s)`);
  } catch {
    // Silently fail — app continues without caching
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const c = getClient();
    if (!c || !connected) return;
    await c.del(key);
    console.log(`[Cache] DEL  ${key}`);
  } catch {}
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const c = getClient();
    if (!c || !connected) return;
    const keys = await c.keys(pattern);
    if (keys.length > 0) await c.del(...keys);
    console.log(`[Cache] DEL pattern  ${pattern}  (${keys.length} keys)`);
  } catch {}
}

export async function getRedisStats(): Promise<{ connected: boolean; memUsed: string }> {
  try {
    const c = getClient();
    if (!c || !connected) return { connected: false, memUsed: 'N/A' };
    const info = await c.info('memory');
    const match = info.match(/used_memory_human:(\S+)/);
    return { connected: true, memUsed: match ? match[1] : 'unknown' };
  } catch {
    return { connected: false, memUsed: 'N/A' };
  }
}
