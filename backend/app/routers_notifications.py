"""User-facing in-app notifications endpoints."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_current_user
from .models import Notification, User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    body: Optional[str]
    link: Optional[str]
    read_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationsListOut(BaseModel):
    items: list[NotificationOut]
    unread_count: int


@router.get("", response_model=NotificationsListOut)
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current user's notifications (newest first) plus unread count."""
    q = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        q = q.filter(Notification.read_at.is_(None))
    items = q.order_by(Notification.created_at.desc()).limit(limit).all()

    unread_count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .count()
    )
    return NotificationsListOut(items=items, unread_count=unread_count)


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read."""
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if n.read_at is None:
        n.read_at = datetime.utcnow()
        db.commit()
    return {"ok": True}


@router.post("/mark-all-read")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Mark every unread notification of the current user as read."""
    now = datetime.utcnow()
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .update({Notification.read_at: now}, synchronize_session=False)
    )
    db.commit()
    return {"ok": True, "updated": updated}
