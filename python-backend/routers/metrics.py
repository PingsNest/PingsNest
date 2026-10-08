"""
routers/metrics.py — CloudWatch metrics endpoint (Phase 3).

Ports: POST /api/aws/metrics  (Node index.ts L2460)

Key behaviours preserved:
  - BUG-01 FIX: endTime aligned to minute boundary (CloudWatch 60s windows)
  - BUG-02 FIX: REST uses 4XXError/5XXError; HTTP uses 4xx/5xx
  - 60 time-bucket alignment with 30s tolerance
  - Redis caching
  - Alert evaluation (POST to Node internal /internal/gateway-alert)
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

import boto3
import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from aws.credentials import build_boto3_kwargs, get_default_connection_credentials, get_connection_credentials, ResolvedCredentials
from cache.redis_client import cache_get, cache_set
from config import get_settings
from routers.apis import _resolve_creds_from_body

logger = logging.getLogger("routers.metrics")
router = APIRouter(tags=["API Gateway — Metrics"])

TTL_METRICS = 60   # 1 min


class MetricsRequest(BaseModel):
    connectionId: str | None = None
    region: str | None = None
    accessKeyId: str | None = None
    secretAccessKey: str | None = None
    apiId: str
    apiName: str
    protocol: str
    stage: str
    bypassCache: bool = False


@router.post("/aws/metrics")
async def get_metrics(body: MetricsRequest) -> JSONResponse:
    """
    Fetch CloudWatch metrics for an API Gateway (1-hour window, 60 buckets).
    Mirrors Node L2460 with BUG-01 and BUG-02 fixes.
    """
    creds = await _resolve_creds_from_body(body.model_dump())
    if not creds:
        return JSONResponse({"error": "Missing params"}, status_code=400)

    cache_key = f"metrics:{body.apiId}:{body.stage}"
    if not body.bypassCache:
        cached = await cache_get(cache_key)
        if cached:
            return JSONResponse(cached)

    try:
        # BUG-01 FIX: align end to minute boundary
        now = datetime.now(timezone.utc)
        end_time = now.replace(second=0, microsecond=0)
        start_time_dt = datetime.fromtimestamp(end_time.timestamp() - 3600, tz=timezone.utc)

        is_rest = body.protocol.upper() == "REST"
        dimensions = [
            {"Name": "ApiName" if is_rest else "ApiId", "Value": body.apiName if is_rest else body.apiId},
            {"Name": "Stage", "Value": body.stage},
        ]
        # BUG-02 FIX: correct metric names per protocol
        err4xx = "4XXError" if is_rest else "4xx"
        err5xx = "5XXError" if is_rest else "5xx"

        metric_queries = [
            {"Id": "requests",            "MetricStat": {"Metric": {"Namespace": "AWS/ApiGateway", "MetricName": "Count",              "Dimensions": dimensions}, "Period": 60, "Stat": "Sum"}},
            {"Id": "latency",             "MetricStat": {"Metric": {"Namespace": "AWS/ApiGateway", "MetricName": "Latency",            "Dimensions": dimensions}, "Period": 60, "Stat": "Average"}},
            {"Id": "integration_latency", "MetricStat": {"Metric": {"Namespace": "AWS/ApiGateway", "MetricName": "IntegrationLatency", "Dimensions": dimensions}, "Period": 60, "Stat": "Average"}},
            {"Id": "errors_4xx",          "MetricStat": {"Metric": {"Namespace": "AWS/ApiGateway", "MetricName": err4xx,              "Dimensions": dimensions}, "Period": 60, "Stat": "Sum"}},
            {"Id": "errors_5xx",          "MetricStat": {"Metric": {"Namespace": "AWS/ApiGateway", "MetricName": err5xx,              "Dimensions": dimensions}, "Period": 60, "Stat": "Sum"}},
        ]

        def _fetch():
            cw = boto3.client("cloudwatch", **build_boto3_kwargs(creds))
            return cw.get_metric_data(
                StartTime=start_time_dt,
                EndTime=end_time,
                MetricDataQueries=metric_queries,
                ScanBy="TimestampAscending",
            )

        cw_response = await asyncio.to_thread(_fetch)

        # Build 60 minute-aligned buckets
        end_ms = int(end_time.timestamp() * 1000)
        time_buckets = []
        for i in range(59, -1, -1):
            t_ms = end_ms - i * 60_000
            t = datetime.fromtimestamp(t_ms / 1000, tz=timezone.utc)
            time_buckets.append({
                "time_ms": t_ms,
                "label": t.strftime("%I:%M:%S %p"),
                "values": {"requests": 0, "latency": 0, "integration_latency": 0, "errors_4xx": 0, "errors_5xx": 0},
            })

        for result in cw_response.get("MetricDataResults", []):
            rid = result.get("Id")
            if not rid:
                continue
            for ts, val in zip(result.get("Timestamps", []), result.get("Values", [])):
                item_ms = int(ts.timestamp() * 1000)
                best = min(time_buckets, key=lambda b: abs(b["time_ms"] - item_ms))
                if abs(best["time_ms"] - item_ms) < 30_000:   # 30s tolerance
                    best["values"][rid] = round(val)

        data_points = [
            {
                "label": b["label"],
                "values": [
                    b["values"]["requests"],
                    b["values"]["latency"],
                    b["values"]["integration_latency"],
                    b["values"]["errors_4xx"],
                    b["values"]["errors_5xx"],
                ],
            }
            for b in time_buckets
        ]
        result_data = {"dataPoints": data_points}
        await cache_set(cache_key, result_data, TTL_METRICS)

        # Fire-and-forget alert evaluation via Node internal endpoint
        asyncio.create_task(_evaluate_alerts(body.apiId, body.stage, data_points, creds.region or "us-east-1"))

        return JSONResponse(result_data)

    except Exception as exc:
        logger.error(f"[metrics] {exc}")
        return JSONResponse({"error": str(exc)}, status_code=500)


async def _evaluate_alerts(api_id: str, stage: str, data_points: list, region: str) -> None:
    """Evaluate metric snapshot against alert rules locally and post to Node (non-blocking)."""
    try:
        total_reqs = sum(dp["values"][0] for dp in data_points)
        total_4xx  = sum(dp["values"][3] for dp in data_points)
        total_5xx  = sum(dp["values"][4] for dp in data_points)
        avg_lat    = sum(dp["values"][1] for dp in data_points) / max(len(data_points), 1)
        err_rate   = round(((total_4xx + total_5xx) / total_reqs) * 100) if total_reqs > 0 else 0

        metrics_snapshot = {
            "errorRate": err_rate,
            "avgLatency": round(avg_lat),
            "totalRequests": total_reqs,
            "status4xx": total_4xx,
            "status5xx": total_5xx,
        }

        # 1. Native Python alert evaluation & webhook dispatch
        try:
            from services.alert_evaluator import evaluate_alerts
            await evaluate_alerts(api_id, stage, metrics_snapshot)
        except Exception:
            pass

        # 2. Forward to Node internal bridge if reachable
        try:
            node_url = get_settings().node_backend_url
            async with httpx.AsyncClient(timeout=3.0) as client:
                await client.post(
                    f"{node_url}/internal/gateway-metrics-alert",
                    json={
                        "apiId": api_id, "stage": stage, "region": region,
                        **metrics_snapshot,
                    },
                )
        except Exception:
            pass
    except Exception:
        pass  # Non-critical — never fail the main response
