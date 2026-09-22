import json
import asyncio

from fastapi import FastAPI
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    HAVE_SENTRY = True
except ImportError:
    HAVE_SENTRY = False
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Product, User, UserRole
from .routers_auth import router as auth_router
from .routers_invoices import router as invoices_router
from .routers_measurements import router as measurements_router
from .routers_oauth import router as oauth_router
from .routers_orders import router as orders_router
from .routers_payments import router as payments_router
from .routers_products import router as products_router
from .routers_users import router as users_router
from .routers_vto import router as vto_router
from .routers_inventory import router as inventory_router
from .routers_khata import router as khata_router
from .routers_admin import router as admin_router
from .routers_appointments import router as appointments_router
from .routers_notifications import router as notifications_router
from .routers_ai_measurements import router as ai_measurements_router
from .routers_analytics import router as analytics_router
from .security import hash_password
from .services.otp_service import cleanup_expired_otps
from .config import logger, settings

# Initialize Sentry if DSN is configured
if HAVE_SENTRY and settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )
    logger.info("Sentry initialized")

app = FastAPI(title="TailorHub Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key=settings.JWT_SECRET_KEY)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")


def seed_defaults(db: Session):
    admin = db.query(User).filter(User.email == settings.DEFAULT_ADMIN_EMAIL).first()
    if not admin:
        db.add(
            User(
                email=settings.DEFAULT_ADMIN_EMAIL,
                password_hash=hash_password(settings.DEFAULT_ADMIN_PASSWORD or "TailorHub@2026!"),
                full_name=settings.DEFAULT_ADMIN_NAME,
                role=UserRole.admin,
                email_verified=True,  # Admin is pre-verified
            )
        )
        db.commit()

    # Seed default delivery rider
    rider = db.query(User).filter(User.email == "rider@tailorhub.pk").first()
    if not rider:
        db.add(
            User(
                email="rider@tailorhub.pk",
                password_hash=hash_password("Rider@123456"),
                full_name="Delivery Rider",
                role=UserRole.delivery,
                email_verified=True,
            )
        )
        db.commit()


@app.on_event("startup")
def on_startup():
    """Seed default data and ensure tables exist on startup."""
    try:
        Base.metadata.create_all(bind=engine)
        if engine.dialect.name == "sqlite":
            from sqlalchemy import text
            with engine.begin() as conn:
                try:
                    res = conn.execute(text("PRAGMA table_info(orders);")).fetchall()
                    cols = [r[1] for r in res]
                    if "signature_image" not in cols:
                        conn.execute(text("ALTER TABLE orders ADD COLUMN signature_image TEXT;"))
                except Exception as e:
                    logger.debug(f"SQLite orders patch skipped: {e}")
                try:
                    res = conn.execute(text("PRAGMA table_info(products);")).fetchall()
                    cols = [r[1] for r in res]
                    if "is_sold_out" not in cols:
                        conn.execute(text("ALTER TABLE products ADD COLUMN is_sold_out BOOLEAN DEFAULT 0;"))
                except Exception as e:
                    logger.debug(f"SQLite products patch skipped: {e}")
    except Exception as e:
        logger.warning(f"Metadata table creation warning: {e}")

    db = SessionLocal()
    try:
        seed_defaults(db)
    finally:
        db.close()

    # Start background tasks
    asyncio.create_task(otp_cleanup_loop())

    # ── Log feature availability summary ───────────────────────────────────
    # This shows which optional services are configured WITHOUT logging secrets.
    _CHECK = "[OK]"
    _CROSS = "[--]"
    features = [
        ("Google OAuth",    settings.google_oauth_enabled),
        ("Stripe Payments", settings.stripe_enabled),
        ("VTO (HuggingFace)", settings.vto_enabled),
        ("SMTP Email",      bool(settings.SMTP_USER and settings.SMTP_PASSWORD)),
        ("Gemini AI",       bool(settings.GEMINI_API_KEY)),
    ]
    logger.info("="*50)
    logger.info("TailorHub Backend — Feature Status")
    logger.info("="*50)
    for name, enabled in features:
        icon = _CHECK if enabled else _CROSS
        status_label = "active" if enabled else "not configured"
        logger.info(f"{icon}  {name:<22} {status_label}")
    logger.info("="*50)


async def otp_cleanup_loop():
    """Periodically removes expired OTPs from the database (every 6 hours)."""
    while True:
        try:
            db = SessionLocal()
            try:
                count = cleanup_expired_otps(db)
                if count > 0:
                    logger.info(f"[CLEANUP] Deleted {count} expired OTP records.")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[CLEANUP] Error in OTP cleanup loop: {e}")
        
        await asyncio.sleep(6 * 3600)  # 6 hours


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(auth_router)
app.include_router(oauth_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(measurements_router)
app.include_router(ai_measurements_router)
app.include_router(payments_router)
app.include_router(invoices_router)
app.include_router(users_router)
app.include_router(vto_router)
app.include_router(inventory_router)
app.include_router(notifications_router)
app.include_router(appointments_router)
app.include_router(admin_router)
app.include_router(analytics_router)
app.include_router(khata_router)

# ── SPA static file serving (production Docker image) ─────────────────────────
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_STATIC_DIR):
    _ASSETS_DIR = os.path.join(_STATIC_DIR, "assets")
    if os.path.isdir(_ASSETS_DIR):
        app.mount("/assets", StaticFiles(directory=_ASSETS_DIR), name="spa-assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        if full_path.startswith(("api/", "health", "docs", "redoc", "openapi.json")):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        index = os.path.join(_STATIC_DIR, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return JSONResponse({"detail": "Not Found"}, status_code=404)
