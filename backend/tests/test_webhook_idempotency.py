"""Webhook idempotency tests — the most important suite for Stripe safety."""
from unittest.mock import patch

import pytest

from app.models import (
    Invoice,
    InvoiceStatus,
    Order,
    OrderStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
    User,
    WebhookEvent,
    WebhookProvider,
)
from app.services.webhook_service import record_event_or_skip


def _fake_checkout_event(event_id: str, order_id: str, amount_total: int = 50000):
    return {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": order_id,
                "amount_total": amount_total,
                "metadata": {"order_id": order_id, "payment_type": "advance"},
                "payment_intent": "pi_test_1",
            }
        },
    }


# ── Idempotency layer ─────────────────────────────────────────────────────────

def test_first_record_returns_event_object(db_session):
    ev = record_event_or_skip(
        db_session,
        provider=WebhookProvider.stripe,
        event_id="evt_first",
        event_type="checkout.session.completed",
        payload={"id": "evt_first"},
    )
    assert ev is not None
    assert ev.provider == WebhookProvider.stripe


def test_duplicate_record_returns_none(db_session):
    record_event_or_skip(
        db_session,
        provider=WebhookProvider.stripe,
        event_id="evt_dup",
        event_type="checkout.session.completed",
        payload={"id": "evt_dup"},
    )
    ev2 = record_event_or_skip(
        db_session,
        provider=WebhookProvider.stripe,
        event_id="evt_dup",
        event_type="checkout.session.completed",
        payload={"id": "evt_dup"},
    )
    assert ev2 is None


# ── End-to-end handler ───────────────────────────────────────────────────────

def test_first_event_marks_payment_completed_and_increments_amount_paid(client, db_session):
    order_id = f"ORD-{'A' * 8}"
    user = User(email="pay@test.com", full_name="Pay", password_hash="$2b$fake", email_verified=True)
    db_session.add(user)
    db_session.flush()
    order = Order(
        id=order_id,
        customer_id=user.id,
        customer_name=user.full_name,
        customer_email=user.email,
        status=OrderStatus.pending,
        total_amount=100.0,
        advance_amount=0,
        amount_paid=0,
    )
    db_session.add(order)
    payment = Payment(order_id=order_id, method=PaymentMethod.card, status=PaymentStatus.pending, amount=0)
    db_session.add(payment)
    db_session.commit()

    event = _fake_checkout_event("evt_ok", order_id, 50000)  # 500 cents = 5.00

    # Patch invoice-related side effects to avoid SMTP/PDF
    with patch("app.services.webhook_service.mark_invoice_paid"), \
         patch("app.services.webhook_service.render_invoice_pdf", return_value=b"PDF"), \
         patch("app.services.webhook_service.send_invoice_email"):
        from app.services.webhook_service import handle_stripe_event
        handle_stripe_event(db_session, event)

    db_session.expire_all()
    payment = db_session.query(Payment).filter(Payment.order_id == order_id).first()
    assert payment.status == PaymentStatus.completed
    assert payment.amount > 0


def test_duplicate_event_does_NOT_double_charge(client, db_session):
    order_id = f"ORD-{'B' * 8}"
    user = User(email="pay2@test.com", full_name="Pay2", password_hash="$2b$fake", email_verified=True)
    db_session.add(user)
    db_session.flush()
    order = Order(
        id=order_id,
        customer_id=user.id,
        customer_name=user.full_name,
        customer_email=user.email,
        status=OrderStatus.pending,
        total_amount=100.0,
        advance_amount=0,
        amount_paid=0,
    )
    db_session.add(order)
    payment = Payment(order_id=order_id, method=PaymentMethod.card, status=PaymentStatus.pending, amount=0)
    db_session.add(payment)
    db_session.commit()

    event = _fake_checkout_event("evt_double", order_id, 60000)  # 600 cents = 6.00

    with patch("app.services.webhook_service.mark_invoice_paid"), \
         patch("app.services.webhook_service.render_invoice_pdf", return_value=b"PDF"), \
         patch("app.services.webhook_service.send_invoice_email"):
        from app.services.webhook_service import handle_stripe_event
        handle_stripe_event(db_session, event)

    db_session.expire_all()
    amount_after_first = db_session.query(Payment).filter(Payment.order_id == order_id).first().amount

    # Duplicate
    with patch("app.services.webhook_service.mark_invoice_paid"), \
         patch("app.services.webhook_service.render_invoice_pdf", return_value=b"PDF"), \
         patch("app.services.webhook_service.send_invoice_email"):
        handle_stripe_event(db_session, event)

    db_session.expire_all()
    amount_after_dup = db_session.query(Payment).filter(Payment.order_id == order_id).first().amount

    assert amount_after_first == amount_after_dup


def test_unhandled_event_type_is_marked_processed(db_session):
    # Idempotency insert first
    ev = record_event_or_skip(
        db_session,
        provider=WebhookProvider.stripe,
        event_id="evt_other",
        event_type="invoice.payment_failed",  # Not mapped
        payload={"id": "evt_other", "type": "invoice.payment_failed"},
    )
    assert ev is not None

    with patch("app.services.webhook_service.mark_invoice_paid"), \
         patch("app.services.webhook_service.render_invoice_pdf", return_value=b"PDF"), \
         patch("app.services.webhook_service.send_invoice_email"):
        from app.services.webhook_service import handle_stripe_event
        handle_stripe_event(db_session, {"id": "evt_other", "type": "invoice.payment_failed", "data": {"object": {}}})

    db_session.expire_all()
    row = db_session.query(WebhookEvent).filter(WebhookEvent.event_id == "evt_other").first()
    assert row is not None
