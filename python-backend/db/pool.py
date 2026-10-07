"""
db/pool.py — Async PostgreSQL connection pool using asyncpg.
Mirrors the connection semantics of server/db.ts (same DATABASE_URL).
"""
from __future__ import annotations

import asyncpg
from asyncpg import Pool
from config import get_settings

_pool: Pool | None = None


async def init_pool() -> None:
    """Create the connection pool. Called once at app startup."""
    global _pool
    settings = get_settings()
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=25,          # matches Node pool.max = 25
        command_timeout=30,
        statement_cache_size=0,  # safe for PgBouncer / TimescaleDB
    )
    print("[DB] PostgreSQL pool initialised.")


async def close_pool() -> None:
    """Gracefully close the pool on shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        print("[DB] PostgreSQL pool closed.")


def get_pool() -> Pool:
    """Return the active pool. Raises if init_pool() was not awaited."""
    if _pool is None:
        raise RuntimeError("DB pool not initialised — call init_pool() first.")
    return _pool


async def query(sql: str, *args) -> list[asyncpg.Record]:
    """
    Thin helper — acquire a connection from the pool, execute the query,
    release the connection, return rows as a list of Record objects.

    Usage:
        rows = await query("SELECT * FROM monitored_gateways WHERE id = $1", gw_id)
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(sql, *args)


async def execute(sql: str, *args) -> str:
    """Execute a DML statement and return the status string (e.g. 'INSERT 0 1')."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(sql, *args)


async def query_one(sql: str, *args) -> asyncpg.Record | None:
    """Return a single row or None."""
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(sql, *args)
