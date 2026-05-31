"""
Email Service
───────────────────
Uses Python stdlib libraries to compose and send emails via SMTP.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional

from .config import settings, logger

OTP_EXPIRY_MINUTES = 15  # Matches the otp_service.py default


def _send_via_smtp(to_email: str, subject: str, text: str, html: str, pdf_bytes: Optional[bytes] = None, pdf_name: Optional[str] = None) -> bool:
    """
    Private helper to handle the SMTP transport logic.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    if pdf_bytes and pdf_name:
        part = MIMEApplication(pdf_bytes, Name=pdf_name)
        part['Content-Disposition'] = f'attachment; filename="{pdf_name}"'
        msg.attach(part)

    try:
        if settings.SMTP_USE_TLS:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.ehlo()
            server.starttls()
        else:
            # Fallback for SSL (usually port 465)
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)

        # Only attempt login if a username is provided
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            
        server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        logger.error(f"[EMAIL SERVICE] SMTP Error: {e}")
        return False


def send_otp_email(to_email: str, otp_code: str) -> bool:
    """
    Send the OTP verification email via SMTP.
    """
    subject = f"TailorHub – Your Verification Code: {otp_code}"
    
    text = f"""
TailorHub Email Verification
─────────────────────────────

Your verification code is: {otp_code}

This code expires in {OTP_EXPIRY_MINUTES} minutes.
If you did not request this, please ignore this email.

– TailorHub Team
"""

    html = f"""
<html>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 12px; margin-bottom: 24px;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">✂️ TailorHub</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Email Verification</p>
  </div>
  <div style="background: #f9fafb; border-radius: 12px; padding: 32px; text-align: center;">
    <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">Your verification code is:</p>
    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4f46e5; padding: 16px; background: #fff; border-radius: 8px; border: 2px dashed #4f46e5; display: inline-block;">
      {otp_code}
    </div>
    <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0;">This code expires in <strong>{OTP_EXPIRY_MINUTES} minutes</strong>.</p>
  </div>
  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
    If you did not request this, you can safely ignore this email.
  </p>
</body>
</html>
"""

    success = _send_via_smtp(to_email, subject, text, html)
    
    # In development or if SMTP fails, log to console and file
    if not success or settings.ENVIRONMENT != "production":
        log_line = f"[EMAIL SERVICE] OTP for {to_email}: {otp_code}"
        logger.info(f"{'='*60} {log_line} {'='*60}")
        try:
            import os
            log_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dev_otp.log")
            with open(log_path, "a") as f:
                from datetime import datetime
                f.write(f"{datetime.now().isoformat()}  {log_line}\n")
        except Exception:
            pass

    return success


def send_invoice_email(to_email: str, customer_name: str, invoice_number: str,
                       order_id: str, total: float, pdf_bytes: bytes) -> bool:
    """Sends an HTML email with the PDF attached."""
    subject = f"TailorHub – Invoice {invoice_number}"
    
    text = f"""
Dear {customer_name},

Thank you for your order! Your invoice ({invoice_number}) is attached to this email.
Total: Rs. {int(total):,}

View your order tracking here: {settings.FRONTEND_URL}/tracking?orderId={order_id}

– TailorHub Team
"""

    html = f"""
<html>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 12px 12px 0 0; margin-bottom: 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">✂️ TailorHub</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Payment Receipt</p>
  </div>
  <div style="background: #f9fafb; border-radius: 0 0 12px 12px; padding: 32px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hi <strong>{customer_name}</strong>,</p>
    <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">Thank you for your order! We have attached your official invoice to this email.</p>
    
    <div style="background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">Invoice Number: <strong style="color: #111827;">{invoice_number}</strong></p>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Total Amount: <strong style="color: #111827;">Rs. {int(total):,}</strong></p>
    </div>

    <div style="text-align: center;">
        <a href="{settings.FRONTEND_URL}/tracking?orderId={order_id}" style="display: inline-block; background: #9333ea; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">View Order Tracking</a>
    </div>
  </div>
  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
    This is an automated message. Please do not reply directly to this email.
  </p>
</body>
</html>
"""

    pdf_name = f"TailorHub-{invoice_number}.pdf"
    return _send_via_smtp(to_email, subject, text, html, pdf_bytes, pdf_name)
