import os
import io
import tempfile
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fpdf import FPDF
import qrcode

from .models import Invoice, InvoiceType, InvoiceStatus, Order, User
from .config import settings
from .email_service import send_invoice_email as send_email_helper

INVOICES_DIR = os.path.join(tempfile.gettempdir(), "invoices")
os.makedirs(INVOICES_DIR, exist_ok=True)


def generate_invoice_number(db: Session) -> str:
    """Returns next sequential invoice number for current year, format INV-YYYY-NNNNN."""
    year = datetime.utcnow().year
    prefix = f"INV-{year}-"
    
    # Find the latest invoice for this year
    latest_invoice = db.query(Invoice).filter(
        Invoice.invoice_number.like(f"{prefix}%")
    ).order_by(Invoice.id.desc()).first()
    
    if not latest_invoice:
        return f"{prefix}00001"
        
    try:
        last_num = int(latest_invoice.invoice_number.split("-")[-1])
        return f"{prefix}{(last_num + 1):05d}"
    except ValueError:
        return f"{prefix}00001"


def create_invoice(db: Session, order: Order, invoice_type: InvoiceType, subtotal: float, delivery_fee: float = 250.0) -> Invoice:
    """Creates and persists a new invoice row."""
    invoice_number = generate_invoice_number(db)
    total_amount = subtotal + delivery_fee
    
    initial_status = InvoiceStatus.unpaid
    paid_at = None
    
    if invoice_type == InvoiceType.advance and order.advance_amount >= total_amount:
        initial_status = InvoiceStatus.paid
        paid_at = datetime.utcnow()
    elif invoice_type == InvoiceType.full and order.amount_paid >= order.total_amount:
        initial_status = InvoiceStatus.paid
        paid_at = datetime.utcnow()
    elif invoice_type == InvoiceType.balance and order.amount_paid >= order.total_amount:
        initial_status = InvoiceStatus.paid
        paid_at = datetime.utcnow()
    
    invoice = Invoice(
        invoice_number=invoice_number,
        order_id=order.id,
        customer_id=order.customer_id,
        type=invoice_type,
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        total_amount=total_amount,
        status=initial_status,
        paid_at=paid_at,
        due_date=datetime.utcnow() + timedelta(days=7),
    )
    
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


def mark_invoice_paid(db: Session, invoice: Invoice, payment_method: str = "card") -> None:
    """Sets status='paid', paid_at=now(). Clears cached PDF so it regenerates with PAID status."""
    invoice.status = InvoiceStatus.paid
    invoice.paid_at = datetime.utcnow()
    # Delete stale cached PDF — next request will regenerate with updated status
    if invoice.pdf_path and os.path.exists(invoice.pdf_path):
        try:
            os.remove(invoice.pdf_path)
        except OSError:
            pass
    invoice.pdf_path = None
    db.commit()
    db.refresh(invoice)


def send_invoice_email(invoice: Invoice, order: Order, customer: User, pdf_bytes: bytes) -> bool:
    """Emails the PDF as attachment using existing email_service module."""
    # We will implement send_invoice_email in email_service.py shortly.
    # For now, we call the helper function.
    success = send_email_helper(
        to_email=customer.email,
        customer_name=customer.full_name or order.customer_name,
        invoice_number=invoice.invoice_number,
        order_id=order.id,
        total=invoice.total_amount,
        pdf_bytes=pdf_bytes
    )
    return success


def render_invoice_pdf(invoice: Invoice, order: Order, customer: User, lang: str = 'en') -> bytes:
    """Generates a branded PDF as bytes. Caches to invoice.pdf_path on disk."""
    
    pdf = FPDF(orientation='P', unit='mm', format='A4')
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Helper to draw a filled rectangle for the header band
    pdf.set_fill_color(147, 51, 234) # #9333ea Purple accent color
    pdf.rect(0, 0, 210, 25, 'F')
    
    # Header Band Text (White)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_xy(15, 6)
    pdf.cell(50, 10, "TailorHub", ln=0, align="L")
    
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_xy(15, 14)
    pdf.cell(50, 6, "Crafted for You", ln=0, align="L")
    
    # Right side of header band
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_xy(130, 5)
    pdf.cell(65, 10, "INVOICE", ln=0, align="R")
    
    pdf.set_font("Courier", "B", 11)
    pdf.set_xy(130, 14)
    pdf.cell(65, 6, invoice.invoice_number, ln=0, align="R")
    
    # Reset text color for body
    pdf.set_text_color(0, 0, 0)
    pdf.set_xy(15, 35)
    
    # Two-column info section
    # English vs Urdu Labels (Best-effort for Urdu via DejaVu or basic transliteration, 
    # but since FPDF core doesn't handle complex Arabic shaping well, we stick to basic or English with translated terms if font allows.
    # For this implementation we will use English but support parameter for future font extension)
    
    bill_to_label = "BILL TO" if lang != 'ur' else "BILL TO (بل ادا کریں)"
    details_label = "INVOICE DETAILS" if lang != 'ur' else "INVOICE DETAILS"
    
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(95, 6, bill_to_label, 0, 0, 'L')
    pdf.cell(95, 6, details_label, 0, 1, 'L')
    
    pdf.set_font("Helvetica", "", 10)
    
    # Left Column Data
    cust_name = customer.full_name or order.customer_name
    cust_email = customer.email
    
    # Right Column Data
    inv_date = invoice.created_at.strftime('%d %b %Y')
    due_date = invoice.due_date.strftime('%d %b %Y')
    status_str = invoice.status.value.upper()
    
    # Row 1
    y_start = pdf.get_y()
    pdf.cell(95, 6, cust_name, 0, 0, 'L')
    pdf.cell(40, 6, "Invoice Date:", 0, 0, 'L')
    pdf.cell(55, 6, inv_date, 0, 1, 'R')
    
    # Row 2
    pdf.cell(95, 6, cust_email, 0, 0, 'L')
    pdf.cell(40, 6, "Due Date:", 0, 0, 'L')
    
    # Highlight due date if overdue
    if invoice.status == InvoiceStatus.overdue:
        pdf.set_text_color(220, 38, 38) # Red
    pdf.cell(55, 6, due_date, 0, 1, 'R')
    pdf.set_text_color(0, 0, 0)
    
    # Row 3
    pdf.cell(95, 6, "", 0, 0, 'L')
    pdf.cell(40, 6, "Order ID:", 0, 0, 'L')
    pdf.cell(55, 6, order.id, 0, 1, 'R')
    
    # Row 4
    pdf.cell(95, 6, "", 0, 0, 'L')
    pdf.cell(40, 6, "Status:", 0, 0, 'L')
    
    # Color-coded status badge
    if invoice.status == InvoiceStatus.paid:
        pdf.set_text_color(22, 163, 74) # Green
    elif invoice.status == InvoiceStatus.unpaid:
        pdf.set_text_color(202, 138, 4) # Yellow/Orange
    elif invoice.status == InvoiceStatus.overdue:
        pdf.set_text_color(220, 38, 38) # Red
    
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(55, 6, status_str, 0, 1, 'R')
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 10)
    
    pdf.ln(10)
    
    # Items Table Header
    pdf.set_fill_color(243, 244, 246) # Light Gray
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(65, 8, "Item Name", 1, 0, "L", True)
    pdf.cell(45, 8, "Customizations", 1, 0, "L", True)
    pdf.cell(15, 8, "Qty", 1, 0, "C", True)
    pdf.cell(30, 8, "Unit Price", 1, 0, "R", True)
    pdf.cell(35, 8, "Subtotal", 1, 1, "R", True)
    
    # Items Table Body
    pdf.set_font("Helvetica", "", 9)
    for idx, item in enumerate(order.items):
        fill = (idx % 2 == 1)
        if fill:
            pdf.set_fill_color(249, 250, 251) # Very light gray for alternating rows
        else:
            pdf.set_fill_color(255, 255, 255)
            
        line_total = item.unit_price * item.quantity
        
        custom_str = f"{item.color or '-'} / {item.size or '-'} / {item.purchase_mode or '-'}"
        
        pdf.cell(65, 8, str(item.product_name)[:35], 1, 0, "L", fill)
        pdf.cell(45, 8, custom_str[:25], 1, 0, "L", fill)
        pdf.cell(15, 8, str(item.quantity), 1, 0, "C", fill)
        pdf.cell(30, 8, f"Rs. {int(item.unit_price):,}", 1, 0, "R", fill)
        pdf.cell(35, 8, f"Rs. {int(line_total):,}", 1, 1, "R", fill)
        
    pdf.ln(10)
    
    # Totals Block
    y_totals = pdf.get_y()
    pdf.set_xy(115, y_totals)
    
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(40, 7, "Subtotal:", 0, 0, "R")
    pdf.cell(40, 7, f"Rs. {int(invoice.subtotal):,}", 0, 1, "R")
    
    pdf.set_xy(115, pdf.get_y())
    pdf.cell(40, 7, "Delivery:", 0, 0, "R")
    pdf.cell(40, 7, f"Rs. {int(invoice.delivery_fee):,}", 0, 1, "R")
    
    pdf.set_xy(115, pdf.get_y())
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(147, 51, 234) # Accent color
    pdf.cell(40, 10, "TOTAL:", 0, 0, "R")
    pdf.cell(40, 10, f"Rs. {int(invoice.total_amount):,}", 0, 1, "R")
    
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 10)
    
    # Display amount paid and balance if applicable
    amount_paid = order.amount_paid
    if amount_paid > 0:
        pdf.set_xy(115, pdf.get_y())
        pdf.cell(40, 7, "Amount Paid:", 0, 0, "R")
        pdf.cell(40, 7, f"Rs. {int(amount_paid):,}", 0, 1, "R")
        
    balance = invoice.total_amount - amount_paid
    if balance > 0 and invoice.status != InvoiceStatus.paid:
        pdf.set_xy(115, pdf.get_y())
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(220, 38, 38) # Red
        pdf.cell(40, 7, "Balance Due:", 0, 0, "R")
        pdf.cell(40, 7, f"Rs. {int(balance):,}", 0, 1, "R")
        pdf.set_text_color(0, 0, 0)
        
    # QR Code Generation
    qr_url = f"{settings.FRONTEND_URL}/tracking?orderId={order.id}"
    qr = qrcode.make(qr_url)
    qr_path = os.path.join(tempfile.gettempdir(), f"qr_temp_{invoice.invoice_number}.png")
    qr.save(qr_path, format="PNG")
    
    # Draw QR Code on left side
    # We go back up to where totals started
    pdf.set_xy(15, y_totals)
    pdf.image(qr_path, x=15, y=y_totals, w=35)
    pdf.set_xy(15, y_totals + 36)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(35, 4, "Scan to track your order", 0, 1, "C")
    
    # Footer
    pdf.set_y(-30)
    pdf.set_draw_color(209, 213, 219)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(5)
    
    pdf.set_text_color(107, 114, 128)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 4, "Thank you for your business!", ln=1, align="L")
    pdf.cell(0, 4, f"Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}", ln=1, align="L")
    pdf.cell(0, 4, "This is a computer-generated invoice. No signature required.", ln=1, align="L")
    
    # Cleanup QR temp file
    try:
        os.remove(qr_path)
    except OSError:
        pass
        
    # Generate PDF bytes
    pdf_bytes = pdf.output(dest='S')
    
    # Cache to disk
    cache_path = os.path.join(INVOICES_DIR, f"{invoice.invoice_number}.pdf")
    with open(cache_path, "wb") as f:
        f.write(pdf_bytes)
        
    # Update model if db instance is attached (caller should commit)
    invoice.pdf_path = cache_path
    
    return pdf_bytes
