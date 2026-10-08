"""
routers/apis.py — AWS API Gateway core routes (Phase 2).

Ports these Node.js routes from server/index.ts:
  POST /api/aws/apis          → list REST + HTTP/WS APIs         (L1344)
  POST /api/aws/stages        → list stages for an API           (L1383)
  POST /api/aws/routes        → list resources/routes + Lambda   (L1488)
  POST /api/aws/throttle-stage → update throttle limits          (L1318)
  POST /api/aws/test-request  → fire a test HTTP request         (L3164)
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Any

import boto3
import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from aws.credentials import (
    ResolvedCredentials,
    build_boto3_kwargs,
    get_connection_credentials,
    get_default_connection_credentials,
)
from cache.redis_client import cache_get, cache_get_or_set, cache_set

logger = logging.getLogger("routers.apis")
router = APIRouter(tags=["API Gateway — Core"])

# ── Cache TTLs (seconds) — mirrors TTL constants in Node index.ts ─────────────
TTL_APIS   = 300   # 5 min
TTL_STAGES = 300
TTL_ROUTES = 120   # 2 min


# ── Credential resolution helpers ─────────────────────────────────────────────

async def _resolve_creds_from_body(body: dict) -> ResolvedCredentials | None:
    """
    Resolve credentials from the request body, mirroring getAwsCredentialsFromReq().
    Priority: connectionId in body → default connection → env vars in body.
    """
    connection_id: str | None = body.get("connectionId")
    if connection_id:
        creds = await get_connection_credentials(connection_id)
        if creds:
            return creds

    # Try the default saved connection
    creds = await get_default_connection_credentials()
    if creds:
        return creds

    # Fallback: inline keys from the request body (legacy UI support)
    region = body.get("region", "us-east-1")
    access_key = body.get("accessKeyId", "")
    secret_key = body.get("secretAccessKey", "")
    if region and access_key and secret_key:
        return ResolvedCredentials(
            region=region,
            access_key_id=access_key,
            secret_access_key=secret_key,
        )

    # Last resort: boto3 default chain (env / instance profile)
    if region:
        return ResolvedCredentials(region=region, use_default_chain=True)

    return None


def _key_hash(access_key_id: str | None) -> str:
    """SHA-256 hash of access key ID for safe cache key — mirrors Node Bug 5 fix."""
    val = access_key_id or "imds"
    return hashlib.sha256(val.encode()).hexdigest()[:16]


def _apigw_v1(creds: ResolvedCredentials):
    return boto3.client("apigateway", **build_boto3_kwargs(creds))


def _apigw_v2(creds: ResolvedCredentials):
    return boto3.client("apigatewayv2", **build_boto3_kwargs(creds))


# ── POST /api/aws/apis ────────────────────────────────────────────────────────

class ApisRequest(BaseModel):
    connectionId: str | None = None
    region: str | None = None
    accessKeyId: str | None = None
    secretAccessKey: str | None = None


@router.post("/aws/apis")
async def list_apis(body: ApisRequest) -> JSONResponse:
    """List all REST and HTTP/WebSocket API Gateways. Mirrors Node L1344."""
    creds = await _resolve_creds_from_body(body.model_dump())
    if not creds:
        raise HTTPException(400, "AWS region is required")
    if not creds.use_default_chain and not creds.access_key_id:
        raise HTTPException(400, "Missing credentials — configure an AWS connection in Settings")

    key_hash = _key_hash(creds.access_key_id)
    cache_key = f"apis:{creds.region}:{key_hash}"

    cached = await cache_get(cache_key)
    if cached:
        return JSONResponse(cached)

    apis_list: list[dict] = []

    # REST APIs (v1)
    try:
        v1 = _apigw_v1(creds)
        r1 = await asyncio.to_thread(v1.get_rest_apis)
        for item in r1.get("items", []):
            if item.get("id") and item.get("name"):
                apis_list.append({"id": item["id"], "name": item["name"], "protocol": "REST"})
    except Exception as exc:
        logger.warning(f"[apis] REST v1: {exc}")

    # HTTP / WebSocket APIs (v2)
    try:
        v2 = _apigw_v2(creds)
        r2 = await asyncio.to_thread(v2.get_apis)
        for item in r2.get("Items", []):
            if item.get("ApiId") and item.get("Name"):
                proto = "WEBSOCKET" if item.get("ProtocolType") == "WEBSOCKET" else "HTTP"
                apis_list.append({"id": item["ApiId"], "name": item["Name"], "protocol": proto})
    except Exception as exc:
        logger.warning(f"[apis] HTTP v2: {exc}")

    result = {"apis": apis_list}
    await cache_set(cache_key, result, TTL_APIS)
    return JSONResponse(result)


# ── POST /api/aws/stages ──────────────────────────────────────────────────────

class StagesRequest(BaseModel):
    connectionId: str | None = None
    region: str | None = None
    accessKeyId: str | None = None
    secretAccessKey: str | None = None
    apiId: str
    protocol: str | None = None
    bypassCache: bool = False


@router.post("/aws/stages")
async def list_stages(
    body: StagesRequest,
    x_aws_region: str | None = Header(default=None, alias="x-aws-region"),
) -> JSONResponse:
    """List stages for an API Gateway. Mirrors Node L1383 with dual-protocol fallback."""
    creds = await _resolve_creds_from_body(body.model_dump())
    region = x_aws_region or body.region or (creds.region if creds else None)
    if not region or not body.apiId:
        raise HTTPException(400, "Missing params: apiId and region are required")
    if not creds:
        raise HTTPException(400, "Missing credentials")
    # Override region from header/body
    creds.region = region

    cache_key = f"stages:{region}:{body.apiId}:{body.protocol or 'any'}"
    if not body.bypassCache:
        cached = await cache_get(cache_key)
        if cached and not cached.get("fallback") and isinstance(cached.get("stages"), list) and len(cached["stages"]) > 0:
            return JSONResponse(cached)

    stages: list[str] = []
    aws_error: str | None = None
    is_rest = not body.protocol or body.protocol.upper() == "REST"

    def _get_stage_name(s: dict) -> str | None:
        return s.get("stageName") or s.get("StageName") or s.get("name")

    def _fetch_v1_stages():
        nonlocal aws_error
        try:
            c = _apigw_v1(creds)
            r = c.get_stages(restApiId=body.apiId)
            items = r.get("item") or r.get("items") or r.get("Items") or []
            for s in items:
                name = _get_stage_name(s)
                if name and name not in stages:
                    stages.append(name)
        except Exception as exc:
            aws_error = str(exc)
            logger.warning(f"[stages] v1 {body.apiId}/{region}: {exc}")

    def _fetch_v2_stages():
        nonlocal aws_error
        try:
            c = _apigw_v2(creds)
            r = c.get_stages(ApiId=body.apiId)
            items = r.get("Items") or r.get("items") or r.get("item") or []
            for s in items:
                name = _get_stage_name(s)
                if name and name not in stages:
                    stages.append(name)
            if stages:
                aws_error = None
        except Exception as exc:
            logger.warning(f"[stages] v2 {body.apiId}/{region}: {exc}")

    if is_rest:
        await asyncio.to_thread(_fetch_v1_stages)
        if not stages:
            await asyncio.to_thread(_fetch_v2_stages)
    else:
        await asyncio.to_thread(_fetch_v2_stages)
        if not stages:
            await asyncio.to_thread(_fetch_v1_stages)

    logger.info(f"[stages] Found {len(stages)} stage(s) for {body.apiId} in {region}: {stages}")

    is_fallback = len(stages) == 0
    default_placeholder = "prod" if body.protocol == "REST" else "$default"
    result = {
        "stages": stages,
        "fallbackStages": [default_placeholder] if is_fallback else [],
        "fallback": is_fallback,
        "warning": (f"AWS error: {aws_error}" if aws_error else "No deployed stages found for this API Gateway in AWS.") if is_fallback else None,
        "error": aws_error if (is_fallback and aws_error) else None,
    }

    if not is_fallback:
        await cache_set(cache_key, result, TTL_STAGES)
    return JSONResponse(result)


# ── POST /api/aws/routes ──────────────────────────────────────────────────────

class RoutesRequest(BaseModel):
    connectionId: str | None = None
    region: str | None = None
    accessKeyId: str | None = None
    secretAccessKey: str | None = None
    apiId: str
    protocol: str
    bypassCache: bool = False


def _parse_lambda_name(uri: str | None, int_type: str | None) -> str | None:
    """Extract Lambda function name from integration URI — mirrors parseLambdaName()."""
    if not uri:
        return "Mock (CORS)" if int_type == "MOCK" else None
    if ":function:" in uri:
        parts = uri.split(":function:")
        if len(parts) > 1:
            return parts[1].split("/")[0].split(":")[0]
    if "/functions/" in uri:
        parts = uri.split("/functions/")
        if len(parts) > 1:
            raw = parts[1].split("/")[0]
            if ":function:" in raw:
                return raw.split(":function:")[1].split("/")[0]
            if not raw.startswith("arn:"):
                return raw
    return int_type or None


@router.post("/aws/routes")
async def list_routes(body: RoutesRequest) -> JSONResponse:
    """List routes/resources with Lambda integration info. Mirrors Node L1488."""
    creds = await _resolve_creds_from_body(body.model_dump())
    if not creds or not creds.region:
        raise HTTPException(400, "Missing params")
    if not body.apiId or not body.protocol:
        raise HTTPException(400, "Missing params")

    cache_key = f"routes:{body.apiId}:{body.protocol}"
    if not body.bypassCache:
        cached = await cache_get(cache_key)
        if cached:
            return JSONResponse(cached)

    routes: list[dict] = []

    def _fetch_rest_routes():
        c = _apigw_v1(creds)
        position = None
        while True:
            kwargs: dict = {"restApiId": body.apiId, "limit": 500}
            if position:
                kwargs["position"] = position
            r = c.get_resources(**kwargs)
            position = r.get("position")
            for item in r.get("items", []):
                path = item.get("path")
                if not path:
                    continue
                methods = item.get("resourceMethods") or {}
                if not methods:
                    routes.append({"method": "ANY", "path": path})
                    continue
                for method in methods:
                    try:
                        integ = c.get_integration(restApiId=body.apiId, resourceId=item["id"], httpMethod=method)
                        int_type = integ.get("type")
                        lambda_name = _parse_lambda_name(integ.get("uri"), int_type)
                        routes.append({"method": method, "path": path, "lambdaName": lambda_name, "integrationType": int_type})
                    except Exception:
                        routes.append({"method": method, "path": path})
            if not position:
                break

    def _fetch_http_routes():
        c = _apigw_v2(creds)
        # Build integration map
        integ_map: dict[str, dict] = {}
        next_token = None
        while True:
            kwargs: dict = {"ApiId": body.apiId, "MaxResults": "500"}
            if next_token:
                kwargs["NextToken"] = next_token
            r = c.get_integrations(**kwargs)
            for integ in r.get("Items", []):
                iid = integ.get("IntegrationId")
                if iid:
                    integ_map[iid] = {
                        "lambdaName": _parse_lambda_name(integ.get("IntegrationUri"), integ.get("IntegrationType")),
                        "type": integ.get("IntegrationType"),
                    }
            next_token = r.get("NextToken")
            if not next_token:
                break

        # Fetch routes
        next_token = None
        while True:
            kwargs = {"ApiId": body.apiId, "MaxResults": "500"}
            if next_token:
                kwargs["NextToken"] = next_token
            r = c.get_routes(**kwargs)
            for item in r.get("Items", []):
                route_key = item.get("RouteKey", "")
                if not route_key:
                    continue
                parts = route_key.split(" ")
                target = item.get("Target", "").replace("integrations/", "")
                integ_info = integ_map.get(target, {})
                if len(parts) == 2:
                    routes.append({"method": parts[0], "path": parts[1], **integ_info})
                else:
                    routes.append({"method": "ANY", "path": route_key, **integ_info})
            next_token = r.get("NextToken")
            if not next_token:
                break

    try:
        if body.protocol.upper() == "REST":
            await asyncio.to_thread(_fetch_rest_routes)
        else:
            await asyncio.to_thread(_fetch_http_routes)
    except Exception as exc:
        raise HTTPException(500, str(exc))

    result = {"routes": routes}
    await cache_set(cache_key, result, TTL_ROUTES)
    return JSONResponse(result)


# ── POST /api/aws/throttle-stage ─────────────────────────────────────────────

class ThrottleRequest(BaseModel):
    connectionId: str | None = None
    region: str | None = None
    accessKeyId: str | None = None
    secretAccessKey: str | None = None
    apiId: str
    stage: str
    throttlingBurstLimit: int = 500
    throttlingRateLimit: int = 1000


@router.post("/aws/throttle-stage")
async def throttle_stage(body: ThrottleRequest) -> JSONResponse:
    """Update throttling limits for an API Gateway stage. Mirrors Node L1318."""
    creds = await _resolve_creds_from_body(body.model_dump())
    if not creds or not creds.region:
        raise HTTPException(400, "Missing required parameters")
    if creds.use_default_chain and not creds.access_key_id:
        pass  # env/instance profile — allowed
    elif not creds.access_key_id:
        raise HTTPException(400, "AWS credentials required to update throttling")

    def _do_throttle():
        c = _apigw_v1(creds)
        c.update_stage(
            restApiId=body.apiId,
            stageName=body.stage,
            patchOperations=[
                {"op": "replace", "path": "/*/*/throttling/burstLimit", "value": str(body.throttlingBurstLimit)},
                {"op": "replace", "path": "/*/*/throttling/rateLimit",  "value": str(body.throttlingRateLimit)},
            ],
        )

    try:
        await asyncio.to_thread(_do_throttle)
        return JSONResponse({"success": True, "message": f"Throttling updated for stage {body.stage}: Burst={body.throttlingBurstLimit}, Rate={body.throttlingRateLimit}"})
    except Exception as exc:
        logger.error(f"[throttle] AWS UpdateStage failed: {exc}")
        raise HTTPException(502, f"AWS rejected the throttle update: {exc}")


# ── POST /api/aws/test-request ────────────────────────────────────────────────

class TestRequestBody(BaseModel):
    url: str
    method: str = "GET"
    headers: dict | None = None
    body: str | None = None
    timeout: int = 10


@router.post("/aws/test-request")
async def test_request(req_body: TestRequestBody) -> JSONResponse:
    """Fire a test HTTP request and return status/latency. Mirrors Node L3164."""
    import time
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=req_body.timeout, follow_redirects=True) as client:
            resp = await client.request(
                method=req_body.method.upper(),
                url=req_body.url,
                headers=req_body.headers or {},
                content=req_body.body.encode() if req_body.body else None,
            )
        latency_ms = int((time.time() - start) * 1000)
        return JSONResponse({
            "success": True,
            "statusCode": resp.status_code,
            "latencyMs": latency_ms,
            "headers": dict(resp.headers),
            "body": resp.text[:4096],
        })
    except httpx.TimeoutException:
        return JSONResponse({"success": False, "error": "Request timed out"}, status_code=504)
    except Exception as exc:
        return JSONResponse({"success": False, "error": str(exc)}, status_code=502)
