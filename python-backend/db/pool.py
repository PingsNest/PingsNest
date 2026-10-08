"""
db/pool.py — Async PostgreSQL connection pool using psycopg3 (psycopg[binary]).
Mirrors the connection semantics of server/db.ts (same DATABASE_URL).

psycopg3 is used instead of asyncpg because it ships pre-built binary wheels
for Python 3.14 on Windows, whereas asyncpg requires a C compiler.
"""
from __future__ import annotations

from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row

from config import get_settings

_pool: AsyncConnectionPool | None = None


async def init_pool() -> None:
    """Create the async connection pool. Called once at app startup."""
    global _pool
    settings = get_settings()
    _pool = AsyncConnectionPool(
        conninfo=settings.database_url,
        min_size=2,
        max_size=25,          # matches Node pool.max = 25
        kwargs={"row_factory": dict_row},
        open=False,
    )
    await _pool.open()
    print("[DB] PostgreSQL pool initialised (psycopg3).")


async def close_pool() -> None:
    """Gracefully close the pool on shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        print("[DB] PostgreSQL pool closed.")


def get_pool() -> AsyncConnectionPool:
    """Return the active pool. Raises if init_pool() was not awaited."""
    if _pool is None:
        raise RuntimeError("DB pool not initialised — call init_pool() first.")
    return _pool


async def query(sql: str, *args) -> list[dict]:
    """
    Thin helper — acquire a connection from the pool, execute the query,
    release the connection, return rows as a list of dicts.

    Usage:
        rows = await query("SELECT * FROM monitored_gateways WHERE id = $1", gw_id)
    """
    pool = get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(sql, args if args else None)
            return await cur.fetchall()


async def execute(sql: str, *args) -> None:
    """Execute a DML statement (INSERT/UPDATE/DELETE)."""
    pool = get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, args if args else None)


async def query_one(sql: str, *args) -> dict | None:
    """Return a single row as a dict, or None."""
    pool = get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(sql, args if args else None)
            return await cur.fetchone()
