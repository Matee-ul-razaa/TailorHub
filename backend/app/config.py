"""
config.py — Centralised settings & secret management for TailorHub Backend
============================================================================
All configuration is loaded exclusively from environment variables (via the
backend/.env file in development, or real env vars in production).

NO secret should ever have a real value as a Python default.
  ✅ Correct:  GEMINI_API_KEY: str = ""          ← empty default, validated below
  ❌ Wrong:    GEMINI_API_KEY: str = "AIzaSy..."  ← hardcoded secret

Environment loading order (highest priority first):
  1. Real OS environment variables  (e.g. set in Docker / CI / hosting platform)
  2. backend/.env file              (local development only — NEVER committed)
  3. Field default values           (safe non-secret defaults only)

Usage:
    from .config import settings
    print(settings.GEMINI_API_KEY)
"""

import os
import logging
import sys

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def setup_logging() -> logging.Logger:
    """Configure structured logging for the application."""
    logger = logging.getLogger("tailorhub")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


# Global logger instance
logger = setup_logging()

# Resolve the backend/ directory regardless of where Python is invoked from
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_PATH = os.path.join(_BACKEND_DIR, ".env")


class Settings(BaseSettings):
    """
    All settings are read from environment variables.
    pydantic-settings automatically loads backend/.env in development.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # ── Core ──────────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development" # "production" or "development"

    # ── JWT ───────────────────────────────────────────────────────────────────
    # Required: set a strong random value in .env (min 32 chars recommended)
    # Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440          # 24 hours — reduce to ~60 for production

    # ── Stripe (Payments) ─────────────────────────────────────────────────────
    # Test keys start with "sk_test_", live keys with "sk_live_"
    # Get yours at: https://dashboard.stripe.com/apikeys
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # ── Google OAuth 2.0 ─────────────────────────────────────────────────────
    # Create credentials at: https://console.cloud.google.com/apis/credentials
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ── AI / ML APIs ──────────────────────────────────────────────────────────
    # Gemini (Virtual Try-On): https://aistudio.google.com/apikey
    GEMINI_API_KEY: str = ""
    # OpenRouter (Nano Banana / Gemini 2.5 Flash Image for VTO): https://openrouter.ai/settings/keys
    OPENROUTER_API_KEY: str = ""
    # HuggingFace (IDM-VTON model): https://huggingface.co/settings/tokens
    HUGGINGFACE_TOKEN: str = ""

    # ── SMTP (Email Verification) ─────────────────────────────────────────────
    # For Gmail: enable 2-Factor Auth, then create an App Password at:
    # https://myaccount.google.com/apppasswords
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@tailorhub.pk"
    SMTP_USE_TLS: bool = True

    # ── Application ───────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:8080"
    CORS_ORIGINS: str = "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,https://frontend-omega-six-42.vercel.app"

    # ── Sentry Error Tracking ───────────────────────────────────────────────
    SENTRY_DSN: str = ""  # Leave empty to disable Sentry
    SENTRY_ENVIRONMENT: str = "development"

    # ── Seeded Admin Account ─────────────────────────────────────────────────
    # These seed the first admin user on startup if they don't already exist.
    # Change DEFAULT_ADMIN_PASSWORD to a strong value in .env — the validator
    # below will REFUSE to start the server if it is weak or a known bad value.
    DEFAULT_ADMIN_EMAIL: str = "admin@tailorhub.pk"
    DEFAULT_ADMIN_PASSWORD: str = ""        # REQUIRED — set in .env
    DEFAULT_ADMIN_NAME: str = "Store Admin"

    # ── Database (MySQL / SQLite / Cloud URL) ──────────────────────────────────
    DATABASE_URL: str = ""
    USE_SQLITE: bool = False
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_DATABASE: str = "tailorhub"
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""

    # ─────────────────────────────────────────────────────────────────────────
    # Computed properties
    # ─────────────────────────────────────────────────────────────────────────

    @property
    def database_url(self) -> str:
        """Build the SQLAlchemy database URL from DATABASE_URL, Railway envs, or MySQL settings."""
        env_url = self.DATABASE_URL or os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL") or os.getenv("MYSQLPRIVATEURL")
        if env_url:
            if env_url.startswith("mysql://"):
                return env_url.replace("mysql://", "mysql+pymysql://", 1)
            if env_url.startswith("postgres://"):
                return env_url.replace("postgres://", "postgresql+psycopg2://", 1)
            return env_url

        sqlite_path = f"sqlite:///{os.path.join(_BACKEND_DIR, 'tailorhub.db')}"
        if self.USE_SQLITE:
            return sqlite_path

        # If a non-default remote MySQL host or password is configured
        if self.MYSQL_DATABASE and (self.MYSQL_HOST not in ("localhost", "127.0.0.1") or self.MYSQL_PASSWORD):
            return (
                f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
                f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            )

        # If localhost is specified, verify if MySQL is actually listening on port 3306
        if self.MYSQL_DATABASE and self.MYSQL_HOST in ("localhost", "127.0.0.1"):
            try:
                import socket
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.3)
                res = sock.connect_ex((self.MYSQL_HOST, self.MYSQL_PORT))
                sock.close()
                if res == 0:
                    return (
                        f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
                        f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
                    )
            except Exception:
                pass
            logger.info("Local MySQL server not running on port 3306; falling back to SQLite (tailorhub.db).")

        return sqlite_path

    @property
    def cors_origins(self) -> list[str]:
        """Parse the comma-separated CORS_ORIGINS string into a list and include FRONTEND_URL."""
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        if self.FRONTEND_URL:
            clean_front = self.FRONTEND_URL.rstrip("/")
            if clean_front not in origins:
                origins.append(clean_front)
        if "https://frontend-omega-six-42.vercel.app" not in origins:
            origins.append("https://frontend-omega-six-42.vercel.app")
        return origins

    @property
    def google_oauth_enabled(self) -> bool:
        """True only when real Google OAuth credentials are configured."""
        return bool(self.GOOGLE_CLIENT_ID and "mock" not in self.GOOGLE_CLIENT_ID)

    @property
    def stripe_enabled(self) -> bool:
        """True only when a non-mock Stripe key is configured."""
        return bool(self.STRIPE_SECRET_KEY and "mock" not in self.STRIPE_SECRET_KEY)

    @property
    def vto_enabled(self) -> bool:
        """True when the VTO feature can be used. IDM-VTON works anonymously too."""
        return True

    # ─────────────────────────────────────────────────────────────────────────
    # Startup validation — runs once when 'settings' is first imported
    # ─────────────────────────────────────────────────────────────────────────

    @model_validator(mode="after")
    def _validate_required_secrets(self) -> "Settings":
        """
        Enforce that all critical secrets are present and meet minimum security
        requirements before the server is allowed to start.

        Rules:
          - JWT_SECRET_KEY      must be set and at least 32 characters
          - DEFAULT_ADMIN_PASSWORD must be set, ≥12 chars, and not a known weak value
          - Optional keys (Stripe, OAuth, AI) produce warnings but don't block startup
            unless they are partially configured (one half of a key pair is set)
        """
        errors: list[str] = []

        # ── REQUIRED: JWT secret ──────────────────────────────────────────────
        if not self.JWT_SECRET_KEY:
            errors.append(
                "JWT_SECRET_KEY is not set.\n"
                "  Generate one: python -c \"import secrets; print(secrets.token_hex(32))\"\n"
                "  Then add to backend/.env:  JWT_SECRET_KEY=<generated-value>"
            )
        elif len(self.JWT_SECRET_KEY) < 32:
            errors.append(
                f"JWT_SECRET_KEY is too short ({len(self.JWT_SECRET_KEY)} chars).\n"
                "  Minimum 32 characters required for HS256 security.\n"
                "  Generate one: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        elif self.JWT_SECRET_KEY in {"change-me-in-production", "secret", "1234567890"}:
            errors.append(
                "JWT_SECRET_KEY is set to a known insecure placeholder value.\n"
                "  Generate a real secret: python -c \"import secrets; print(secrets.token_hex(32))\""
            )

        # ── REQUIRED: Admin password ──────────────────────────────────────────
        _KNOWN_WEAK = {
            "admin123", "password", "changeme", "secret", "1234",
            "12345678", "admin@123", "Admin1234", "admin",
        }
        if not self.DEFAULT_ADMIN_PASSWORD:
            errors.append(
                "DEFAULT_ADMIN_PASSWORD is not set.\n"
                "  Set a strong password (12+ chars, mixed case, digit, symbol) in backend/.env:\n"
                "  DEFAULT_ADMIN_PASSWORD=YourStr0ng!Pass"
            )
        elif self.DEFAULT_ADMIN_PASSWORD in _KNOWN_WEAK:
            errors.append(
                f"DEFAULT_ADMIN_PASSWORD is a known weak value.\n"
                "  Use a password with 12+ characters, mixed case, a digit, and a symbol."
            )
        elif len(self.DEFAULT_ADMIN_PASSWORD) < 12:
            errors.append(
                f"DEFAULT_ADMIN_PASSWORD is too short ({len(self.DEFAULT_ADMIN_PASSWORD)} chars).\n"
                "  Minimum 12 characters required."
            )

        # ── Raise all errors together for a clear, actionable message ─────────
        if errors:
            formatted = "\n\n".join(f"  [{i+1}] {e}" for i, e in enumerate(errors))
            raise ValueError(
                f"\n\n{'='*60}\n"
                f"🔴  TailorHub — SECRET CONFIGURATION ERROR\n"
                f"{'='*60}\n"
                f"The server cannot start because the following required\n"
                f"environment variables are missing or insecure:\n\n"
                f"{formatted}\n\n"
                f"Fix these values in:  backend/.env\n"
                f"Template available:   backend/.env.example\n"
                f"{'='*60}\n"
            )

        # ── OPTIONAL: Warn about partial key pairs (don't block startup) ──────
        _warnings: list[str] = []

        if bool(self.GOOGLE_CLIENT_ID) != bool(self.GOOGLE_CLIENT_SECRET):
            _warnings.append("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET: only one is set — Google OAuth will fail.")

        if bool(self.STRIPE_SECRET_KEY) != bool(self.STRIPE_WEBHOOK_SECRET):
            _warnings.append("STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET: only one is set — Stripe webhooks will fail.")

        if _warnings:
            import warnings
            for w in _warnings:
                warnings.warn(f"[TailorHub Config] ⚠️  {w}", stacklevel=2)

        return self


# ── Singleton — import this everywhere ───────────────────────────────────────
settings = Settings()
