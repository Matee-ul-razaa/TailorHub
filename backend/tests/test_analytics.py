"""Tests for the Admin Analytics endpoints."""

import json
from datetime import datetime, timedelta
import pytest
from app.models import AuditLog, Order, OrderItem, OrderStatus, User, UserRole


# ── Authorization Tests ──────────────────────────────────────────────────────

def test_analytics_endpoints_require_admin(client, customer_token, auth_headers):
    """Ensure non-admin requests to analytics return 403 Forbidden."""
    endpoints = [
        "/api/analytics/orders-by-month",
        "/api/analytics/popular-categories",
        "/api/analytics/repeat-rate",
        "/api/analytics/avg-lead-time",
    ]
    for endpoint in endpoints:
        resp = client.get(endpoint, headers=auth_headers(customer_token))
        assert resp.status_code == 403, f"Endpoint {endpoint} should require admin"


def test_analytics_endpoints_require_auth(client):
    """Ensure unauthenticated requests to analytics return 401 Unauthorized."""
    endpoints = [
        "/api/analytics/orders-by-month",
        "/api/analytics/popular-categories",
        "/api/analytics/repeat-rate",
        "/api/analytics/avg-lead-time",
    ]
    for endpoint in endpoints:
        resp = client.get(endpoint)
        assert resp.status_code == 401, f"Endpoint {endpoint} should require auth"


# ── Empty Data State Tests ───────────────────────────────────────────────────

def test_analytics_empty_data_states(client, admin_token, auth_headers):
    """Ensure endpoints return correct structure when database has no records."""
    # Month list should still be generated with 0 count/revenue
    resp = client.get("/api/analytics/orders-by-month", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 12
    for m in data:
        assert m["count"] == 0
        assert m["revenue"] == 0.0

    # Popular categories should be empty list
    resp = client.get("/api/analytics/popular-categories", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    assert resp.json() == []

    # Repeat rate should be 0.0
    resp = client.get("/api/analytics/repeat-rate", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    assert resp.json() == {
        "repeat_rate": 0.0,
        "repeat_customers": 0,
        "total_customers": 0
    }

    # Avg lead time should be 0.0
    resp = client.get("/api/analytics/avg-lead-time", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    assert resp.json() == {"avg_lead_time_days": 0.0}


# ── Populated Data Calculation Tests ──────────────────────────────────────────

def test_analytics_calculations(client, admin_token, auth_headers, db_session):
    """Seed data and verify analytics calculations for count, categories, repeat rate, and lead time."""
    # 1. Create two customers
    u1 = User(email="cust1@test.com", full_name="Customer 1", password_hash="$2b$fake", email_verified=True, role=UserRole.customer)
    u2 = User(email="cust2@test.com", full_name="Customer 2", password_hash="$2b$fake", email_verified=True, role=UserRole.customer)
    db_session.add_all([u1, u2])
    db_session.flush()

    # 2. Add orders (u1 has 2 orders, u2 has 1 order) -> repeat rate = 50%
    # Order 1 for u1 (delivered)
    o1 = Order(id="ORD-ANA01", customer_id=u1.id, customer_name="Cust 1", customer_email=u1.email,
               status=OrderStatus.delivered, total_amount=1500.0, advance_amount=0)
    # Order 2 for u1 (confirmed)
    o2 = Order(id="ORD-ANA02", customer_id=u1.id, customer_name="Cust 1", customer_email=u1.email,
               status=OrderStatus.confirmed, total_amount=2500.0, advance_amount=0)
    # Order 3 for u2 (pending)
    o3 = Order(id="ORD-ANA03", customer_id=u2.id, customer_name="Cust 2", customer_email=u2.email,
               status=OrderStatus.pending, total_amount=3000.0, advance_amount=0)
    # Order 4 for u2 (cancelled)
    o4 = Order(id="ORD-ANA04", customer_id=u2.id, customer_name="Cust 2", customer_email=u2.email,
               status=OrderStatus.cancelled, total_amount=10000.0, advance_amount=0)

    db_session.add_all([o1, o2, o3, o4])
    db_session.flush()

    # 3. Add order items to verify popular categories count
    item1 = OrderItem(order_id="ORD-ANA01", product_id="test-prod", product_name="Shirt A", quantity=2, unit_price=750.0, garment_category="shirts")
    item2 = OrderItem(order_id="ORD-ANA02", product_id="test-prod", product_name="Kurta B", quantity=1, unit_price=2500.0, garment_category="kurta")
    item3 = OrderItem(order_id="ORD-ANA03", product_id="test-prod", product_name="Pants C", quantity=3, unit_price=1000.0, garment_category="pants")
    item4 = OrderItem(order_id="ORD-ANA04", product_id="test-prod", product_name="Cancelled Item", quantity=5, unit_price=2000.0, garment_category="shirts")
    db_session.add_all([item1, item2, item3, item4])
    db_session.flush()

    # 4. Add audit logs to verify avg lead time
    # Let's say lead time for ORD-ANA01 (delivered) is exactly 4.5 days
    now = datetime.utcnow()
    t_confirmed = now - timedelta(days=5)
    t_delivered = now - timedelta(hours=12) # 5 days - 0.5 days = 4.5 days

    log_confirm = AuditLog(
        action="order.status.update",
        resource_type="order",
        resource_id="ORD-ANA01",
        created_at=t_confirmed,
        details_json=json.dumps({"from": "pending", "to": "confirmed"})
    )
    log_deliver = AuditLog(
        action="order.status.update",
        resource_type="order",
        resource_id="ORD-ANA01",
        created_at=t_delivered,
        details_json=json.dumps({"from": "ready", "to": "delivered"})
    )
    db_session.add_all([log_confirm, log_deliver])
    db_session.commit()

    # Verify orders-by-month response
    resp = client.get("/api/analytics/orders-by-month", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    data_months = resp.json()
    # Current month should contain non-cancelled orders count (3) and total amount (1500 + 2500 + 3000 = 7000)
    current_month_str = now.strftime("%Y-%m")
    current_month_data = next((m for m in data_months if m["month"] == current_month_str), None)
    assert current_month_data is not None
    assert current_month_data["count"] == 3
    assert current_month_data["revenue"] == 7000.0

    # Verify popular categories response
    resp = client.get("/api/analytics/popular-categories", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    categories_data = resp.json()
    # Sort order of returned list is by value descending
    # pants: 3, shirts: 2, kurta: 1 (cancelled shirts are ignored)
    assert len(categories_data) == 3
    assert categories_data[0] == {"category": "pants", "value": 3}
    assert categories_data[1] == {"category": "shirts", "value": 2}
    assert categories_data[2] == {"category": "kurta", "value": 1}

    # Verify repeat customer rate response
    resp = client.get("/api/analytics/repeat-rate", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    repeat_data = resp.json()
    # Active ordering customers: u1 (2 orders: ORD-ANA01, ORD-ANA02), u2 (1 order: ORD-ANA03)
    # Note: ORD-ANA04 is cancelled so it is excluded, making u2 have only 1 active order.
    # Total customers: 2 (u1, u2)
    # Repeat customers (>=2 active orders): 1 (u1)
    # Repeat rate: 50.0%
    assert repeat_data["total_customers"] == 2
    assert repeat_data["repeat_customers"] == 1
    assert repeat_data["repeat_rate"] == 50.0

    # Verify avg lead time response
    resp = client.get("/api/analytics/avg-lead-time", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    lead_time_data = resp.json()
    assert lead_time_data["avg_lead_time_days"] == 4.5
