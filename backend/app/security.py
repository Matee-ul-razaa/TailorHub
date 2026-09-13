from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: Optional[str]) -> bool:
    """Verify a plain password against a bcrypt hash.

    Returns False for OAuth users (no hash) and for any stored hash that is not
    a recognizable bcrypt hash (e.g. a legacy MySQL ``PASSWORD()`` value). This
    keeps login failures at HTTP 401 instead of crashing with a 500.
    """
    if not password_hash:
        return False
    try:
        return pwd_context.verify(password, password_hash)
    except (UnknownHashError, ValueError):
        return False


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
