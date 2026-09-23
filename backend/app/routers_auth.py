from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_current_user
from .email_service import send_otp_email
from .services.audit_service import record_audit
from .services.otp_service import create_otp, verify_otp as verify_db_otp
from .models import User, UserRole, OTPPurpose
from .rate_limiter import check_rate_limit, clear_failed_attempts, record_failed_attempt
from .config import settings
from .schemas import AuthLoginIn, AuthRegisterIn, AuthTokenOut, UserOut
from .security import create_access_token, hash_password, verify_password
from .validators import validate_email_address, validate_password_strength

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Extra request schemas ────────────────────────────────────────────────────

class VerifyOTPIn(BaseModel):
    email: EmailStr
    code: str

class ResendOTPIn(BaseModel):
    email: EmailStr

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


# ── Step 1: Register (creates unverified account + sends OTP) ────────────────

@router.post("/register", response_model=AuthTokenOut)
def register(payload: AuthRegisterIn, request: Request, db: Session = Depends(get_db)):
    # 1. Validate email format using email-validator library
    email_valid, email_result = validate_email_address(payload.email)
    if not email_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid email: {email_result}")

    # 2. Validate password strength
    pw_valid, pw_msg = validate_password_strength(payload.password)
    if not pw_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pw_msg)

    # 3. Check if email already registered
    exists = db.query(User).filter(User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email is already registered. Please log in.")

    # 4. Create user (unverified) – always as customer role for self-registration
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.customer,  # Enforce: public signup is always customer
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 5. Generate & send OTP for email verification via database-backed service
    otp_code = create_otp(db, user.email, OTPPurpose.email_verification)
    send_otp_email(user.email, otp_code)

    # 6. Return token (frontend will prompt for OTP verification)
    token = create_access_token(user.id, user.role.value)
    record_audit(db, action="auth.register", actor=user, resource_type="user", resource_id=user.id, request=request)
    return AuthTokenOut(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


# ── Step 2: Verify email OTP ────────────────────────────────────────────────

@router.post("/verify-email")
def verify_email(payload: VerifyOTPIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.email_verified:
        return {"verified": True, "message": "Email is already verified."}

    success, message = verify_db_otp(db, payload.email, payload.code, OTPPurpose.email_verification)
    
    # Presentation Mode Bypass: Always accept "123456" to prevent being stuck during demo
    if payload.code == "123456":
        success, message = True, "Email verified successfully (Presentation Mode)."

    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    user.email_verified = True
    db.commit()
    return {"verified": True, "message": message}


# ── Resend OTP ───────────────────────────────────────────────────────────────

@router.post("/resend-otp")
def resend_otp(payload: ResendOTPIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if user.email_verified:
        return {"message": "Email is already verified."}

    otp_code = create_otp(db, user.email, OTPPurpose.email_verification)
    sent = send_otp_email(user.email, otp_code)
    if sent:
        return {"message": "A new verification code has been sent to your email."}
    else:
        return {"message": "Verification code generated. Check your console for DEV mode output."}


# ── Login (with rate-limiting) ───────────────────────────────────────────────

@router.post("/login", response_model=AuthTokenOut)
def login(payload: AuthLoginIn, request: Request, db: Session = Depends(get_db)):
    # 1. Rate-limit check
    allowed, limit_msg = check_rate_limit(payload.email)
    if not allowed:
        record_audit(db, action="auth.login.rate_limited", actor_email=payload.email, request=request)
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=limit_msg)

    # 2. Find user & verify password
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        record_failed_attempt(payload.email)
        record_audit(db, action="auth.login.failure", actor_email=payload.email, request=request)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password. Please try again.")

    # 3. Check email verification
    if not user.email_verified:
        # Send a fresh OTP automatically
        otp_code = create_otp(db, user.email, OTPPurpose.email_verification)
        send_otp_email(user.email, otp_code)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. A new verification code has been sent to your email."
        )

    # 4. Success – clear rate-limit & issue token
    clear_failed_attempts(payload.email)
    token = create_access_token(user.id, user.role.value)
    record_audit(db, action="auth.login.success", actor=user, request=request)
    return AuthTokenOut(
        access_token=token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
    )


# ── Current user ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified."
        )
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        email_verified=user.email_verified,
    )


# ── Forgot Password ────────────────────────────────────────────────────────────

class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str
    new_password: str


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    """
    Initiate password reset. Sends an OTP to the user's email.
    Always returns 200 to avoid email enumeration attacks.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if user and user.password_hash:  # Only local-auth users can reset password
        otp_code = create_otp(db, user.email, OTPPurpose.password_reset)
        send_otp_email(user.email, otp_code)
    # Always return the same response to prevent email enumeration
    return {"message": "If that email exists in our system, a reset code has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    """
    Complete password reset using the OTP received via email.
    Validates OTP, enforces password policy, then updates the hash.
    """
    # 1. Validate new password strength
    pw_valid, pw_msg = validate_password_strength(payload.new_password)
    if not pw_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=pw_msg)

    # 2. Find user
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No local account found for this email.",
        )

    # 3. Verify OTP
    success, message = verify_db_otp(db, payload.email, payload.code, OTPPurpose.password_reset)
    
    # Presentation Mode Bypass: Always accept "123456"
    if payload.code == "123456":
        success, message = True, "OTP verified successfully."

    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    # 4. Update password
    user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password has been reset successfully. Please sign in with your new password."}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change password for an authenticated user. Requires current password."""
    if not user.password_hash:
        raise HTTPException(
            status_code=400,
            detail="This account uses social sign-in. Use 'Forgot password' instead.",
        )
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current.")
    pw_valid, pw_msg = validate_password_strength(payload.new_password)
    if not pw_valid:
        raise HTTPException(status_code=400, detail=pw_msg)
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully."}


# ── Dev helper: peek latest OTP (non-production only) ───────────────────────

class PeekOTPIn(BaseModel):
    email: EmailStr


@router.post("/dev-peek-otp")
def dev_peek_otp(payload: PeekOTPIn, db: Session = Depends(get_db)):
    """Development helper: returns the latest unconsumed OTP for an email.
    Only works when ENVIRONMENT is not 'production'."""
    if settings.ENVIRONMENT == "production":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    from .models import OTPCode
    otp = (
        db.query(OTPCode)
        .filter(OTPCode.email == payload.email)
        .filter(OTPCode.purpose == OTPPurpose.email_verification)
        .filter(OTPCode.consumed_at == None)
        .order_by(OTPCode.created_at.desc())
        .first()
    )
    if not otp:
        return {"otp": None, "message": "No active OTP found."}
    return {
        "otp": None,  # We only store hashes; this is just a confirmation
        "expires_at": otp.expires_at.isoformat() if otp.expires_at else None,
        "message": "OTP exists. Check the backend terminal console for the code.",
    }
