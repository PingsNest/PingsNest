"""
routers/gateways.py — Multi-API Gateway Fleet Summary & Compare endpoints.

Ports from server/index.ts:
  POST /api/gateways/fleet-summary   → Aggregated fleet metrics (L1597)
  POST /api/gateways/compare         → Multi-gateway side-by-side CloudWatch comparison (L1736)

Key behaviours preserved:
  - BUG-04 FIX: Never inject synthetic fake mock gateways when 0 APIs found
  - Dual v1 (REST) and v2 (HTTP/WebSocket) API discovery
  - Real stage discovery with caching
  - CloudWatch 10-minute sparkline and p99 comparison
  - Strict 10-gateway comparison limit
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
import hashlib
import logging
from typing import Any
import boto3
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from aws.credentials import (
    ResolvedCredentials,
    build_boto3_kwargs,
    get_connection_credentials,
    get_default_connection_credentials,
)
from cache.redis_client import cache_get, cache_get_or_set, cache_set

logger = logging.getLogger("gateways_router")
router = APIRouter(tags=["gateways"])

SPARKLINE_POINTS = 10


async def _resolve_creds(body: dict, explicit_region: str | None = None) -> ResolvedCredentials | None:
    connection_id: str | None = body.get("connectionId")
    if connection_id:
        creds = await get_connection_credentials(connection_id)
        if creds:
            if explicit_region:
                creds.region = explicit_region
            return creds

    creds = await get_default_connection_credentials()
    if creds:
        if explicit_region:
            creds.region = explicit_region
        return creds

    region = explicit_region or body.get("region", "us-east-1")
    access_key = body.get("accessKeyId", "")
    secret_key = body.get("secretAccessKey", "")
    if region and access_key and secret_key:
        return ResolvedCredentials(
            region=region,
            access_key_id=access_key,
            secret_access_key=secret_key,
        )

    if region:
        return ResolvedCredentials(region=region, use_default_chain=True)

    return None


def _key_hash(access_key_id: str | None) -> str:
    val = access_key_id or "imds"
    return hashlib.sha256(val.encode()).hexdigest()[:12]


# ── POST /api/gateways/fleet-summary ──────────────────────────────────────────

class FleetSummaryRequest(BaseModel):
    connectionId: str | None = None
    region: str | None = None
    accessKeyId: str | None = None
    secretAccessKey: str | None = None


@router.post("/gateways/fleet-summary")
async def fleet_summary(
    payload: FleetSummaryRequest,
    x_aws_region: str | None = Header(None, alias="x-aws-region"),
):
    body = payload.model_dump()
    region_param = x_aws_region or payload.region
    creds = await _resolve_creds(body, region_param)

    if not creds or not creds.region:
        raise HTTPException(status_code=400, detail="Missing region or credentials")

    region = creds.region
    kh = _key_hash(creds.access_key_id)
    cache_key = f"apigw:fleet-summary:{region}:{kh}"

    try:
        async def _fetch():
            return await asyncio.to_thread(_compute_fleet_summary, creds, region)

        result = await cache_get_or_set(cache_key, 30, _fetch)
        return result
    except Exception as exc:
        logger.error(f"[Fleet Summary] Error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


def _compute_fleet_summary(creds: ResolvedCredentials, region: str) -> dict:
    kwargs = build_boto3_kwargs(creds)
    v1 = boto3.client("apigateway", **kwargs)
    v2 = boto3.client("apigatewayv2", **kwargs)

    apis_list: list[dict] = []

    try:
        r1 = v1.get_rest_apis()
        for item in r1.get("items", []):
            if item.get("id") and item.get("name"):
                apis_list.append({"id": item["id"], "name": item["name"], "protocol": "REST"})
    except Exception as exc:
        logger.warning(f"[Fleet Summary] v1 GetRestApis failed: {exc}")

    try:
        r2 = v2.get_apis()
        for item in r2.get("Items", []):
            if item.get("ApiId") and item.get("Name"):
                proto = "WEBSOCKET" if item.get("ProtocolType") == "WEBSOCKET" else "HTTP"
                apis_list.append({"id": item["ApiId"], "name": item["Name"], "protocol": proto})
    except Exception as exc:
        logger.warning(f"[Fleet Summary] v2 GetApis failed: {exc}")

    # BUG-04 FIX: No longer inject synthetic fake gateways when the account returns 0 APIs
    if not apis_list:
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "fleetTotals": {
                "totalGateways": 0,
                "healthyCount": 0,
                "warningCount": 0,
                "criticalCount": 0,
                "totalFleetRequests": 0,
                "avgFleetLatency": 0,
                "lambdaFallbackCount": 0,
            },
            "gateways": [],
        }

    # Query deployed stages for each discovered gateway
    gateways: list[dict] = []
    for gw in apis_list:
        stages: list[str] = []
        try:
            if gw["protocol"] == "REST":
                r_stages = v1.get_stages(restApiId=gw["id"])
                for s in r_stages.get("item", []):
                    name = s.get("stageName") or s.get("name")
                    if name and name not in stages:
                        stages.append(name)
            else:
                r_stages = v2.get_stages(ApiId=gw["id"])
                for s in r_stages.get("Items", []):
                    name = s.get("StageName") or s.get("name")
                    if name and name not in stages:
                        stages.append(name)
        except Exception:
            pass

        fallback_stage = "prod" if gw["protocol"] == "REST" else "$default"
        default_stage = stages[0] if stages else fallback_stage

        gateways.append(
            {
                **gw,
                "region": region,
                "stage": default_stage,
                "stages": stages if stages else [default_stage],
                "requestsPerMin": 0,
                "avgLatencyMs": 0,
                "p99LatencyMs": 0,
                "errorRate4xxPct": 0,
                "errorRate5xxPct": 0,
                "healthStatus": "UNKNOWN",
                "logSource": {
                    "type": "apigateway_access_logs",
                    "label": "API Gateway",
                    "logGroup": f"API-Gateway-Execution-Logs_{gw['id']}/{default_stage}",
                },
                "metricsSimulated": False,
            }
        )

    total_fleet_requests = sum(g["requestsPerMin"] for g in gateways)
    total_weighted_latency = sum(g["avgLatencyMs"] * g["requestsPerMin"] for g in gateways)
    avg_fleet_latency = (
        round(total_weighted_latency / total_fleet_requests) if total_fleet_requests > 0 else 0
    )
    healthy_count = sum(1 for g in gateways if g["healthStatus"] == "HEALTHY")
    warning_count = sum(1 for g in gateways if g["healthStatus"] == "WARNING")
    critical_count = sum(1 for g in gateways if g["healthStatus"] == "CRITICAL")
    lambda_fallback_count = sum(1 for g in gateways if g["logSource"]["type"] == "lambda_fallback")

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "fleetTotals": {
            "totalGateways": len(gateways),
            "healthyCount": healthy_count,
            "warningCount": warning_count,
            "criticalCount": critical_count,
            "totalFleetRequests": total_fleet_requests,
            "avgFleetLatency": avg_fleet_latency,
            "lambdaFallbackCount": lambda_fallback_count,
        },
        "gateways": gateways,
    }


# ── POST /api/gateways/compare ────────────────────────────────────────────────

class CompareGatewayItem(BaseModel):
    gatewayId: str
    gatewayName: str | None = None
    stage: str
    protocol: str = "REST"
    region: str | None = None


class CompareRequest(BaseModel):
    gateways: list[CompareGatewayItem]
    connectionId: str | None = None
    region: str | None = None
    accessKeyId: str | None = None
    secretAccessKey: str | None = None


@router.post("/gateways/compare")
async def compare_gateways(
    payload: CompareRequest,
    x_aws_region: str | None = Header(None, alias="x-aws-region"),
):
    body = payload.model_dump()
    region_param = x_aws_region or payload.region
    creds = await _resolve_creds(body, region_param)

    if not creds or not creds.region:
        raise HTTPException(status_code=400, detail="Missing region or credentials")

    if not payload.gateways or len(payload.gateways) == 0:
        raise HTTPException(status_code=400, detail="gateways array required")

    if len(payload.gateways) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 gateways per compare request")

    try:
        tasks = [
            _compare_single_gateway(gw, creds, region_param or creds.region)
            for gw in payload.gateways
        ]
        results_list = await asyncio.gather(*tasks)

        results_map = {r["gatewayId"]: r for r in results_list}
        return {
            "results": results_map,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        logger.error(f"[Compare] Error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


async def _compare_single_gateway(
    gw: CompareGatewayItem,
    creds: ResolvedCredentials,
    default_region: str,
) -> dict:
    gw_region = gw.region or default_region
    cache_key = f"compare:{gw.gatewayId}:{gw.stage}"

    cached = await cache_get(cache_key)
    if cached:
        return {"gatewayId": gw.gatewayId, **cached}

    try:
        snapshot = await asyncio.to_thread(_fetch_cw_comparison, gw, creds, gw_region)
        await cache_set(cache_key, snapshot, 25)  # 25s TTL
        return {"gatewayId": gw.gatewayId, **snapshot}
    except Exception as exc:
        logger.warning(f"[Compare] Metric fetch error for {gw.gatewayId}: {exc}")
        return {
            "gatewayId": gw.gatewayId,
            "requestsPerMin": 0,
            "avgLatencyMs": 0,
            "p99LatencyMs": 0,
            "errorRate5xxPct": 0,
            "errorRate4xxPct": 0,
            "cacheHitRate": 0,
            "sparkline": [0] * SPARKLINE_POINTS,
            "latencyLine": [],
            "errorLine": [0] * SPARKLINE_POINTS,
        }


def _fetch_cw_comparison(
    gw: CompareGatewayItem,
    creds: ResolvedCredentials,
    region: str,
) -> dict:
    gw_creds = ResolvedCredentials(
        region=region,
        access_key_id=creds.access_key_id,
        secret_access_key=creds.secret_access_key,
        session_token=creds.session_token,
        use_default_chain=creds.use_default_chain,
    )
    cw = boto3.client("cloudwatch", **build_boto3_kwargs(gw_creds))

    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start_time = now - timedelta(minutes=SPARKLINE_POINTS)

    is_rest = gw.protocol.upper() == "REST"
    rest_dim_val = (
        gw.gatewayName if gw.gatewayName and gw.gatewayName != gw.gatewayId else gw.gatewayId
    )
    dim_name = "ApiName" if is_rest else "ApiId"
    dim_val = rest_dim_val if is_rest else gw.gatewayId

    dimensions = [
        {"Name": dim_name, "Value": dim_val},
        {"Name": "Stage", "Value": gw.stage},
    ]

    err4xx_name = "4XXError" if is_rest else "4xx"
    err5xx_name = "5XXError" if is_rest else "5xx"

    queries = [
        {"Id": "req", "MetricStat": {"Metric": {"Namespace": "AWS/ApiGateway", "MetricName": "Count", "Dimensions": dimensions}, "Period": 60, "Stat": "Sum"}},
        {"Id": "lat", "MetricStat": {"Metric": {"Namespace": "AWS/ApiGateway", "MetricName": "Latency", "Dimensions": dimensions}, "Period": 60, "Stat": "Average"}},
        {"Id": "lat_p99", "MetricStat": {"Metric": {"Namespace": "AWS/ApiGateway", "MetricName": "Latency", "Dimensions": dimensions}, "Period": 60, "Stat": "p99"}},
        {"Id": "e4", "MetricStat": {"Metric": {"Namespace": "AWS/ApiGateway", "MetricName": err4xx_name, "Dimensions": dimensions}, "Period": 60, "Stat": "Sum"}},
        {"Id": "e5", "MetricStat": {"Metric": {"Namespace": "AWS/ApiGateway", "MetricName": err5xx_name, "Dimensions": dimensions}, "Period": 60, "Stat": "Sum"}},
    ]

    resp = cw.get_metric_data(
        StartTime=start_time,
        EndTime=now,
        ScanBy="TimestampAscending",
        MetricDataQueries=queries,
    )

    by_id: dict[str, list[int]] = {}
    for r in resp.get("MetricDataResults", []):
        r_id = r.get("Id")
        if r_id and "Values" in r:
            by_id[r_id] = [int(round(v)) for v in r["Values"]]

    sparkline = by_id.get("req", [0] * SPARKLINE_POINTS)
    latency_line = by_id.get("lat", [])
    error_line = by_id.get("e5", [0] * SPARKLINE_POINTS)

    total_req = sum(sparkline)
    requests_per_min = round(total_req / len(sparkline)) if sparkline else 0
    avg_latency_ms = round(sum(latency_line) / len(latency_line)) if latency_line else 0
    p99_vals = by_id.get("lat_p99", [])
    p99_latency_ms = (
        round(sum(p99_vals) / len(p99_vals)) if p99_vals else round(avg_latency_ms * 2.5)
    )
    total_5xx = sum(error_line)
    total_4xx = sum(by_id.get("e4", []))
    error_rate_5xx_pct = round((total_5xx / total_req) * 100) if total_req > 0 else 0
    error_rate_4xx_pct = round((total_4xx / total_req) * 100) if total_req > 0 else 0

    return {
        "requestsPerMin": requests_per_min,
        "avgLatencyMs": avg_latency_ms,
        "p99LatencyMs": p99_latency_ms,
        "errorRate5xxPct": error_rate_5xx_pct,
        "errorRate4xxPct": error_rate_4xx_pct,
        "sparkline": sparkline,
        "latencyLine": latency_line,
        "errorLine": error_line,
    }
