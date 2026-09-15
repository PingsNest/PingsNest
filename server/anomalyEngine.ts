import { query } from './db.js';
import { broadcastAlert } from './ws.js';

export interface AnomalyResult {
  route: string;
  meanLatency: number;
  stdDev: number;
  currentLatency: number;
  isAnomaly: boolean;
  zScore: number;
}

/**
 * Statistical Anomaly Engine using 3-Sigma (Z-Score >= 3.0) threshold detection
 * for route latencies, with an absolute minimum threshold guard.
 *
 * BUG-05 FIX: Now accepts `region` parameter so alert dispatches use the real
 *   gateway region instead of the hardcoded 'us-east-1'.
 * BUG-06 FIX: The stdDev === 0 (perfectly flat baseline) case previously set
 *   zScore = 0, silently ignoring catastrophic latency spikes. Now uses an
 *   absolute threshold comparison when stdDev is 0.
 */
export async function detectLatencyAnomalies(apiId: string, stage: string, region: string = 'us-east-1'): Promise<AnomalyResult[]> {
  const anomalies: AnomalyResult[] = [];

  try {
    // 1. Fetch past 1 hour of route latency data from TimescaleDB
    const { rows } = await query(
      `SELECT route, latency, "statusCode", "fullTime"
       FROM gateway_logs
       WHERE "apiId" = $1 AND stage = $2 AND "fullTime" >= NOW() - INTERVAL '1 hour'
       ORDER BY "fullTime" ASC`,
      [apiId, stage]
    );

    if (rows.length < 10) return anomalies; // Need minimum baseline sample size

    // Group by route
    const routeData = new Map<string, number[]>();
    for (const r of rows) {
      const list = routeData.get(r.route) || [];
      list.push(r.latency);
      routeData.set(r.route, list);
    }

    for (const [route, latencies] of routeData) {
      if (latencies.length < 5) continue;

      const latestLatency = latencies[latencies.length - 1];
      const historical = latencies.slice(0, -1);

      // Compute Mean
      const sum = historical.reduce((acc, v) => acc + v, 0);
      const mean = sum / historical.length;

      // Compute Standard Deviation
      const variance = historical.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / historical.length;
      const stdDev = Math.sqrt(variance);

      // BUG-06 FIX: When stdDev === 0, all historical samples were identical.
      // A latency spike yields zScore = (spike - mean) / 0 which is NaN or 0,
      // silently bypassing anomaly detection. Use absolute deviation instead.
      let zScore: number;
      let isAnomaly: boolean;
      if (stdDev === 0) {
        zScore = latestLatency > mean ? 3.0 : 0;
        isAnomaly = latestLatency - mean > 100 && latestLatency > 150;
      } else {
        zScore = (latestLatency - mean) / stdDev;
        isAnomaly = zScore >= 3.0 && latestLatency > 150;
      }

      const result: AnomalyResult = {
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

        // BUG-05 FIX: Use the actual `region` param instead of hardcoded 'us-east-1'.
        try {
          const { dispatchGatewayFleetAlert } = await import('./notifications.js');
          await dispatchGatewayFleetAlert({
            severity: 'warning',
            gatewayId: apiId,
            gatewayName: `API Gateway (${apiId})`,
            region,
            stage,
            routePath: route,
            metricName: '3-Sigma Latency Anomaly Spike',
            currentValue: `${latestLatency}ms (Z-Score: ${result.zScore})`,
            thresholdValue: `${Math.round(mean)}ms baseline`,
            details: `Statistical EWMA latency anomaly spike detected on route ${route}. Current: ${latestLatency}ms vs 1hr mean ${Math.round(mean)}ms.`
          }).catch(() => {});
        } catch (dispatchErr) {}
      }
    }
  } catch (err: any) {
    console.error('[Anomaly Engine Error]:', err.message);
  }

  return anomalies;
}
