"""
config.py — Centralised settings for the API Gateway Python microservice.
Reads from the same .env file as the Node.js backend via pydantic-settings.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",          # repo root .env (same file Node reads)
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Server ────────────────────────────────────────────────────────────────
    port: int = 8000                 # Python service port (Node stays on 3001)
    node_backend_url: str = "http://localhost:3001"  # internal proxy target

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = "postgres://nova:nova_secret@localhost:5432/nova_monitor"

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379"
    cache_key_prefix: str = "gw:"   # namespace — avoids collision with Node keys

    # ── AWS defaults ──────────────────────────────────────────────────────────
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""

    # ── Auth ──────────────────────────────────────────────────────────────────
    jwt_secret: str = "nova_jwt_secret_2026_change_in_production"

    # ── Encryption (must match Node db.ts AES-256-GCM key derivation) ────────
    encryption_secret: str = "nova_api_gateway_monitor_secret_key_2026"
    encryption_salt: bytes = b"salt_2026"


@lru_cache
def get_settings() -> Settings:
    """Cached singleton — import and call this everywhere."""
    return Settings()
