"""Tests for the Stripe refund flow.

Covers:
  - Admin-only access
  - Card-only refunds (COD rejected)
  - Status guards (already-refunded, pending payments)
  - Missing transaction_id rejected
  - Refund-amount bounds (>0, <= captured amount)
  - Full vs partial refund branches
  - Order auto-cancel on full refund
  - charge.refunded webhook reconciliation + idempotency
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.models import (
    AuditLog,
    Notification,
    Order,
    OrderStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
    User,
)


# ── Helpers ─────────────────────────────────────────────────────────────────

def _seed_card_order(
    db_session,
    customer: User,
    *,
    order_id: str = "ORD-REFUND01",
    total: float = 100.0,
    paid: float = 100.0,
    payment_status: PaymentStatus = PaymentStatus.completed,
    transaction_id: str = "pi_test_refund_1",
) -> tuple[Order, Payment]:
    order = Order(
        id=order_id,
        customer_id=customer.id,
        customer_name=customer.full_name,
        customer_email=customer.email,
        status=OrderStatus.confirmed,
        total_amount=total,
        advance_amount=0,
        amount_paid=paid,
    )
    db_session.add(order)
    payment = Payment(
        order_id=order_id,
        method=PaymentMethod.card,
        status=payment_status,
        amount=total,
        transaction_id=transaction_id,
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return order, payment


def _stripe_refund_obj(refund_id: str = "re_test_1"):
    return SimpleNamespace(id=refund_id, status="succeeded")


from typing import Optional

def _patch_stripe(refund_obj=None, raise_error: Optional[Exception] = None):
    """Monkey-patch the stripe module that routers_payments imports."""
    refund_obj = refund_obj or _stripe_refund_obj()
    refund_create = MagicMock(side_effect=raise_error) if raise_error else MagicMock(return_value=refund_obj)
    return patch("app.routers_payments.stripe.Refund.create", refund_create), refund_create


@pytest.fixture(autouse=True)
def _enable_stripe(monkeypatch):
    """Force stripe_enabled=True for the duration of each test."""
    from app.config import settings
    monkeypatch.setattr(type(settings), "stripe_enabled", property(lambda self: True))
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_dummy", raising=False)
    yield


# ── Authorization ───────────────────────────────────────────────────────────

def test_refund_requires_admin(client, db_session, customer_user, customer_token, auth_headers):
    _seed_card_order(db_session, customer_user)
    resp = client.post(
        "/api/payments/ORD-REFUND01/refund",
        json={},
        headers=auth_headers(customer_token),
    )
    assert resp.status_code == 403


def test_refund_unauthenticated_rejected(client, db_session, customer_user):
    _seed_card_order(db_session, customer_user)
    resp = client.post("/api/payments/ORD-REFUND01/refund", json={})
    assert resp.status_code == 401


# ── Validation ──────────────────────────────────────────────────────────────

def test_refund_unknown_order_returns_404(client, admin_token, auth_headers):
    resp = client.post(
        "/api/payments/ORD-DOESNOTEXIST/refund",
        json={},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 404


def test_refund_cod_payment_rejected(client, db_session, admin_user, admin_token, auth_headers, customer_user):
    order = Order(
        id="ORD-COD01",
        customer_id=customer_user.id,
        customer_name=customer_user.full_name,
        customer_email=customer_user.email,
        status=OrderStatus.confirmed,
        total_amount=100.0,
        advance_amount=0,
        amount_paid=100.0,
    )
    db_session.add(order)
    db_session.add(Payment(order_id=order.id, method=PaymentMethod.cod, status=PaymentStatus.completed, amount=100.0))
    db_session.commit()

    resp = client.post(
        f"/api/payments/{order.id}/refund",
        json={},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 400
    assert "card" in resp.json()["detail"].lower()


def test_refund_already_refunded_payment_rejected(client, db_session, admin_token, auth_headers, customer_user):
    _seed_card_order(db_session, customer_user, payment_status=PaymentStatus.refunded)
    resp = client.post(
        "/api/payments/ORD-REFUND01/refund",
        json={},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 400
    assert "completed" in resp.json()["detail"].lower()


def test_refund_payment_without_transaction_id_rejected(client, db_session, admin_token, auth_headers, customer_user):
    _seed_card_order(db_session, customer_user, transaction_id=None)
    resp = client.post(
        "/api/payments/ORD-REFUND01/refund",
        json={},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 400


def test_refund_amount_exceeds_captured_rejected(client, db_session, admin_token, auth_headers, customer_user):
    _seed_card_order(db_session, customer_user, total=100.0)
    resp = client.post(
        "/api/payments/ORD-REFUND01/refund",
        json={"amount": 200.0},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 400


# ── Happy paths ─────────────────────────────────────────────────────────────

def test_full_refund_marks_payment_refunded_and_cancels_order(
    client, db_session, admin_token, auth_headers, customer_user
):
    _seed_card_order(db_session, customer_user, total=100.0)
    p, mock_create = _patch_stripe()
    with p:
        resp = client.post(
            "/api/payments/ORD-REFUND01/refund",
            json={"reason": "requested_by_customer"},
            headers=auth_headers(admin_token),
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["refunded_amount"] == 100.0
    assert body["new_payment_status"] == "refunded"
    assert body["new_order_status"] == "cancelled"
    mock_create.assert_called_once()
    _, kwargs = mock_create.call_args
    assert kwargs["amount"] == 10000  # cents
    assert kwargs["reason"] == "requested_by_customer"

    db_session.expire_all()
    payment = db_session.query(Payment).filter(Payment.order_id == "ORD-REFUND01").first()
    order = db_session.get(Order, "ORD-REFUND01")
    assert payment.status == PaymentStatus.refunded
    assert order.status == OrderStatus.cancelled
    assert order.amount_paid == 0.0


def test_partial_refund_keeps_payment_completed_and_does_not_cancel(
    client, db_session, admin_token, auth_headers, customer_user
):
    _seed_card_order(db_session, customer_user, total=100.0)
    p, _ = _patch_stripe()
    with p:
        resp = client.post(
            "/api/payments/ORD-REFUND01/refund",
            json={"amount": 30.0},
            headers=auth_headers(admin_token),
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["refunded_amount"] == 30.0
    assert body["new_payment_status"] == "completed"
    assert body["new_order_status"] != "cancelled"

    db_session.expire_all()
    order = db_session.get(Order, "ORD-REFUND01")
    assert order.amount_paid == 70.0


def test_full_refund_with_cancel_order_false_keeps_status(
    client, db_session, admin_token, auth_headers, customer_user
):
    _seed_card_order(db_session, customer_user, total=100.0)
    p, _ = _patch_stripe()
    with p:
        resp = client.post(
            "/api/payments/ORD-REFUND01/refund",
            json={"cancel_order": False},
            headers=auth_headers(admin_token),
        )

    assert resp.status_code == 200
    db_session.expire_all()
    order = db_session.get(Order, "ORD-REFUND01")
    assert order.status != OrderStatus.cancelled


def test_refund_records_audit_and_notifies_customer(
    client, db_session, admin_token, auth_headers, customer_user
):
    _seed_card_order(db_session, customer_user, total=100.0)
    p, _ = _patch_stripe()
    with p:
        resp = client.post(
            "/api/payments/ORD-REFUND01/refund",
            json={},
            headers=auth_headers(admin_token),
        )
    assert resp.status_code == 200

    db_session.expire_all()
    audit = db_session.query(AuditLog).filter(AuditLog.action == "payment.refund").first()
    assert audit is not None
    assert audit.resource_type == "payment"

    notif = (
        db_session.query(Notification)
        .filter(Notification.user_id == customer_user.id, Notification.type == "payment.refunded")
        .first()
    )
    assert notif is not None
    assert "Rs. 100" in notif.title


def test_stripe_error_returns_502(client, db_session, admin_token, auth_headers, customer_user):
    import stripe as _stripe_module

    _seed_card_order(db_session, customer_user, total=100.0)

    class FakeStripeErr(_stripe_module.error.StripeError):  # type: ignore[attr-defined]
        pass

    p, _ = _patch_stripe(raise_error=FakeStripeErr("card_declined"))
    with p:
        resp = client.post(
            "/api/payments/ORD-REFUND01/refund",
            json={},
            headers=auth_headers(admin_token),
        )

    assert resp.status_code == 502
    db_session.expire_all()
    payment = db_session.query(Payment).filter(Payment.order_id == "ORD-REFUND01").first()
    # Local state must be unchanged when Stripe rejects
    assert payment.status == PaymentStatus.completed


# ── Webhook reconciliation ──────────────────────────────────────────────────

def test_charge_refunded_webhook_reconciles_local_state(client, db_session, customer_user):
    _seed_card_order(
        db_session, customer_user, total=100.0, transaction_id="pi_webhook_1"
    )
    event = {
        "id": "evt_refund_1",
        "type": "charge.refunded",
        "data": {
            "object": {
                "payment_intent": "pi_webhook_1",
                "amount_refunded": 10000,  # cents
                "refunded": True,
            }
        },
    }

    from app.services.webhook_service import handle_stripe_event
    handle_stripe_event(db_session, event)

    db_session.expire_all()
    payment = db_session.query(Payment).filter(Payment.order_id == "ORD-REFUND01").first()
    order = db_session.get(Order, "ORD-REFUND01")
    assert payment.status == PaymentStatus.refunded
    assert order.amount_paid == 0.0


def test_charge_refunded_webhook_is_idempotent(client, db_session, customer_user):
    _seed_card_order(
        db_session, customer_user, total=100.0, transaction_id="pi_webhook_2"
    )
    event_a = {
        "id": "evt_refund_a",
        "type": "charge.refunded",
        "data": {
            "object": {
                "payment_intent": "pi_webhook_2",
                "amount_refunded": 10000,
                "refunded": True,
            }
        },
    }
    event_b = dict(event_a)
    event_b["id"] = "evt_refund_b"  # different event_id to bypass idempotency at webhook layer

    from app.services.webhook_service import handle_stripe_event
    handle_stripe_event(db_session, event_a)
    handle_stripe_event(db_session, event_b)

    db_session.expire_all()
    order = db_session.get(Order, "ORD-REFUND01")
    # Should not double-deduct amount_paid
    assert order.amount_paid == 0.0
