import { query } from './db.js';
export async function calculateTargetSlo(targetId, targetSloPercent = 99.9) {
    const windowDays = 30;
    const totalWindowSec = windowDays * 24 * 3600; // 2,592,000 seconds
    const allowedDownSec = Math.round(totalWindowSec * ((100 - targetSloPercent) / 100)); // e.g. 2,592 sec = 43.2 min for 99.9%
    let consumedDownSec = 0;
    let incidentCount = 0;
    try {
        const cutOff = new Date(Date.now() - totalWindowSec * 1000).toISOString();
        const { rows } = await query(`SELECT COALESCE(SUM(CASE WHEN "isResolved" THEN "durationSec" ELSE GREATEST(1, EXTRACT(EPOCH FROM (NOW() - "startedAt"))::int) END), 0) AS "totalDownSec", COUNT(*) AS "totalCount"
       FROM url_incidents
       WHERE "targetId" = $1 AND "startedAt" >= $2`, [targetId, cutOff]);
        consumedDownSec = Number(rows[0]?.totalDownSec || 0);
        incidentCount = Number(rows[0]?.totalCount || 0);
    }
    catch (err) {
        consumedDownSec = 0;
    }
    const remainingBudgetSec = Math.max(0, allowedDownSec - consumedDownSec);
    const remainingBudgetPercent = allowedDownSec > 0
        ? Math.max(0, Math.round((remainingBudgetSec / allowedDownSec) * 100))
        : 100;
    let burnRateStatus = 'NORMAL';
    if (remainingBudgetPercent < 20) {
        burnRateStatus = 'CRITICAL_BURN';
    }
    else if (remainingBudgetPercent < 50) {
        burnRateStatus = 'MODERATE_BURN';
    }
    return {
        targetId,
        targetSloPercent,
        windowDays,
        allowedDownSec,
        consumedDownSec,
        remainingBudgetSec,
        remainingBudgetPercent,
        burnRateStatus,
        incidentCount
    };
}
