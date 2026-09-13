from datetime import datetime
from enum import Enum
import uuid
import random
import string

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class UserRole(str, Enum):
    customer = "customer"
    admin = "admin"
    delivery = "delivery"


class WearType(str, Enum):
    traditional = "traditional"
    western = "western"


class OrderStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    cutting = "cutting"
    stitching = "stitching"
    processing = "processing"
    ready = "ready"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    cancelled = "cancelled"


class PaymentStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"
    refunded = "refunded"


class PaymentMethod(str, Enum):
    card = "card"
    cod = "cod"


class InvoiceType(str, Enum):
    advance = "advance"
    full = "full"
    balance = "balance"


class InvoiceStatus(str, Enum):
    unpaid = "unpaid"
    paid = "paid"
    overdue = "overdue"
    cancelled = "cancelled"


class OTPPurpose(str, Enum):
    email_verification = "email_verification"
    password_reset = "password_reset"


class WebhookProvider(str, Enum):
    stripe = "stripe"


class WebhookEventStatus(str, Enum):
    received = "received"
    processed = "processed"
    failed = "failed"


def generate_measurement_code():
    digits = ''.join(random.choices(string.digits, k=4))
    return f"TH-M-{digits}"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True) # made optional for OAuth
    full_name: Mapped[str] = mapped_column(String(150), nullable=True)
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole), default=UserRole.customer, nullable=False)
    auth_provider: Mapped[str] = mapped_column(String(50), nullable=True, default="local")
    oauth_id: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    wear_type: Mapped[WearType] = mapped_column(SqlEnum(WearType), nullable=False)
    image: Mapped[str] = mapped_column(Text, nullable=False)
    available_modes: Mapped[str] = mapped_column(Text, nullable=False)
    fabric: Mapped[str] = mapped_column(String(120), nullable=True)
    colors: Mapped[str] = mapped_column(Text, nullable=False)
    sizes: Mapped[str] = mapped_column(Text, nullable=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_waistcoat_option: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    suit_options: Mapped[str] = mapped_column(Text, nullable=True)
    brand: Mapped[str] = mapped_column(String(100), nullable=True)
    is_sold_out: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(150), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(SqlEnum(OrderStatus), default=OrderStatus.pending, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    advance_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    amount_paid: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    assigned_to: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    delivery_address: Mapped[str] = mapped_column(Text, nullable=True)
    delivery_phone: Mapped[str] = mapped_column(String(30), nullable=True)
    delivery_city: Mapped[str] = mapped_column(String(100), nullable=True)
    # Use a large text field (LONGTEXT in MySQL) to safely store base64 PNG signatures
    signature_image: Mapped[str] = mapped_column(Text(length=4294967295), nullable=True)
    inventory_consumed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)  # set once when stock is decremented (idempotency guard)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment: Mapped["Payment"] = relationship("Payment", back_populates="order", uselist=False, cascade="all, delete-orphan")
    invoices: Mapped[list["Invoice"]] = relationship("Invoice", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(String(32), ForeignKey("orders.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(String(64), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    color: Mapped[str] = mapped_column(String(60), nullable=True)
    size: Mapped[str] = mapped_column(String(30), nullable=True)
    purchase_mode: Mapped[str] = mapped_column(String(30), nullable=True)
    garment_category: Mapped[str] = mapped_column(String(64), nullable=True)
    measurement_type: Mapped[str] = mapped_column(String(128), nullable=True)
    measurements_json: Mapped[str] = mapped_column(Text, nullable=True)

    order: Mapped[Order] = relationship("Order", back_populates="items")


class Measurement(Base):
    __tablename__ = "measurements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    unique_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, default=generate_measurement_code)
    garment_type: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=True)
    data_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(String(32), ForeignKey("orders.id"), nullable=False, unique=True)
    method: Mapped[PaymentMethod] = mapped_column(SqlEnum(PaymentMethod), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(SqlEnum(PaymentStatus), default=PaymentStatus.pending, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    last4: Mapped[str] = mapped_column(String(4), nullable=True)
    card_brand: Mapped[str] = mapped_column(String(20), nullable=True)
    transaction_id: Mapped[str] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    order: Mapped[Order] = relationship("Order", back_populates="payment")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    unit: Mapped[str] = mapped_column(String(50), default="meters")
    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, default=10.0) # Low stock alert threshold
    # Admin-controlled sold-out toggle (independent of computed stock level).
    # Use to manually hide items even when quantity > 0 (e.g. discontinued fabric).
    is_sold_out: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KhataEntry(Base):
    __tablename__ = "khata_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    order_id: Mapped[str] = mapped_column(String(32), ForeignKey("orders.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(20)) # "credit", "payment"
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. Electricity, Rent, Thread
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    expense_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invoice_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    order_id: Mapped[str] = mapped_column(String(32), ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    type: Mapped[InvoiceType] = mapped_column(SqlEnum(InvoiceType), nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False)
    delivery_fee: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(SqlEnum(InvoiceStatus), default=InvoiceStatus.unpaid, nullable=False, index=True)
    due_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    pdf_path: Mapped[str] = mapped_column(String(500), nullable=True)
    email_sent_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    order: Mapped[Order] = relationship("Order", back_populates="invoices")


class OTPCode(Base):
    __tablename__ = "otp_codes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[OTPPurpose] = mapped_column(SqlEnum(OTPPurpose), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    consumed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class WebhookEvent(Base):
    __tablename__ = "webhook_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[WebhookProvider] = mapped_column(SqlEnum(WebhookProvider), nullable=False, index=True)
    event_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[WebhookEventStatus] = mapped_column(SqlEnum(WebhookEventStatus), default=WebhookEventStatus.received, nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Notification(Base):
    """In-app notification for a single user.

    Notifications are user-scoped, soft-readable (read_at), and contain a
    short title + body. Optional `link` lets the frontend deep-link the user
    to a relevant page (e.g. an order detail).
    """
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # e.g. "order.status", "order.new"
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=True)
    link: Mapped[str] = mapped_column(String(255), nullable=True)  # e.g. "/tracking/ORD-XXXXXXXX"
    read_at: Mapped[datetime] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class AuditLog(Base):
    """Append-only audit trail for security/compliance-relevant actions.

    Records: who did what, on which resource, with optional metadata.
    Never UPDATE or DELETE rows here — only INSERT.
    """
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_user_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)  # null for anonymous (e.g. failed login)
    actor_email: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    actor_role: Mapped[str] = mapped_column(String(20), nullable=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)  # e.g. "auth.login.success"
    resource_type: Mapped[str] = mapped_column(String(50), nullable=True, index=True)  # e.g. "order", "user"
    resource_id: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str] = mapped_column(String(255), nullable=True)
    details_json: Mapped[str] = mapped_column(Text, nullable=True)  # JSON-encoded extra context
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
