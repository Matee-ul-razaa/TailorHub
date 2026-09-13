from app.database import SessionLocal
from app.invoice_service import render_invoice_pdf
from app.models import Invoice, Order, User

db = SessionLocal()
inv = db.query(Invoice).first()
if inv:
    order = db.query(Order).filter(Order.id == inv.order_id).first()
    customer = db.query(User).filter(User.id == inv.customer_id).first()
    try:
        pdf_bytes = render_invoice_pdf(inv, order, customer, "en")
        print("Success, generated PDF bytes:", len(pdf_bytes))
    except Exception as e:
        import traceback
        traceback.print_exc()
else:
    print("No invoices found")
