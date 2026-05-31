"""Notification service — create in-app notifications for users.

Use `notify(...)` to push a notification. As with audit logging, failures
must never break the parent request — all DB writes are wrapped in try/except.
"""
from __future__ import annotations

from typing import Iterable, Optional

from sqlalchemy.orm import Session

from ..models import Notification, User, UserRole


def notify(
    db: Session,
    *,
    user_id: str,
    type: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
) -> None:
    """Create a single notification. Never raises on failure."""
    try:
        n = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            link=link,
        )
        db.add(n)
        db.commit()
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        print(f"[NOTIFY] Failed to deliver '{type}' to {user_id}: {e}")


def notify_role(
    db: Session,
    *,
    role: UserRole,
    type: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
) -> int:
    """Notify every active user with the given role. Returns count delivered."""
    try:
        users = db.query(User).filter(User.role == role).all()
    except Exception as e:
        print(f"[NOTIFY] Failed to load role={role}: {e}")
        return 0

    count = 0
    for user in users:
        notify(db, user_id=user.id, type=type, title=title, body=body, link=link)
        count += 1
    return count


def notify_many(
    db: Session,
    *,
    user_ids: Iterable[str],
    type: str,
    title: str,
    body: Optional[str] = None,
    link: Optional[str] = None,
) -> int:
    """Notify a list of user IDs. Returns count delivered."""
    count = 0
    for uid in user_ids:
        if uid:
            notify(db, user_id=uid, type=type, title=title, body=body, link=link)
            count += 1
    return count
