"""OTP service tests — hashing, expiry, attempts, cleanup."""
from datetime import datetime, timedelta

from freezegun import freeze_time

from app.models import OTPCode, OTPPurpose
from app.services.otp_service import cleanup_expired_otps, create_otp, verify_otp


EMAIL = "otp@test.com"


def test_otp_is_bcrypt_hashed_in_db(db_session):
    code = create_otp(db_session, EMAIL, OTPPurpose.email_verification)
    assert code.isdigit() and len(code) == 6
    record = db_session.query(OTPCode).filter(OTPCode.email == EMAIL).first()
    assert record is not None
    assert record.code_hash != code
    assert record.code_hash.startswith("$2")  # bcrypt prefix


def test_resend_otp_invalidates_previous_code(db_session):
    code1 = create_otp(db_session, EMAIL, OTPPurpose.email_verification)
    code2 = create_otp(db_session, EMAIL, OTPPurpose.email_verification)
    # Old code should now be consumed → verification with code1 must fail
    ok, _ = verify_otp(db_session, EMAIL, code1, OTPPurpose.email_verification)
    assert ok is False
    ok2, _ = verify_otp(db_session, EMAIL, code2, OTPPurpose.email_verification)
    assert ok2 is True


def test_correct_code_succeeds(db_session):
    code = create_otp(db_session, EMAIL, OTPPurpose.email_verification)
    ok, msg = verify_otp(db_session, EMAIL, code, OTPPurpose.email_verification)
    assert ok is True
    assert "success" in msg.lower()


def test_wrong_code_increments_attempts(db_session):
    create_otp(db_session, EMAIL, OTPPurpose.email_verification)
    ok, _ = verify_otp(db_session, EMAIL, "000000", OTPPurpose.email_verification)
    assert ok is False
    record = db_session.query(OTPCode).filter(OTPCode.email == EMAIL).first()
    assert record.attempts == 1


def test_5_wrong_attempts_locks_code(db_session):
    create_otp(db_session, EMAIL, OTPPurpose.email_verification)
    for _ in range(5):
        verify_otp(db_session, EMAIL, "000000", OTPPurpose.email_verification)
    ok, msg = verify_otp(db_session, EMAIL, "000000", OTPPurpose.email_verification)
    assert ok is False
    assert "too many" in msg.lower() or "attempts" in msg.lower()


def test_expired_code_is_rejected(db_session):
    with freeze_time("2026-01-01 12:00:00"):
        code = create_otp(db_session, EMAIL, OTPPurpose.email_verification)
    with freeze_time("2026-01-01 12:16:00"):  # 16 minutes later (TTL=15)
        ok, msg = verify_otp(db_session, EMAIL, code, OTPPurpose.email_verification)
    assert ok is False
    assert "expired" in msg.lower()


def test_cleanup_deletes_records_older_than_24h(db_session):
    # Insert an OTP 25h in the past
    old = OTPCode(
        email=EMAIL,
        code_hash="$2b$12$abcdefghijklmnopqrstuv",
        purpose=OTPPurpose.email_verification,
        expires_at=datetime.utcnow() - timedelta(hours=24, minutes=50),
        created_at=datetime.utcnow() - timedelta(hours=25),
    )
    db_session.add(old)
    # And a fresh one
    create_otp(db_session, "fresh@test.com", OTPPurpose.email_verification)
    db_session.commit()

    deleted = cleanup_expired_otps(db_session)
    assert deleted >= 1
    remaining = db_session.query(OTPCode).filter(OTPCode.email == EMAIL).count()
    assert remaining == 0
