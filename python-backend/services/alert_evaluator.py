"""
services/alert_evaluator.py — Alert evaluation and webhook notification dispatcher.

Ports from server/alerting.ts:
  - Metric threshold condition evaluations (>, <, >=, <=)
  - Fingerprinted deduplication and debounce intervals
  - Multi-channel webhook formatting (Slack, Teams, Discord, PagerDuty, WebhookBot, Generic)
  - Exponential backoff retries (1s, 2s, 4s)
  - Database logging into alert_history
  - Redis Pub/Sub broadcast on 'ws:fanout:alert'
  - Test alert dispatch (test_alert)
  - Background gateway monitor evaluation loop
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
import math
from typing import Any, Literal
import uuid

import httpx

from db.pool import query, execute, query_one
from cache.redis_client import publish
from services.anomaly_engine import detect_latency_anomalies

logger = logging.getLogger("alert_evaluator")

AlertMetric = Literal["errorRate", "avgLatency", "totalRequests", "status5xx", "status4xx"]
AlertCondition = Literal[">", "<", ">=", "<="]
ChannelType = Literal["slack", "teams", "discord", "pagerduty", "webhookbot", "generic"]

# In-memory last-fired timestamps for debouncing (fingerprint -> ms)
_last_fired_at: dict[str, float] = {}


def evaluate_condition(value: float, condition: str, threshold: float) -> bool:
    if condition == ">":
        return value > threshold
    if condition == "<":
        return value < threshold
    if condition == ">=":
        return value >= threshold
    if condition == "<=":
        return value <= threshold
    return False


async def evaluate_alerts(
    api_id: str,
    stage: str,
    metrics: dict[str, float],
) -> None:
    """
    Evaluate a metric snapshot against all enabled rules matching apiId and stage.
    """
    try:
        # Check active maintenance windows
        active_maint = await query(
            'SELECT id FROM maintenance_windows '
            'WHERE ("targetId" = $1 OR "targetId" = \'all\' OR "targetId" IS NULL) '
            'AND "isActive" = true AND NOW() BETWEEN "startTime" AND "endTime" LIMIT 1',
            api_id,
        )
        if active_maint and len(active_maint) > 0:
            return  # Suppress alerts during scheduled maintenance
    except Exception:
        # Fail-open if maintenance_windows table is not available
        pass

    try:
        rules = await query(
            'SELECT * FROM alert_rules '
            'WHERE ("apiId"=$1 OR "apiId"=\'*\') AND (stage=$2 OR stage=\'*\') AND enabled=true',
            api_id,
            stage,
        )
    except Exception as exc:
        logger.warning(f"[Alert Evaluator] Could not query alert_rules: {exc}")
        return

    now_ms = datetime.now(timezone.utc).timestamp() * 1000.0

    for rule in rules:
        metric_name = rule.get("metric", "")
        value = float(metrics.get(metric_name, 0.0))
        condition = rule.get("condition", ">")
        threshold = float(rule.get("threshold", 0.0))

        if not evaluate_condition(value, condition, threshold):
            continue

        rule_id = str(rule.get("id"))
        fingerprint = f"{rule_id}:{api_id}:{stage}:{metric_name}"
        last = _last_fired_at.get(fingerprint)

        if last is None:
            try:
                hist = await query_one(
                    'SELECT MAX("firedAt") as "lastFired" FROM alert_history '
                    'WHERE "ruleId"=$1 AND "apiId"=$2 AND stage=$3 AND metric=$4',
                    rule_id,
                    api_id,
                    stage,
                    metric_name,
                )
                if hist and hist.get("lastFired"):
                    last_dt = hist["lastFired"]
                    if isinstance(last_dt, datetime):
                        last = last_dt.timestamp() * 1000.0
                    else:
                        last = 0.0
                else:
                    last = 0.0
            except Exception:
                last = 0.0
            _last_fired_at[fingerprint] = last

        interval_minutes = float(rule.get("intervalMinutes") or 5)
        minutes_since_last = (now_ms - last) / 60000.0
        if minutes_since_last < interval_minutes:
            continue

        _last_fired_at[fingerprint] = now_ms

        # Record in alert_history table
        try:
            await execute(
                'INSERT INTO alert_history ("ruleId", "ruleName", "apiId", stage, metric, value, threshold, "firedAt", resolved) '
                "VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false)",
                rule_id,
                rule.get("name", "Alert Rule"),
                api_id,
                stage,
                metric_name,
                value,
                threshold,
            )
        except Exception as exc:
            logger.debug(f"[Alert Evaluator] Could not insert alert_history: {exc}")

        # Broadcast real-time alert over Redis for Node.js WebSocket fanout
        await publish(
            "ws:fanout:alert",
            {
                "alert": {
                    "type": "metric_threshold_breach",
                    "ruleId": rule_id,
                    "ruleName": rule.get("name"),
                    "apiId": api_id,
                    "stage": stage,
                    "metric": metric_name,
                    "value": value,
                    "threshold": threshold,
                    "condition": condition,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

        # Fire webhook with retry non-blocking
        asyncio.create_task(fire_webhook_with_retry(rule, value))
        logger.info(
            f'[Alert Evaluator] Rule "{rule.get("name")}" fired — '
            f"{metric_name}={value} {condition} {threshold}"
        )


async def fire_webhook(rule: dict[str, Any], value: float) -> None:
    webhook_url = rule.get("webhookUrl")
    if not webhook_url:
        return

    body = build_webhook_body(rule, value)
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.post(
            webhook_url,
            json=body,
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")


async def fire_webhook_with_retry(rule: dict[str, Any], value: float, max_retries: int = 3) -> None:
    for attempt in range(1, max_retries + 1):
        try:
            await fire_webhook(rule, value)
            return
        except Exception as exc:
            if attempt == max_retries:
                logger.error(
                    f'[Alerts] Webhook permanently failed after {max_retries} attempts for rule "{rule.get("name")}": {exc}'
                )
                return
            delay = (2 ** (attempt - 1)) * 1.0  # 1s, 2s, 4s
            logger.warning(
                f'[Alerts] Webhook attempt {attempt}/{max_retries} failed for "{rule.get("name")}", retrying in {delay}s...'
            )
            await asyncio.sleep(delay)


def build_webhook_body(rule: dict[str, Any], value: float) -> dict[str, Any]:
    metric = str(rule.get("metric", ""))
    is_high_severity = metric == "status5xx" or (metric == "errorRate" and value > 15)
    color_hex = "#EF4444" if is_high_severity else "#F59E0B"
    status_emoji = "🚨" if is_high_severity else "⚠️"
    timestamp = datetime.now(timezone.utc).isoformat()
    name = str(rule.get("name", "Alert Rule"))
    api_id = str(rule.get("apiId", ""))
    stage = str(rule.get("stage", ""))
    cond = str(rule.get("condition", ">"))
    threshold = rule.get("threshold", 0)
    channel = str(rule.get("channel", "slack")).lower()
    webhook_url = str(rule.get("webhookUrl", ""))

    if channel == "webhookbot" or "webhookbot" in webhook_url:
        alert_text = f"{status_emoji} PingsNest Monitor Alert — {name}: {metric} {cond} {threshold} (Current: {value}) on {api_id}/{stage}"
        return {"type": "message", "text": alert_text, "attachments": []}

    if channel == "slack":
        return {
            "text": f"{status_emoji} *PingsNest Monitor Alert*: {name}",
            "attachments": [
                {
                    "color": color_hex,
                    "fallback": f"Alert: {name} - {metric} = {value}",
                    "title": f"{status_emoji} Alert Triggered: {name}",
                    "fields": [
                        {"title": "Gateway API", "value": api_id, "short": True},
                        {"title": "Stage", "value": stage, "short": True},
                        {"title": "Metric", "value": metric, "short": True},
                        {"title": "Threshold", "value": f"{cond} {threshold}", "short": True},
                        {"title": "Current Value", "value": str(value), "short": True},
                        {"title": "Triggered At", "value": timestamp, "short": True},
                    ],
                    "footer": "PingsNest API Gateway Monitor",
                    "ts": int(datetime.now(timezone.utc).timestamp()),
                }
            ],
        }

    if channel == "teams":
        if any(kw in webhook_url for kw in ("powerautomate", "logic.azure.com", "workflows")):
            return {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": {
                            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                            "type": "AdaptiveCard",
                            "version": "1.4",
                            "body": [
                                {
                                    "type": "TextBlock",
                                    "size": "Medium",
                                    "weight": "Bolder",
                                    "text": f"{status_emoji} PingsNest Monitor Alert — {name}",
                                    "color": "Attention" if is_high_severity else "Warning",
                                },
                                {
                                    "type": "FactSet",
                                    "facts": [
                                        {"title": "Gateway ID:", "value": api_id},
                                        {"title": "Stage:", "value": stage},
                                        {"title": "Metric:", "value": metric},
                                        {"title": "Threshold:", "value": f"{cond} {threshold}"},
                                        {"title": "Current Value:", "value": str(value)},
                                        {"title": "Fired At:", "value": timestamp},
                                    ],
                                },
                            ],
                        },
                    }
                ],
            }

        return {
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            "summary": f"PingsNest Alert: {name}",
            "themeColor": "EF4444" if is_high_severity else "F59E0B",
            "title": f"{status_emoji} PingsNest Monitor Alert — {name}",
            "sections": [
                {
                    "activityTitle": f"Metric {metric} breached threshold!",
                    "activitySubtitle": f"Gateway: {api_id} ({stage})",
                    "facts": [
                        {"name": "Alert Rule", "value": name},
                        {"name": "Metric", "value": metric},
                        {"name": "Current Value", "value": str(value)},
                        {"name": "Threshold", "value": f"{cond} {threshold}"},
                        {"name": "Fired At", "value": timestamp},
                    ],
                    "markdown": True,
                }
            ],
        }

    if channel == "discord":
        return {
            "username": "PingsNest Monitor Alert",
            "embeds": [
                {
                    "title": f"{status_emoji} Alert Fired: {name}",
                    "description": f"Telemetry threshold breached on API Gateway `{api_id}` ({stage})",
                    "color": int(color_hex.replace("#", ""), 16),
                    "fields": [
                        {"name": "Metric", "value": metric, "inline": True},
                        {"name": "Value", "value": str(value), "inline": True},
                        {"name": "Threshold", "value": f"{cond} {threshold}", "inline": True},
                        {"name": "API ID", "value": api_id, "inline": True},
                        {"name": "Stage", "value": stage, "inline": True},
                    ],
                    "footer": {"text": "PingsNest API Gateway Monitor"},
                    "timestamp": timestamp,
                }
            ],
        }

    if channel == "pagerduty":
        return {
            "payload": {
                "summary": f"[PingsNest Alert] {name}: {metric}={value} {cond} {threshold} on {api_id}/{stage}",
                "timestamp": timestamp,
                "severity": "critical" if is_high_severity else "warning",
                "source": f"API-Gateway:{api_id}",
                "component": stage,
                "group": "API-Gateway-Monitor",
                "class": metric,
                "custom_details": {
                    "ruleId": rule.get("id"),
                    "ruleName": name,
                    "metric": metric,
                    "value": value,
                    "threshold": threshold,
                    "condition": cond,
                    "apiId": api_id,
                    "stage": stage,
                },
            },
            "routing_key": webhook_url,
            "event_action": "trigger",
        }

    # Generic Webhook
    alert_text = f"{status_emoji} PingsNest Monitor Alert — {name}: {metric} {cond} {threshold} (Current: {value}) on {api_id}/{stage}"
    return {
        "type": "message",
        "text": alert_text,
        "content": alert_text,
        "attachments": [],
        "alert": name,
        "metric": metric,
        "value": value,
        "threshold": threshold,
        "condition": cond,
        "apiId": api_id,
        "stage": stage,
        "severity": "critical" if is_high_severity else "warning",
        "firedAt": timestamp,
        "system": "PingsNest API Gateway Monitor",
    }


async def test_alert(rule_id: str) -> None:
    """Send a test webhook notification for the given rule ID."""
    row = await query_one("SELECT * FROM alert_rules WHERE id=$1", rule_id)
    if not row:
        raise ValueError("Rule not found")
    test_rule = dict(row)
    test_rule["name"] = f"[TEST] {test_rule.get('name')}"
    threshold = float(test_rule.get("threshold", 0.0))
    await fire_webhook(test_rule, threshold)


async def run_background_gateway_monitoring() -> None:
    """
    Evaluates enabled monitored_gateways, respecting per-gateway pollIntervalSec
    and deriving actual health status via anomaly detection.
    """
    try:
        scopes = await query('SELECT * FROM monitored_gateways WHERE "isEnabled" = true')
        if not scopes:
            return

        now = datetime.now(timezone.utc)
        for scope in scopes:
            try:
                gw_id = scope.get("gatewayId", "")
                stage = scope.get("stage") or "prod"
                poll_interval_sec = int(scope.get("pollIntervalSec") or 60)

                last_polled_at = scope.get("lastPolledAt")
                if last_polled_at:
                    if isinstance(last_polled_at, datetime):
                        diff_sec = (now - last_polled_at).total_seconds()
                        if diff_sec < poll_interval_sec:
                            continue

                health_status = "HEALTHY"
                if gw_id != "*":
                    try:
                        anomalies = await detect_latency_anomalies(gw_id, stage)
                        if any(a.get("isAnomaly") for a in anomalies):
                            health_status = "WARNING"
                    except Exception:
                        pass

                await execute(
                    'UPDATE monitored_gateways SET "lastPolledAt" = NOW(), "lastStatus" = $1 WHERE id = $2',
                    health_status,
                    scope["id"],
                )
            except Exception as scope_err:
                logger.warning(f"[Background Gateway Monitor] Scope error for {scope.get('id')}: {scope_err}")
                await execute(
                    'UPDATE monitored_gateways SET "lastPolledAt" = NOW(), "lastStatus" = $1 WHERE id = $2',
                    "WARNING",
                    scope["id"],
                )
    except Exception as exc:
        logger.error(f"[Background Gateway Monitor Error]: {exc}", exc_info=True)
