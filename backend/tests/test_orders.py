"""Orders router tests — create, list, update, delete, authorization."""
import json
from unittest.mock import patch

import pytest

from app.models import (
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
    User,
    UserRole,
)


def _order_payload(items=None, total=100.0, advance=0.0, payment_method="card"):
    return {
        "customerName": "Customer",
        "customerEmail": "c@test.com",
        "totalAmount": total,
        "advanceAmount": advance,
        "notes": "",
        "deliveryAddress": "Street 1",
        "deliveryPhone": "+1234567890",
        "deliveryCity": "City",
        "paymentMethod": payment_method,
        "items": items or [{
            "productId": "prod-test",
            "productName": "Test Product",
            "quantity": 1,
            "unitPrice": 100.0,
            "garmentCategory": "kurta",
        }],
    }


# ── Create ───────────────────────────────────────────────────────────────────

def test_customer_can_create_order(client, customer_user, customer_token, auth_headers, db_session):
    resp = client.post(
        "/api/orders",
        json=_order_payload(),
        headers=auth_headers(customer_token),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["id"].startswith("ORD-")
    # Format: ORD-<8 uppercase hex>
    suffix = body["id"].replace("ORD-", "")
    assert len(suffix) == 8
    assert suffix.upper() == suffix


def test_create_order_without_garment_category_is_rejected_400(client, customer_user, customer_token, auth_headers):
    bad = _order_payload()
    bad["items"][0]["garmentCategory"] = ""
    resp = client.post(
        "/api/orders",
        json=bad,
        headers=auth_headers(customer_token),
    )
    # Pydantic returns 422 for validation errors
    assert resp.status_code in (400, 422)


# ── List filters ────────────────────────────────────────────────────────────

def test_customer_only_sees_own_orders(client, db_session):
    # Two customers
    u1 = User(email="a@test.com", full_name="A", password_hash="$2b$fake", email_verified=True)
    u2 = User(email="b@test.com", full_name="B", password_hash="$2b$fake", email_verified=True)
    db_session.add_all([u1, u2])
    db_session.flush()
    from app.security import create_access_token
    t1 = create_access_token(u1.id, "customer")
    t2 = create_access_token(u2.id, "customer")

    o1 = Order(id="ORD-A0000001", customer_id=u1.id, customer_name="A", customer_email=u1.email,
               status=OrderStatus.pending, total_amount=10, advance_amount=0)
    o2 = Order(id="ORD-A0000002", customer_id=u2.id, customer_name="B", customer_email=u2.email,
               status=OrderStatus.pending, total_amount=20, advance_amount=0)
    db_session.add_all([o1, o2])
    db_session.commit()

    h = {"Authorization": f"Bearer {t1}"}
    resp = client.get("/api/orders", headers=h)
    assert resp.status_code == 200
    ids = [o["id"] for o in resp.json()]
    assert "ORD-A0000001" in ids
    assert "ORD-A0000002" not in ids


def test_admin_sees_all_orders(client, admin_token, auth_headers, db_session):
    # Seed an order
    user = User(email="any@test.com", full_name="Any", password_hash="$2b$fake", email_verified=True, role=UserRole.customer)
    db_session.add(user)
    db_session.flush()
    o = Order(id="ORD-ADMN0001", customer_id=user.id, customer_name="Any", customer_email=user.email,
              status=OrderStatus.pending, total_amount=10, advance_amount=0)
    db_session.add(o)
    db_session.commit()

    resp = client.get("/api/orders", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    ids = [x["id"] for x in resp.json()]
    assert "ORD-ADMN0001" in ids


# ── Update status ───────────────────────────────────────────────────────────

def test_admin_can_update_status(client, admin_token, auth_headers, db_session):
    user = User(email="upd@test.com", full_name="Upd", password_hash="$2b$fake", email_verified=True)
    db_session.add(user)
    db_session.flush()
    o = Order(id="ORD-UPD00001", customer_id=user.id, customer_name="Upd", customer_email=user.email,
              status=OrderStatus.pending, total_amount=10, advance_amount=0)
    db_session.add(o)
    db_session.commit()

    resp = client.patch(
        "/api/orders/ORD-UPD00001/status",
        json={"status": "confirmed"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code == 200


def test_customer_cannot_update_status(client, customer_user, customer_token, auth_headers, db_session):
    o = Order(id="ORD-NOUPD001", customer_id=customer_user.id, customer_name="X", customer_email=customer_user.email,
              status=OrderStatus.pending, total_amount=10, advance_amount=0)
    db_session.add(o)
    db_session.commit()

    resp = client.patch(
        "/api/orders/ORD-NOUPD001/status",
        json={"status": "confirmed"},
        headers=auth_headers(customer_token),
    )
    assert resp.status_code == 403


def test_status_change_to_invalid_value_returns_422(client, admin_token, auth_headers, db_session):
    user = User(email="inv@test.com", full_name="Inv", password_hash="$2b$fake", email_verified=True)
    db_session.add(user)
    db_session.flush()
    o = Order(id="ORD-INV00001", customer_id=user.id, customer_name="Inv", customer_email=user.email,
              status=OrderStatus.pending, total_amount=10, advance_amount=0)
    db_session.add(o)
    db_session.commit()

    resp = client.patch(
        "/api/orders/ORD-INV00001/status",
        json={"status": "nonexistent_status"},
        headers=auth_headers(admin_token),
    )
    assert resp.status_code in (422, 400)


# ── Delete ──────────────────────────────────────────────────────────────────

def test_admin_can_delete_pending_order(client, admin_token, auth_headers, db_session):
    user = User(email="del@test.com", full_name="Del", password_hash="$2b$fake", email_verified=True)
    db_session.add(user)
    db_session.flush()
    o = Order(id="ORD-DEL00001", customer_id=user.id, customer_name="Del", customer_email=user.email,
              status=OrderStatus.pending, total_amount=10, advance_amount=0)
    db_session.add(o)
    db_session.commit()

    resp = client.delete("/api/orders/ORD-DEL00001", headers=auth_headers(admin_token))
    assert resp.status_code == 204


def test_admin_cannot_delete_delivered_order_returns_400(client, admin_token, auth_headers, db_session):
    user = User(email="del2@test.com", full_name="Del2", password_hash="$2b$fake", email_verified=True)
    db_session.add(user)
    db_session.flush()
    o = Order(id="ORD-DEL00002", customer_id=user.id, customer_name="Del2", customer_email=user.email,
              status=OrderStatus.delivered, total_amount=10, advance_amount=0)
    db_session.add(o)
    db_session.commit()

    resp = client.delete("/api/orders/ORD-DEL00002", headers=auth_headers(admin_token))
    assert resp.status_code == 400
