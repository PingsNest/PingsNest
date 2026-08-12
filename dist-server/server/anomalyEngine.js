import { query } from './db.js';
import { broadcastAlert } from './ws.js';
/**
 * ML-Lite Statistical Anomaly Engine using Exponentially Weighted Moving Average (EWMA)
 * and 3-Sigma (Z-Score > 3.0) threshold detection for route latencies and error rates.
 */
export async function detectLatencyAnomalies(apiId, stage) {
    const anomalies = [];
    try {
        // 1. Fetch past 1 hour of route latency data from TimescaleDB
        const { rows } = await query(`SELECT route, latency, "statusCode", "fullTime"
       FROM gateway_logs
       WHERE "apiId" = $1 AND stage = $2 AND "fullTime" >= NOW() - INTERVAL '1 hour'
       ORDER BY "fullTime" ASC`, [apiId, stage]);
        if (rows.length < 10)
            return anomalies; // Need minimum baseline sample size
        // Group by route
        const routeData = new Map();
        for (const r of rows) {
            const list = routeData.get(r.route) || [];
            list.push(r.latency);
            routeData.set(r.route, list);
        }
        for (const [route, latencies] of routeData) {
            if (latencies.length < 5)
                continue;
            const latestLatency = latencies[latencies.length - 1];
            const historical = latencies.slice(0, -1);
            // Compute Mean
            const sum = historical.reduce((acc, v) => acc + v, 0);
            const mean = sum / historical.length;
            // Compute Standard Deviation
            const variance = historical.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / historical.length;
            const stdDev = Math.sqrt(variance);
            // Calculate Z-Score: (current - mean) / stdDev
            const zScore = stdDev > 0 ? (latestLatency - mean) / stdDev : 0;
            const isAnomaly = zScore >= 3.0 && latestLatency > 150; // 3-Sigma Rule with minimum threshold
            const result = {
                route,
                meanLatency: Math.round(mean),
                stdDev: Math.round(stdDev),
                currentLatency: latestLatency,
                isAnomaly,
                zScore: Number(zScore.toFixed(2))
            };
            if (isAnomaly) {
                anomalies.push(result);
                console.warn(`[Anomaly Engine] Statistical latency spike on route ${route}: current=${latestLatency}ms, baseline=${Math.round(mean)}ms (Z-Score: ${result.zScore})`);
                // Broadcast real-time anomaly alert over WebSockets
                broadcastAlert({
                    type: 'anomaly_spike',
                    apiId,
                    stage,
                    route,
                    currentLatency: latestLatency,
                    baselineMean: Math.round(mean),
                    zScore: result.zScore,
                    timestamp: new Date().toISOString()
                });
                // Dispatch multi-channel Gateway anomaly alert
                try {
                    const { dispatchGatewayFleetAlert } = await import('./notifications.js');
                    await dispatchGatewayFleetAlert({
                        severity: 'warning',
                        gatewayId: apiId,
                        gatewayName: `API Gateway (${apiId})`,
                        region: 'us-east-1',
                        stage,
                        routePath: route,
                        metricName: '3-Sigma Latency Anomaly Spike',
                        currentValue: `${latestLatency}ms (Z-Score: ${result.zScore})`,
                        thresholdValue: `${Math.round(mean)}ms baseline`,
                        details: `Statistical EWMA latency anomaly spike detected on route ${route}. Current: ${latestLatency}ms vs 1hr mean ${Math.round(mean)}ms.`
                    }).catch(() => { });
                }
                catch (dispatchErr) { }
            }
        }
    }
    catch (err) {
        console.error('[Anomaly Engine Error]:', err.message);
    }
    return anomalies;
}
