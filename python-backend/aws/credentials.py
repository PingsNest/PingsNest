"""
aws/credentials.py — Resolve AWS credentials from the aws_connections table.
Mirrors the resolveAwsCredentials() + getAwsCredentialsFromReq() logic in server/index.ts.

The Python service reads credentials from the same PostgreSQL table that Node writes to,
using the matching AES-256-GCM decryption from aws/crypto.py.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

import boto3
from botocore.credentials import RefreshableCredentials
from botocore.session import get_session

from db.pool import query_one
from aws.crypto import decrypt_secret

logger = logging.getLogger("aws.credentials")

AuthType = Literal["keys", "role", "environment", "instance_profile"]


@dataclass
class ResolvedCredentials:
    region: str
    access_key_id: str | None = None
    secret_access_key: str | None = None
    session_token: str | None = None
    auth_type: AuthType = "keys"
    # When auth_type is 'environment' or 'instance_profile', boto3 handles the chain
    use_default_chain: bool = False


async def get_connection_credentials(connection_id: str) -> ResolvedCredentials | None:
    """
    Load an aws_connections row by ID and decrypt the secret key.
    Returns None if the connection doesn't exist.
    """
    row = await query_one(
        """
        SELECT id, name, region, "authType", "accessKeyId",
               "secretAccessKeyEncrypted", "roleArn", "externalId", "isDefault"
        FROM aws_connections WHERE id = $1
        """,
        connection_id,
    )
    if not row:
        return None
    return _resolve_from_row(dict(row))


async def get_default_connection_credentials() -> ResolvedCredentials | None:
    """Load the default aws_connections row (isDefault = true)."""
    row = await query_one(
        """
        SELECT id, name, region, "authType", "accessKeyId",
               "secretAccessKeyEncrypted", "roleArn", "externalId", "isDefault"
        FROM aws_connections WHERE "isDefault" = true
        ORDER BY "createdAt" DESC LIMIT 1
        """,
    )
    if not row:
        return None
    return _resolve_from_row(dict(row))


def _resolve_from_row(row: dict) -> ResolvedCredentials:
    auth_type: AuthType = row.get("authType", "keys")
    region: str = row.get("region", "us-east-1")
    encrypted_secret: str = row.get("secretAccessKeyEncrypted", "") or ""
    secret = decrypt_secret(encrypted_secret) if encrypted_secret else ""

    if auth_type in ("environment", "instance_profile"):
        return ResolvedCredentials(region=region, auth_type=auth_type, use_default_chain=True)

    if auth_type == "role":
        role_arn = row.get("roleArn", "")
        external_id = row.get("externalId", "")
        if role_arn:
            try:
                assumed = _assume_role(region, role_arn, external_id)
                if assumed:
                    return assumed
            except Exception as exc:
                logger.warning(f"[AWS STS] AssumeRole failed, falling back to keys: {exc}")

    # Static keys or role fallback
    return ResolvedCredentials(
        region=region,
        auth_type="keys",
        access_key_id=row.get("accessKeyId") or None,
        secret_access_key=secret or None,
    )


def _assume_role(region: str, role_arn: str, external_id: str) -> ResolvedCredentials | None:
    """STS AssumeRole — synchronous because boto3 STS doesn't need async."""
    sts = boto3.client("sts", region_name=region)
    kwargs = {
        "RoleArn": role_arn,
        "RoleSessionName": "PythonGatewayMonitorSession",
        "DurationSeconds": 3600,
    }
    if external_id:
        kwargs["ExternalId"] = external_id

    resp = sts.assume_role(**kwargs)
    creds = resp.get("Credentials", {})
    if not creds:
        return None
    return ResolvedCredentials(
        region=region,
        auth_type="role",
        access_key_id=creds["AccessKeyId"],
        secret_access_key=creds["SecretAccessKey"],
        session_token=creds.get("SessionToken"),
    )


def build_boto3_kwargs(creds: ResolvedCredentials) -> dict:
    """
    Build keyword arguments for boto3.client() / boto3.Session().
    Usage:
        apigw = boto3.client("apigateway", **build_boto3_kwargs(creds))
    """
    kwargs: dict = {"region_name": creds.region}
    if creds.use_default_chain:
        # Let boto3 use its default provider chain (env vars / IMDS / etc.)
        return kwargs
    if creds.access_key_id and creds.secret_access_key:
        kwargs["aws_access_key_id"] = creds.access_key_id
        kwargs["aws_secret_access_key"] = creds.secret_access_key
        if creds.session_token:
            kwargs["aws_session_token"] = creds.session_token
    return kwargs
