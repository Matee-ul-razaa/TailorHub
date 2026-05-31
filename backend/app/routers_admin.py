"""Admin-only endpoints (audit log viewer, etc.)."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_db
from .deps import require_role
from .models import AuditLog, User, UserRole

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: Optional[str]
    actor_email: Optional[str]
    actor_role: Optional[str]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    details_json: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action prefix, e.g. 'auth.'"),
    resource_type: Optional[str] = None,
    actor_email: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """List audit log entries (admin only). Newest first."""
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action.like(f"{action}%"))
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    if actor_email:
        q = q.filter(AuditLog.actor_email == actor_email)
    return q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
