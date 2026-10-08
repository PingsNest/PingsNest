"""
routers/ingest.py — Ingestion endpoints: Push CloudWatch Logs & OpenTelemetry (OTLP).

Ports from:
  server/pushIngestion.ts:
    POST /api/ingest/cloudwatch-logs  - Decompresses gzip subscription filter logs,
                                        upserts into TimescaleDB & broadcasts over Redis
  server/otlp.ts:
    POST /v1/traces                   - Native OTLP HTTP trace ingestion
    POST /v1/metrics                  - Native OTLP HTTP metrics ingestion
"""
from __future__ import annotations

import base64
from datetime import datetime, timezone
import gzip
import json
import logging
import uuid
from typing import Any
from fastapi import APIRouter, Header, HTTPException, Request

from db.pool import execute
from cache.redis_client import publish

logger = logging.getLogger("ingest_router")
router = APIRouter(tags=["ingestion"])


# ── CloudWatch Subscription Filter Push Ingestion ─────────────────────────────

@router.post("/api/ingest/cloudwatch-logs")
@router.post("/ingest/cloudwatch-logs")
async def ingest_cloudwatch_logs(
    request: Request,
    x_tenant_id: str | None = Header(None, alias="x-tenant-id"),
    x_amzn_trace_id: str | None = Header(None, alias="x-amzn-trace-id"),
):
    try:
        raw_body = await request.body()
        payload_bytes = raw_body

        # 1. Try decoding JSON wrapper if present (e.g. { "awslogs": { "data": "base64..." } })
        try:
            parsed_wrapper = json.loads(raw_body)
            if isinstance(parsed_wrapper, dict) and "awslogs" in parsed_wrapper and "data" in parsed_wrapper["awslogs"]:
                payload_bytes = base64.b64decode(parsed_wrapper["awslogs"]["data"])
            elif isinstance(parsed_wrapper, str):
                payload_bytes = base64.b64decode(parsed_wrapper)
        except Exception:
            pass

        # 2. Decompress gzip payload if compressed
        try:
            decompressed = gzip.decompress(payload_bytes)
        except Exception:
            decompressed = payload_bytes

        log_data = json.loads(decompressed.decode("utf-8"))
        log_group = log_data.get("logGroup", "unknown-group")
        log_stream = log_data.get("logStream", "")
        log_events = log_data.get("logEvents", [])

        if not isinstance(log_events, list):
            raise HTTPException(status_code=400, detail="Invalid CloudWatch subscription payload format")

        tenant_id = x_tenant_id or "default-tenant"
        parsed_records: list[dict[str, Any]] = []

        for ev in log_events:
            msg = str(ev.get("message", ""))
            parsed_json: dict[str, Any] = {}
            trimmed = msg.strip()
            if trimmed.startswith("{") and trimmed.endswith("}"):
                try:
                    parsed_json = json.loads(trimmed)
                except Exception:
                    pass

            request_id = (
                parsed_json.get("requestId")
                or ev.get("id")
                or f"req-{uuid.uuid4().hex[:8]}"
            )
            status_code = int(
                parsed_json.get("status")
                or parsed_json.get("statusCode")
                or parsed_json.get("httpStatus")
                or 200
            )
            method = parsed_json.get("httpMethod") or parsed_json.get("method") or "GET"
            route = (
                parsed_json.get("resourcePath")
                or parsed_json.get("path")
                or parsed_json.get("routeKey")
                or "/"
            )
            latency = int(parsed_json.get("responseLatency") or parsed_json.get("latency") or 10)
            integration_latency = int(parsed_json.get("integrationLatency") or 0)
            identity = parsed_json.get("identity") if isinstance(parsed_json.get("identity"), dict) else {}
            client_ip = identity.get("sourceIp") or parsed_json.get("ip") or "127.0.0.1"
            user_agent = identity.get("userAgent") or parsed_json.get("userAgent") or "AWS-PushIngestion"
            trace_id = parsed_json.get("traceId") or x_amzn_trace_id or None

            ts_ms = ev.get("timestamp") or int(datetime.now(timezone.utc).timestamp() * 1000)
            iso_time = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc).isoformat()

            api_id = log_data.get("owner") or "push-api"
            stage = log_stream.split("/")[0] if log_stream and "/" in log_stream else "prod"

            record = {
                "apiId": api_id,
                "stage": stage,
                "id": request_id,
                "timestamp": iso_time,
                "fullTime": iso_time,
                "method": method,
                "route": route,
                "statusCode": status_code,
                "latency": latency,
                "integrationLatency": integration_latency,
                "cacheHit": False,
                "clientIp": client_ip,
                "userAgent": user_agent,
                "rawLogs": [msg],
                "customLogGroup": log_group,
                "tenantId": tenant_id,
                "traceId": trace_id,
            }
            parsed_records.append(record)

            # Insert into TimescaleDB
            try:
                await execute(
                    """
                    INSERT INTO gateway_logs (
                        "apiId", stage, id, timestamp, "fullTime", method, route,
                        "statusCode", latency, "integrationLatency", "cacheHit",
                        "clientIp", "userAgent", "rawLogs", "customLogGroup", "tenantId", "traceId"
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                    ON CONFLICT ("apiId", stage, id, "fullTime") DO NOTHING
                    """,
                    record["apiId"],
                    record["stage"],
                    record["id"],
                    record["timestamp"],
                    record["fullTime"],
                    record["method"],
                    record["route"],
                    record["statusCode"],
                    record["latency"],
                    record["integrationLatency"],
                    record["cacheHit"],
                    record["clientIp"],
                    record["userAgent"],
                    json.dumps(record["rawLogs"]),
                    record["customLogGroup"],
                    record["tenantId"],
                    record["traceId"],
                )
            except Exception as ins_err:
                logger.debug(f"[Push Ingestion] Insert row error: {ins_err}")

        # Broadcast real-time batch over Redis
        if parsed_records:
            first = parsed_records[0]
            await publish(
                "ws:fanout:logs",
                {
                    "apiId": first["apiId"],
                    "stage": first["stage"],
                    "logs": parsed_records,
                },
            )

        return {"success": True, "processedEvents": len(parsed_records)}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[Push Ingestion Error]: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Push ingestion processing failed: {exc}")


# ── OpenTelemetry (OTLP) Traces Receiver ──────────────────────────────────────

@router.post("/v1/traces")
async def ingest_otlp_traces(request: Request):
    try:
        body = await request.json()
        resource_spans = body.get("resourceSpans", [])
        ingested_count = 0

        for r_span in resource_spans:
            resource = r_span.get("resource", {})
            attributes = resource.get("attributes", [])
            service_name = "otel-service"
            for attr in attributes:
                if attr.get("key") == "service.name":
                    service_name = attr.get("value", {}).get("stringValue") or service_name

            scope_spans = r_span.get("scopeSpans") or r_span.get("instrumentationLibrarySpans") or []
            for s_span in scope_spans:
                spans = s_span.get("spans", [])
                for span in spans:
                    ingested_count += 1
                    trace_id = span.get("traceId")
                    span_id = span.get("spanId") or f"span-{uuid.uuid4().hex[:8]}"
                    name = span.get("name") or "http.request"

                    start_nano = int(span.get("startTimeUnixNano") or (datetime.now(timezone.utc).timestamp() * 1e9))
                    end_nano = int(span.get("endTimeUnixNano") or (datetime.now(timezone.utc).timestamp() * 1e9))
                    start_ms = round(start_nano / 1e6)
                    end_ms = round(end_nano / 1e6)
                    duration_ms = max(1, end_ms - start_ms)

                    status = span.get("status", {})
                    status_code = 500 if status.get("code") == 2 else 200

                    start_dt = datetime.fromtimestamp(start_ms / 1000.0, tz=timezone.utc)
                    iso_time = start_dt.isoformat()

                    try:
                        await execute(
                            """
                            INSERT INTO gateway_logs (
                                "apiId", stage, id, timestamp, "fullTime", method, route,
                                "statusCode", latency, "integrationLatency", "cacheHit",
                                "clientIp", "userAgent", "rawLogs", "customLogGroup", "tenantId", "traceId"
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, $12, $13, $14, $15, $16)
                            ON CONFLICT ("apiId", stage, id, "fullTime") DO NOTHING
                            """,
                            service_name,
                            "otel",
                            span_id,
                            start_dt.strftime("%H:%M:%S"),
                            iso_time,
                            "POST",
                            name,
                            status_code,
                            duration_ms,
                            duration_ms,
                            "otel-agent",
                            "OpenTelemetry-SDK",
                            json.dumps([json.dumps(span)]),
                            f"/aws/otel/{service_name}",
                            "default-tenant",
                            trace_id,
                        )
                    except Exception as ins_err:
                        logger.debug(f"[OTLP Traces] Insert row error: {ins_err}")

        return {"partialSuccess": {}, "ingestedSpans": ingested_count}
    except Exception as exc:
        logger.error(f"[OTLP Traces Error]: {exc}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"OTLP trace processing failed: {exc}")


# ── OpenTelemetry (OTLP) Metrics Receiver ─────────────────────────────────────

@router.post("/v1/metrics")
async def ingest_otlp_metrics(request: Request):
    try:
        body = await request.json()
        resource_metrics = body.get("resourceMetrics", [])
        metrics_count = 0

        for r_metric in resource_metrics:
            scope_metrics = r_metric.get("scopeMetrics", [])
            for s_metric in scope_metrics:
                metrics = s_metric.get("metrics", [])
                metrics_count += len(metrics)

        return {"partialSuccess": {}, "ingestedMetrics": metrics_count}
    except Exception as exc:
        logger.error(f"[OTLP Metrics Error]: {exc}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"OTLP metric processing failed: {exc}")
