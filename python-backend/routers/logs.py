"""
routers/logs.py — CloudWatch Logs endpoints (Phase 3).

Ports from server/index.ts:
  POST /api/aws/logs              - fetch + parse + upsert gateway logs  (L2591)
  POST /api/aws/logs/clear        - delete logs for apiId/stage          (L3074)
  POST /api/aws/logs/rotate       - rotate logs by interval              (L3102)
  GET  /api/aws/logs/rotation-config                                      (L3134)
  POST /api/aws/logs/rotation-config                                      (L3147)
  POST /api/aws/log-groups        - list CloudWatch log groups           (L3194)

Key behaviours preserved:
  - Bug 8: hard cap at 40 pages with truncation flag
  - Direct stream reader fallback when FilterLogEvents returns 0
  - Batched log group requests (5 at a time, 150ms delay)
  - Full log parsing pipeline: JSON struct → request grouping → status extraction
  - Upsert into gateway_logs TimescaleDB table (50-row chunks)
  - Stored-history fallback queries
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any

import boto3
import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from aws.credentials import build_boto3_kwargs
from cache.redis_client import cache_get, cache_set
from config import get_settings
from db.pool import execute, query, query_one
from routers.apis import _resolve_creds_from_body

logger = logging.getLogger("routers.logs")
router = APIRouter(tags=["API Gateway — Logs"])

TTL_LOGS_LIVE  = 30   # seconds
TTL_LOG_GROUPS = 300


# ── Log parsing helpers ────────────────────────────────────────────────────────

STATUS_PATTERNS = [
    re.compile(r'"statusCode"\s*:\s*(\d{3})\b'),
    re.compile(r'"status"\s*:\s*(\d{3})\b'),
    re.compile(r'"httpStatus"\s*:\s*(\d{3})\b'),
    re.compile(r'status_code\s*[:=]\s*"?(\d{3})"?\b', re.IGNORECASE),
    re.compile(r'statusCode\s*[:=]\s*"?(\d{3})"?\b', re.IGNORECASE),
    re.compile(r'\bstatus\s*[:=]\s*"?(\d{3})"?\b', re.IGNORECASE),
    re.compile(r'HTTP/1\.[01]\s+(\d{3})\b', re.IGNORECASE),
    re.compile(r'HTTP/2\s+(\d{3})\b', re.IGNORECASE),
    re.compile(r'\bMethod completed with status:\s*(\d{3})\b', re.IGNORECASE),
    re.compile(r'\bMethod response status:\s*(\d{3})\b', re.IGNORECASE),
    re.compile(r'\bEndpoint response status:\s*(\d{3})\b', re.IGNORECASE),
]

METHOD_ROUTE_RE = re.compile(r'\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(/[^\s,]*)')
HTTP_METHOD_RE  = re.compile(r'HTTP Method:\s*(\w+)[,\s]+Resource Path:\s*([^\s,\n]+)', re.IGNORECASE)
LATENCY_RE      = re.compile(r'Duration:\s+([\d.]+)\s+ms')
LATENCY_MS_RE   = re.compile(r'latency:\s*(\d+)\s*ms', re.IGNORECASE)


def _extract_status(msg: str, is_lambda: bool) -> int | None:
    """Extract HTTP status code from a log line. Mirrors extractStatusCodeFromLogMessage()."""
    # Skip Lambda system lines
    for prefix in ("REPORT RequestId:", "START RequestId:", "END RequestId:", "XRAY TraceId:"):
        if msg.startswith(prefix):
            return None

    for kw, sc in (
        ("Method response status:", None),
        ("Method completed with status:", None),
        ("Endpoint response status:", None),
    ):
        if kw in msg:
            try:
                v = int(msg.split(kw)[1].strip().split()[0])
                if 100 <= v < 600:
                    return v
            except Exception:
                pass

    if "{" in msg and "}" in msg:
        try:
            p = json.loads(msg)
            for k in ("statusCode", "status", "httpStatus", "responseStatus", "status_code"):
                v = p.get(k)
                if v is not None:
                    try:
                        sc = int(v)
                        if 100 <= sc < 600:
                            return sc
                    except Exception:
                        pass
        except Exception:
            pass

    for pat in STATUS_PATTERNS:
        m = pat.search(msg)
        if m:
            sc = int(m.group(1))
            if 100 <= sc < 600:
                return sc

    if "Task timed out" in msg:
        return 504
    if "Memory size limit exceeded" in msg or "Process exited before completing" in msg:
        return 502
    if any(k in msg for k in ("Execution failed due to", "UnhandledPromiseRejection", "Runtime.ExitError")):
        return 500

    return None


def _clean_lambda_route(log_group: str) -> tuple[str, str]:
    """Derive route and method from a Lambda log group name."""
    name = log_group.replace("/aws/lambda/", "")
    # kebab-case function name heuristics
    if "-get-" in name or name.endswith("-get"):
        return "/", "GET"
    if "-post-" in name or name.endswith("-post"):
        return "/", "POST"
    return f"/{name}", "POST"


def _parse_logs(events: list[dict], custom_log_group: str) -> list[dict]:
    """Full log parsing pipeline mirroring Node's parsedLogs construction."""
    events_sorted = sorted(events, key=lambda e: e.get("timestamp") or 0)
    parsed: list[dict] = []
    request_groups: dict[str, dict] = {}
    stream_last_req_id: dict[str, str] = {}
    uuid_re = re.compile(r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})', re.IGNORECASE)

    for event in events_sorted:
        log_group  = event.get("logGroupName") or custom_log_group or ""
        log_stream = event.get("logStreamName") or "default-stream"
        message    = event.get("message") or ""
        ts_ms      = event.get("timestamp") or int(time.time() * 1000)
        date_obj   = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
        time_str   = date_obj.strftime("%I:%M:%S %p")
        full_time  = date_obj.isoformat()

        # Structured JSON log
        stripped = message.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            try:
                p = json.loads(stripped)
                if p.get("requestId"):
                    sc_raw = p.get("status") or p.get("statusCode") or p.get("httpStatus") or p.get("responseStatus") or p.get("status_code") or 200
                    try:
                        sc = int(sc_raw)
                        if not (100 <= sc < 600):
                            sc = 200
                    except Exception:
                        sc = 200
                    parsed.append({
                        "id": p["requestId"], "timestamp": time_str, "fullTime": full_time,
                        "method": p.get("httpMethod", "GET"),
                        "route": p.get("routeKey") or p.get("resourcePath") or p.get("path") or p.get("route") or "/",
                        "statusCode": sc,
                        "latency": int(p.get("latency", 5)) if p.get("latency") else 5,
                        "integrationLatency": int(p.get("integrationLatency", 0)) if p.get("integrationLatency") else 0,
                        "cacheHit": p.get("xCache") == "HIT",
                        "clientIp": p.get("ip", "127.0.0.1"),
                        "requestId": p["requestId"],
                        "userAgent": p.get("userAgent", "AWS-Monitor"),
                        "rawLogs": [message],
                    })
                    stream_last_req_id[log_stream] = p["requestId"]
                    continue
            except Exception:
                pass

        # Extract or inherit requestId
        m = uuid_re.search(message)
        req_id = m.group(1) if m else None
        if req_id:
            stream_last_req_id[log_stream] = req_id
        else:
            req_id = stream_last_req_id.get(log_stream)
        if not req_id:
            continue

        is_lambda = "/aws/lambda/" in log_group
        if req_id not in request_groups:
            route, method = ("/", "GET")
            if is_lambda:
                route, method = _clean_lambda_route(log_group)
            request_groups[req_id] = {
                "id": req_id, "timestamp": time_str, "fullTime": full_time,
                "requestId": req_id, "clientIp": "", "method": method, "route": route,
                "userAgent": "AWS-Lambda" if is_lambda else "AWS-Gateway-SDK",
                "statusCode": 200, "latency": 0 if is_lambda else 15,
                "integrationLatency": 0 if is_lambda else 10, "rawLogs": [],
            }

        grp = request_groups[req_id]
        clean = (
            re.sub(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+[a-f0-9-]+\s+', '', message).strip()
            if is_lambda else
            re.sub(r'^\([^)]+\)\s+', '', message).strip()
        )
        grp["rawLogs"].append(message.rstrip())

        # Status extraction with priority (5XX > 4XX > 2XX)
        sc = _extract_status(clean, is_lambda)
        if sc:
            cur = grp["statusCode"]
            if sc >= 500 or (sc >= 400 and cur < 500) or cur == 200:
                grp["statusCode"] = sc

        if is_lambda:
            # Parse JSON body for route/method/IP
            if not grp["route"] and clean.strip().startswith("{"):
                try:
                    p = json.loads(clean)
                    hm = p.get("httpMethod") or (p.get("requestContext") or {}).get("http", {}).get("method")
                    rp = p.get("path") or p.get("resource") or (p.get("requestContext") or {}).get("http", {}).get("path")
                    if hm and rp:
                        grp["method"] = hm; grp["route"] = rp
                    ip = (p.get("requestContext") or {}).get("identity", {}).get("sourceIp") or \
                         (p.get("headers") or {}).get("X-Forwarded-For", "")
                    if ip and not grp["clientIp"]:
                        grp["clientIp"] = ip.split(",")[0].strip()
                except Exception:
                    pass

            # Fallback method/route extraction
            if not grp["route"]:
                m2 = METHOD_ROUTE_RE.search(clean)
                if m2:
                    grp["method"] = m2.group(1); grp["route"] = m2.group(2)

            # REPORT line → duration
            if "REPORT RequestId:" in clean:
                d = LATENCY_RE.search(clean)
                if d:
                    ms = round(float(d.group(1)))
                    grp["latency"] = ms; grp["integrationLatency"] = ms

            if any(k in clean for k in ("ERROR", "Exception", "Runtime.ExitError")):
                if grp["statusCode"] < 400:
                    grp["statusCode"] = 500
        else:
            hm = HTTP_METHOD_RE.search(clean)
            if hm:
                grp["method"] = hm.group(1).upper()
                rp = hm.group(2).strip()
                if rp and rp not in ("{}", "null"):
                    grp["route"] = rp
            if "Method request method:" in clean:
                v = clean.split("Method request method:")[1].strip().split()[0]
                if v:
                    grp["method"] = v.upper()
            if "Method request path:" in clean:
                v = clean.split("Method request path:")[1].strip().split()[0]
                if v and v not in ("{}", "null"):
                    grp["route"] = v
            lm = LATENCY_MS_RE.search(clean)
            if lm:
                grp["integrationLatency"] = int(lm.group(1))
            if "Execution failed due to" in clean or "5XX" in clean:
                if not grp["statusCode"] or grp["statusCode"] < 400:
                    grp["statusCode"] = 500

    for grp in request_groups.values():
        parsed.append({
            "id": grp["id"], "timestamp": grp["timestamp"], "fullTime": grp["fullTime"],
            "method": grp.get("method") or "POST", "route": grp.get("route") or "/",
            "statusCode": grp.get("statusCode") or 200, "latency": grp.get("latency") or 15,
            "integrationLatency": grp.get("integrationLatency") or 10,
            "cacheHit": any("Cache hit" in l for l in grp["rawLogs"]),
            "clientIp": grp.get("clientIp") or "Unknown",
            "requestId": grp["requestId"],
            "userAgent": grp.get("userAgent"),
            "rawLogs": grp["rawLogs"],
        })

    # Final fallback: raw events if no request groups were built
    if not parsed and events_sorted:
        for ev in events_sorted:
            msg  = ev.get("message", "")
            d    = datetime.fromtimestamp((ev.get("timestamp") or int(time.time() * 1000)) / 1000, tz=timezone.utc)
            m2   = METHOD_ROUTE_RE.search(msg)
            mth  = m2.group(1) if m2 else "LOG"
            rte  = m2.group(2) if m2 else "/log-event"
            sc   = _extract_status(msg, False) or (500 if ("ERROR" in msg or "Exception" in msg) else 200)
            parsed.append({
                "id": ev.get("eventId") or str(time.time()),
                "timestamp": d.strftime("%I:%M:%S %p"), "fullTime": d.isoformat(),
                "method": mth, "route": rte, "statusCode": sc,
                "latency": 0, "integrationLatency": 0, "cacheHit": False,
                "clientIp": "Unknown", "requestId": ev.get("eventId") or "raw",
                "userAgent": "CloudWatch", "rawLogs": [msg],
            })
    return parsed


# ── CloudWatch helpers ─────────────────────────────────────────────────────────

def _fetch_group_events(client, log_group: str, start_ms: int, end_ms: int) -> tuple[list, bool]:
    """FilterLogEvents with 40-page cap + truncation flag (Bug 8 fix)."""
    all_events: list = []
    next_token = None
    page_count = 0
    truncated = False
    while True:
        kwargs: dict = {"logGroupName": log_group, "startTime": start_ms, "endTime": end_ms, "limit": 500}
        if next_token:
            kwargs["nextToken"] = next_token
        r = client.filter_log_events(**kwargs)
        for ev in r.get("events", []):
            all_events.append({**ev, "logGroupName": log_group})
        next_token = r.get("nextToken")
        page_count += 1
        if page_count >= 40 and next_token:
            truncated = True
            break
        if not next_token:
            break
    logger.info(f"[logs] {log_group}: {len(all_events)} events ({page_count} page(s){'  TRUNCATED' if truncated else ''})")
    return all_events, truncated


def _fetch_stream_events(client, log_group: str) -> list:
    """Direct stream reader fallback — top 5 most-recent streams, 500 events each."""
    all_events: list = []
    try:
        sr = client.describe_log_streams(logGroupName=log_group, orderBy="LastEventTime", descending=True, limit=5)
        for st in sr.get("logStreams", []):
            sname = st.get("logStreamName")
            if not sname:
                continue
            er = client.get_log_events(logGroupName=log_group, logStreamName=sname, startFromHead=False, limit=500)
            for ev in er.get("events", []):
                all_events.append({**ev, "logGroupName": log_group, "logStreamName": sname})
    except Exception as exc:
        logger.warning(f"[logs stream] {log_group}: {exc}")
    return all_events


async def _fetch_groups_batched(creds, groups: list[str], start_ms: int, end_ms: int) -> tuple[list, bool]:
    """Fetch multiple log groups in batches of 5 with 150ms inter-batch delay."""
    all_events: list = []
    any_truncated = False

    def _batch(batch_groups):
        client = boto3.client("logs", **build_boto3_kwargs(creds))
        batch_result = []
        trunc = False
        for g in batch_groups:
            try:
                evs, t = _fetch_group_events(client, g, start_ms, end_ms)
                batch_result.extend(evs)
                if t:
                    trunc = True
            except Exception as exc:
                logger.warning(f"[logs] batch warning {g}: {exc}")
        return batch_result, trunc

    for i in range(0, len(groups), 5):
        batch = groups[i : i + 5]
        evs, trunc = await asyncio.to_thread(_batch, batch)
        all_events.extend(evs)
        if trunc:
            any_truncated = True
        if i + 5 < len(groups):
            await asyncio.sleep(0.15)

    # Stream fallback if everything returned 0
    if not all_events and groups:
        def _stream_all():
            client = boto3.client("logs", **build_boto3_kwargs(creds))
            result = []
            for g in groups[:10]:
                result.extend(_fetch_stream_events(client, g))
            return result
        all_events = await asyncio.to_thread(_stream_all)

    return all_events, any_truncated


# ── POST /api/aws/logs ─────────────────────────────────────────────────────────

class LogsRequest(BaseModel):
    connectionId: str | None = None
    region: str | None = None
    accessKeyId: str | None = None
    secretAccessKey: str | None = None
    apiId: str
    stage: str
    customLogGroup: str | None = None
    startTime: int | None = None
    endTime: int | None = None
    liveWindow: int = 30
    bypassCache: bool = False


@router.post("/aws/logs")
async def get_logs(body: LogsRequest) -> JSONResponse:
    """
    Fetch, parse and upsert CloudWatch gateway logs. Mirrors Node L2591.
    Supports: direct log group, __lambdas__ auto-discovery, multi-group list.
    """
    creds = await _resolve_creds_from_body(body.model_dump())
    if not creds:
        return JSONResponse({"error": "Missing params"}, status_code=400)

    live_window_min = body.liveWindow or 30
    is_history = body.startTime is not None
    clg = (body.customLogGroup or "")[:60] if body.customLogGroup else "default"
    cache_key = f"logs:{body.apiId}:{body.stage}:{body.startTime or 'live'}:{body.endTime or 'live'}:{clg}"

    if not body.bypassCache and not is_history:
        cached = await cache_get(cache_key)
        if cached and isinstance(cached.get("logs"), list) and cached["logs"]:
            return JSONResponse({**cached, "fromCache": True})

    end_ms = body.endTime if is_history else int(time.time() * 1000)
    start_ms = body.startTime if is_history else end_ms - live_window_min * 60_000

    events: list[dict] = []
    truncated = False
    is_access_denied = False
    logs_error: str | None = None

    cg = body.customLogGroup or ""

    if cg in ("__lambdas__",) or cg.startswith("__lambdas_list__:") or cg.startswith("__lambdas_list__ReferencePrefix:"):
        target_groups: list[str] = []

        if cg.startswith("__lambdas_list__:") or cg.startswith("__lambdas_list__ReferencePrefix:"):
            list_str = re.sub(r'^__lambdas_list__(ReferencePrefix)?:', '', cg)
            target_groups = [g for g in list_str.split(",") if g]
        else:
            # Auto-discover log groups from stage access log ARN + Lambda integrations
            def _discover():
                groups: list[str] = []
                functions: set[str] = set()
                gw1 = boto3.client("apigateway", **build_boto3_kwargs(creds))
                gw2 = boto3.client("apigatewayv2", **build_boto3_kwargs(creds))

                # Stage access log group
                for fetch_stage in [
                    lambda: gw1.get_stage(restApiId=body.apiId, stageName=body.stage).get("accessLogSettings", {}).get("destinationArn"),
                    lambda: gw2.get_stage(ApiId=body.apiId, StageName=body.stage).get("AccessLogSettings", {}).get("DestinationArn"),
                ]:
                    try:
                        arn = fetch_stage()
                        if arn:
                            parts = arn.split(":log-group:")
                            if len(parts) == 2:
                                groups.append(parts[1])
                                break
                    except Exception:
                        pass

                # Lambda functions from integrations
                try:
                    r = gw2.get_integrations(ApiId=body.apiId)
                    for integ in r.get("Items", []):
                        m = re.search(r':function:([^/:]+)', integ.get("IntegrationUri", ""))
                        if m:
                            functions.add(m.group(1))
                except Exception:
                    pass

                try:
                    r = gw1.get_resources(restApiId=body.apiId, limit=100)
                    for item in r.get("items", []):
                        for method in item.get("resourceMethods", {}):
                            try:
                                integ = gw1.get_integration(restApiId=body.apiId, resourceId=item["id"], httpMethod=method)
                                m = re.search(r':function:([^/:]+)', integ.get("uri", ""))
                                if m:
                                    functions.add(m.group(1))
                            except Exception:
                                pass
                except Exception:
                    pass

                for fn in functions:
                    groups.append(f"/aws/lambda/{fn}")
                return groups

            try:
                target_groups = await asyncio.to_thread(_discover)
            except Exception as exc:
                logs_error = str(exc)

        if target_groups:
            events, truncated = await _fetch_groups_batched(creds, target_groups, start_ms, end_ms)
        else:
            fallback_group = f"API-Gateway-Execution-Logs_{body.apiId}/{body.stage}"
            try:
                def _fb():
                    c = boto3.client("logs", **build_boto3_kwargs(creds))
                    return _fetch_group_events(c, fallback_group, start_ms, end_ms)
                events, truncated = await asyncio.to_thread(_fb)
            except Exception:
                pass
    else:
        log_group_name = cg or f"API-Gateway-Execution-Logs_{body.apiId}/{body.stage}"
        try:
            def _single():
                c = boto3.client("logs", **build_boto3_kwargs(creds))
                evs, trunc = _fetch_group_events(c, log_group_name, start_ms, end_ms)
                if not evs:
                    evs = _fetch_stream_events(c, log_group_name)
                    trunc = False
                return evs, trunc
            events, truncated = await asyncio.to_thread(_single)
        except Exception as exc:
            logs_error = str(exc)
            if "AccessDenied" in str(exc) or "not authorized" in str(exc).lower():
                is_access_denied = True

    # Parse log events
    parsed_logs = _parse_logs(events, body.customLogGroup or "")

    # Upsert into TimescaleDB in 50-row chunks
    if parsed_logs:
        async def _upsert():
            chunk_size = 50
            for i in range(0, len(parsed_logs), chunk_size):
                chunk = parsed_logs[i : i + chunk_size]
                await asyncio.gather(*(
                    _insert_log(body.apiId, body.stage, log, body.customLogGroup)
                    for log in chunk
                ))
            logger.info(f"[logs DB] Saved {len(parsed_logs)} logs for {body.apiId}/{body.stage}")
        asyncio.create_task(_upsert())

    # Query final window from DB
    final_logs, is_stored_fallback = await _query_final_logs(body.apiId, body.stage, start_ms, end_ms, is_history, live_window_min, parsed_logs)

    response_data = {
        "logs": final_logs,
        "error": logs_error,
        "isAccessDenied": is_access_denied,
        "isStoredFallback": is_stored_fallback,
        "truncated": truncated,
        "fromCache": False,
    }

    if not is_history and final_logs:
        await cache_set(cache_key, response_data, TTL_LOGS_LIVE)

    return JSONResponse(response_data)


async def _insert_log(api_id: str, stage: str, log: dict, custom_log_group: str | None) -> None:
    try:
        await execute(
            """INSERT INTO gateway_logs
               ("apiId", stage, id, timestamp, "fullTime", method, route, "statusCode",
                latency, "integrationLatency", "cacheHit", "clientIp", "userAgent", "rawLogs", "customLogGroup")
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
               ON CONFLICT ("apiId", stage, id, "fullTime") DO UPDATE SET
                 method=EXCLUDED.method, route=EXCLUDED.route,
                 "statusCode"=EXCLUDED."statusCode", latency=EXCLUDED.latency,
                 "integrationLatency"=EXCLUDED."integrationLatency", "cacheHit"=EXCLUDED."cacheHit",
                 "clientIp"=EXCLUDED."clientIp", "userAgent"=EXCLUDED."userAgent",
                 "rawLogs"=EXCLUDED."rawLogs" """,
            api_id, stage, log["id"], log["timestamp"], log["fullTime"],
            log["method"], log["route"], log["statusCode"], log["latency"],
            log["integrationLatency"], log["cacheHit"], log["clientIp"],
            log.get("userAgent"), json.dumps(log.get("rawLogs") or []),
            custom_log_group or "default",
        )
    except Exception as exc:
        logger.warning(f"[logs DB] Row skipped: {exc}")


async def _query_final_logs(api_id: str, stage: str, start_ms: int, end_ms: int, is_history: bool, live_window_min: int, parsed_logs: list) -> tuple[list, bool]:
    is_stored_fallback = False
    try:
        if is_history:
            rows = await query(
                'SELECT * FROM gateway_logs WHERE "apiId"=$1 AND stage=$2 AND "fullTime">=$3 AND "fullTime"<=$4 ORDER BY "fullTime" DESC',
                api_id, stage,
                datetime.fromtimestamp(start_ms / 1000, tz=timezone.utc).isoformat(),
                datetime.fromtimestamp(end_ms / 1000, tz=timezone.utc).isoformat(),
            )
            if not rows:
                rows = await query('SELECT * FROM gateway_logs WHERE "apiId"=$1 AND stage=$2 ORDER BY "fullTime" DESC LIMIT 500', api_id, stage)
                if rows:
                    is_stored_fallback = True
        else:
            window_start = datetime.fromtimestamp((int(time.time() * 1000) - live_window_min * 60_000) / 1000, tz=timezone.utc).isoformat()
            rows = await query('SELECT * FROM gateway_logs WHERE "apiId"=$1 AND stage=$2 AND "fullTime">=$3 ORDER BY "fullTime" DESC', api_id, stage, window_start)
            if not rows:
                rows = await query('SELECT * FROM gateway_logs WHERE "apiId"=$1 AND stage=$2 ORDER BY "fullTime" DESC LIMIT 500', api_id, stage)
                if rows:
                    is_stored_fallback = True

        final = [_row_to_log(r) for r in rows] if rows else []
        if not final and parsed_logs:
            final = sorted(parsed_logs, key=lambda l: l.get("fullTime", ""), reverse=True)
        return final, is_stored_fallback
    except Exception as exc:
        logger.error(f"[logs DB] Query error: {exc}")
        return sorted(parsed_logs, key=lambda l: l.get("fullTime", ""), reverse=True), False


def _row_to_log(r: dict) -> dict:
    raw = r.get("rawLogs")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = []
    ft = r.get("fullTime")
    return {
        "id": r["id"], "timestamp": r["timestamp"],
        "fullTime": ft.isoformat() if hasattr(ft, "isoformat") else ft,
        "method": r["method"], "route": r["route"], "statusCode": r["statusCode"],
        "latency": r["latency"], "integrationLatency": r["integrationLatency"],
        "cacheHit": r["cacheHit"], "clientIp": r["clientIp"],
        "requestId": r["id"], "userAgent": r.get("userAgent"), "rawLogs": raw or [],
    }


# ── POST /api/aws/logs/clear ──────────────────────────────────────────────────

class LogsClearRequest(BaseModel):
    apiId: str
    stage: str


@router.post("/aws/logs/clear")
async def clear_logs(body: LogsClearRequest) -> JSONResponse:
    """Delete all gateway_logs for an apiId/stage. Mirrors Node L3074."""
    if not body.apiId or not body.stage:
        return JSONResponse({"error": "Missing params (apiId, stage)"}, status_code=400)
    try:
        await execute('DELETE FROM gateway_logs WHERE "apiId"=$1 AND stage=$2', body.apiId, body.stage)
        return JSONResponse({"success": True, "via": "direct"})
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


# ── POST /api/aws/logs/rotate ─────────────────────────────────────────────────

class RotateRequest(BaseModel):
    interval: str = "30 days"
    apiId: str | None = None
    stage: str | None = None


@router.post("/aws/logs/rotate")
async def rotate_logs(body: RotateRequest) -> JSONResponse:
    """Rotate (delete old) gateway_logs by interval. Mirrors Node L3102."""
    try:
        if body.apiId and body.stage:
            await execute(
                'DELETE FROM gateway_logs WHERE "apiId"=$1 AND stage=$2 AND "fullTime" < NOW() - $3::interval',
                body.apiId, body.stage, body.interval,
            )
        else:
            await execute('DELETE FROM gateway_logs WHERE "fullTime" < NOW() - $1::interval', body.interval)
        return JSONResponse({"success": True, "interval": body.interval, "via": "direct"})
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


# ── GET/POST /api/aws/logs/rotation-config ────────────────────────────────────

@router.get("/aws/logs/rotation-config")
async def get_rotation_config(apiId: str = "", stage: str = "*") -> JSONResponse:
    """Get log rotation config for an API/stage. Mirrors Node L3134."""
    try:
        row = await query_one('SELECT * FROM log_rotation_config WHERE "apiId"=$1 AND stage=$2', apiId, stage)
        return JSONResponse({"config": dict(row) if row else {"apiId": apiId, "stage": stage, "interval": os.getenv("LOG_ROTATION_INTERVAL", "30 days")}})
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


class RotationConfigBody(BaseModel):
    apiId: str
    stage: str = "*"
    interval: str


@router.post("/aws/logs/rotation-config")
async def set_rotation_config(body: RotationConfigBody) -> JSONResponse:
    """Upsert log rotation config. Mirrors Node L3147."""
    if not body.apiId or not body.interval:
        return JSONResponse({"error": "Missing params (apiId, interval)"}, status_code=400)
    try:
        await execute(
            'INSERT INTO log_rotation_config ("apiId", stage, interval, "updatedAt") VALUES ($1,$2,$3,NOW()) '
            'ON CONFLICT ("apiId", stage) DO UPDATE SET interval=EXCLUDED.interval, "updatedAt"=NOW()',
            body.apiId, body.stage, body.interval,
        )
        return JSONResponse({"success": True, "apiId": body.apiId, "stage": body.stage, "interval": body.interval})
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


# ── POST /api/aws/log-groups ──────────────────────────────────────────────────

class LogGroupsRequest(BaseModel):
    connectionId: str | None = None
    region: str | None = None
    accessKeyId: str | None = None
    secretAccessKey: str | None = None


@router.post("/aws/log-groups")
async def list_log_groups(body: LogGroupsRequest) -> JSONResponse:
    """List available CloudWatch log groups. Mirrors Node L3194."""
    creds = await _resolve_creds_from_body(body.model_dump())
    if not creds:
        return JSONResponse({"error": "Missing params"}, status_code=400)

    cache_key = f"loggroups:{creds.region}:{creds.access_key_id or 'imds'}"
    cached = await cache_get(cache_key)
    if cached:
        return JSONResponse(cached)

    try:
        def _fetch():
            c = boto3.client("logs", **build_boto3_kwargs(creds))
            r = c.describe_log_groups(limit=50)
            return [g["logGroupName"] for g in r.get("logGroups", []) if g.get("logGroupName")]
        log_groups = await asyncio.to_thread(_fetch)
        result = {"logGroups": log_groups}
        await cache_set(cache_key, result, TTL_LOG_GROUPS)
        return JSONResponse(result)
    except Exception as exc:
        return JSONResponse({"logGroups": [], "error": str(exc)})
