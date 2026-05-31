# TailorHub — Part C: Polish & Hardening

> Paste this file into your AI coding assistant. End with: *"Start with C1. After each subsection completes, stop and report. Do not start the next until I tell you to."*

**Goal**: turn an MVP-shaped project into a production-grade one. Six independent subsections — pick and choose in any order.

**Effort**: ~23 hours total (C1: 2h, C2: 4h, C3: 5h, C4: 5h, C5: 3h, C6: 4h)

**Prerequisite**: Parts A and B are done.

---

## Project context

### What's already done (do NOT redo)

- Auth, OTPs (DB-backed), Stripe webhooks (with idempotency), rate limiting — all complete
- Order pipeline with 9 statuses; role-based filtering
- `webhook_events`, `otp_codes`, `payments`, `orders`, `order_items`, `users`, `products`, `measurements`, `invoices`, `inventory_items`, `khata_entries`, `expenses` tables
- 4 Alembic migrations; current head is `e8e959ff5e42` (brand-column)
- Centralised API client `apiRequest()` in `src/lib/api.jsx` (token + 401 + Pydantic error handling)
- i18n via `useLanguage()` and `t('prefix.key', 'fallback')`
- Cart context with locked pricing math

### Working conventions (critical)

- Routers: `backend/app/routers_<domain>.py`, registered in `main.py` bottom
- Models: single `backend/app/models.py`, SQLAlchemy 2 `mapped_column` style
- Schemas: single `backend/app/schemas.py`
- Auth dependencies: `from .deps import get_current_user, require_role`
- Migrations: NEVER edit existing; `alembic revision --autogenerate -m "<name>"`
- Frontend API calls: ONLY through `apiRequest()` from `src/lib/api.jsx`
- i18n: every user-facing string via `t('key', 'fallback')` with BOTH `en` and `ur` entries
- localStorage keys: `tailorhub-auth-token`, `tailorhub-auth-session` — do NOT rename

---

# C1. README accuracy audit (~2h)

The current `README.md` is short (~3.9 KB) and makes a few claims that need verifying.

## C1.1 Claims to audit

| Claim | Verify by | Action if untrue |
|-------|-----------|------------------|
| "Email verification with OTP" | Existing — already complete | Keep |
| "Google/Facebook/Apple OAuth placeholders" | `backend/app/routers_oauth.py` — confirm Apple is a stub | Mark Apple "WIP" if not E2E tested |
| "Bilingual UI, full support for English and Urdu" | grep `src/context/LanguageContext.jsx` for missing `ur` keys | List untranslated keys in "Known limitations" |
| "PDF invoices with QR codes" | Trigger an order → invoice; scan the QR | Confirm with a screenshot in README |
| "Full Stripe Checkout integration" | `routers_payments.py` — confirm both checkout creation AND webhook are live | — |
| "Bootstrap 5 utility classes" | `package.json` — Bootstrap IS present alongside Tailwind | Clarify the deprecation plan (see C2) |

## C1.2 Required new sections in README

- **Testing** — `cd backend && pytest` and `npm run test` (from Part A)
- **Deployment** — Docker, Render (link to `render.yaml`), Vercel, Firebase Hosting; mention env vars needed
- **Configuration** — table of every required env var, descriptions sourced from `backend/.env.example`
- **Architecture notes** — token localStorage key, `apiRequest()` discipline, router naming, migration discipline, ID formats (`ORD-<8 hex>`, `TH-M-XXXX`)
- **CI badge** (after Part B): `![CI](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg)`

## C1.3 Acceptance — C1

- [ ] Every claim in the Features section is verifiable from code
- [ ] No claim mentions a stubbed-only feature without a "WIP" label
- [ ] Testing, Deployment, Configuration, Architecture sections exist
- [ ] CI badge URL is filled in once the repo is on GitHub

---

# C2. Bootstrap removal (recommended) OR boundary doc (~4h)

The frontend has `bootstrap@5.3.8` AND Tailwind + shadcn/ui. Two utility-class systems coexisting is a contributor footgun.

## C2.1 Pick one decision

### Option (a) — Remove Bootstrap (recommended)

1. Find all imports:
   ```bash
   grep -rn "from 'bootstrap'\|import 'bootstrap" src/
   ```
2. Find all class usages:
   ```bash
   grep -rnE "className=\"[^\"]*\\b(btn|container|row|col-|d-flex|me-|ms-|mt-|mb-|p-|justify-content|align-items|text-muted|rounded-circle|sticky-top)" src/
   ```
3. Replace each Bootstrap class with the Tailwind equivalent:

| Bootstrap | Tailwind |
|-----------|----------|
| `d-flex` | `flex` |
| `d-none d-md-flex` | `hidden md:flex` |
| `d-md-block` | `hidden md:block` |
| `align-items-center` | `items-center` |
| `justify-content-between` | `justify-between` |
| `justify-content-center` | `justify-center` |
| `me-2` | `mr-2` |
| `ms-2` | `ml-2` |
| `mt-3 mb-3` | `my-3` |
| `py-2` | `py-2` (same) |
| `text-muted` | `text-muted-foreground` |
| `text-decoration-none` | `no-underline` |
| `rounded-circle` | `rounded-full` |
| `rounded-pill` | `rounded-full` |
| `rounded-3` | `rounded-lg` |
| `shadow-lg` | `shadow-lg` (same) |
| `sticky-top` | `sticky top-0` |
| `position-relative` | `relative` |
| `position-absolute` | `absolute` |
| `border-top` | `border-t` |
| `border-bottom` | `border-b` |
| `bg-white` | `bg-white` (same) |
| `btn btn-primary` | use `<Button>` from `src/components/ui/button.jsx` |
| `btn btn-light btn-sm` | `<Button variant="ghost" size="sm">` |
| `container` | `container mx-auto` |
| `small` | `text-sm` |
| `fw-bold` | `font-bold` |
| `fw-semibold` | `font-semibold` |
| `fw-medium` | `font-medium` |

4. Remove `import 'bootstrap/dist/css/bootstrap.min.css'` from `src/main.jsx` (or wherever it's imported)
5. `npm uninstall bootstrap`
6. Update README's tech stack to remove "Bootstrap 5"

### Option (b) — Document the boundary (safer, less effort)

If removal is too risky for FYP timelines, add a `CONTRIBUTING.md` that says exactly which folders may use Bootstrap and which must use Tailwind. Prevent further mixing.

## C2.2 Acceptance — C2

- [ ] Option (a): `bootstrap` no longer in `package.json` AND no `import 'bootstrap'` in `src/`. OR
- [ ] Option (b): `CONTRIBUTING.md` exists with a clear Bootstrap-vs-Tailwind rule
- [ ] Visual regression: run `npm run dev` and click through Index → Catalog → Cart → Tracking — no layout breakage

---

# C3. Audit log table + middleware (~5h)

Admin writes (delete user, delete order, assign delivery, mark invoice paid) leave no trace today. Add an append-only audit log.

## C3.1 New model — append to `backend/app/models.py`

```python
class AuditLog(Base):
    """
    Append-only log of write actions on sensitive endpoints. Populated by
    AuditMiddleware. Surfaced in the admin dashboard.

    Notes:
      - actor_email/role are snapshots so the row stays readable after the
        user is deleted (FK is SET NULL).
      - Failures (4xx/5xx) are logged too — useful for spotting probing.
    """
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_email: Mapped[str] = mapped_column(String(255), nullable=True)
    actor_role: Mapped[str] = mapped_column(String(20), nullable=True)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
```

## C3.2 Alembic migration (descends from current head)

```bash
cd backend
alembic revision --autogenerate -m "add audit_log table"
# Review the generated file
alembic upgrade head
```

## C3.3 Middleware — `backend/app/middleware_audit.py` (new file)

```python
from datetime import datetime
from fastapi import Request
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings
from .database import SessionLocal
from .models import AuditLog

AUDITED_METHODS = {"POST", "PATCH", "PUT", "DELETE"}
AUDITED_PATH_PREFIXES = (
    "/api/orders", "/api/users", "/api/invoices",
    "/api/inventory", "/api/khata", "/api/products",
)

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        try:
            if request.method not in AUDITED_METHODS:
                return response
            if not any(request.url.path.startswith(p) for p in AUDITED_PATH_PREFIXES):
                return response

            actor_id, actor_email, actor_role = None, None, None
            auth = request.headers.get("authorization", "")
            if auth.lower().startswith("bearer "):
                try:
                    payload = jwt.decode(
                        auth.split(" ", 1)[1],
                        settings.JWT_SECRET_KEY,
                        algorithms=[settings.JWT_ALGORITHM],
                    )
                    actor_id = payload.get("sub")
                    actor_role = payload.get("role")
                except JWTError:
                    pass

            if actor_id and not actor_email:
                from .models import User
                db_lookup = SessionLocal()
                try:
                    user = db_lookup.get(User, actor_id)
                    if user:
                        actor_email = user.email
                finally:
                    db_lookup.close()

            db = SessionLocal()
            try:
                db.add(AuditLog(
                    actor_id=actor_id,
                    actor_email=actor_email,
                    actor_role=actor_role,
                    method=request.method,
                    path=request.url.path,
                    status_code=response.status_code,
                    ip_address=request.client.host if request.client else None,
                    timestamp=datetime.utcnow(),
                ))
                db.commit()
            finally:
                db.close()
        except Exception as e:
            print(f"[AUDIT] failed to log: {e}")
        return response
```

Register in `backend/app/main.py` **after** the existing CORS + Session middleware:

```python
from .middleware_audit import AuditMiddleware
app.add_middleware(AuditMiddleware)
```

## C3.4 Admin endpoint — `backend/app/routers_audit.py` (new file)

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .database import get_db
from .deps import require_role
from .models import AuditLog, User, UserRole

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("/logs")
def list_logs(
    limit: int = Query(100, ge=1, le=500),
    method: str | None = Query(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.admin)),
):
    q = db.query(AuditLog)
    if method:
        q = q.filter(AuditLog.method == method.upper())
    rows = q.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": r.id, "actor_id": r.actor_id, "actor_email": r.actor_email,
            "actor_role": r.actor_role, "method": r.method, "path": r.path,
            "status_code": r.status_code, "ip_address": r.ip_address,
            "timestamp": r.timestamp.isoformat(),
        }
        for r in rows
    ]
```

Register in `main.py`. Add an "Audit Log" tab to `src/pages/AdminDashboard.jsx` that fetches `/api/audit/logs` and renders a sortable table.

## C3.5 i18n keys (in `src/context/LanguageContext.jsx`, prefix `admin`)

- `admin.auditTab` — Audit Log / آڈٹ لاگ
- `admin.auditActor` — Actor / صارف
- `admin.auditAction` — Action / عمل
- `admin.auditTime` — Time / وقت

## C3.6 Acceptance — C3

- [ ] Migration runs forward + backward cleanly
- [ ] Deleting an order as admin creates an `audit_log` row (method=DELETE, status=204)
- [ ] Customer DELETE attempt (403) is still logged with `status_code=403`
- [ ] Audit tab in admin dashboard renders the log
- [ ] Test: `test_admin_delete_is_audited` added to `test_orders.py`

---

# C4. In-app notifications (~5h)

Customers don't see status changes when they're offline. Add a `notifications` table + bell-icon dropdown.

## C4.1 New model

```python
class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[str] = mapped_column(String(500), nullable=True)
    read_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
```

Add to the same Alembic migration as `audit_log`, OR run separately.

## C4.2 Service helper — `backend/app/services/notification_service.py`

```python
from sqlalchemy.orm import Session
from ..models import Notification

def notify(db: Session, user_id: str, title: str, body: str, link: str | None = None):
    try:
        n = Notification(user_id=user_id, title=title, body=body, link=link)
        db.add(n)
        db.commit()
        db.refresh(n)
        return n
    except Exception as e:
        print(f"[NOTIFY] failed: {e}")
        db.rollback()
        return None
```

## C4.3 Hook into order status changes

In `backend/app/routers_orders.py` `update_order_status()`, after `db.commit()`:

```python
from .services.notification_service import notify

if old_status != payload.status:
    notify(
        db, order.customer_id,
        title=f"Order {order.id} update",
        body=f"Status changed to {payload.status.value.replace('_', ' ').title()}",
        link=f"/tracking?order={order.id}",
    )
```

(`old_status` requires capturing `order.status` BEFORE you reassign it.)

## C4.4 Endpoints — `backend/app/routers_notifications.py`

```python
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .database import get_db
from .deps import get_current_user
from .models import Notification, User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("")
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        q = q.filter(Notification.read_at.is_(None))
    rows = q.order_by(Notification.created_at.desc()).limit(limit).all()
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .count()
    )
    return {
        "unread_count": unread,
        "notifications": [
            {
                "id": r.id, "title": r.title, "body": r.body, "link": r.link,
                "read_at": r.read_at.isoformat() if r.read_at else None,
                "created_at": r.created_at.isoformat(),
            } for r in rows
        ],
    }

@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    if n.read_at is None:
        n.read_at = datetime.utcnow()
        db.commit()
    return {"ok": True}

@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    rows = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .all()
    )
    for r in rows:
        r.read_at = now
    db.commit()
    return {"ok": True, "marked": len(rows)}
```

Register in `main.py`.

## C4.5 Frontend bell icon — `src/components/layout/NotificationBell.jsx`

- Bell icon (Lucide `Bell`) in Navbar
- Polls `GET /api/notifications?limit=10` every 30 seconds while authenticated
- Unread count badge (cap display at "9+")
- Dropdown shows last 10 items
- "Mark all as read" button when `unread_count > 0`
- Each item is clickable — if `link` is set, navigates AND marks that one read
- Click outside closes the dropdown
- i18n keys under `nav.notifications.*` (4 keys: `title`, `empty`, `markAllRead`, `viewAll`)

Embed in `src/components/layout/Navbar.jsx` next to the cart icon. Show only when `user` is authenticated.

## C4.6 Acceptance — C4

- [ ] Migration runs
- [ ] Admin updating an order's status creates a `notifications` row for that customer
- [ ] Bell shows unread count within 30s of an update
- [ ] Marking notifications read clears the badge
- [ ] User cannot mark another user's notification read (returns 404)
- [ ] Test: `test_status_change_creates_notification` in `test_orders.py`

---

# C5. Stock decrement on cutting (~3h)

`inventory_items` exists but isn't tied to orders. When an admin transitions an order to `cutting`, linked fabric should decrement.

## C5.1 Schema change (Alembic)

Add `inventory_item_id INT NULL` to `order_items`, FK to `inventory_items.id`, ondelete=SET NULL.

```python
op.add_column('order_items', sa.Column('inventory_item_id', sa.Integer(), nullable=True))
op.create_foreign_key(
    'fk_order_items_inventory',
    'order_items', 'inventory_items',
    ['inventory_item_id'], ['id'],
    ondelete='SET NULL',
)
```

And in `models.py` `OrderItem`:
```python
inventory_item_id: Mapped[int] = mapped_column(Integer, ForeignKey("inventory_items.id", ondelete="SET NULL"), nullable=True)
```

## C5.2 Logic in `routers_orders.py` (PATCH /{id}/status)

When `new_status == OrderStatus.cutting` and `old_status != OrderStatus.cutting`:

```python
from .models import InventoryItem

for item in order.items:
    if not item.inventory_item_id:
        continue
    inv = db.get(InventoryItem, item.inventory_item_id)
    if not inv:
        continue
    required = item.quantity
    if inv.quantity < required:
        if not request.headers.get("X-Stock-Override"):
            raise HTTPException(409, f"Insufficient stock for {inv.name}")
    inv.quantity = max(0, inv.quantity - required)

db.commit()
```

Inject `request: Request` parameter into the endpoint signature.

## C5.3 Frontend admin override

In `src/pages/AdminDashboard.jsx`, when transitioning to `cutting` and the API returns 409:
1. Show confirmation dialog: "Stock insufficient — proceed anyway?"
2. On confirm: retry with header `X-Stock-Override: 1`

Extend `apiRequest()` in `src/lib/api.jsx` to accept a `headers` option that merges with the default headers.

## C5.4 Acceptance — C5

- [ ] Moving to `cutting` decrements linked `inventory_items.quantity` by `OrderItem.quantity`
- [ ] Insufficient stock returns 409 by default
- [ ] `X-Stock-Override: 1` bypasses the check
- [ ] Tests: `test_cutting_decrements_inventory`, `test_insufficient_stock_blocks_without_override` in `test_orders.py`

---

# C6. Stripe refund flow (~4h)

`OrderStatus.cancelled` exists but doesn't refund. Add `POST /api/orders/{id}/cancel`.

## C6.1 Endpoint in `routers_orders.py`

```python
@router.post("/{order_id}/cancel")
def cancel_order(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from .models import Payment, PaymentMethod, PaymentStatus, KhataEntry
    from .config import settings

    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    # Authorization
    if user.role == UserRole.customer:
        if order.customer_id != user.id or order.status != OrderStatus.pending:
            raise HTTPException(403, "Cannot cancel this order")
    elif user.role == UserRole.admin:
        if order.status == OrderStatus.delivered:
            raise HTTPException(409, "Delivered orders cannot be cancelled")
    else:
        raise HTTPException(403, "Forbidden")

    # Refund if Stripe-paid
    refunded = False
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if payment and payment.status == PaymentStatus.completed and payment.method == PaymentMethod.card:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            stripe.Refund.create(payment_intent=payment.transaction_id)
            payment.status = PaymentStatus.refunded
            refunded = True
        except Exception as e:
            raise HTTPException(502, f"Refund failed: {e}")

    order.status = OrderStatus.cancelled
    db.commit()

    # Reverse khata entries linked to this order
    db.query(KhataEntry).filter(KhataEntry.order_id == order_id).update({KhataEntry.order_id: None})

    # Notify (from C4)
    try:
        from .services.notification_service import notify
        notify(db, order.customer_id,
               "Order cancelled",
               f"Your order {order.id} has been cancelled.",
               link=f"/tracking?order={order.id}")
    except ImportError:
        pass  # C4 not done yet — silent skip

    return {"ok": True, "refunded": refunded}
```

## C6.2 Frontend cancel buttons

- `src/pages/Tracking.jsx`: customer "Cancel order" button when `status === 'pending'` and they own the order
- `src/pages/AdminDashboard.jsx`: admin-side cancel control in the order detail panel
- Both POST to `/api/orders/<id>/cancel`
- Show toast on success (with "Refunded" suffix when `refunded === true`)
- Show error toast on 4xx/5xx with the `detail` message

## C6.3 Acceptance — C6

- [ ] Customer can cancel only their own `pending` orders
- [ ] Customer cannot cancel another customer's order (403)
- [ ] Admin can cancel any non-`delivered` order
- [ ] Stripe-paid cancel issues a real refund (verify in Stripe test mode dashboard)
- [ ] COD cancel sets status without calling Stripe
- [ ] Khata reversal: linked `khata_entries.order_id` is nulled
- [ ] Tests: `test_customer_cancels_pending_order`, `test_customer_cannot_cancel_others`, `test_admin_cancels_with_refund` (mock `stripe.Refund.create`)

---

# CHANGES.md template (append after each subsection)

```markdown
### Feature 11: README accuracy audit
- **Files changed**: `README.md` — rewritten with verified claims
- Added sections: Testing, Deployment, Configuration, Architecture
- Removed/qualified: <list>

### Feature 12: Bootstrap removal  [or: Bootstrap boundary documented in CONTRIBUTING.md]
- **Files changed**: `package.json` (bootstrap removed), `src/main.jsx`, and N files with class replacements
- **Visual verification**: clicked through all routes, no breakage

### Feature 13: Audit log
- **Files added**: `backend/app/middleware_audit.py`, `backend/app/routers_audit.py`, admin tab in AdminDashboard.jsx
- **Tables added**: `audit_log`
- **Migration**: `alembic/versions/<hash>_add_audit_log.py`
- **Tests**: `test_admin_delete_is_audited` in `test_orders.py`

### Feature 14: In-app notifications
- **Files added**: `backend/app/services/notification_service.py`, `backend/app/routers_notifications.py`, `src/components/layout/NotificationBell.jsx`
- **Tables added**: `notifications`
- **Files changed**: `backend/app/routers_orders.py` (hook into status change), `src/components/layout/Navbar.jsx` (bell icon)
- **i18n added**: 4 keys under `nav.notifications.*`

### Feature 15: Stock decrement on cutting
- **Files changed**: `backend/app/models.py` (added `inventory_item_id`), `routers_orders.py` (decrement logic + override header)
- **Migration**: adds `order_items.inventory_item_id` FK
- **Tests**: 2 added

### Feature 16: Stripe refund flow
- **Files changed**: `backend/app/routers_orders.py` (new `POST /{id}/cancel` endpoint), `src/pages/Tracking.jsx`, `src/pages/AdminDashboard.jsx`
- **Tests**: 3 added (mocks `stripe.Refund.create`)
```

---

## Hard rules (do not break)

- Don't merge audit_log and notifications models into one — they're different concerns with different retention requirements.
- The audit middleware MUST be best-effort: a logging failure cannot fail the user's request. Wrap everything in try/except.
- The notification `notify()` helper must roll back on failure but never throw.
- The Bootstrap migration (C2) is the riskiest item — do it last in this Part and verify each page visually.
- For C5 (stock), the `X-Stock-Override` header is a deliberate admin-only escape hatch. Don't let it leak into the customer flow.
- For C6 (refund), if Stripe API call fails, the order status must NOT change to `cancelled`. Either everything succeeds or nothing changes.
- Don't add new packages for any of these (e.g. don't pull in a notification library, don't add a dialog library — shadcn already has `<Dialog>`).

---

**Stop after each subsection and report. Wait for human approval before continuing.**
