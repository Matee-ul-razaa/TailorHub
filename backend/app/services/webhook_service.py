import os
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..models import Order, Payment, PaymentMethod, PaymentStatus, User, WebhookEvent, WebhookProvider, WebhookEventStatus, Invoice, InvoiceStatus, InvoiceType
from ..invoice_service import mark_invoice_paid, render_invoice_pdf, send_invoice_email


def record_event_or_skip(db: Session, *, provider: WebhookProvider, event_id: str, event_type: str, payload: dict) -> Optional[WebhookEvent]:
    """
    Insert event row. Returns None if duplicate (caught IntegrityError).
    """
    import json
    try:
        new_event = WebhookEvent(
            provider=provider,
            event_id=event_id,
            event_type=event_type,
            payload=json.dumps(payload),
            status=WebhookEventStatus.received
        )
        db.add(new_event)
        db.commit()
        return new_event
    except IntegrityError:
        db.rollback()
        return None


def mark_event_processed(db: Session, event: WebhookEvent):
    event.status = WebhookEventStatus.processed
    event.processed_at = datetime.utcnow()
    db.commit()


def mark_event_failed(db: Session, event: WebhookEvent, error: str):
    event.status = WebhookEventStatus.failed
    event.error_message = error
    db.commit()


def handle_stripe_event(db: Session, event: dict) -> None:
    """
    Top-level dispatcher. Records idempotency, routes to per-event handler.
    """
    event_id = event.get('id')
    event_type = event.get('type')
    
    # 1. Idempotency Check
    record = record_event_or_skip(
        db, 
        provider=WebhookProvider.stripe, 
        event_id=event_id, 
        event_type=event_type, 
        payload=event
    )
    if not record:
        print(f"[WEBHOOK] Skipping duplicate Stripe event {event_id}")
        return

    # 2. Dispatch
    handlers = {
        "checkout.session.completed": _handle_checkout_completed,
        "charge.refunded": _handle_charge_refunded,
        # Add other events here: "payment_intent.payment_failed", etc.
    }
    
    handler = handlers.get(event_type)
    if not handler:
        print(f"[WEBHOOK] No handler for event type {event_type}")
        mark_event_processed(db, record) # Still mark as processed so we don't retry a non-critical event
        return

    try:
        handler(db, event)
        mark_event_processed(db, record)
    except Exception as e:
        print(f"[WEBHOOK] Error processing {event_type} ({event_id}): {e}")
        mark_event_failed(db, record, str(e))
        raise # Re-raise so the caller can decide whether to return 200 or 400


def _handle_checkout_completed(db: Session, event: dict):
    session = event['data']['object']
    order_id = session.get('client_reference_id') or session.get('metadata', {}).get('order_id')
    payment_type = session.get('metadata', {}).get('payment_type', 'full')
    amount_paid = session.get('amount_total', 0) / 100

    order = db.get(Order, order_id)
    if not order:
        raise ValueError(f"Order {order_id} not found")

    # Update order payments
    if payment_type == "advance":
        order.advance_amount += amount_paid
    order.amount_paid += amount_paid
    db.commit()

    # Update or create Payment record
    payment = db.query(Payment).filter(Payment.order_id == order.id).first()
    if not payment:
        payment = Payment(
            order_id=order.id,
            method=PaymentMethod.card,
            status=PaymentStatus.completed,
            amount=amount_paid,
            transaction_id=session.get('payment_intent')
        )
        db.add(payment)
        
        # Add Khata Payment
        from ..models import KhataEntry
        khata_payment = KhataEntry(
            customer_id=order.customer_id,
            order_id=order.id,
            type="payment",
            amount=amount_paid,
            notes=f"Stripe Payment: {session.get('payment_intent')}"
        )
        db.add(khata_payment)
    else:
        payment.status = PaymentStatus.completed
        payment.amount += amount_paid
        payment.transaction_id = session.get('payment_intent')
        
        # Add Khata Payment
        from ..models import KhataEntry
        khata_payment = KhataEntry(
            customer_id=order.customer_id,
            order_id=order.id,
            type="payment",
            amount=amount_paid,
            notes=f"Stripe Payment: {session.get('payment_intent')}"
        )
        db.add(khata_payment)
    
    db.commit()

    # Handle Invoice
    inv_type = InvoiceType.advance if payment_type == "advance" else InvoiceType.full
    invoice = db.query(Invoice).filter(
        Invoice.order_id == order.id,
        Invoice.status == InvoiceStatus.unpaid,
        Invoice.type == inv_type
    ).first()
    
    if not invoice:
        # Fallback to oldest unpaid
        invoice = db.query(Invoice).filter(
            Invoice.order_id == order.id,
            Invoice.status == InvoiceStatus.unpaid
        ).first()

    if invoice:
        mark_invoice_paid(db, invoice, "card")
        customer = db.get(User, order.customer_id)
        
        # Ensure PDF exists or generate it
        if invoice.pdf_path and os.path.exists(invoice.pdf_path):
            with open(invoice.pdf_path, "rb") as f:
                pdf_bytes = f.read()
        else:
            pdf_bytes = render_invoice_pdf(invoice, order, customer)
            db.commit()
            
        # Send email
        from ..email_service import send_invoice_email as send_email
        send_email(customer.email, customer.full_name, invoice.invoice_number, order.id, invoice.total_amount, pdf_bytes)


def _handle_charge_refunded(db: Session, event: dict):
    """Reconcile a refund initiated externally (e.g. via the Stripe Dashboard).

    Idempotent: if the local Payment is already marked refunded, this is a no-op.
    """
    charge = event['data']['object']
    payment_intent_id = charge.get('payment_intent')
    amount_refunded = (charge.get('amount_refunded') or 0) / 100.0
    fully_refunded = bool(charge.get('refunded'))

    if not payment_intent_id:
        return

    payment = (
        db.query(Payment)
        .filter(Payment.transaction_id == payment_intent_id)
        .first()
    )
    if not payment:
        print(f"[WEBHOOK] charge.refunded: no local payment for {payment_intent_id}")
        return

    # Idempotency: already reconciled
    if payment.status == PaymentStatus.refunded:
        return

    order = db.get(Order, payment.order_id)
    if not order:
        return

    if fully_refunded:
        payment.status = PaymentStatus.refunded
    order.amount_paid = max(0.0, float(order.amount_paid) - amount_refunded)
    db.commit()

    # Notify customer (only if we didn't already do it via the local refund endpoint)
    try:
        from .notification_service import notify
        notify(
            db, user_id=order.customer_id, type="payment.refunded",
            title=f"Refund processed: Rs. {amount_refunded:.0f}",
            body=f"A refund for order {order.id} has been processed by Stripe.",
            link=f"/tracking/{order.id}",
        )
    except Exception:
        pass
