"""
routers/health.py — Health check and Prometheus metrics endpoints.
Mirrors the /health and /metrics routes in server/index.ts.
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from db.pool import query_one
from cache.redis_client import _client as redis_client, _connected as redis_connected

router = APIRouter(tags=["Observability"])

_start_time = time.time()


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """Deep readiness check — mirrors Node's GET /health."""
    db_status = "ok"
    redis_status = "ok" if redis_connected else "degraded"

    try:
        await query_one("SELECT 1")
    except Exception:
        db_status = "error"

    is_healthy = db_status == "ok"
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=200 if is_healthy else 503,
        content={
            "status": "healthy" if is_healthy else "unhealthy",
            "service": "api-gateway-python",
            "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "uptimeSeconds": int(time.time() - _start_time),
            "components": {
                "database": db_status,
                "redis": redis_status,
            },
        },
    )
