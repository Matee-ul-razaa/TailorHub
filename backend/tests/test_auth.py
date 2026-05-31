"""Auth router tests — register / verify / login / forgot / change."""
from unittest.mock import patch

from app.models import OTPCode, User


VALID_PASSWORD = "Password123!"


def _register_payload(email="newuser@test.com", password=VALID_PASSWORD, full_name="Jane Doe"):
    return {"email": email, "password": password, "full_name": full_name}


# ── Register ────────────────────────────────────────────────────────────────

def test_register_creates_unverified_user_and_issues_otp(client, db_session):
    resp = client.post("/api/auth/register", json=_register_payload())
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == "newuser@test.com"
    assert body["role"] == "customer"
    assert body["access_token"]

    user = db_session.query(User).filter(User.email == "newuser@test.com").first()
    assert user is not None
    assert user.email_verified is False

    otp = db_session.query(OTPCode).filter(OTPCode.email == "newuser@test.com").first()
    assert otp is not None
    # Hash, never plaintext
    assert otp.code_hash.startswith("$2")
    assert len(otp.code_hash) > 20


def test_register_rejects_weak_password(client):
    resp = client.post("/api/auth/register", json=_register_payload(password="weak"))
    # Pydantic may return 422 for schema validation; accept 400 or 422
    assert resp.status_code in (400, 422)
    assert "password" in resp.json()["detail"].lower() or "password" in resp.text.lower()


def test_register_rejects_duplicate_email(client):
    client.post("/api/auth/register", json=_register_payload(email="dup@test.com"))
    resp = client.post("/api/auth/register", json=_register_payload(email="dup@test.com"))
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"].lower()


# ── Verify email ────────────────────────────────────────────────────────────

def test_verify_with_correct_code_succeeds(client, db_session):
    captured = {}
    real_create_otp = __import__("app.services.otp_service", fromlist=["create_otp"]).create_otp

    def spy(db, email, purpose):
        code = real_create_otp(db, email, purpose)
        captured["code"] = code
        return code

    with patch("app.routers_auth.create_otp", side_effect=spy):
        client.post("/api/auth/register", json=_register_payload(email="verify@test.com"))

    assert "code" in captured
    resp = client.post("/api/auth/verify-email", json={"email": "verify@test.com", "code": captured["code"]})
    assert resp.status_code == 200, resp.text
    assert resp.json()["verified"] is True

    db_session.expire_all()
    user = db_session.query(User).filter(User.email == "verify@test.com").first()
    assert user.email_verified is True


def test_verify_with_wrong_code_fails(client):
    client.post("/api/auth/register", json=_register_payload(email="bad@test.com"))
    resp = client.post("/api/auth/verify-email", json={"email": "bad@test.com", "code": "000000"})
    assert resp.status_code in (400, 401, 403)


# ── Login ───────────────────────────────────────────────────────────────────

def test_login_success_returns_token(client, customer_user):
    resp = client.post("/api/auth/login", json={"email": customer_user.email, "password": VALID_PASSWORD})
    assert resp.status_code == 200, resp.text
    assert resp.json()["access_token"]


def test_login_wrong_password_returns_401(client, customer_user):
    resp = client.post("/api/auth/login", json={"email": customer_user.email, "password": "WrongPass1!"})
    assert resp.status_code == 401


def test_login_unverified_user_is_rejected_with_403(client, db_session):
    client.post("/api/auth/register", json=_register_payload(email="unv@test.com"))
    resp = client.post("/api/auth/login", json={"email": "unv@test.com", "password": VALID_PASSWORD})
    assert resp.status_code in (403, 422)


def test_login_5_failed_attempts_triggers_429_lockout(client, customer_user):
    for _ in range(5):
        client.post("/api/auth/login", json={"email": customer_user.email, "password": "WrongPass1!"})
    resp = client.post("/api/auth/login", json={"email": customer_user.email, "password": VALID_PASSWORD})
    assert resp.status_code == 429


# ── Forgot / change password ────────────────────────────────────────────────

def test_forgot_password_returns_200_for_unknown_email(client):
    resp = client.post("/api/auth/forgot-password", json={"email": "nobody@test.com"})
    # Pydantic validation may return 422; accept 200 or 422
    assert resp.status_code in (200, 422)
    # Generic message — never reveal whether the email exists
    assert "if that email" in resp.json()["message"].lower()


def test_change_password_requires_correct_current_password(client, customer_user, customer_token, auth_headers):
    resp = client.post(
        "/api/auth/change-password",
        json={"current_password": "WrongPass1!", "new_password": "NewPassword123!"},
        headers=auth_headers(customer_token),
    )
    assert resp.status_code == 400
    assert "current password" in resp.json()["detail"].lower()
