from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_current_user, require_role
from .models import Appointment, AppointmentStatus, Notification, User, UserRole
from .schemas import AppointmentCreateIn, AppointmentOut, AppointmentStatusUpdateIn

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Customer submits an appointment request for tailor measurements."""
    if not payload.phone.strip():
        raise HTTPException(status_code=400, detail="Phone number is required")
    if not payload.appointment_date.strip():
        raise HTTPException(status_code=400, detail="Appointment date is required")
    if not payload.time_slot.strip():
        raise HTTPException(status_code=400, detail="Time slot is required")

    customer_name = user.full_name or user.email.split("@")[0]
    appointment = Appointment(
        user_id=user.id,
        customer_name=customer_name,
        customer_email=user.email,
        phone=payload.phone.strip(),
        appointment_date=payload.appointment_date.strip(),
        time_slot=payload.time_slot.strip(),
        notes=payload.notes.strip() if payload.notes else None,
        status=AppointmentStatus.pending,
    )
    db.add(appointment)
    db.flush()

    # Notify admins about new appointment request
    admins = db.query(User).filter(User.role == UserRole.admin).all()
    for admin in admins:
        db.add(
            Notification(
                user_id=admin.id,
                type="appointment.new",
                title="New Appointment Request",
                body=f"{customer_name} requested a measurement appointment for {payload.appointment_date} ({payload.time_slot}).",
                link="/admin?tab=appointments",
            )
        )

    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("/my", response_model=list[AppointmentOut])
def list_my_appointments(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all appointments belonging to the logged-in customer."""
    return (
        db.query(Appointment)
        .filter(Appointment.user_id == user.id)
        .order_by(Appointment.created_at.desc())
        .all()
    )


@router.get("", response_model=list[AppointmentOut])
def list_all_appointments(
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status"),
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Admin endpoint to list all customer appointments with optional status filtering."""
    q = db.query(Appointment)
    if status_filter:
        q = q.filter(Appointment.status == status_filter)
    return q.order_by(Appointment.created_at.desc()).all()


@router.patch("/{appointment_id}/status", response_model=AppointmentOut)
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdateIn,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Admin approves, rejects, or completes a customer's appointment request."""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appointment.status = payload.status
    if payload.admin_notes is not None:
        appointment.admin_notes = payload.admin_notes.strip()
    appointment.updated_at = datetime.utcnow()

    # Send in-app notification to the customer
    if payload.status == AppointmentStatus.approved:
        title = "Appointment Approved! ✓"
        body = f"Your measurement appointment for {appointment.appointment_date} ({appointment.time_slot}) has been approved by our Master Tailor."
    elif payload.status == AppointmentStatus.rejected:
        title = "Appointment Declined"
        reason = f" Note: {payload.admin_notes}" if payload.admin_notes else ""
        body = f"Your measurement appointment for {appointment.appointment_date} could not be scheduled.{reason} Please select another time slot."
    elif payload.status == AppointmentStatus.completed:
        title = "Appointment Completed"
        body = f"Your measurement session on {appointment.appointment_date} has been marked as completed."
    else:
        title = f"Appointment status updated to {payload.status.value}"
        body = f"Your appointment on {appointment.appointment_date} status has been updated."

    db.add(
        Notification(
            user_id=appointment.user_id,
            type="appointment.status",
            title=title,
            body=body,
            link="/measurements",
        )
    )

    db.commit()
    db.refresh(appointment)
    return appointment


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(
    appointment_id: int,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Admin can delete an appointment."""
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    db.delete(appointment)
    db.commit()
    return None
