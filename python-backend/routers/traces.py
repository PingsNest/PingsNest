"""
routers/traces.py — AWS X-Ray Trace Endpoint.

Ports: GET /api/aws/traces/:traceId  (server/index.ts L1234)
Queries AWS X-Ray via BatchGetTraces if credentials are provided,
otherwise returns correlated synthetic trace fallback for UI presentation.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any
import boto3
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("traces_router")
router = APIRouter(tags=["traces"])


@router.get("/aws/traces/{trace_id}")
async def get_xray_trace(
    trace_id: str,
    region: str | None = Query(None),
    accessKeyId: str | None = Query(None),
    secretAccessKey: str | None = Query(None),
):
    if not trace_id:
        raise HTTPException(status_code=400, detail="Trace ID required")

    # Try querying live AWS X-Ray if credentials provided
    if region and accessKeyId and secretAccessKey:
        try:
            trace_data = await asyncio.to_thread(
                _fetch_xray_trace, trace_id, region, accessKeyId, secretAccessKey
            )
            if trace_data:
                return {"trace": trace_data}
        except Exception as exc:
            logger.warning(f"[X-Ray] SDK query fallback: {exc}")

    # Correlated synthetic trace fallback for UI presentation (matches Node.js behavior)
    return {
        "trace": {
            "traceId": trace_id,
            "duration": 340,
            "statusCode": 200,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "rootService": "api-gateway",
            "segments": [
                {
                    "id": "seg-1",
                    "name": "API Gateway GET /api/users",
                    "startTime": 0,
                    "duration": 340,
                    "status": "ok",
                    "type": "gateway",
                    "details": {"stage": "prod", "route": "/api/users"},
                },
                {
                    "id": "seg-2",
                    "name": "AWS Lambda (user-service-fn)",
                    "startTime": 12,
                    "duration": 298,
                    "status": "ok",
                    "type": "lambda",
                    "details": {"memory": "256MB", "coldStart": False},
                },
                {
                    "id": "seg-3",
                    "name": "PostgreSQL Pool Query",
                    "startTime": 35,
                    "duration": 185,
                    "status": "ok",
                    "type": "postgres",
                    "details": {"query": "SELECT * FROM users WHERE status=active"},
                },
                {
                    "id": "seg-4",
                    "name": "Redis Session Check",
                    "startTime": 240,
                    "duration": 14,
                    "status": "ok",
                    "type": "dynamodb",
                    "details": {"key": "sess:993", "hit": True},
                },
            ],
        }
    }


def _fetch_xray_trace(trace_id: str, region: str, key: str, secret: str) -> dict | None:
    client = boto3.client(
        "xray",
        region_name=region,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
    )
    resp = client.batch_get_traces(TraceIds=[trace_id])
    traces = resp.get("Traces", [])
    if traces and len(traces) > 0:
        return traces[0]
    return None
