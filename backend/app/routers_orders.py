import json
import random
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_current_user, require_role
from .models import KhataEntry, Order, OrderItem, OrderStatus, User, UserRole
from .schemas import AssignOrderIn, OrderIn, OrderOut, OrderItemOut, UpdateOrderStatusIn
from .services.audit_service import record_audit
from .services.notification_service import notify, notify_role
from .services.stock_service import consume_for_order

router = APIRouter(prefix="/api/orders", tags=["orders"])

ORDER_PROGRESS = {
    "pending": 5,
    "confirmed": 15,
    "cutting": 30,
    "stitching": 50,
    "processing": 65,
    "ready": 75,
    "out_for_delivery": 90,
    "delivered": 100,
    "cancelled": 0,
}


def _to_order_out(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        customerId=order.customer_id,
        customerName=order.customer_name,
        customerEmail=order.customer_email,
        status=order.status,
        totalAmount=order.total_amount,
        advanceAmount=order.advance_amount,
        amountPaid=order.amount_paid,
        assignedTo=order.assigned_to,
        notes=order.notes,
        deliveryAddress=order.delivery_address,
        deliveryPhone=order.delivery_phone,
        deliveryCity=order.delivery_city,
        signatureImage=order.signature_image,
        createdAt=order.created_at,
        deliveredAt=order.delivered_at,
        items=[
            OrderItemOut(
                productId=item.product_id,
                productName=item.product_name,
                quantity=item.quantity,
                unitPrice=item.unit_price,
                color=item.color,
                size=item.size,
                purchaseMode=item.purchase_mode,
                garmentCategory=item.garment_category,
                measurementType=item.measurement_type,
                measurements=json.loads(item.measurements_json) if item.measurements_json else None,
            )
            for item in order.items
        ],
    )


@router.get("", response_model=list[OrderOut])
def list_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Order)
    if user.role == UserRole.customer:
        query = query.filter(Order.customer_id == user.id)
    if user.role == UserRole.delivery:
        query = query.filter((Order.assigned_to == user.id) | (Order.status == OrderStatus.delivered))
    return [_to_order_out(order) for order in query.order_by(Order.created_at.desc()).all()]


@router.post("", response_model=OrderOut)
def create_order(payload: OrderIn, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    order = Order(
        id=order_id,
        customer_id=user.id,
        customer_name=payload.customerName,
        customer_email=payload.customerEmail,
        status=OrderStatus.pending,
        total_amount=payload.totalAmount,
        advance_amount=payload.advanceAmount,
        notes=payload.notes,
        delivery_address=payload.deliveryAddress,
        delivery_phone=payload.deliveryPhone,
        delivery_city=payload.deliveryCity,
    )
    # TC-10: Verify garment types are selected for all items
    for item in payload.items:
        if not item.garmentCategory:
            raise HTTPException(status_code=400, detail="Please select a garment type before placing your order.")

    db.add(order)
    db.flush()

    for item in payload.items:
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=item.productId,
                product_name=item.productName,
                quantity=item.quantity,
                unit_price=item.unitPrice,
                color=item.color,
                size=item.size,
                purchase_mode=item.purchaseMode,
                garment_category=item.garmentCategory,
                measurement_type=item.measurementType,
                measurements_json=json.dumps(item.measurements) if item.measurements else None,
            )
        )

    db.commit()
    db.refresh(order)

        
    # Create Payment record
    from .models import Payment, PaymentMethod, PaymentStatus
    payment = Payment(
        order_id=order.id,
        method=payload.paymentMethod,
        status=PaymentStatus.pending,
        amount=order.total_amount if payload.paymentMethod == PaymentMethod.cod else 0.0
    )
    db.add(payment)
    db.commit()
    db.refresh(order)

    record_audit(
        db, action="order.create", actor=user, resource_type="order", resource_id=order.id,
        request=request, details={"total": order.total_amount, "items": len(payload.items)},
    )
    
    # Create Khata 'credit' entry for the total order amount
    from .models import KhataEntry
    khata = KhataEntry(
        customer_id=order.customer_id,
        order_id=order.id,
        type="credit",
        amount=order.total_amount,
        notes=f"Order {order.id} Placed"
    )
    db.add(khata)
    db.commit()
    # Notify customer (confirmation) + all admins (new order alert)
    notify(
        db, user_id=user.id, type="order.created",
        title="Order placed",
        body=f"Your order {order.id} has been received. We'll start work soon.",
        link=f"/tracking/{order.id}",
    )
    notify_role(
        db, role=UserRole.admin, type="order.new",
        title="New order",
        body=f"{order.customer_name} placed order {order.id} (Rs. {order.total_amount:.0f}).",
        link=f"/admin?order={order.id}",
    )
    return _to_order_out(order)


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: str,
    payload: UpdateOrderStatusIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if user.role not in [UserRole.admin, UserRole.delivery]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if user.role == UserRole.delivery and order.assigned_to not in [None, user.id]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Order not assigned to you")

    if payload.status == OrderStatus.delivered and order.status != OrderStatus.delivered:
        order.delivered_at = datetime.utcnow()
        total_amt = order.total_amount or 0.0
        paid_amt = order.amount_paid or 0.0
        balance = total_amt - paid_amt
        if balance > 0:
            try:
                from .invoice_service import create_invoice
                from .models import InvoiceType
                create_invoice(db, order, InvoiceType.balance, balance, 0.0)
            except Exception as e:
                from .config import logger
                logger.error(f"[ORDER DELIVERY] Failed to create balance invoice for {order.id}: {e}")

    previous_status = order.status.value
    order.status = payload.status
    if payload.signature:
        order.signature_image = payload.signature
        
    db.commit()
    db.refresh(order)

    # Decrement inventory the first time an order enters `cutting`
    if payload.status == OrderStatus.cutting and order.inventory_consumed_at is None:
        try:
            stock_summary = consume_for_order(db, order)
            record_audit(
                db, action="inventory.consume", actor=user, resource_type="order", resource_id=order.id,
                request=request, details=stock_summary,
            )
        except Exception as e:
            # Stock failures must not break the status update
            print(f"[STOCK] consume_for_order failed for {order.id}: {e}")

    record_audit(
        db, action="order.status.update", actor=user, resource_type="order", resource_id=order.id,
        request=request, details={"from": previous_status, "to": payload.status.value},
    )
    # Notify the customer about progress
    notify(
        db, user_id=order.customer_id, type="order.status",
        title=f"Order {order.id}: {payload.status.value.replace('_', ' ')}",
        body=f"Status changed from {previous_status} to {payload.status.value}.",
        link=f"/tracking/{order.id}",
    )
    return _to_order_out(order)


@router.patch("/{order_id}/assign", response_model=OrderOut)
def assign_order(
    order_id: str,
    payload: AssignOrderIn,
    request: Request,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    order.assigned_to = payload.assignedTo
    db.commit()
    db.refresh(order)
    record_audit(
        db, action="order.assign", actor=_admin, resource_type="order", resource_id=order.id,
        request=request, details={"assigned_to": payload.assignedTo},
    )
    # Notify the rider that they have a new assignment
    if payload.assignedTo:
        notify(
            db, user_id=payload.assignedTo, type="order.assigned",
            title="New delivery assigned",
            body=f"Order {order.id} — {order.delivery_city or 'address pending'}.",
            link="/delivery",
        )
    return _to_order_out(order)


@router.get("/{order_id}/tracking")
def order_tracking(order_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if user.role == UserRole.customer and order.customer_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if user.role == UserRole.delivery and order.assigned_to not in [None, user.id]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    return {"orderId": order.id, "status": order.status.value, "progress": ORDER_PROGRESS.get(order.status.value, 0)}


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: str,
    request: Request,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """
    Delete an order (admin only).

    Business rules:
      - Only admins can delete orders.
      - Orders that have already been delivered cannot be deleted (audit trail).
        Use 'cancelled' status if you need to void a non-delivered order.
      - Cascades automatically to OrderItems and Payment via SQLAlchemy relationship.
      - KhataEntry rows referencing this order have no cascade, so we null
        the order_id (preserving the customer's ledger history).
    """
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Protect delivered orders from deletion to preserve audit trail
    if order.status == OrderStatus.delivered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delivered orders cannot be deleted. They are kept for record-keeping.",
        )

    # Detach khata entries (preserve ledger history but clear FK reference)
    db.query(KhataEntry).filter(KhataEntry.order_id == order_id).update(
        {KhataEntry.order_id: None}
    )

    deleted_status = order.status.value
    db.delete(order)  # cascades to items + payment
    db.commit()
    record_audit(
        db, action="order.delete", actor=_admin, resource_type="order", resource_id=order_id,
        request=request, details={"status_at_deletion": deleted_status},
    )
    return None

