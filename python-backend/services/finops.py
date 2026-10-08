"""
services/finops.py — AWS FinOps Cost Optimization Engine.

Ported from server/finops.ts.
Calculates real-time cloud infrastructure cost correlation per API route based on AWS pricing specs:
  - API Gateway REST API: $3.50 per 1 million calls
  - API Gateway HTTP API: $1.00 per 1 million calls
  - AWS Lambda: $0.20 per 1 million requests + $0.0000166667 per GB-second
Includes calculate_lambda_memory_right_sizing with BUG-03 fix.
"""
from __future__ import annotations

import logging
import math
from typing import TypedDict, Literal

from db.pool import query

logger = logging.getLogger("finops")


class RouteCostSummary(TypedDict):
    route: str
    method: str
    totalCalls: int
    apiGatewayCostUsd: float
    lambdaExecCostUsd: float
    totalCostUsd: float
    costPerThousandCallsUsd: float


class MemoryRightSizingRecommendation(TypedDict):
    functionName: str
    allocatedMemoryMb: int
    peakMemoryUsedMb: int | None
    recommendedMemoryMb: int
    overProvisionedRatio: float
    monthlyCurrentCostUsd: float
    monthlyOptimizedCostUsd: float
    monthlySavingsUsd: float
    recommendationLevel: Literal["HIGH_SAVINGS", "MODERATE_SAVINGS", "OPTIMAL", "INSUFFICIENT_DATA"]
    isMeasured: bool
    warning: str | None


async def calculate_route_finops_costs(
    api_id: str,
    stage: str,
    protocol: str = "REST",
    default_memory_mb: float = 1024.0,
) -> list[RouteCostSummary]:
    """
    Calculates cost per route over the past 30 days based on gateway_logs in TimescaleDB.
    """
    route_costs: list[RouteCostSummary] = []

    try:
        rows = await query(
            'SELECT route, method, COUNT(*) AS "totalCalls", AVG(latency) AS "avgLatency" '
            "FROM gateway_logs "
            'WHERE "apiId" = $1 AND stage = $2 AND "fullTime" >= NOW() - INTERVAL \'30 days\' '
            "GROUP BY route, method "
            'ORDER BY "totalCalls" DESC',
            api_id,
            stage,
        )

        api_rate_per_million = 1.00 if protocol.upper() == "HTTP" else 3.50
        lambda_memory_gb = default_memory_mb / 1024.0

        for r in rows:
            calls = int(r.get("totalCalls") or 0)
            avg_latency_ms = float(r.get("avgLatency") or 15.0)

            # 1. API Gateway Request Cost
            api_gateway_cost_usd = (calls / 1_000_000.0) * api_rate_per_million

            # 2. Lambda Request & GB-Second Compute Cost
            lambda_request_cost = (calls / 1_000_000.0) * 0.20
            gb_seconds = calls * (avg_latency_ms / 1000.0) * lambda_memory_gb
            lambda_compute_cost = gb_seconds * 0.0000166667
            lambda_exec_cost_usd = lambda_request_cost + lambda_compute_cost

            total_cost_usd = api_gateway_cost_usd + lambda_exec_cost_usd
            cost_per_thousand_calls_usd = (total_cost_usd / calls * 1000.0) if calls > 0 else 0.0

            route_costs.append(
                {
                    "route": r.get("route") or "/",
                    "method": r.get("method") or "GET",
                    "totalCalls": calls,
                    "apiGatewayCostUsd": round(api_gateway_cost_usd, 4),
                    "lambdaExecCostUsd": round(lambda_exec_cost_usd, 4),
                    "totalCostUsd": round(total_cost_usd, 4),
                    "costPerThousandCallsUsd": round(cost_per_thousand_calls_usd, 6),
                }
            )

    except Exception as exc:
        logger.error(f"[FinOps Cost Engine Error]: {exc}", exc_info=True)

    return route_costs


def calculate_lambda_memory_right_sizing(
    functions: list[dict],
) -> list[MemoryRightSizingRecommendation]:
    """
    Determines memory right-sizing recommendations.
    Differentiates between verified CloudWatch measurements and unverified estimates.
    Warns that downscaling Lambda memory also downscales vCPU linearly.
    """
    results: list[MemoryRightSizingRecommendation] = []

    for fn in functions:
        allocated = int(fn.get("memorySize") or 1024)
        peak_used_raw = fn.get("peakMemoryUsedMb")
        is_measured = peak_used_raw is not None

        if is_measured:
            peak_used = min(allocated, int(peak_used_raw))
            warning_text = (
                "Verified via CloudWatch REPORT log. Note: Lambda vCPU scales linearly with memory "
                "(1,769 MB = 1 vCPU). For CPU-bound tasks, lower memory may increase execution duration."
            )
        else:
            # Conservative baseline estimate when CloudWatch REPORT metrics are unavailable
            peak_used = min(allocated, max(64, int(allocated * 0.40)))
            warning_text = (
                "ESTIMATED: Peak memory not directly observed in CloudWatch logs. "
                "Do not downsize without benchmarking duration impact on CPU-bound workloads."
            )

        target_optimal = max(128, math.ceil((peak_used * 1.25) / 64) * 64)
        recommended_mb = target_optimal if target_optimal < allocated else allocated
        over_ratio = round((allocated - peak_used) / allocated, 2)

        current_cost = float(fn.get("monthlyCost") or 18.50)
        ratio = recommended_mb / allocated
        optimized_cost = round(current_cost * (0.3 + 0.7 * ratio), 2)
        savings = max(0.0, round(current_cost - optimized_cost, 2))

        if not is_measured:
            level = "INSUFFICIENT_DATA" if savings > 0 else "OPTIMAL"
        else:
            level = (
                "HIGH_SAVINGS" if savings > 15 else ("MODERATE_SAVINGS" if savings > 5 else "OPTIMAL")
            )

        results.append(
            {
                "functionName": fn.get("functionName", "unknown"),
                "allocatedMemoryMb": allocated,
                "peakMemoryUsedMb": peak_used_raw if is_measured else None,
                "recommendedMemoryMb": recommended_mb,
                "overProvisionedRatio": over_ratio,
                "monthlyCurrentCostUsd": current_cost,
                "monthlyOptimizedCostUsd": optimized_cost,
                "monthlySavingsUsd": savings,
                "recommendationLevel": level,
                "isMeasured": is_measured,
                "warning": warning_text,
            }
        )

    return results
