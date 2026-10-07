"""
cache/redis_client.py — Async Redis helpers.
Mirrors the API of server/cache.ts (cacheGet, cacheSet, cacheDel, cacheGetOrSet).
Keys are prefixed with settings.cache_key_prefix ("gw:") to avoid collisions
with the Node.js backend's existing keys.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Callable, Awaitable, TypeVar

import redis.asyncio as aioredis
from redis.asyncio import Redis

from config import get_settings

logger = logging.getLogger("cache")

_client: Redis | None = None
_connected: bool = False

T = TypeVar("T")


async def init_redis() -> None:
    """Connect to Redis. Called once at app startup."""
    global _client, _connected
    settings = get_settings()
    try:
        _client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=False,
        )
        await _client.ping()
        _connected = True
        logger.info("[Cache] Redis connected.")
    except Exception as exc:
        logger.warning(f"[Cache] Redis unavailable — running without cache: {exc}")
        _connected = False


async def close_redis() -> None:
    """Close the Redis connection on shutdown."""
    global _client, _connected
    if _client:
        await _client.aclose()
        _connected = False
        logger.info("[Cache] Redis connection closed.")


def _prefixed(key: str) -> str:
    """Apply the 'gw:' namespace prefix to avoid key collisions with Node."""
    return get_settings().cache_key_prefix + key


async def cache_get(key: str) -> Any | None:
    """Return the cached value or None on miss / Redis unavailable."""
    if not _connected or _client is None:
        return None
    try:
        val = await _client.get(_prefixed(key))
        if val is None:
            return None
        logger.debug(f"[Cache] HIT  {key}")
        return json.loads(val)
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl_seconds: int) -> None:
    """Store value as JSON with TTL. Silently ignores Redis errors."""
    if not _connected or _client is None:
        return
    try:
        await _client.set(_prefixed(key), json.dumps(value), ex=ttl_seconds)
        logger.debug(f"[Cache] SET  {key}  (TTL {ttl_seconds}s)")
    except Exception:
        pass


async def cache_del(key: str) -> None:
    """Delete a single key."""
    if not _connected or _client is None:
        return
    try:
        await _client.delete(_prefixed(key))
        logger.debug(f"[Cache] DEL  {key}")
    except Exception:
        pass


async def cache_del_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern using SCAN (non-blocking)."""
    if not _connected or _client is None:
        return
    try:
        keys: list[str] = []
        async for key in _client.scan_iter(match=_prefixed(pattern), count=200):
            keys.append(key)
        if keys:
            await _client.delete(*keys)
        logger.debug(f"[Cache] SCAN DEL  {pattern}  ({len(keys)} keys)")
    except Exception:
        pass


async def cache_get_or_set(
    key: str,
    ttl_seconds: int,
    fn: Callable[[], Awaitable[T]],
) -> T:
    """
    Get-or-set helper. Returns cached value if present; otherwise calls fn(),
    caches the result, and returns it.
    """
    cached = await cache_get(key)
    if cached is not None:
        return cached
    value = await fn()
    await cache_set(key, value, ttl_seconds)
    return value
