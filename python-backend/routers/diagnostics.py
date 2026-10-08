"""
routers/diagnostics.py — AI Incident Diagnostic Assistant Endpoint.

Ports: POST /api/diagnostics/analyze-spike  (server/index.ts L1271)
Analyzes recent telemetry (5xx errors, latency bottleneck, error log patterns like
timeouts and connection pool saturation) and produces actionable recommendations.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, Field
from fastapi import APIRouter

logger = logging.getLogger("diagnostics_router")
router = APIRouter(tags=["diagnostics"])


class MetricSnapshot(BaseModel):
    status5xx: int | float | None = 0
    avgLatency: int | float | None = 0
    status4xx: int | float | None = 0
    requestsPerMin: int | float | None = 0


class AnalyzeSpikeRequest(BaseModel):
    apiId: str | None = None
    errorLogs: list[dict[str, Any]] | None = Field(default_factory=list)
    metricSnapshot: MetricSnapshot | None = None


@router.post("/diagnostics/analyze-spike")
async def analyze_spike(payload: AnalyzeSpikeRequest):
    api_id = payload.apiId or "Active Gateway"
    summary = f'Analyzed recent telemetry for API Gateway "{api_id}".'
    findings: list[str] = []
    recommendations: list[str] = []

    if payload.metricSnapshot:
        snap = payload.metricSnapshot
        if snap.status5xx and snap.status5xx > 0:
            findings.append(f"Detected {snap.status5xx} 5XX server errors in recent evaluation window.")
            recommendations.append("Inspect Lambda execution timeout and database connection pool capacity.")
        if snap.avgLatency and snap.avgLatency > 500:
            findings.append(f"Latency bottleneck observed: Average latency reached {snap.avgLatency}ms (exceeding 500ms target).")
            recommendations.append("Check downstream integration HTTP client keep-alive settings and Redis cache hit ratios.")

    if payload.errorLogs and len(payload.errorLogs) > 0:
        error_text = " ".join(
            str(l.get("message") or l.get("log") or "") for l in payload.errorLogs
        )
        lower_err = error_text.lower()
        if "timeout" in lower_err or "etimedout" in lower_err:
            findings.append("Log analysis reveals repeated network request timeouts to downstream endpoints.")
            recommendations.append("Increase Lambda integration timeout or adjust circuit breaker backoff rules.")
        elif "connection pool" in lower_err or "too many clients" in lower_err:
            findings.append("Database client connection limit reached.")
            recommendations.append("Enable AWS RDS Proxy or optimize connection reuse inside Lambda handler.")
        else:
            first_err = payload.errorLogs[0].get("message") or payload.errorLogs[0].get("log") or "Unhandled exception"
            findings.append(f'Captured error pattern: "{first_err}"')

    if len(findings) == 0:
        findings.append("All evaluated metrics are operating within expected SLA baselines.")
        recommendations.append("Continue monitoring baseline p99 latency and CloudWatch error logs.")

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "apiId": payload.apiId or "all",
        "summary": summary,
        "findings": findings,
        "recommendations": recommendations,
        "confidenceScore": 0.94,
    }
