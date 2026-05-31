from fpdf import FPDF
import qrcode
import os
import tempfile

try:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, "Test Invoice", ln=1, align='C')
    
    qr = qrcode.make("https://example.com")
    qr_path = os.path.join(tempfile.gettempdir(), "test_qr.png")
    qr.save(qr_path)
    
    pdf.image(qr_path, x=10, y=20, w=30)
    
    out_path = os.path.join(tempfile.gettempdir(), "test_invoice.pdf")
    pdf.output(out_path)
    print(f"Success: {out_path}")
    os.remove(qr_path)
except Exception as e:
    print(f"Error: {e}")
