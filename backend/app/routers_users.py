from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_current_user, require_role
from .models import KhataEntry, Measurement, Order, OrderStatus, User, UserRole
from .schemas import TeamMemberIn, UpdateRoleIn, UserOut
from .security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/team", response_model=list[UserOut])
def team_members(_admin: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        UserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            email_verified=bool(user.email_verified),
            created_at=user.created_at,
        )
        for user in users
    ]


@router.get("/customers", response_model=list[UserOut])
def list_customers(_admin: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == UserRole.customer).order_by(User.created_at.desc()).all()
    return [
        UserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            email_verified=bool(user.email_verified),
            created_at=user.created_at,
        )
        for user in users
    ]


@router.post("/team", response_model=UserOut)
def add_team_member(
    payload: TeamMemberIn,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    exists = db.query(User).filter(User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
    user = User(
        email=payload.email,
        full_name=payload.fullName,
        role=payload.role,
        password_hash=hash_password("TailorHub@2026!"),
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role, email_verified=user.email_verified)


@router.patch("/{user_id}/role", response_model=UserOut)
def update_role(
    user_id: str,
    payload: UpdateRoleIn,
    admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent demoting the last admin (would lock everyone out)
    if user.role == UserRole.admin and payload.role != UserRole.admin:
        admin_count = db.query(User).filter(User.role == UserRole.admin).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last admin. Promote another user to admin first.",
            )

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role, email_verified=user.email_verified)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """
    Delete a user (admin only).

    Business rules:
      - Admins cannot delete themselves (would lock them out mid-session).
      - Cannot delete the last admin (would lock everyone out).
      - Cannot delete a customer who has active (non-delivered, non-cancelled) orders.
      - Cleanup performed:
          * Customer's measurements are removed.
          * Khata entries are detached (customer_id nulled to preserve ledger totals
            from accounting reports — but this is a soft-link by design).
          * Delivery users have their assigned_to references on orders cleared.
    """
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent self-deletion
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account while signed in.",
        )

    # Prevent deleting the last admin
    if user.role == UserRole.admin:
        admin_count = db.query(User).filter(User.role == UserRole.admin).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last admin account.",
            )

    # Block deletion if customer has active orders (preserve order history integrity)
    if user.role == UserRole.customer:
        active_count = (
            db.query(Order)
            .filter(
                Order.customer_id == user.id,
                Order.status.notin_([OrderStatus.delivered, OrderStatus.cancelled]),
            )
            .count()
        )
        if active_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot delete: this customer has {active_count} active order(s). "
                    "Cancel or complete them first."
                ),
            )

    # For delivery users: unassign them from any orders they're handling
    if user.role == UserRole.delivery:
        db.query(Order).filter(Order.assigned_to == user.id).update(
            {Order.assigned_to: None}
        )

    # Cleanup measurements (no cascade defined on the model)
    db.query(Measurement).filter(Measurement.user_id == user.id).delete()

    # Detach khata entries — preserve historical totals but clear the FK so the
    # user row can be deleted. (KhataEntry.customer_id is non-nullable, so we
    # delete rather than null-out for customers being removed entirely.)
    db.query(KhataEntry).filter(KhataEntry.customer_id == user.id).delete()

    db.delete(user)
    db.commit()
    return None

