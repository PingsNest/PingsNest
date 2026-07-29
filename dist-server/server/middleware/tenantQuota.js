import { query } from '../db.js';
const TIER_QUOTAS = {
    free: { tier: 'free', monthlyLimit: 100_000 },
    pro: { tier: 'pro', monthlyLimit: 10_000_000 },
    enterprise: { tier: 'enterprise', monthlyLimit: 1_000_000_000 }
};
/**
 * Multi-Tenant Usage Metering & Monthly Quota Middleware
 * Enforces monthly request quotas per tenant tier and sets tenant X-Usage response headers.
 */
export function tenantQuotaMiddleware(req, res, next) {
    const tenantId = req.headers['x-tenant-id'] || 'default-tenant';
    const tenantTier = (req.headers['x-tenant-tier'] || 'free').toLowerCase();
    const quota = TIER_QUOTAS[tenantTier] || TIER_QUOTAS.free;
    // Execute non-blocking query to count tenant usage in current calendar month
    query(`SELECT COUNT(*) AS count
     FROM gateway_logs
     WHERE "tenantId" = $1 AND "fullTime" >= date_trunc('month', NOW())`, [tenantId])
        .then(({ rows }) => {
        const currentUsage = Number(rows[0]?.count || 0);
        const remaining = Math.max(0, quota.monthlyLimit - currentUsage);
        res.setHeader('X-Tenant-Id', tenantId);
        res.setHeader('X-Tenant-Tier', quota.tier);
        res.setHeader('X-Tenant-Quota-Limit', quota.monthlyLimit);
        res.setHeader('X-Tenant-Quota-Remaining', remaining);
        if (currentUsage >= quota.monthlyLimit && quota.tier !== 'enterprise') {
            res.status(429).json({
                error: `Monthly quota exceeded for Tenant Tier '${quota.tier}'. Limit: ${quota.monthlyLimit.toLocaleString()} requests/month. Please upgrade your tenant subscription.`
            });
            return;
        }
        next();
    })
        .catch(() => {
        // If quota query fails, allow request to proceed
        next();
    });
}
