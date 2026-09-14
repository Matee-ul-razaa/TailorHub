from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr

from .models import AppointmentStatus, OrderStatus, PaymentMethod, PaymentStatus, UserRole, WearType


# ── Auth ──────────────────────────────────────────────────────────────────────

class AuthRegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    # Role is always 'customer' for self-registration.
    # Admins/delivery staff are created by an admin in the dashboard.


class AuthLoginIn(BaseModel):
    email: EmailStr
    password: str


class AuthTokenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: Optional[str]= None
    role: UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole
    email_verified: bool


# ── Products ──────────────────────────────────────────────────────────────────

class ProductIn(BaseModel):
    id: str
    name: str
    description: str
    price: float
    category: str
    wearType: WearType
    image: str
    availableModes: list[str]
    fabric: Optional[str]= None
    colors: list[str]
    sizes: list[str]
    featured: bool = False
    hasWaistcoatOption: bool = False
    suitOptions: Optional[list[str]]= None
    brand: Optional[str]= None
    isSoldOut: bool = False


class ProductOut(ProductIn):
    model_config = ConfigDict(from_attributes=True)


# ── Orders ────────────────────────────────────────────────────────────────────

class OrderItemIn(BaseModel):
    productId: str
    productName: str
    quantity: int
    unitPrice: float
    color: Optional[str]= None
    size: Optional[str]= None
    purchaseMode: Optional[str]= None
    garmentCategory: Optional[str]= None
    measurementType: Optional[str]= None
    measurements: Optional[dict[str, float]]= None


class OrderIn(BaseModel):
    customerName: str
    customerEmail: EmailStr
    totalAmount: float
    advanceAmount: float
    notes: Optional[str]= None
    deliveryAddress: Optional[str]= None
    deliveryPhone: Optional[str]= None
    deliveryCity: Optional[str]= None
    paymentMethod: PaymentMethod = PaymentMethod.card
    items: list[OrderItemIn]


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    productId: str
    productName: str
    quantity: int
    unitPrice: float
    color: Optional[str]= None
    size: Optional[str]= None
    purchaseMode: Optional[str]= None
    garmentCategory: Optional[str]= None
    measurementType: Optional[str]= None
    measurements: Optional[dict[str, float]]= None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    customerName: str
    customerEmail: EmailStr
    status: OrderStatus
    totalAmount: float
    advanceAmount: float
    amountPaid: float
    assignedTo: Optional[str]= None
    notes: Optional[str]= None
    deliveryAddress: Optional[str]= None
    deliveryPhone: Optional[str]= None
    deliveryCity: Optional[str]= None
    signatureImage: Optional[str]= None
    createdAt: datetime
    items: list[OrderItemOut]
    payment: "PaymentOut" = None


class UpdateOrderStatusIn(BaseModel):
    status: OrderStatus
    signature: Optional[str]= None


class AssignOrderIn(BaseModel):
    assignedTo: Optional[str]= None


# ── Team ──────────────────────────────────────────────────────────────────────

class TeamMemberIn(BaseModel):
    fullName: str
    email: EmailStr
    role: UserRole


class UpdateRoleIn(BaseModel):
    role: UserRole


# ── Measurements ──────────────────────────────────────────────────────────────

class MeasurementIn(BaseModel):
    garmentType: str
    label: Optional[str]= None
    data: dict[str, float]


class MeasurementUpdateIn(BaseModel):
    label: Optional[str]= None
    data: Optional[dict[str, float]]= None


class MeasurementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uniqueCode: str
    garmentType: str
    label: Optional[str]= None
    data: dict[str, float]
    createdAt: datetime
    updatedAt: datetime


# ── Payments ──────────────────────────────────────────────────────────────────

class PaymentIn(BaseModel):
    orderId: str
    method: PaymentMethod
    amount: float
    cardNumber: Optional[str]= None
    cardExpiry: Optional[str]= None
    cardCvv: Optional[str]= None
    cardName: Optional[str]= None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    orderId: str
    method: PaymentMethod
    status: PaymentStatus
    amount: float
    last4: Optional[str]= None
    cardBrand: Optional[str]= None
    transactionId: Optional[str]= None
    createdAt: datetime


# ── Inventory ─────────────────────────────────────────────────────────────────

class InventoryItemIn(BaseModel):
    name: str
    quantity: float
    unit: str = "meters"
    price_per_unit: float
    threshold: float = 10.0
    is_sold_out: bool = False

class InventoryItemOut(InventoryItemIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    updated_at: datetime

# ── Khata ─────────────────────────────────────────────────────────────────────

class KhataEntryIn(BaseModel):
    customer_id: str
    order_id: Optional[str]= None
    type: str # "credit" or "payment"
    amount: float
    notes: Optional[str]= None

class KhataEntryOut(KhataEntryIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime

# ── Expenses ──────────────────────────────────────────────────────────────────

class ExpenseIn(BaseModel):
    category: str
    amount: float
    description: Optional[str]= None

class ExpenseOut(ExpenseIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    expense_date: datetime


# ── Appointments ─────────────────────────────────────────────────────────────

class AppointmentCreateIn(BaseModel):
    phone: str
    appointment_date: str
    time_slot: str
    notes: Optional[str] = None


class AppointmentStatusUpdateIn(BaseModel):
    status: AppointmentStatus
    admin_notes: Optional[str] = None


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: str
    customer_name: str
    customer_email: str
    phone: str
    appointment_date: str
    time_slot: str
    notes: Optional[str] = None
    status: AppointmentStatus
    admin_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
