"""
aws/crypto.py — AES-256-GCM encryption helpers.
MUST produce identical output to server/db.ts encryptSecret / decryptSecret.

Node implementation (reference):
  const ENCRYPTION_KEY = crypto.scryptSync(secret, 'salt_2026', 32);
  iv  = crypto.randomBytes(12)           → 12 bytes  (96-bit GCM nonce)
  tag = cipher.getAuthTag()              → 16 bytes  (GCM auth tag)
  stored format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
"""
from __future__ import annotations

import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend

from config import get_settings


def _derive_key() -> bytes:
    """
    Derive a 32-byte key using scrypt — identical parameters to Node's
    crypto.scryptSync(password, salt, 32).
    Node defaults: N=16384, r=8, p=1.
    """
    settings = get_settings()
    password = settings.encryption_secret.encode()
    salt = settings.encryption_salt

    kdf = Scrypt(
        salt=salt,
        length=32,
        n=16384,   # Node scryptSync default
        r=8,
        p=1,
        backend=default_backend(),
    )
    return kdf.derive(password)


# Derive once at module load (same approach as Node — module-level const)
_KEY: bytes = _derive_key()


def encrypt_secret(plaintext: str) -> str:
    """
    Encrypt a string with AES-256-GCM.
    Returns:  "<iv_hex>:<auth_tag_hex>:<ciphertext_hex>"
    Matches Node encryptSecret() exactly.
    """
    if not plaintext:
        return ""
    iv = os.urandom(12)                         # 96-bit nonce
    aesgcm = AESGCM(_KEY)
    # AESGCM.encrypt() appends the 16-byte auth tag to the ciphertext
    ct_with_tag = aesgcm.encrypt(iv, plaintext.encode(), None)
    ciphertext = ct_with_tag[:-16]
    auth_tag   = ct_with_tag[-16:]
    return f"{iv.hex()}:{auth_tag.hex()}:{ciphertext.hex()}"


def decrypt_secret(cipher_text: str) -> str:
    """
    Decrypt a string produced by encrypt_secret() (or Node's encryptSecret()).
    Returns the original plaintext, or the cipher_text as-is on failure
    (same fallback as Node decryptSecret()).
    """
    if not cipher_text:
        return ""
    parts = cipher_text.split(":")
    if len(parts) != 3:
        return cipher_text   # plain-text fallback
    try:
        iv        = bytes.fromhex(parts[0])
        auth_tag  = bytes.fromhex(parts[1])
        encrypted = bytes.fromhex(parts[2])
        aesgcm    = AESGCM(_KEY)
        # Re-assemble: ciphertext || auth_tag  (what AESGCM.decrypt expects)
        plaintext = aesgcm.decrypt(iv, encrypted + auth_tag, None)
        return plaintext.decode()
    except Exception:
        return cipher_text   # return as-is on decryption failure
