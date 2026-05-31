"""Audit log service — append-only event tracking.

Use `record_audit(...)` from any router/service to log a security or
compliance-relevant event. Failures here MUST never break the parent request:
all writes are wrapped in try/except and silently logged to stdout.
"""
from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import Request
from sqlalchemy.orm import Session

from ..models import AuditLog, User


def _client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    # Honour X-Forwarded-For if behind a proxy
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _user_agent(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    return request.headers.get("user-agent", "")[:255] or None


def record_audit(
    db: Session,
    *,
    action: str,
    actor: Optional[User] = None,
    actor_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    request: Optional[Request] = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    """Insert an audit row. Never raises — failures are swallowed."""
    try:
        details_json = json.dumps(details, default=str) if details else None
        entry = AuditLog(
            actor_user_id=(actor.id if actor else None),
            actor_email=(actor.email if actor else actor_email),
            actor_role=(actor.role.value if actor and hasattr(actor.role, "value") else None),
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            ip_address=_client_ip(request),
            user_agent=_user_agent(request),
            details_json=details_json,
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        # Audit must never break the parent request
        try:
            db.rollback()
        except Exception:
            pass
        print(f"[AUDIT] Failed to record '{action}': {e}")
