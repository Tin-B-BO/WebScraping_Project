# backend/api_app/auth.py
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
from jose import jwt
from jose.exceptions import JWTError, ExpiredSignatureError


def _load_root_env_file() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_root_env_file()

# JWT signing config loaded from env
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256" # JWT signing algorithm
JWT_EXPIRES_TIME = int(os.environ.get("JWT_EXPIRES_TIME", "2160"))  # 2160 minutes (3 days)


# password hashing
def hash_password(password: str) -> str:
    # prevent against None to avoid crashes
    if password is None:
        password = ""
    # create a unique salted hash for this password
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")

# check whether a plain password matches a stored bcrypt hash
def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

# build and sign a JWT access token containing the user id and expiry time.
def create_access_token(sub: str) -> str:
    # use UTC timestamps so token validity is timezone-independent.
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=JWT_EXPIRES_TIME)
    # basic token fields: user id, created time, and expiry time.
    payload = {
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


# decode JWT and return user id if valid
def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        # return user id if token is valid.
        return payload.get("sub")
    except ExpiredSignatureError:
        # treat expired tokens as unauthenticated.
        return None
    except JWTError:
        return None
