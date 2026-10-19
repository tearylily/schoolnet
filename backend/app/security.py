"""Senhas (PBKDF2), JWT e dependências de autenticação/permissão."""

import base64
import hashlib
import hmac
import os
import secrets
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

def _load_secret_key() -> str:
    """SECRET_KEY do ambiente; senão gera uma chave aleatória e guarda em .secret_key."""
    env = os.getenv("SECRET_KEY")
    if env:
        return env

    path = Path(__file__).resolve().parent.parent / ".secret_key"
    if path.exists():
        return path.read_text().strip()

    key = secrets.token_hex(32)
    path.write_text(key)
    return key


SECRET_KEY = _load_secret_key()
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "480"))  # 8 horas

PBKDF2_ITERATIONS = 200_000

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


# ---------------------------------------------------------
# Senhas
# ---------------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode(),
        base64.b64encode(digest).decode(),
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, digest = stored.split("$")
        expected = base64.b64decode(digest)
        calculated = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), base64.b64decode(salt), int(iterations)
        )
        return hmac.compare_digest(calculated, expected)
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------
# JWT
# ---------------------------------------------------------

def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


# ---------------------------------------------------------
# Dependências
# ---------------------------------------------------------

def get_current_user(token: str = Depends(oauth2_scheme)) -> sqlite3.Row:
    # Import tardio para evitar import circular (database importa security)
    from .database import connect

    erro = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise erro

    conn = connect()
    try:
        user = conn.execute(
            "SELECT id, name, email, role FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    finally:
        conn.close()

    if user is None:
        raise erro

    return user


def require_role(*roles: str):
    """Permite o acesso só para os perfis informados (403 para os demais)."""

    def checker(user: sqlite3.Row = Depends(get_current_user)) -> sqlite3.Row:
        if user["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Sem permissão.")
        return user

    return checker
