"""Stock decrement service.

When an order moves from any state into ``cutting``, the fabric required for
each garment is deducted from `inventory_items` (matched by name, case-insensitive
on the garment category). If an inventory row is missing or has insufficient
stock, that line is recorded in ``warnings`` but the operation does not abort —
business rule: cutting is not blocked by missing inventory rows; instead the
admin team is notified so they can replenish.

Idempotency: ``Order.inventory_consumed_at`` is set on the first successful
decrement; subsequent calls are no-ops.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ..models import InventoryItem, Order, OrderItem, UserRole
from .notification_service import notify_role


# Default fabric requirement per garment category, in metres per unit.
# Override at runtime by editing this map (or extending with a config table).
DEFAULT_FABRIC_PER_UNIT_METERS: dict[str, float] = {
    "shalwar-kameez": 4.0,
    "kurta": 2.5,
    "waistcoat": 1.5,
    "shirt": 2.0,
    "pant": 1.5,
    "trouser": 1.5,
    "suit": 5.5,
    "two-piece": 5.5,
    "three-piece": 7.0,
}


def _normalise(name: str) -> str:
    return (name or "").strip().lower()


def _meters_for(category: Optional[str]) -> float:
    if not category:
        return 0.0
    return DEFAULT_FABRIC_PER_UNIT_METERS.get(_normalise(category), 0.0)


def _find_inventory(db: Session, category: str) -> Optional[InventoryItem]:
    """Find an inventory row whose name matches the garment category (case-insensitive)."""
    cat = _normalise(category)
    if not cat:
        return None
    # Try exact, then LIKE
    exact = (
        db.query(InventoryItem)
        .filter(InventoryItem.name.ilike(cat))
        .first()
    )
    if exact:
        return exact
    return (
        db.query(InventoryItem)
        .filter(InventoryItem.name.ilike(f"%{cat}%"))
        .first()
    )


def consume_for_order(db: Session, order: Order) -> dict:
    """Decrement inventory for every item in the order. Idempotent.

    Returns a summary dict::

        {
          "skipped": bool,                # True if already consumed
          "consumed": [{"name": str, "qty": float, "unit": str}],
          "warnings": [{"category": str, "reason": str, "needed": float, "available": float}],
          "low_stock_alerts": [{"name": str, "remaining": float, "threshold": float}],
        }
    """
    if order.inventory_consumed_at is not None:
        return {"skipped": True, "consumed": [], "warnings": [], "low_stock_alerts": []}

    consumed: list[dict] = []
    warnings: list[dict] = []
    low_stock_alerts: list[dict] = []

    items: list[OrderItem] = list(order.items)
    for item in items:
        per_unit = _meters_for(item.garment_category)
        if per_unit <= 0:
            warnings.append(
                {
                    "category": item.garment_category or "",
                    "reason": "no fabric mapping defined",
                    "needed": 0.0,
                    "available": 0.0,
                }
            )
            continue

        needed = per_unit * (item.quantity or 1)
        inv = _find_inventory(db, item.garment_category)
        if inv is None:
            warnings.append(
                {
                    "category": item.garment_category,
                    "reason": "no matching inventory row",
                    "needed": needed,
                    "available": 0.0,
                }
            )
            continue

        if inv.quantity < needed:
            warnings.append(
                {
                    "category": item.garment_category,
                    "reason": "insufficient stock",
                    "needed": needed,
                    "available": float(inv.quantity),
                }
            )
            # Still deduct what we have (don't go negative)
            actually_deducted = float(inv.quantity)
            inv.quantity = 0.0
        else:
            actually_deducted = needed
            inv.quantity = float(inv.quantity) - needed

        inv.updated_at = datetime.utcnow()
        consumed.append({"name": inv.name, "qty": actually_deducted, "unit": inv.unit})

        if inv.quantity <= float(inv.threshold or 0.0):
            low_stock_alerts.append(
                {
                    "name": inv.name,
                    "remaining": float(inv.quantity),
                    "threshold": float(inv.threshold or 0.0),
                }
            )

    order.inventory_consumed_at = datetime.utcnow()

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        # Do not raise — caller should not fail the order status update
        print(f"[STOCK] Failed to commit inventory changes for {order.id}: {e}")
        return {
            "skipped": False,
            "consumed": [],
            "warnings": warnings + [{"category": "*", "reason": str(e), "needed": 0.0, "available": 0.0}],
            "low_stock_alerts": [],
        }

    # Side-effect: notify all admins about low stock
    for alert in low_stock_alerts:
        try:
            notify_role(
                db,
                role=UserRole.admin,
                type="inventory.low_stock",
                title=f"Low stock: {alert['name']}",
                body=f"Remaining: {alert['remaining']:.1f} (threshold {alert['threshold']:.1f}).",
                link="/admin?tab=inventory",
            )
        except Exception:
            pass

    return {
        "skipped": False,
        "consumed": consumed,
        "warnings": warnings,
        "low_stock_alerts": low_stock_alerts,
    }
