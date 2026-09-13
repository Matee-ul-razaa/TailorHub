from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from .database import get_db
from .deps import require_role, get_current_user
from .models import KhataEntry, Expense, User, UserRole, Order, Invoice, InvoiceStatus
from .schemas import KhataEntryIn, KhataEntryOut, ExpenseIn, ExpenseOut
from .invoice_service import mark_invoice_paid

router = APIRouter(prefix="/api/khata", tags=["khata"])

# ── Khata (Customer Ledger) ───────────────────────────────────────────────────

@router.get("/customer/{customer_id}", response_model=List[KhataEntryOut])
def get_customer_khata(
    customer_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Customers can only see their own khata, admins can see all
    if user.role == UserRole.customer and user.id != customer_id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    return db.query(KhataEntry).filter(KhataEntry.customer_id == customer_id).order_by(KhataEntry.created_at.desc()).all()

@router.post("/entry", response_model=KhataEntryOut)
def add_khata_entry(
    payload: KhataEntryIn,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db)
):
    # Normalize empty string to None
    order_id = payload.order_id or None

    # Verify order exists if order_id is provided
    if order_id:
        order = db.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
            
    entry = KhataEntry(
        customer_id=payload.customer_id,
        order_id=order_id,
        type=payload.type,
        amount=payload.amount,
        notes=payload.notes
    )
    db.add(entry)

    # If it's a payment, update order.amount_paid and settle any unpaid invoices
    if payload.type == "payment" and order_id:
        order = db.get(Order, order_id)
        order.amount_paid = round(float(order.amount_paid) + float(payload.amount), 2)

        # Settle invoices based on total amount paid so far
        paid_so_far = order.amount_paid
        all_invoices = (
            db.query(Invoice)
            .filter(Invoice.order_id == order_id)
            .order_by(Invoice.created_at)
            .all()
        )
        for inv in all_invoices:
            if paid_so_far >= inv.total_amount:
                if inv.status == InvoiceStatus.unpaid:
                    mark_invoice_paid(db, inv, "cash")
                paid_so_far -= inv.total_amount
            else:
                break

    db.commit()
    db.refresh(entry)
    return entry

# ── Expenses ──────────────────────────────────────────────────────────────────

@router.get("/expenses", response_model=List[ExpenseOut])
def list_expenses(
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db)
):
    return db.query(Expense).order_by(Expense.expense_date.desc()).all()

@router.post("/expenses", response_model=ExpenseOut)
def record_expense(
    payload: ExpenseIn,
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db)
):
    expense = Expense(
        category=payload.category,
        amount=payload.amount,
        description=payload.description
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense

@router.get("/summary")
def get_financial_summary(
    _admin: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    
    total_payments = db.query(func.sum(KhataEntry.amount)).filter(KhataEntry.type == "payment").scalar() or 0
    total_credits = db.query(func.sum(KhataEntry.amount)).filter(KhataEntry.type == "credit").scalar() or 0
    total_expenses = db.query(func.sum(Expense.amount)).scalar() or 0
    
    return {
        "total_revenue": total_payments,
        "outstanding_balance": total_credits - total_payments,
        "total_expenses": total_expenses,
        "net_profit": total_payments - total_expenses
    }
