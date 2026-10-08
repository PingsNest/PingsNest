"""
main.py — FastAPI application entry point for the API Gateway Python microservice.

Startup order:
  1. PostgreSQL pool (asyncpg)
  2. Redis client
  3. Include all routers
  4. Apply middleware

Port: 8000 (Node.js stays on 3001)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db.pool import init_pool, close_pool
from cache.redis_client import init_redis, close_redis
from middleware.security_headers import SecurityHeadersMiddleware
from routers import health

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")


# ── Lifespan (startup + shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[Startup] Initialising API Gateway Python microservice…")
    await init_pool()
    await init_redis()
    logger.info("[Startup] Ready.")
    yield
    logger.info("[Shutdown] Closing connections…")
    await close_pool()
    await close_redis()
    logger.info("[Shutdown] Done.")


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="API Gateway Monitor — Python Microservice",
    description=(
        "Handles AWS API Gateway monitoring: listing APIs/stages/routes, "
        "CloudWatch metrics & logs, X-Ray traces, anomaly detection, FinOps, "
        "SLA reporting, alert rules, and OTLP ingestion."
    ),
    version="0.1.0",
    lifespan=lifespan,
    # Auto-generated OpenAPI docs at /docs and /redoc
)

# ── Middleware ─────────────────────────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)

# Phase 2 — AWS API Gateway core routes
from routers import apis  # noqa: E402
app.include_router(apis.router, prefix="/api")

# TODO Phase 3+: add routers as they are implemented
# from routers import metrics, logs, traces, gateways, anomalies, finops
# from routers import sla, alerts, diagnostics, ingest


# ── Dev entry point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=True,
        log_level="info",
    )
