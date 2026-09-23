import stripe
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, Header
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .deps import get_current_user, require_role
from .models import Order, OrderStatus, Payment, User, PaymentMethod, PaymentStatus, UserRole
from .schemas import PaymentOut
from .services.audit_service import record_audit
from .services.notification_service import notify
from .services.webhook_service import handle_stripe_event
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _get_stripe():
    if not settings.stripe_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe payments not configured."
        )
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe

class CreateStripeSessionIn(BaseModel):
    orderId: str
    paymentType: str # "advance" or "full"

@router.post("/create-checkout-session")
def create_checkout_session(
    payload: CreateStripeSessionIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.get(Order, payload.orderId)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.paymentType == "advance":
        amount_due = (order.total_amount / 2) - order.advance_amount
        description = "Advance Payment (50%)"
    else:
        amount_due = order.total_amount - order.amount_paid
        description = "Full/Remaining Payment"

    if amount_due <= 0:
        raise HTTPException(status_code=400, detail="No remaining balance.")

    # Determine base frontend URL dynamically from the request, bypassing protected Vercel previews
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    frontend_base = settings.public_frontend_url
    if origin and ("vercel.app" in origin or "localhost" in origin or origin in settings.cors_origins):
        frontend_base = origin.rstrip("/")
    elif referer and ("vercel.app" in referer or "localhost" in referer):
        from urllib.parse import urlparse
        p = urlparse(referer)
        frontend_base = f"{p.scheme}://{p.netloc}"

    if "frontend-hvg2vxuru" in frontend_base:
        frontend_base = "https://tailorhub-pk.vercel.app"

    frontend_base = frontend_base.rstrip("/")

    _stripe = _get_stripe()
    try:
        session = _stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'pkr',
                    'product_data': {
                        'name': f"Tailor Hub Order: {order.id}",
                        'description': description,
                    },
                    'unit_amount': int(amount_due * 100),
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{frontend_base}/payment-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_base}/cart",
            client_reference_id=order.id,
            metadata={
                "order_id": order.id,
                "payment_type": payload.paymentType,
            },
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {e}")

@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None),
    db: Session = Depends(get_db),
):
    _stripe = _get_stripe()
    raw_body = await request.body()
    try:
        event = _stripe.Webhook.construct_event(
            raw_body, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signature verification failed: {e}")

    try:
        handle_stripe_event(db, event)
    except Exception:
        # Service already logged it; return 200 so Stripe doesn't retry forever
        pass
    
    return {"status": "received"}


if settings.ENVIRONMENT != "production":
    @router.post("/simulate_webhook")
    def simulate_webhook(order_id: str, amount: float, p_type: str, db: Session = Depends(get_db)):
        from .services.webhook_service import _handle_checkout_completed
        mock_event = {
            'data': {
                'object': {
                    'metadata': {
                        'order_id': order_id,
                        'payment_type': p_type,
                    },
                    'amount_total': amount * 100,
                    'payment_intent': 'pi_mock_simulate',
                }
            }
        }
        try:
            _handle_checkout_completed(db, mock_event)
        except Exception as e:
            print(f"Simulated webhook error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        return {"status": "success"}


def _to_out(p: Payment) -> PaymentOut:
    return PaymentOut(
        id=p.id,
        orderId=p.order_id,
        method=p.method,
        status=p.status,
        amount=p.amount,
        last4=p.last4,
        cardBrand=p.card_brand,
        transactionId=p.transaction_id,
        createdAt=p.created_at,
    )

@router.get("/methods")
def list_payment_methods():
    """List supported payment methods for checkout UI."""
    return [
        {"id": PaymentMethod.cod.value, "label": "Cash on Delivery"},
        {"id": PaymentMethod.card.value, "label": "Card"},
    ]

@router.get("/{order_id}", response_model=PaymentOut)
def get_payment(order_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="No payment found")
    order = db.get(Order, order_id)
    if order and order.customer_id != user.id and user.role.value not in ('admin',):
        raise HTTPException(status_code=403, detail="Forbidden")
    return _to_out(payment)


@router.patch("/{payment_id}/mark-paid")
def mark_payment_paid(
    payment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delivery staff marks a COD payment as collected. (Part B2.4)"""
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.method != PaymentMethod.cod:
        raise HTTPException(400, "Only COD payments can be marked manually")
    if user.role not in (UserRole.admin, UserRole.delivery):
        raise HTTPException(403, "Forbidden")
    if user.role == UserRole.delivery:
        order = db.get(Order, payment.order_id)
        if order.assigned_to != user.id:
            raise HTTPException(403, "Not your order")
    
    from .models import PaymentStatus
    payment.status = PaymentStatus.completed
    order = db.get(Order, payment.order_id)
    order.amount_paid = order.total_amount
    
    # Mark any existing unpaid invoices as paid
    from .models import Invoice, InvoiceStatus
    from .invoice_service import mark_invoice_paid
    unpaid_invoices = db.query(Invoice).filter(
        Invoice.order_id == order.id,
        Invoice.status == InvoiceStatus.unpaid
    ).all()
    for inv in unpaid_invoices:
        mark_invoice_paid(db, inv, "cod")
        
    db.commit()
    return {"message": "COD payment recorded"}


# ── Refund (admin only) ──────────────────────────────────────────────────────

class RefundIn(BaseModel):
    amount: Optional[float] = Field(
        default=None,
        gt=0,
        description="Amount to refund. If omitted, refunds the full payment amount.",
    )
    reason: Optional[str] = Field(
        default=None,
        description="Reason: requested_by_customer | duplicate | fraudulent | (free text in notes)",
    )
    cancel_order: bool = Field(
        default=True,
        description="If true, also marks the order as 'cancelled' on a full refund.",
    )


class RefundOut(BaseModel):
    payment_id: int
    order_id: str
    refund_id: str
    refunded_amount: float
    new_payment_status: str
    new_order_status: str


@router.post("/{order_id}/refund", response_model=RefundOut)
def refund_payment(
    order_id: str,
    payload: RefundIn,
    request: Request,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Issue a Stripe refund for a card payment, partial or full.

    Business rules:
      - Only admins can issue refunds.
      - Card payments only (COD refunds must be handled out-of-band).
      - Payment must be in `completed` state.
      - Refund amount cannot exceed the captured amount.
      - Idempotent at the audit level — re-firing for an already-refunded
        payment returns 400.
    """
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No payment found for this order")

    if payment.method != PaymentMethod.card:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only card payments can be refunded via Stripe. COD payments must be handled manually.",
        )
    if payment.status != PaymentStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment is not in 'completed' status (current: {payment.status.value}).",
        )
    if not payment.transaction_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment has no Stripe transaction reference; cannot refund automatically.",
        )

    refund_amount = payload.amount if payload.amount is not None else float(payment.amount)
    if refund_amount <= 0 or refund_amount > float(payment.amount):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Refund amount must be between 0 and {payment.amount}.",
        )

    is_full_refund = abs(refund_amount - float(payment.amount)) < 0.01

    _stripe = _get_stripe()
    try:
        refund = _stripe.Refund.create(
            payment_intent=payment.transaction_id,
            amount=int(round(refund_amount * 100)),
            reason=payload.reason if payload.reason in {"requested_by_customer", "duplicate", "fraudulent"} else None,
            metadata={"order_id": order.id},
        )
    except stripe.error.StripeError as e:  # type: ignore[attr-defined]
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Stripe refund failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Refund error: {e}")

    # Update local state
    payment.status = PaymentStatus.refunded if is_full_refund else PaymentStatus.completed
    order.amount_paid = max(0.0, float(order.amount_paid) - refund_amount)
    new_order_status = order.status
    if is_full_refund and payload.cancel_order and order.status != OrderStatus.delivered:
        order.status = OrderStatus.cancelled
        new_order_status = OrderStatus.cancelled
    db.commit()

    # Audit
    record_audit(
        db, action="payment.refund", actor=_admin, resource_type="payment", resource_id=str(payment.id),
        request=request,
        details={
            "order_id": order.id,
            "refund_id": getattr(refund, "id", None),
            "amount": refund_amount,
            "is_full": is_full_refund,
            "reason": payload.reason,
            "cancelled_order": is_full_refund and payload.cancel_order and new_order_status == OrderStatus.cancelled,
        },
    )

    # Notify the customer
    notify(
        db, user_id=order.customer_id, type="payment.refunded",
        title=f"Refund issued: Rs. {refund_amount:.0f}",
        body=f"A refund for order {order.id} has been processed. It may take 5-10 days to appear.",
        link=f"/tracking/{order.id}",
    )

    return RefundOut(
        payment_id=payment.id,
        order_id=order.id,
        refund_id=getattr(refund, "id", "") or "",
        refunded_amount=refund_amount,
        new_payment_status=payment.status.value,
        new_order_status=new_order_status.value if hasattr(new_order_status, "value") else str(new_order_status),
    )
