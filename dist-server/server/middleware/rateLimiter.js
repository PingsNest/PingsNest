import { cacheGet, cacheSet } from '../cache.js';
/**
 * Distributed sliding-window Rate Limiter Middleware backed by Redis / Cache.
 */
export function rateLimiterMiddleware(options = {}) {
    const windowMs = options.windowMs || 60 * 1000;
    const max = options.max || 100;
    const message = options.message || 'Too many requests from this IP, please try again later.';
    return async (req, res, next) => {
        // Skip rate limiting in test or for internal readiness check
        if (req.path === '/health' || req.path === '/metrics') {
            return next();
        }
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const key = `ratelimit:${req.path.replace(/\//g, '_')}:${clientIp}`;
        try {
            const current = await cacheGet(key);
            const now = Date.now();
            if (!current || now > current.resetAt) {
                // First request in new window
                await cacheSet(key, { count: 1, resetAt: now + windowMs }, Math.ceil(windowMs / 1000));
                res.setHeader('X-RateLimit-Limit', max);
                res.setHeader('X-RateLimit-Remaining', max - 1);
                return next();
            }
            if (current.count >= max) {
                const retryAfter = Math.ceil((current.resetAt - now) / 1000);
                res.setHeader('Retry-After', retryAfter);
                res.setHeader('X-RateLimit-Limit', max);
                res.setHeader('X-RateLimit-Remaining', 0);
                res.status(429).json({ error: message, retryAfterSeconds: retryAfter });
                return;
            }
            current.count += 1;
            const ttlSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
            await cacheSet(key, current, ttlSeconds);
            res.setHeader('X-RateLimit-Limit', max);
            res.setHeader('X-RateLimit-Remaining', max - current.count);
            next();
        }
        catch {
            // Fallback: If cache fails, allow request to avoid blocking valid traffic
            next();
        }
    };
}
