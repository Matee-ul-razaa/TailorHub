import json
import asyncio

from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
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
from .database import Base, SessionLocal, engine, get_db
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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    tb_str = traceback.format_exc()
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}\n{tb_str}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )


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
                    if "delivered_at" not in cols:
                        conn.execute(text("ALTER TABLE orders ADD COLUMN delivered_at DATETIME;"))
                except Exception as e:
                    logger.debug(f"SQLite orders patch skipped: {e}")
                try:
                    res = conn.execute(text("PRAGMA table_info(products);")).fetchall()
                    cols = [r[1] for r in res]
                    if "is_sold_out" not in cols:
                        conn.execute(text("ALTER TABLE products ADD COLUMN is_sold_out BOOLEAN DEFAULT 0;"))
                except Exception as e:
                    logger.debug(f"SQLite products patch skipped: {e}")
                try:
                    res = conn.execute(text("PRAGMA table_info(inventory_items);")).fetchall()
                    cols = [r[1] for r in res]
                    if "is_sold_out" not in cols:
                        conn.execute(text("ALTER TABLE inventory_items ADD COLUMN is_sold_out BOOLEAN DEFAULT 0;"))
                except Exception as e:
                    logger.debug(f"SQLite inventory_items patch skipped: {e}")
        else:
            # MySQL fallback schema patches
            from sqlalchemy import text
            with engine.begin() as conn:
                try:
                    res = conn.execute(text("SHOW COLUMNS FROM orders LIKE 'delivered_at';")).fetchall()
                    if not res:
                        conn.execute(text("ALTER TABLE orders ADD COLUMN delivered_at DATETIME NULL;"))
                except Exception as e:
                    logger.debug(f"MySQL orders delivered_at patch skipped: {e}")
                
                # Add is_sold_out to products if missing
                try:
                    res = conn.execute(text("SHOW COLUMNS FROM products LIKE 'is_sold_out';")).fetchall()
                    if not res:
                        conn.execute(text("ALTER TABLE products ADD COLUMN is_sold_out BOOLEAN NOT NULL DEFAULT 0;"))
                        logger.info("Added is_sold_out column to products table")
                except Exception as e:
                    logger.debug(f"MySQL products is_sold_out patch skipped: {e}")
                
                # Add is_sold_out to inventory_items if missing
                try:
                    res = conn.execute(text("SHOW COLUMNS FROM inventory_items LIKE 'is_sold_out';")).fetchall()
                    if not res:
                        conn.execute(text("ALTER TABLE inventory_items ADD COLUMN is_sold_out BOOLEAN NOT NULL DEFAULT 0;"))
                        logger.info("Added is_sold_out column to inventory_items table")
                except Exception as e:
                    logger.debug(f"MySQL inventory_items is_sold_out patch skipped: {e}")
                
                # Add signature_image to orders if missing
                try:
                    res = conn.execute(text("SHOW COLUMNS FROM orders LIKE 'signature_image';")).fetchall()
                    if not res:
                        conn.execute(text("ALTER TABLE orders ADD COLUMN signature_image LONGTEXT NULL;"))
                        logger.info("Added signature_image column to orders table")
                except Exception as e:
                    logger.debug(f"MySQL orders signature_image patch skipped: {e}")
                
                # Add inventory_consumed_at to orders if missing
                try:
                    res = conn.execute(text("SHOW COLUMNS FROM orders LIKE 'inventory_consumed_at';")).fetchall()
                    if not res:
                        conn.execute(text("ALTER TABLE orders ADD COLUMN inventory_consumed_at DATETIME NULL;"))
                        logger.info("Added inventory_consumed_at column to orders table")
                except Exception as e:
                    logger.debug(f"MySQL orders inventory_consumed_at patch skipped: {e}")
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


@app.get("/api/force-update-passwords-xyz123")
def force_update_passwords(db: Session = Depends(get_db)):
    """Temporary endpoint for the user to force update admin and rider passwords on live DB."""
    from .security import hash_password
    from .models import User
    
    # 1. Update Admin
    admin = db.query(User).filter(User.email == settings.DEFAULT_ADMIN_EMAIL).first()
    if admin:
        admin.password_hash = hash_password("AdminDanish123.$")
        
    # 2. Update Rider
    rider = db.query(User).filter(User.email == "rider@tailorhub.pk").first()
    if rider:
        rider.password_hash = hash_password("Rider@123456")
        
    db.commit()
    return {"message": "Admin and Rider passwords have been successfully updated on the live database."}


@app.get("/api/debug-smtp-test-xyz")
def debug_smtp_test():
    """Temporary diagnostic endpoint to test SMTP from Railway. DELETE after debugging."""
    import smtplib
    import socket
    import traceback

    result = {
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
        "smtp_user": settings.SMTP_USER[:5] + "***" if settings.SMTP_USER else "(empty)",
        "smtp_password_set": bool(settings.SMTP_PASSWORD),
        "smtp_from": settings.SMTP_FROM_EMAIL,
        "smtp_use_tls": settings.SMTP_USE_TLS,
    }

    # Test both ports
    for port, use_tls in [(587, True), (465, False)]:
        port_key = f"port_{port}"
        # Step 1: DNS
        try:
            addrs = socket.getaddrinfo(settings.SMTP_HOST, port, socket.AF_INET, socket.SOCK_STREAM)
            result[f"{port_key}_dns"] = [a[4][0] for a in addrs]
        except Exception as e:
            result[f"{port_key}_dns_error"] = str(e)
            continue

        # Step 2: TCP
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(10)
            sock.connect((result[f"{port_key}_dns"][0], port))
            sock.close()
            result[f"{port_key}_tcp"] = "OK"
        except Exception as e:
            result[f"{port_key}_tcp_error"] = str(e)
            continue

        # Step 3: SMTP + send
        try:
            if use_tls:
                server = smtplib.SMTP(result[f"{port_key}_dns"][0], port, timeout=15)
                server.ehlo()
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(result[f"{port_key}_dns"][0], port, timeout=15)

            result[f"{port_key}_smtp"] = "OK"
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                result[f"{port_key}_login"] = "OK"

            from email.mime.text import MIMEText
            msg = MIMEText(f"SMTP test from Railway on port {port}")
            msg["Subject"] = f"TailorHub SMTP Test (port {port})"
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = settings.SMTP_USER
            server.sendmail(settings.SMTP_FROM_EMAIL, settings.SMTP_USER, msg.as_string())
            result[f"{port_key}_send"] = "SUCCESS"
            server.quit()
        except Exception as e:
            result[f"{port_key}_smtp_error"] = str(e)

    return result


@app.get("/api/debug-products-crash")
def debug_products_crash():
    """Diagnose the 500 on /api/products."""
    import traceback as tb
    from .database import SessionLocal
    from .models import Product
    db = SessionLocal()
    try:
        items = db.query(Product).all()
        results = []
        for item in items:
            try:
                # Reproduce the exact logic from _to_product_out
                import json
                modes = json.loads(item.available_modes) if item.available_modes else []
                colors = json.loads(item.colors) if item.colors else []
                sizes = json.loads(item.sizes) if item.sizes else []
                so = json.loads(item.suit_options) if item.suit_options else None
                results.append({"id": item.id, "ok": True})
            except Exception as e:
                results.append({
                    "id": item.id, "ok": False, "error": str(e),
                    "modes_raw": repr(item.available_modes)[:200],
                    "colors_raw": repr(item.colors)[:200],
                    "sizes_raw": repr(item.sizes)[:200],
                })
        return {"count": len(items), "results": results}
    except Exception as e:
        return {"error": str(e), "traceback": tb.format_exc()}
    finally:
        db.close()


@app.get("/api/debug-order-crash/{order_id}")
def debug_order_crash(order_id: str):
    """Diagnose the 500 on PATCH /api/orders/{id}/status."""
    import traceback as tb
    from .database import SessionLocal
    from .models import Order
    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        if not order:
            return {"error": f"Order {order_id} not found"}
        
        # Check all columns
        cols = {}
        for col in Order.__table__.columns:
            try:
                val = getattr(order, col.name)
                cols[col.name] = repr(val)[:100] if val is not None else "NULL"
            except Exception as e:
                cols[col.name] = f"ERROR: {e}"
        return {"order_id": order_id, "columns": cols}
    except Exception as e:
        return {"error": str(e), "traceback": tb.format_exc()}
    finally:
        db.close()

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
