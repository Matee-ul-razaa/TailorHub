import os
import sys

# Ensure backend directory is on python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import Base, engine, SessionLocal
from app.models import (
    User, UserRole, Order, OrderItem, Payment, KhataEntry,
    Expense, Invoice, Appointment, Measurement, Notification,
    AuditLog, OTPCode
)
from app.security import hash_password
from app.config import settings

def reset_database(db=None):
    close_at_end = False
    if db is None:
        db = SessionLocal()
        close_at_end = True

    try:
        print("Ensuring tables exist with latest schema...")
        Base.metadata.create_all(bind=engine)

        print("Deleting transactional records...")
        # Delete in order respecting foreign keys
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

        # Delete customer accounts, preserve admin and rider
        preserved_emails = [
            settings.DEFAULT_ADMIN_EMAIL.lower(),
            "admin@tailorhub.pk",
            "rider@tailorhub.pk"
        ]
        db.query(User).filter(User.role == UserRole.customer).delete()
        # Also ensure any other non-admin/non-rider users are removed
        for u in db.query(User).all():
            if u.email.lower() not in preserved_emails and u.role not in (UserRole.admin, UserRole.delivery):
                db.delete(u)

        db.commit()

        # Ensure default admin exists
        admin = db.query(User).filter(User.email == settings.DEFAULT_ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                email=settings.DEFAULT_ADMIN_EMAIL,
                password_hash=hash_password(settings.DEFAULT_ADMIN_PASSWORD or "TailorHub@2026!"),
                full_name=settings.DEFAULT_ADMIN_NAME or "Store Admin",
                role=UserRole.admin,
                email_verified=True,
            )
            db.add(admin)

        # Ensure default delivery rider exists
        rider = db.query(User).filter(User.email == "rider@tailorhub.pk").first()
        if not rider:
            rider = User(
                email="rider@tailorhub.pk",
                password_hash=hash_password("Rider@123456"),
                full_name="Delivery Rider",
                role=UserRole.delivery,
                email_verified=True,
            )
            db.add(rider)

        db.commit()

        print("Verification:")
        print(f"  Orders: {db.query(Order).count()}")
        print(f"  Order Items: {db.query(OrderItem).count()}")
        print(f"  Khata Entries: {db.query(KhataEntry).count()}")
        print(f"  Expenses: {db.query(Expense).count()}")
        print(f"  Invoices: {db.query(Invoice).count()}")
        print(f"  Payments: {db.query(Payment).count()}")
        print(f"  Appointments: {db.query(Appointment).count()}")
        print(f"  Measurements: {db.query(Measurement).count()}")
        print(f"  Users: {db.query(User).count()} (Admin: {settings.DEFAULT_ADMIN_EMAIL}, Rider: rider@tailorhub.pk)")
        print("Database successfully reset to clean state (all transactional data is 0)!")

    finally:
        if close_at_end:
            db.close()

if __name__ == "__main__":
    reset_database()
