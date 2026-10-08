"""
routers/anomalies.py — ML Statistical Anomaly Detection endpoint.

Ports: GET /api/anomalies  (server/index.ts L111)
Query params: apiId, stage, region (optional)
Cached with TTL 60s.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Query

from cache.redis_client import cache_get_or_set
from services.anomaly_engine import detect_latency_anomalies

logger = logging.getLogger("anomalies_router")
router = APIRouter(tags=["anomalies"])


@router.get("/anomalies")
async def get_anomalies(
    apiId: str = Query(..., description="API Gateway ID"),
    stage: str = Query(..., description="Stage name"),
    region: str = Query("us-east-1", description="AWS Region"),
):
    if not apiId or not stage:
        raise HTTPException(status_code=400, detail="Missing apiId or stage")

    cache_key = f"anomalies:{apiId}:{stage}"

    try:
        async def _fetch():
            anomalies = await detect_latency_anomalies(apiId, stage, region)
            return {"anomalies": anomalies}

        # 60s cache TTL (matches Node TTL.ANOMALIES)
        result = await cache_get_or_set(cache_key, 60, _fetch)
        return result
    except Exception as exc:
        logger.error(f"[Anomalies] Error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
