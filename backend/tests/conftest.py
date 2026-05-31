"""
Pytest fixtures for TailorHub backend.

Sets required env vars BEFORE importing the app, swaps the database for an
in-memory SQLite using StaticPool (single shared connection), and provides
auth/role fixtures.
"""
import os
import sys

# ── 1. Required env vars must be set BEFORE importing app/config ────────────
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long-for-ci")
os.environ.setdefault("DEFAULT_ADMIN_EMAIL", "admin@test.com")
os.environ.setdefault("DEFAULT_ADMIN_PASSWORD", "TestAdmin@2026!")
os.environ.setdefault("DEFAULT_ADMIN_NAME", "Test Admin")
os.environ["MYSQL_DATABASE"] = ""  # force SQLite fallback in config.database_url

# Ensure the backend/ dir is on sys.path so `import app.*` works.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Import app after env vars are set
from app.main import app  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app import models  # noqa: F401, E402  (ensures all models are registered)
from app.models import User, UserRole  # noqa: E402
from app.security import hash_password, create_access_token  # noqa: E402
from app import validators as _validators  # noqa: E402
from app import rate_limiter as _rate_limiter  # noqa: E402
from app import routers_auth as _routers_auth  # noqa: E402


# ── 2. In-memory SQLite engine shared across the suite ──────────────────────
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)
TestSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False, future=True)


def _override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


# ── 3. Disable network-dependent email deliverability check in tests ────────
def _validate_email_no_dns(email: str):
    from email_validator import validate_email, EmailNotValidError
    try:
        result = validate_email(email, check_deliverability=False)
        return True, result.normalized
    except EmailNotValidError as e:
        return False, str(e)


# Patch on every module that imported the symbol by name.
_validators.validate_email_address = _validate_email_no_dns
_routers_auth.validate_email_address = _validate_email_no_dns


# ── Stub email sending so tests never touch SMTP ────────────────────────────
from app import email_service as _email_service  # noqa: E402

def _stub_send_otp_email(to_email: str, otp_code: str) -> bool:  # noqa: ARG001
    return True

def _stub_send_invoice_email(*args, **kwargs) -> bool:  # noqa: ARG001
    return True

_email_service.send_otp_email = _stub_send_otp_email
_email_service.send_invoice_email = _stub_send_invoice_email
_routers_auth.send_otp_email = _stub_send_otp_email


# ── 4. Schema lifecycle: create once, wipe rows between tests ───────────────
@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(autouse=True)
def _clean_db():
    """Truncate all tables between tests (preserve schema)."""
    yield
    with test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    """Reset the in-memory login rate-limit dict between tests."""
    _rate_limiter._failed_attempts.clear()
    yield
    _rate_limiter._failed_attempts.clear()


# ── 5. Session + client fixtures ────────────────────────────────────────────
@pytest.fixture()
def db_session():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client():
    return TestClient(app)


# ── 6. User + token fixtures ────────────────────────────────────────────────
def _make_user(db, *, email: str, role: UserRole, password: str = "Password123!", verified: bool = True) -> User:
    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=f"{role.value.title()} User",
        role=role,
        email_verified=verified,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def admin_user(db_session) -> User:
    return _make_user(db_session, email="admin@test.com", role=UserRole.admin)


@pytest.fixture()
def admin_token(admin_user) -> str:
    return create_access_token(admin_user.id, admin_user.role.value)


@pytest.fixture()
def customer_user(db_session) -> User:
    return _make_user(db_session, email="customer@test.com", role=UserRole.customer)


@pytest.fixture()
def customer_token(customer_user) -> str:
    return create_access_token(customer_user.id, customer_user.role.value)


@pytest.fixture()
def delivery_user(db_session) -> User:
    return _make_user(db_session, email="delivery@test.com", role=UserRole.delivery)


@pytest.fixture()
def delivery_token(delivery_user) -> str:
    return create_access_token(delivery_user.id, delivery_user.role.value)


@pytest.fixture()
def auth_headers():
    def _make(token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}
    return _make
