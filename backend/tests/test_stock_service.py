"""Tests for app.services.stock_service.consume_for_order."""
import uuid

from app.models import (
    InventoryItem,
    Order,
    OrderItem,
    OrderStatus,
    User,
    UserRole,
)
from app.services import stock_service


def _make_order(db, *, customer_id: str, items: list[dict]) -> Order:
    order = Order(
        id=f"ORD-{uuid.uuid4().hex[:8].upper()}",
        customer_id=customer_id,
        customer_name="Test",
        customer_email="t@example.com",
        status=OrderStatus.pending,
        total_amount=10000.0,
        advance_amount=0.0,
        amount_paid=0.0,
    )
    db.add(order)
    db.flush()
    for it in items:
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=it.get("product_id", "prod-1"),
                product_name=it.get("product_name", "Test Product"),
                quantity=it.get("quantity", 1),
                unit_price=it.get("unit_price", 10000.0),
                garment_category=it.get("garment_category"),
            )
        )
    db.commit()
    db.refresh(order)
    return order


def _add_inventory(db, *, name: str, quantity: float, threshold: float = 10.0) -> InventoryItem:
    inv = InventoryItem(
        name=name,
        quantity=quantity,
        unit="meters",
        price_per_unit=500.0,
        threshold=threshold,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


def test_consume_decrements_matching_inventory(db_session, customer_user):
    inv = _add_inventory(db_session, name="kurta", quantity=20.0)
    order = _make_order(
        db_session,
        customer_id=customer_user.id,
        items=[{"garment_category": "kurta", "quantity": 2}],  # 2 * 2.5 = 5m
    )

    summary = stock_service.consume_for_order(db_session, order)

    db_session.refresh(inv)
    assert summary["skipped"] is False
    assert inv.quantity == 15.0
    assert summary["consumed"][0]["name"] == "kurta"
    assert summary["consumed"][0]["qty"] == 5.0
    assert order.inventory_consumed_at is not None


def test_consume_is_idempotent(db_session, customer_user):
    inv = _add_inventory(db_session, name="kurta", quantity=20.0)
    order = _make_order(
        db_session,
        customer_id=customer_user.id,
        items=[{"garment_category": "kurta", "quantity": 1}],
    )

    first = stock_service.consume_for_order(db_session, order)
    db_session.refresh(inv)
    assert first["skipped"] is False
    assert inv.quantity == 17.5

    # Calling again must not deduct further
    second = stock_service.consume_for_order(db_session, order)
    db_session.refresh(inv)
    assert second["skipped"] is True
    assert inv.quantity == 17.5


def test_consume_warns_when_no_matching_inventory(db_session, customer_user):
    order = _make_order(
        db_session,
        customer_id=customer_user.id,
        items=[{"garment_category": "kurta", "quantity": 1}],
    )

    summary = stock_service.consume_for_order(db_session, order)

    assert any(w["reason"] == "no matching inventory row" for w in summary["warnings"])
    assert summary["consumed"] == []


def test_consume_warns_on_unknown_category(db_session, customer_user):
    order = _make_order(
        db_session,
        customer_id=customer_user.id,
        items=[{"garment_category": "exotic-garment", "quantity": 1}],
    )

    summary = stock_service.consume_for_order(db_session, order)

    assert any(w["reason"] == "no fabric mapping defined" for w in summary["warnings"])


def test_consume_handles_insufficient_stock(db_session, customer_user):
    inv = _add_inventory(db_session, name="kurta", quantity=2.0)  # need 5m, have 2m
    order = _make_order(
        db_session,
        customer_id=customer_user.id,
        items=[{"garment_category": "kurta", "quantity": 2}],
    )

    summary = stock_service.consume_for_order(db_session, order)

    db_session.refresh(inv)
    assert any(w["reason"] == "insufficient stock" for w in summary["warnings"])
    assert inv.quantity == 0.0  # drained to zero, never negative
    assert len(summary["low_stock_alerts"]) == 1


def test_consume_emits_low_stock_alert(db_session, customer_user):
    # 12m available, threshold 10, will deduct 2.5m → leaves 9.5 (below threshold)
    inv = _add_inventory(db_session, name="kurta", quantity=12.0, threshold=10.0)
    order = _make_order(
        db_session,
        customer_id=customer_user.id,
        items=[{"garment_category": "kurta", "quantity": 1}],
    )

    summary = stock_service.consume_for_order(db_session, order)

    db_session.refresh(inv)
    assert inv.quantity == 9.5
    assert len(summary["low_stock_alerts"]) == 1
    assert summary["low_stock_alerts"][0]["remaining"] == 9.5


def test_consume_partial_match_by_substring(db_session, customer_user):
    # Inventory uses a longer descriptive name; should still match by substring
    inv = _add_inventory(db_session, name="Premium Kurta Cotton", quantity=10.0)
    order = _make_order(
        db_session,
        customer_id=customer_user.id,
        items=[{"garment_category": "kurta", "quantity": 1}],
    )

    summary = stock_service.consume_for_order(db_session, order)

    db_session.refresh(inv)
    assert summary["consumed"][0]["name"] == "Premium Kurta Cotton"
    assert inv.quantity == 7.5
