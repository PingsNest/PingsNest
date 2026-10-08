"""
routers/finops.py — AWS FinOps Cost Optimization Endpoint.

Ports: GET /api/finops/costs  (server/index.ts L126)
Query params: apiId, stage, protocol ('REST' | 'HTTP')
Cached with TTL 300s (5 minutes).
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, Query

from cache.redis_client import cache_get_or_set
from services.finops import calculate_route_finops_costs

logger = logging.getLogger("finops_router")
router = APIRouter(tags=["finops"])


@router.get("/finops/costs")
async def get_finops_costs(
    apiId: str = Query(..., description="API Gateway ID"),
    stage: str = Query(..., description="Stage name"),
    protocol: str = Query("REST", description="API protocol (REST or HTTP)"),
):
    if not apiId or not stage:
        raise HTTPException(status_code=400, detail="Missing apiId or stage")

    proto = protocol.upper() if protocol else "REST"
    cache_key = f"finops:{apiId}:{stage}:{proto}"

    try:
        async def _fetch():
            costs = await calculate_route_finops_costs(apiId, stage, proto)
            return {"routeCosts": costs}

        result = await cache_get_or_set(cache_key, 300, _fetch)
        return result
    except Exception as exc:
        logger.error(f"[FinOps] Error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
