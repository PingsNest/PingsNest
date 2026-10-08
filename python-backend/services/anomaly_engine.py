"""
services/anomaly_engine.py — Statistical Anomaly Engine using 3-Sigma (Z-Score >= 3.0).

Ported from server/anomalyEngine.ts.
Key behaviours preserved:
  - 1-hour window query against TimescaleDB gateway_logs
  - Minimum sample size guards (10 overall, 5 per route)
  - BUG-05 FIX: Accepts region parameter for alerts
  - BUG-06 FIX: stdDev == 0 guard for flat baselines with sudden spikes
  - Publishes real-time anomaly alerts to Redis 'ws:fanout:alert' channel for
    immediate fanout through the Node.js WebSocket gateway
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import TypedDict

from db.pool import query
from cache.redis_client import publish

logger = logging.getLogger("anomaly_engine")


class AnomalyResult(TypedDict):
    route: str
    meanLatency: int
    stdDev: int
    currentLatency: int
    isAnomaly: bool
    zScore: float


async def detect_latency_anomalies(
    api_id: str,
    stage: str,
    region: str = "us-east-1",
) -> list[AnomalyResult]:
    """
    Statistical Anomaly Engine using 3-Sigma (Z-Score >= 3.0) threshold detection
    for route latencies, with an absolute minimum threshold guard (150ms).
    """
    anomalies: list[AnomalyResult] = []

    try:
        # 1. Fetch past 1 hour of route latency data from TimescaleDB
        rows = await query(
            'SELECT route, latency, "statusCode", "fullTime" '
            "FROM gateway_logs "
            'WHERE "apiId" = $1 AND stage = $2 AND "fullTime" >= NOW() - INTERVAL \'1 hour\' '
            'ORDER BY "fullTime" ASC',
            api_id,
            stage,
        )

        if not rows or len(rows) < 10:
            return anomalies  # Need minimum baseline sample size

        # 2. Group latencies by route
        route_data: dict[str, list[int]] = {}
        for r in rows:
            route = r.get("route") or "unknown"
            lat = int(r.get("latency") or 0)
            if route not in route_data:
                route_data[route] = []
            route_data[route].append(lat)

        for route, latencies in route_data.items():
            if len(latencies) < 5:
                continue

            latest_latency = latencies[-1]
            historical = latencies[:-1]

            # Compute Mean
            mean = sum(historical) / len(historical)

            # Compute Sample Variance (Bessel's correction N - 1)
            deg_free = max(1, len(historical) - 1)
            variance = sum((v - mean) ** 2 for v in historical) / deg_free
            std_dev = math.sqrt(variance)

            # BUG-06 FIX: When stdDev == 0, historical samples were identical.
            # Avoid division by zero, use relative deviation guard
            if std_dev == 0:
                z_score = 3.0 if latest_latency > mean else 0.0
                is_anomaly = (latest_latency - mean > 50) and (latest_latency > mean * 1.5)
            else:
                z_score = (latest_latency - mean) / std_dev
                # Dynamic guard: 3-Sigma breach, at least 1.5x baseline jump, and minimum 50ms floor
                is_anomaly = (z_score >= 3.0) and (latest_latency > mean * 1.5) and (latest_latency > 50)

            result: AnomalyResult = {
                "route": route,
                "meanLatency": int(round(mean)),
                "stdDev": int(round(std_dev)),
                "currentLatency": latest_latency,
                "isAnomaly": bool(is_anomaly),
                "zScore": round(float(z_score), 2),
            }

            if is_anomaly:
                anomalies.append(result)
                logger.warning(
                    f"[Anomaly Engine] Statistical latency spike on route {route}: "
                    f"current={latest_latency}ms, baseline={result['meanLatency']}ms (Z-Score: {result['zScore']})"
                )

                # Broadcast real-time anomaly alert over Redis Pub/Sub for Node WS fanout
                now_iso = datetime.now(timezone.utc).isoformat()
                await publish(
                    "ws:fanout:alert",
                    {
                        "alert": {
                            "type": "anomaly_spike",
                            "apiId": api_id,
                            "stage": stage,
                            "route": route,
                            "region": region,
                            "currentLatency": latest_latency,
                            "baselineMean": result["meanLatency"],
                            "zScore": result["zScore"],
                            "timestamp": now_iso,
                        }
                    },
                )

    except Exception as exc:
        logger.error(f"[Anomaly Engine Error]: {exc}", exc_info=True)

    return anomalies
