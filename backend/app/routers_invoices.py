import io
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_current_user, require_role
from .models import Invoice, InvoiceType, InvoiceStatus, Order, User, UserRole
from .invoice_service import (
    create_invoice,
    generate_invoice_number,
    render_invoice_pdf,
    mark_invoice_paid as service_mark_paid,
    send_invoice_email as service_send_email,
    INVOICES_DIR
)

# We register both /api/invoices and /api/orders prefixes for backward compatibility
router = APIRouter(tags=["invoices"])


@router.get("/api/invoices")
def list_invoices(
    status_filter: Optional[InvoiceStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List invoices. Customers see their own, admins see all."""
    query = db.query(Invoice)
    
    if user.role == UserRole.customer:
        query = query.filter(Invoice.customer_id == user.id)
    
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
        
    total = query.count()
    invoices = query.order_by(Invoice.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    # Return basic metadata without full order details
    return {
        "items": [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "order_id": inv.order_id,
                "type": inv.type,
                "total_amount": inv.total_amount,
                "status": inv.status,
                "due_date": inv.due_date,
                "created_at": inv.created_at,
            }
            for inv in invoices
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/api/invoices/{invoice_number}")
def get_invoice(invoice_number: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch invoice metadata."""
    invoice = db.query(Invoice).filter(Invoice.invoice_number == invoice_number).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if user.role == UserRole.customer and invoice.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "order_id": invoice.order_id,
        "customer_id": invoice.customer_id,
        "type": invoice.type,
        "subtotal": invoice.subtotal,
        "delivery_fee": invoice.delivery_fee,
        "total_amount": invoice.total_amount,
        "status": invoice.status,
        "due_date": invoice.due_date,
        "paid_at": invoice.paid_at,
        "email_sent_at": invoice.email_sent_at,
        "created_at": invoice.created_at,
    }


@router.get("/api/invoices/{invoice_number}/pdf")
def get_invoice_pdf(
    invoice_number: str, 
    lang: str = Query('en'), 
    user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Stream the PDF, regenerating if necessary."""
    invoice = db.query(Invoice).filter(Invoice.invoice_number == invoice_number).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if user.role == UserRole.customer and invoice.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    order = db.get(Order, invoice.order_id)
    customer = db.get(User, invoice.customer_id)
    
    # Check if we have a cached PDF and it exists
    if invoice.pdf_path and os.path.exists(invoice.pdf_path):
        with open(invoice.pdf_path, "rb") as f:
            pdf_bytes = f.read()
    else:
        # Generate on the fly
        try:
            pdf_bytes = render_invoice_pdf(invoice, order, customer, lang)
            db.commit() # commit the saved pdf_path
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF Generation failed: {e}")
            
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=TailorHub-{invoice.invoice_number}.pdf"},
    )


@router.post("/api/invoices/{invoice_number}/email")
def email_invoice(invoice_number: str, user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    """Admin-only: re-send invoice email."""
    invoice = db.query(Invoice).filter(Invoice.invoice_number == invoice_number).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    order = db.get(Order, invoice.order_id)
    customer = db.get(User, invoice.customer_id)
    
    if invoice.pdf_path and os.path.exists(invoice.pdf_path):
        with open(invoice.pdf_path, "rb") as f:
            pdf_bytes = f.read()
    else:
        pdf_bytes = render_invoice_pdf(invoice, order, customer)
        db.commit()
        
    success = service_send_email(invoice, order, customer, pdf_bytes)
    if success:
        from datetime import datetime
        invoice.email_sent_at = datetime.utcnow()
        db.commit()
        return {"message": "Email sent successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to send email. Check SMTP settings.")


@router.patch("/api/invoices/{invoice_number}/mark-paid")
def mark_paid(invoice_number: str, user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    """Admin-only: manually mark invoice as paid (e.g., COD)."""
    invoice = db.query(Invoice).filter(Invoice.invoice_number == invoice_number).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if invoice.status == InvoiceStatus.paid:
        return {"message": "Invoice already paid"}
        
    service_mark_paid(db, invoice, "cod")

    # Also sync order.amount_paid
    order = db.get(Order, invoice.order_id)
    if order and order.amount_paid < order.total_amount:
        order.amount_paid = order.total_amount
        db.commit()

    # Send email receipt if possible
    customer = db.get(User, invoice.customer_id)
    try:
        if invoice.pdf_path and os.path.exists(invoice.pdf_path):
            with open(invoice.pdf_path, "rb") as f:
                pdf_bytes = f.read()
        else:
            pdf_bytes = render_invoice_pdf(invoice, order, customer)
            db.commit()
        service_send_email(invoice, order, customer, pdf_bytes)
    except Exception:
        pass # Ignore email failures on manual mark-paid
        
    return {"message": "Invoice marked as paid"}


@router.post("/api/invoices/from-order/{order_id}")
def create_invoice_from_order(
    order_id: str, 
    type: InvoiceType = Query(InvoiceType.full),
    user: User = Depends(require_role(UserRole.admin)), 
    db: Session = Depends(get_db)
):
    """Admin-only: manually create an invoice."""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # Calculate subtotal based on items
    subtotal = sum(item.unit_price * item.quantity for item in order.items)
    
    # If advance, use advance_amount
    if type == InvoiceType.advance:
        subtotal = order.advance_amount
        delivery_fee = 0.0
    elif type == InvoiceType.balance:
        subtotal = order.total_amount - order.advance_amount
        delivery_fee = 0.0 # Assuming delivery fee was paid in advance or full
    else:
        delivery_fee = 250.0 # Or derived from order logic
        
    invoice = create_invoice(db, order, type, subtotal, delivery_fee)
    
    return {"invoice_number": invoice.invoice_number, "message": "Invoice created"}


# ── BACKWARD COMPATIBILITY ALIAS ──────────────────────────────────────────────
@router.get("/api/orders/{order_id}/invoice")
def legacy_generate_invoice(order_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Legacy alias that guarantees returning a PDF for an order."""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if user.role == UserRole.customer and order.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    # Find existing invoice
    invoice = db.query(Invoice).filter(Invoice.order_id == order_id).order_by(Invoice.created_at.desc()).first()
    
    # If no invoice exists, auto-create a 'full' invoice
    if not invoice:
        subtotal = sum(item.unit_price * item.quantity for item in order.items)
        # We assume 250 delivery fee if it makes total match, otherwise use delta
        delivery_fee = max(0, order.total_amount - subtotal)
        invoice = create_invoice(db, order, InvoiceType.full, subtotal, delivery_fee)
        
    # Redirect to the new PDF stream logic
    return get_invoice_pdf(invoice.invoice_number, lang='en', user=user, db=db)
