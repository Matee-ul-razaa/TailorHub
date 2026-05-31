import secrets
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..models import OTPCode, OTPPurpose
from ..security import hash_password, verify_password


def create_otp(db: Session, email: str, purpose: OTPPurpose) -> str:
    """
    Generates a 6-digit OTP, marks old ones as consumed, and persists the hash.
    Returns the raw code to be sent via email.
    """
    # 1. Mark previous unconsumed OTPs for this email/purpose as consumed
    db.execute(
        update(OTPCode)
        .where(OTPCode.email == email)
        .where(OTPCode.purpose == purpose)
        .where(OTPCode.consumed_at == None)
        .values(consumed_at=datetime.utcnow())
    )

    # 2. Generate raw 6-digit code
    raw_code = "".join([str(secrets.randbelow(10)) for _ in range(6)])

    # 3. Persist hashed code
    new_otp = OTPCode(
        email=email,
        code_hash=hash_password(raw_code),
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=15),
    )
    db.add(new_otp)
    db.commit()

    return raw_code


def verify_otp(db: Session, email: str, code: str, purpose: OTPPurpose) -> Tuple[bool, str]:
    """
    Verifies an OTP.
    Returns (success, message).
    """
    # Find the latest unconsumed OTP for this email/purpose
    stmt = (
        select(OTPCode)
        .where(OTPCode.email == email)
        .where(OTPCode.purpose == purpose)
        .where(OTPCode.consumed_at == None)
        .order_by(OTPCode.created_at.desc())
        .limit(1)
    )
    otp_record = db.execute(stmt).scalar_one_or_none()

    if not otp_record:
        return False, "No active verification code found."

    # Check expiry
    if otp_record.expires_at < datetime.utcnow():
        return False, "Verification code has expired."

    # Check attempts
    if otp_record.attempts >= otp_record.max_attempts:
        return False, "Too many failed attempts. Please request a new code."

    # Verify code match
    if not verify_password(code, otp_record.code_hash):
        otp_record.attempts += 1
        remaining = otp_record.max_attempts - otp_record.attempts
        db.commit()
        if remaining <= 0:
            return False, "Too many failed attempts. Please request a new code."
        return False, f"Invalid code. {remaining} attempts remaining."

    # Success - mark as consumed
    otp_record.consumed_at = datetime.utcnow()
    db.commit()

    return True, "Verification successful."


def cleanup_expired_otps(db: Session) -> int:
    """
    Removes OTPs older than 24 hours.
    Returns the number of deleted rows.
    """
    cutoff = datetime.utcnow() - timedelta(hours=24)
    # Using delete() for efficiency
    from sqlalchemy import delete
    result = db.execute(delete(OTPCode).where(OTPCode.created_at < cutoff))
    db.commit()
    return result.rowcount
