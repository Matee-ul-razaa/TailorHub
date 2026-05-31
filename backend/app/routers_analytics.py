"""Customer and order analytics endpoints for admins."""

import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import get_db
from .deps import require_role
from .models import AuditLog, Order, OrderItem, OrderStatus, User, UserRole

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ── Response Schemas ─────────────────────────────────────────────────────────

class OrderByMonthOut(BaseModel):
    month: str
    count: int
    revenue: float


class PopularCategoryOut(BaseModel):
    category: str
    value: int


class RepeatRateOut(BaseModel):
    repeat_rate: float
    repeat_customers: int
    total_customers: int


class AvgLeadTimeOut(BaseModel):
    avg_lead_time_days: float


# ── Helpers ──────────────────────────────────────────────────────────────────

def calculate_avg_lead_time(db: Session) -> float:
    """Calculate average days from order confirmation to delivery using AuditLog.

    Falls back to created_at if confirmation audit log is not found.
    """
    delivered_orders = db.query(Order).filter(Order.status == OrderStatus.delivered).all()
    if not delivered_orders:
        return 0.0

    order_ids = [o.id for o in delivered_orders]
    
    # Query status update audit logs
    logs = db.query(AuditLog).filter(
        AuditLog.resource_type == "order",
        AuditLog.resource_id.in_(order_ids),
        AuditLog.action == "order.status.update"
    ).all()

    confirmed_times = {}
    delivered_times = {}

    for log in logs:
        try:
            details = json.loads(log.details_json) if log.details_json else {}
            to_status = details.get("to")
            if to_status == "confirmed":
                if log.resource_id not in confirmed_times or log.created_at < confirmed_times[log.resource_id]:
                    confirmed_times[log.resource_id] = log.created_at
            elif to_status == "delivered":
                if log.resource_id not in delivered_times or log.created_at < delivered_times[log.resource_id]:
                    delivered_times[log.resource_id] = log.created_at
        except Exception:
            pass

    diffs = []
    for order in delivered_orders:
        t_start = confirmed_times.get(order.id, order.created_at)
        t_end = delivered_times.get(order.id)

        # Fallback for delivered timestamp: if not in audit logs, use the order's DB state/created_at or skip
        if not t_end:
            # Try order status update log to any status or fallback
            continue

        delta = t_end - t_start
        days = delta.total_seconds() / 86400.0
        if days >= 0:
            diffs.append(days)

    if not diffs:
        return 0.0

    return sum(diffs) / len(diffs)


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/orders-by-month", response_model=list[OrderByMonthOut])
def get_orders_by_month(
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Retrieve count and revenue of orders grouped by month for the last 12 months."""
    now = datetime.utcnow()
    year = now.year
    month = now.month
    months_list = []

    # Generate last 12 months chronologically
    for i in range(12):
        m = month - i
        y = year
        while m <= 0:
            m += 12
            y -= 1
        months_list.append(f"{y:04d}-{m:02d}")
    months_list.reverse()

    # Find orders from the start of the 12-month window
    start_y, start_m = map(int, months_list[0].split("-"))
    start_date = datetime(start_y, start_m, 1)

    orders = db.query(Order).filter(
        Order.created_at >= start_date,
        Order.status != OrderStatus.cancelled
    ).all()

    data_map = {m: {"month": m, "count": 0, "revenue": 0.0} for m in months_list}
    for order in orders:
        m_str = order.created_at.strftime("%Y-%m")
        if m_str in data_map:
            data_map[m_str]["count"] += 1
            data_map[m_str]["revenue"] += order.total_amount

    return [OrderByMonthOut(**data_map[m]) for m in months_list]


@router.get("/popular-categories", response_model=list[PopularCategoryOut])
def get_popular_categories(
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Retrieve quantity totals grouped by garment category."""
    items = db.query(OrderItem).join(Order).filter(
        Order.status != OrderStatus.cancelled
    ).all()

    counts = {}
    for item in items:
        cat = item.garment_category or "Unspecified"
        counts[cat] = counts.get(cat, 0) + item.quantity

    res = [{"category": cat, "value": count} for cat, count in counts.items()]
    res.sort(key=lambda x: x["value"], reverse=True)
    return [PopularCategoryOut(**x) for x in res]


@router.get("/repeat-rate", response_model=RepeatRateOut)
def get_repeat_rate(
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Calculate the repeat customer rate percentage (customers with >= 2 non-cancelled orders)."""
    order_counts = db.query(
        Order.customer_id,
        func.count(Order.id).label("cnt")
    ).filter(
        Order.status != OrderStatus.cancelled
    ).group_by(Order.customer_id).all()

    total_customers = len(order_counts)
    if total_customers == 0:
        return RepeatRateOut(repeat_rate=0.0, repeat_customers=0, total_customers=0)

    repeat_customers = sum(1 for row in order_counts if row.cnt >= 2)
    rate = (repeat_customers / total_customers) * 100.0

    return RepeatRateOut(
        repeat_rate=round(rate, 2),
        repeat_customers=repeat_customers,
        total_customers=total_customers
    )


@router.get("/avg-lead-time", response_model=AvgLeadTimeOut)
def get_avg_lead_time(
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """Calculate average lead time in days for order fulfillment."""
    avg_days = calculate_avg_lead_time(db)
    return AvgLeadTimeOut(avg_lead_time_days=round(avg_days, 2))
