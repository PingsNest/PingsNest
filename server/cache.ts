import { Redis, type RedisOptions } from 'ioredis';

export function getRedisUrl(): string {
  if (process.env.REDIS_URL) {
    let url = process.env.REDIS_URL.trim();
    if (!url.startsWith('redis://') && !url.startsWith('rediss://')) {
      const isAws = url.includes('cache.amazonaws.com');
      const protocol = isAws || process.env.REDIS_TLS === 'true' ? 'rediss' : 'redis';
      url = `${protocol}://${url}`;
    }
    return url;
  }
  if (process.env.REDIS_HOST) {
    const isAws = process.env.REDIS_HOST.includes('cache.amazonaws.com');
    const useTls = process.env.REDIS_TLS === 'true' || isAws;
    const protocol = useTls ? 'rediss' : 'redis';
    const port = process.env.REDIS_PORT || '6379';
    const auth = process.env.REDIS_PASSWORD ? `:${encodeURIComponent(process.env.REDIS_PASSWORD)}@` : '';
    return `${protocol}://${auth}${process.env.REDIS_HOST}:${port}`;
  }
  return 'redis://localhost:6379';
}

const REDIS_URL = getRedisUrl();

let client: Redis | null = null;
let connected = false;

function getClient(): Redis | null {
  if (client) return client;
  try {
    const isTls = REDIS_URL.startsWith('rediss://') || process.env.REDIS_TLS === 'true';
    const redisOptions: RedisOptions = {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {})
    };
    client = new Redis(REDIS_URL, redisOptions);

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
    // Use non-blocking SCAN instead of KEYS * to avoid Redis latency spikes on large keyspaces
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await c.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    if (keys.length > 0) await c.del(...keys);
    console.log(`[Cache] SCAN DEL  ${pattern}  (${keys.length} keys)`);
  } catch {}
}

/**
 * Get-or-set helper: returns cached value if present, otherwise calls `fn()`,
 * caches the result, and returns it. Reduces boilerplate on every cached route.
 */
export async function cacheGetOrSet<T = any>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const value = await fn();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function getRedisStats(): Promise<{ connected: boolean; memUsed: string }> {
  try {
    const c = getClient();
    if (!c || !connected) return { connected: false, memUsed: 'N/A' };
    
    let info = '';
    try {
      info = await Promise.race([
        c.info('memory'),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
      ]);
    } catch {}

    if (!info || info.trim().length === 0 || info.trim() === '# Memory') {
      try {
        info = await Promise.race([
          c.info(),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
      } catch {}
    }

    // 1. Check used_memory_human (e.g. 1.25M)
    const humanMatch = info.match(/used_memory_human:\s*([^\r\n]+)/i);
    if (humanMatch && humanMatch[1].trim()) {
      return { connected: true, memUsed: humanMatch[1].trim() };
    }

    // 2. Check raw used_memory in bytes
    const bytesMatch = info.match(/used_memory:\s*(\d+)/i);
    if (bytesMatch && bytesMatch[1]) {
      return { connected: true, memUsed: formatBytes(parseInt(bytesMatch[1], 10)) };
    }

    // 3. Check used_memory_peak_human
    const peakMatch = info.match(/used_memory_peak_human:\s*([^\r\n]+)/i);
    if (peakMatch && peakMatch[1].trim()) {
      return { connected: true, memUsed: peakMatch[1].trim() };
    }

    // 4. Amazon ElastiCache Serverless dynamically manages memory without static bounds
    return { connected: true, memUsed: 'Serverless (Auto)' };
  } catch {
    return { connected: false, memUsed: 'N/A' };
  }
}
