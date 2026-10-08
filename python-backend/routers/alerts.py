"""
routers/alerts.py — Gateway Alert Rules & Monitored Gateways CRUD and Evaluation.

Ports from server/index.ts:
  GET    /api/alerts/rules                   - List alert rules (L5010)
  POST   /api/alerts/rules                   - Create alert rule (L5033)
  PATCH  /api/alerts/rules/:id               - Toggle enable alert rule (L5050)
  DELETE /api/alerts/rules/:id               - Delete alert rule (L5059)
  GET    /api/alerts/monitored-gateways      - List monitored gateway scopes (L5068)
  POST   /api/alerts/monitored-gateways      - Add/update monitored gateway (L5077)
  POST   /api/alerts/monitored-gateways/toggle - Toggle monitored gateway (L5111)
  DELETE /api/alerts/monitored-gateways/:id  - Remove monitored gateway (L5121)
  POST   /api/alerts/monitored-gateways/poll-now - Trigger immediate background poll (L5177)
  GET    /api/alerts/history                 - Alert dispatch history (L5191)
  POST   /api/alerts/test/:id                - Test webhook dispatch for rule (L5209)
"""
from __future__ import annotations

import logging
import uuid
from typing import Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query

from db.pool import query, execute
from cache.redis_client import cache_get_or_set, cache_del_pattern
from services.alert_evaluator import test_alert, run_background_gateway_monitoring

logger = logging.getLogger("alerts_router")
router = APIRouter(tags=["alerts"])

TTL_ALERTS = 60
TTL_ALERT_HIST = 30


# ── Alert Rules ───────────────────────────────────────────────────────────────

class CreateAlertRuleRequest(BaseModel):
    name: str
    apiId: str
    stage: str
    metric: str
    condition: str
    threshold: float
    intervalMinutes: int = 5
    webhookUrl: str
    channel: str = "slack"


class ToggleAlertRuleRequest(BaseModel):
    enabled: bool


@router.get("/alerts/rules")
async def get_alert_rules(
    apiId: str | None = Query(None),
    stage: str | None = Query(None),
):
    cache_key = f"alert_rules:{apiId or 'all'}:{stage or 'all'}"

    async def _fetch():
        sql = "SELECT * FROM alert_rules"
        params: list[Any] = []
        if apiId:
            sql += ' WHERE ("apiId" = $1 OR "apiId" = \'*\')'
            params.append(apiId)
            if stage:
                sql += ' AND (stage = $2 OR stage = \'*\')'
                params.append(stage)
        sql += ' ORDER BY "createdAt" DESC'

        rows = await query(sql, *params)
        return {"rules": rows}

    try:
        return await cache_get_or_set(cache_key, TTL_ALERTS, _fetch)
    except Exception as exc:
        logger.error(f"[Alerts] List rules error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/alerts/rules")
async def create_alert_rule(payload: CreateAlertRuleRequest):
    rule_id = str(uuid.uuid4())
    try:
        await execute(
            'INSERT INTO alert_rules (id, name, "apiId", stage, metric, condition, threshold, "intervalMinutes", "webhookUrl", channel) '
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            rule_id,
            payload.name,
            payload.apiId,
            payload.stage,
            payload.metric,
            payload.condition,
            payload.threshold,
            payload.intervalMinutes,
            payload.webhookUrl,
            payload.channel,
        )
        await cache_del_pattern("alert_rules:*")
        return {"success": True, "id": rule_id}
    except Exception as exc:
        logger.error(f"[Alerts] Create rule error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/alerts/rules/{rule_id}")
async def patch_alert_rule(rule_id: str, payload: ToggleAlertRuleRequest):
    try:
        await execute("UPDATE alert_rules SET enabled=$1 WHERE id=$2", payload.enabled, rule_id)
        await cache_del_pattern("alert_rules:*")
        return {"success": True}
    except Exception as exc:
        logger.error(f"[Alerts] Patch rule error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/alerts/rules/{rule_id}")
async def delete_alert_rule(rule_id: str):
    try:
        await execute("DELETE FROM alert_rules WHERE id=$1", rule_id)
        await cache_del_pattern("alert_rules:*")
        return {"success": True}
    except Exception as exc:
        logger.error(f"[Alerts] Delete rule error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Monitored Gateways ────────────────────────────────────────────────────────

class MonitoredGatewayRequest(BaseModel):
    gatewayId: str
    gatewayName: str | None = None
    region: str | None = "us-east-1"
    stage: str | None = "prod"
    connectionId: str | None = None
    awsAccountName: str | None = "Default Account"
    pollIntervalSec: int = 60
    isEnabled: bool = True


class ToggleMonitoredGatewayRequest(BaseModel):
    id: str
    isEnabled: bool


@router.get("/alerts/monitored-gateways")
async def get_monitored_gateways():
    try:
        rows = await query('SELECT * FROM monitored_gateways ORDER BY "createdAt" DESC')
        return {"gateways": rows}
    except Exception:
        return {"gateways": []}


@router.post("/alerts/monitored-gateways")
async def save_monitored_gateway(payload: MonitoredGatewayRequest):
    if not payload.gatewayId:
        raise HTTPException(status_code=400, detail="Gateway ID is required")

    # Clamp pollIntervalSec (15s minimum, 3600s maximum) — preserves Bug 11 fix
    clamped_interval = min(3600, max(15, payload.pollIntervalSec))
    gw_id = f"mgw-{uuid.uuid4().hex[:8]}"
    name = payload.gatewayName or f"API Gateway ({payload.gatewayId})"
    reg = payload.region or "us-east-1"
    stg = payload.stage or "prod"
    acct = payload.awsAccountName or "Default Account"

    try:
        await execute(
            """
            INSERT INTO monitored_gateways (id, "gatewayId", "gatewayName", region, stage, "connectionId", "awsAccountName", "pollIntervalSec", "isEnabled", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (id) DO UPDATE SET
              "gatewayName" = EXCLUDED."gatewayName",
              region = EXCLUDED.region,
              stage = EXCLUDED.stage,
              "connectionId" = EXCLUDED."connectionId",
              "awsAccountName" = EXCLUDED."awsAccountName",
              "pollIntervalSec" = EXCLUDED."pollIntervalSec",
              "isEnabled" = EXCLUDED."isEnabled"
            """,
            gw_id,
            payload.gatewayId,
            name,
            reg,
            stg,
            payload.connectionId,
            acct,
            clamped_interval,
            payload.isEnabled,
        )
        return {"success": True, "id": gw_id}
    except Exception as exc:
        logger.error(f"[Monitored Gateways] Save error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/alerts/monitored-gateways/toggle")
async def toggle_monitored_gateway(payload: ToggleMonitoredGatewayRequest):
    try:
        await execute(
            'UPDATE monitored_gateways SET "isEnabled" = $1 WHERE id = $2',
            payload.isEnabled,
            payload.id,
        )
        return {"success": True}
    except Exception as exc:
        logger.error(f"[Monitored Gateways] Toggle error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/alerts/monitored-gateways/{mgw_id}")
async def delete_monitored_gateway(mgw_id: str):
    try:
        await execute("DELETE FROM monitored_gateways WHERE id = $1", mgw_id)
        return {"success": True}
    except Exception as exc:
        logger.error(f"[Monitored Gateways] Delete error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/alerts/monitored-gateways/poll-now")
async def poll_monitored_gateways_now():
    try:
        await run_background_gateway_monitoring()
        return {
            "success": True,
            "message": "Background gateway monitoring poll executed successfully.",
        }
    except Exception as exc:
        logger.error(f"[Monitored Gateways] Poll now error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Alert History & Test ──────────────────────────────────────────────────────

@router.get("/alerts/history")
async def get_alert_history(
    apiId: str | None = Query(None),
    stage: str | None = Query(None),
    limit: int = Query(50),
):
    cache_key = f"alert_history:{apiId or 'all'}:{stage or 'all'}:{limit}"

    async def _fetch():
        sql = "SELECT * FROM alert_history"
        params: list[Any] = []
        if apiId:
            sql += ' WHERE "apiId" = $1'
            params.append(apiId)
            if stage:
                sql += " AND stage = $2"
                params.append(stage)
        sql += f' ORDER BY "firedAt" DESC LIMIT ${len(params) + 1}'
        params.append(limit)

        rows = await query(sql, *params)
        return {"history": rows}

    try:
        return await cache_get_or_set(cache_key, TTL_ALERT_HIST, _fetch)
    except Exception as exc:
        logger.error(f"[Alert History] Error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/alerts/test/{rule_id}")
async def test_alert_rule(rule_id: str):
    try:
        await test_alert(rule_id)
        return {"success": True, "message": "Test webhook sent"}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(f"[Alerts Test] Error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
