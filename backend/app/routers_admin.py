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


@router.post("/reset-database")
def reset_database(
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """
    Reset all transactional data to clean zero state:
    - Orders & Order Items
    - Payments
    - Khata Entries & Expenses
    - Invoices
    - Appointments
    - Measurements
    - Notifications
    - Audit Logs
    - Customer accounts (preserves default admin and delivery rider)
    """
    from .models import (
        Order, OrderItem, Payment, KhataEntry,
        Expense, Invoice, Appointment, Measurement,
        Notification, OTPCode
    )
    from .config import settings
    from .security import hash_password

    # 1. Delete transactional records in correct foreign key order
    db.query(KhataEntry).delete()
    db.query(Invoice).delete()
    db.query(Payment).delete()
    db.query(OrderItem).delete()
    db.query(Order).delete()
    db.query(Appointment).delete()
    db.query(Measurement).delete()
    db.query(Notification).delete()
    db.query(AuditLog).delete()
    db.query(Expense).delete()
    db.query(OTPCode).delete()

    # 2. Clean up customer accounts, preserve admin & rider
    preserved_emails = {
        settings.DEFAULT_ADMIN_EMAIL.lower(),
        "admin@tailorhub.pk",
        "rider@tailorhub.pk",
    }
    db.query(User).filter(User.role == UserRole.customer).delete()
    for u in db.query(User).all():
        if u.email.lower() not in preserved_emails and u.role not in (UserRole.admin, UserRole.delivery):
            db.delete(u)

    db.commit()

    # 3. Ensure default admin exists
    admin = db.query(User).filter(User.email == settings.DEFAULT_ADMIN_EMAIL).first()
    if not admin:
        db.add(
            User(
                email=settings.DEFAULT_ADMIN_EMAIL,
                password_hash=hash_password(settings.DEFAULT_ADMIN_PASSWORD or "TailorHub@2026!"),
                full_name=settings.DEFAULT_ADMIN_NAME or "Store Admin",
                role=UserRole.admin,
                email_verified=True,
            )
        )

    # 4. Ensure default delivery rider exists
    rider = db.query(User).filter(User.email == "rider@tailorhub.pk").first()
    if not rider:
        db.add(
            User(
                email="rider@tailorhub.pk",
                password_hash=hash_password("Rider@123456"),
                full_name="Delivery Rider",
                role=UserRole.delivery,
                email_verified=True,
            )
        )

    db.commit()

    return {
        "success": True,
        "message": "Database successfully reset to 0. All test orders, khata entries, invoices, and customer data have been cleared.",
        "counts": {
            "orders": 0,
            "khata_entries": 0,
            "expenses": 0,
            "invoices": 0,
            "payments": 0,
            "appointments": 0,
            "measurements": 0,
            "active_users": db.query(User).count()
        }
    }

