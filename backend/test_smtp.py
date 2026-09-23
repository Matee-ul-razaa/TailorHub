import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import sys

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = "mateeulraza5@gmail.com"
SMTP_PASSWORD = "aqrzvqejbggulyql"

msg = MIMEMultipart("alternative")
msg["Subject"] = "Test Email from TailorHub"
msg["From"] = SMTP_USER
msg["To"] = SMTP_USER

msg.attach(MIMEText("This is a test email.", "plain"))

try:
    print(f"Connecting to {SMTP_HOST}:{SMTP_PORT}...")
    server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
    server.set_debuglevel(1)
    server.ehlo()
    print("Starting TLS...")
    server.starttls()
    print("Logging in...")
    server.login(SMTP_USER, SMTP_PASSWORD)
    print("Sending email...")
    server.sendmail(SMTP_USER, SMTP_USER, msg.as_string())
    server.quit()
    print("Success!")
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)
