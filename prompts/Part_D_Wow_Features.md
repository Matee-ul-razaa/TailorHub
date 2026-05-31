# TailorHub — Part D: Wow Features

> Paste this file into your AI coding assistant. End with: *"I want to implement D2 and D3 [or your chosen pair]. Start with D2. Stop after it completes."*

**Goal**: pick **2 of 5** demo-worthy features. Two solid features are more impressive than five half-done ones. **Recommended pairing: D2 (AI body measurements) + D3 (analytics dashboard)** — one customer-facing AI feature plus one admin visual punch.

**Effort**: 6–14 hours per feature.

**Prerequisite**: Parts A, B, C are done (or at least A so you have tests to extend).

---

## Project context

### What's already done (do NOT redo)

- Auth, OTPs, Stripe webhooks, order pipeline, invoices, khata, inventory — all complete
- Gemini API key support is already in `backend/app/config.py` (`GEMINI_API_KEY`) — VTO uses it
- `google-genai` is in `backend/requirements.txt` — Gemini SDK is already installed
- Recharts is already in `package.json` — analytics charts won't need new deps
- `users.phone` — check `models.py`; add if missing (D1/D5 need it)
- All routers register in `backend/app/main.py` at the bottom

### Working conventions (critical)

- Routers: `backend/app/routers_<domain>.py`
- All API calls from frontend: through `apiRequest()` in `src/lib/api.jsx`
- i18n: `t('prefix.key', 'fallback')` with BOTH `en` + `ur` entries
- Never auto-save user-facing data without explicit user confirmation
- No new state libraries, HTTP clients, or CSS frameworks

---

# D1. WhatsApp order notifications (Twilio) — ~6h

Opt-in WhatsApp messages on order status changes via Twilio's sandbox or production WhatsApp Business API.

## D1.1 Setup

- `pip install twilio` → add to `backend/requirements.txt`
- Add env vars to `backend/app/config.py` and `backend/.env.example`:
  ```python
  TWILIO_ACCOUNT_SID: str = ""
  TWILIO_AUTH_TOKEN: str = ""
  TWILIO_WHATSAPP_FROM: str = ""    # e.g. "whatsapp:+14155238886" (sandbox)
  ```

## D1.2 New column

Add to `users` table via Alembic:
```python
op.add_column('users', sa.Column('whatsapp_opt_in', sa.Boolean(), nullable=False, server_default='0'))
op.add_column('users', sa.Column('phone', sa.String(20), nullable=True))  # only if not already present
```

And update `User` model.

## D1.3 Service — `backend/app/services/whatsapp_service.py`

```python
from twilio.rest import Client
from ..config import settings

def send_whatsapp(to_phone: str, body: str) -> bool:
    """Send a WhatsApp message via Twilio. Silent no-op if not configured."""
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_WHATSAPP_FROM):
        return False
    if not to_phone:
        return False
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=f"whatsapp:{to_phone}",
            body=body,
        )
        return True
    except Exception as e:
        print(f"[WHATSAPP] send failed: {e}")
        return False
```

## D1.4 Wire into order status changes

In `backend/app/routers_orders.py` `update_order_status()`, alongside the existing `notify()` call (if C4 is done):

```python
if old_status != payload.status:
    customer = db.get(User, order.customer_id)
    if customer and customer.whatsapp_opt_in and customer.phone:
        from .services.whatsapp_service import send_whatsapp
        send_whatsapp(
            customer.phone,
            f"TailorHub: Your order {order.id} is now {payload.status.value.replace('_', ' ')}.",
        )
```

## D1.5 Profile UI toggle

In `src/pages/CompleteProfile.jsx` (or a new "Settings" page), add a switch:
- Toggle: "Receive WhatsApp notifications on order updates"
- Phone number input (required when toggled on)
- POST to `PATCH /api/users/me` (extend `routers_users.py` accordingly)

## D1.6 Acceptance — D1

- [ ] Toggle off → no WhatsApp message sent
- [ ] Toggle on + valid phone → status change sends a WhatsApp via Twilio sandbox
- [ ] Twilio creds missing → silent no-op (no crash)
- [ ] Invalid phone → silent no-op with `[WHATSAPP] send failed` console message

---

# D2. AI body measurement from photo (Gemini Vision) — ~8h — RECOMMENDED

Customer uploads a front + side photo, Gemini Vision extracts estimated body measurements, the existing measurement form is pre-filled with a clear "AI-estimated — verify before saving" banner.

## D2.1 Frontend — new page `src/pages/AIMeasurements.jsx`

- Two file inputs (front photo, side photo); accept image/jpeg, image/png
- Preview thumbnails after selection
- "Generate estimates" button → multipart POST to `/api/measurements/extract`
- Receives JSON of estimated measurements
- **Pre-fills** the existing measurement form (`src/pages/Measurements.jsx`) — or navigates to it with state
- Display a prominent yellow banner: *"AI estimated — please verify each value before saving."*
- **Never auto-save** — the user must click Save
- Add route in `src/App.jsx` under `<ProtectedRoute>`
- Add link from `src/pages/Measurements.jsx` ("Get estimates from photo")
- i18n keys under `measurements.ai.*`

## D2.2 Backend endpoint — append to `backend/app/routers_measurements.py`

```python
from fastapi import UploadFile, File

@router.post("/measurements/extract")
async def extract_measurements(
    front: UploadFile = File(...),
    side: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    from .config import settings
    if not settings.GEMINI_API_KEY:
        raise HTTPException(503, "AI measurement service is not configured")

    front_bytes = await front.read()
    side_bytes = await side.read()

    if len(front_bytes) > 5_000_000 or len(side_bytes) > 5_000_000:
        raise HTTPException(413, "Photos must be under 5 MB each")

    from .services.gemini_measurements import extract_from_photos
    estimates = extract_from_photos(front_bytes, side_bytes)

    return {
        "estimates": estimates,
        "disclaimer": "AI-generated estimates. Verify with manual measurement before saving.",
    }
```

## D2.3 Gemini service — `backend/app/services/gemini_measurements.py`

```python
"""
Wraps Gemini Vision to extract body measurements from two photos (front + side).

Returns a dict of estimates in cm:
  shoulder, chest, waist, hip, sleeve_length, inseam
"""
import json
from google import genai
from google.genai import types

from ..config import settings

_PROMPT = """You are a tailoring assistant. Given a front and side photo of a person,
estimate their body measurements in centimeters. Respond ONLY with a JSON object:
{
  "shoulder": <float>,
  "chest": <float>,
  "waist": <float>,
  "hip": <float>,
  "sleeve_length": <float>,
  "inseam": <float>,
  "confidence": "<low|medium|high>"
}
If you cannot see a person clearly, return all values as null and confidence as "low".
"""

def extract_from_photos(front: bytes, side: bytes) -> dict:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    response = client.models.generate_content(
        model="gemini-2.0-flash-exp",
        contents=[
            _PROMPT,
            types.Part.from_bytes(data=front, mime_type="image/jpeg"),
            types.Part.from_bytes(data=side, mime_type="image/jpeg"),
        ],
    )
    text = response.text.strip()
    # Strip code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"shoulder": None, "chest": None, "waist": None, "hip": None,
                "sleeve_length": None, "inseam": None, "confidence": "low",
                "_raw": text}
```

## D2.4 Acceptance — D2

- [ ] Two photos uploaded → estimates appear in the measurement form
- [ ] Banner clearly states "AI-estimated — verify before saving"
- [ ] Estimates are NEVER auto-saved; user must click Save
- [ ] Endpoint requires auth (401 without token)
- [ ] If `GEMINI_API_KEY` is unset, returns 503 with a clear message
- [ ] Photos > 5 MB return 413
- [ ] No measurement row is created until user explicitly saves

---

# D3. Customer analytics dashboard — ~6h — RECOMMENDED

Admin-only dashboard showing business metrics. Recharts is already installed.

## D3.1 New endpoints — `backend/app/routers_analytics.py`

```python
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import get_db
from .deps import require_role
from .models import Order, OrderItem, OrderStatus, User, UserRole

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/orders-by-month")
def orders_by_month(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.admin)),
):
    """Last 12 months: count + revenue per month."""
    cutoff = datetime.utcnow() - timedelta(days=365)
    rows = (
        db.query(
            func.strftime("%Y-%m", Order.created_at).label("month"),  # SQLite
            func.count(Order.id).label("count"),
            func.sum(Order.amount_paid).label("revenue"),
        )
        .filter(Order.created_at >= cutoff)
        .group_by("month")
        .order_by("month")
        .all()
    )
    return [{"month": r.month, "count": r.count, "revenue": float(r.revenue or 0)} for r in rows]

@router.get("/popular-categories")
def popular_categories(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.admin)),
):
    rows = (
        db.query(OrderItem.garment_category, func.count(OrderItem.id).label("count"))
        .group_by(OrderItem.garment_category)
        .order_by(func.count(OrderItem.id).desc())
        .limit(10)
        .all()
    )
    return [{"category": r.garment_category or "uncategorised", "count": r.count} for r in rows]

@router.get("/repeat-rate")
def repeat_rate(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.admin)),
):
    """% of customers with >= 2 orders in the last 6 months."""
    cutoff = datetime.utcnow() - timedelta(days=180)
    subq = (
        db.query(Order.customer_id, func.count(Order.id).label("order_count"))
        .filter(Order.created_at >= cutoff)
        .group_by(Order.customer_id)
        .subquery()
    )
    total = db.query(func.count()).select_from(subq).scalar() or 0
    repeat = db.query(func.count()).select_from(subq).filter(subq.c.order_count >= 2).scalar() or 0
    rate = (repeat / total * 100) if total > 0 else 0.0
    return {"total_customers_6m": total, "repeat_customers": repeat, "rate_percent": round(rate, 1)}

@router.get("/avg-lead-time")
def avg_lead_time(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.admin)),
):
    """Average days from confirmed → delivered, for orders delivered in the last 90 days.

    Approximation: we don't track per-status timestamps, so use created_at → 'now' for delivered orders.
    For a real implementation, add a `delivered_at` column.
    """
    cutoff = datetime.utcnow() - timedelta(days=90)
    delivered = db.query(Order).filter(
        Order.status == OrderStatus.delivered,
        Order.created_at >= cutoff,
    ).all()
    if not delivered:
        return {"avg_days": None, "sample_size": 0}
    avg = sum((datetime.utcnow() - o.created_at).days for o in delivered) / len(delivered)
    return {"avg_days": round(avg, 1), "sample_size": len(delivered)}
```

Register in `main.py`.

**Note**: `func.strftime` is SQLite-specific. For MySQL/Postgres use `func.date_format(Order.created_at, "%Y-%m")` or a dialect-agnostic approach. Test in both.

## D3.2 Frontend — new tab in `src/pages/AdminDashboard.jsx`

Add an "Analytics" tab next to existing tabs. Inside:

- **LineChart** for orders-by-month (X: month, Y: count + revenue with second axis)
- **BarChart** for popular categories (horizontal bars)
- **KPI card 1**: repeat-rate percentage (with sample size as caption)
- **KPI card 2**: avg lead time (with sample size)

Use existing Recharts imports — `LineChart`, `Bar`, `BarChart`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ResponsiveContainer`.

All endpoints accessed via `apiRequest()`. All copy via `t('admin.analytics.*')` i18n keys (recommended keys: `analyticsTab`, `ordersByMonth`, `popularCategories`, `repeatRate`, `avgLeadTime`, `noData`, `customersIn6Months`, `sampleSize`).

## D3.3 Acceptance — D3

- [ ] 4 widgets render correctly
- [ ] Charts handle empty-data state without crashing (fresh DB, no orders)
- [ ] All 4 endpoints are admin-only (403 for customer)
- [ ] Numbers match what's in the database (spot-check `orders` table manually)
- [ ] i18n keys added for English + Urdu

---

# D4. Multi-tailor marketplace mode (v2 — flag as scope expansion) — ~40h+

Big lift. Only attempt if you have 2+ weeks left and the basic features are solid.

## Scope sketch
- New `tailor_shops` table (id, name, slug, owner_user_id, address, banner_url, ...)
- `users.tailor_shop_id` for staff/admin (existing customers stay null)
- `products.tailor_shop_id` for shop ownership
- New customer-facing `/shops` page listing shops; clicking opens that shop's filtered catalog
- Admin dashboard scoped to a single shop unless the user is a new "platform-admin" role
- Existing data: migrate everything into a default `tailor_shops.id = 1` row

## Acceptance — D4
- [ ] Two shops can coexist with separate catalogs and separate admin accounts
- [ ] Customer can browse across both seamlessly
- [ ] Existing single-shop data migrates cleanly to a default shop
- [ ] All existing tests still pass after the migration

**Strong recommendation**: skip this for FYP timeline. Note it in the README as "v2 roadmap."

---

# D5. SMS OTP fallback (Twilio SMS) — ~6h

When SMTP fails or user prefers SMS, send OTPs via SMS.

## D5.1 Setup
- Reuse `twilio` package (also used in D1)
- Add env var `TWILIO_SMS_FROM` to `config.py` and `.env.example`

## D5.2 Service — extend `services/whatsapp_service.py` or new `sms_service.py`

```python
def send_sms(to_phone: str, body: str) -> bool:
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_SMS_FROM):
        return False
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(from_=settings.TWILIO_SMS_FROM, to=to_phone, body=body)
        return True
    except Exception as e:
        print(f"[SMS] send failed: {e}")
        return False
```

## D5.3 Fallback logic in `email_service.py`

```python
def send_otp(email: str, phone: str | None, code: str, prefer_sms: bool = False) -> bool:
    if prefer_sms and phone:
        if send_sms(phone, f"TailorHub verification code: {code}"):
            return True
    sent = send_otp_email(email, code)
    if not sent and phone:
        return send_sms(phone, f"TailorHub verification code: {code}")
    return sent
```

Update register / forgot-password handlers to pass `phone` and read user's preference.

## D5.4 UI
- Registration form: "Receive OTP by SMS instead of email" checkbox (requires phone)
- Save preference on `users.prefer_sms_otp BOOLEAN`

## D5.5 Acceptance — D5
- [ ] SMTP failure with SMS opt-in → OTP arrives via SMS
- [ ] SMTP success → no SMS sent
- [ ] Twilio missing → graceful 503 with retry guidance
- [ ] User can toggle their preference at any time

---

# Picking 2 of 5 — recommendation matrix

| Pairing | Strength | Why |
|---------|----------|-----|
| **D2 + D3** (default) | Customer AI + admin charts | Best demo balance — one impressive interactive feature, one visual punch |
| D1 + D3 | Real notifications + analytics | If your demo audience cares about real-world UX |
| D2 + D5 | AI measurements + resilient OTPs | Heavy on AI/ML angle |
| D1 + D2 | Notifications + AI measurements | Customer-facing only — skips admin polish |
| D4 alone | Marketplace | Only if you have 2+ weeks |

---

# CHANGES.md template (append after each chosen feature)

```markdown
### Feature 17: AI body measurements
- **Files added**: `src/pages/AIMeasurements.jsx`,
  `backend/app/services/gemini_measurements.py`
- **Files changed**: `backend/app/routers_measurements.py` (new `/extract` endpoint), `src/pages/Measurements.jsx` (link + pre-fill support), `src/App.jsx` (route)
- **Env vars added**: none (reuses `GEMINI_API_KEY`)
- **Critical UX rule**: AI estimates are never auto-saved

### Feature 18: Analytics dashboard
- **Files added**: `backend/app/routers_analytics.py`
- **Files changed**: `src/pages/AdminDashboard.jsx` (Analytics tab)
- **Endpoints**: 4 new under `/api/analytics/*`, all admin-only
- **i18n added**: 8 keys under `admin.analytics.*`
```

---

## Hard rules (do not break)

- For D2: AI estimates are user-facing assistance, NOT data. **Never** auto-save them. Always show a "verify before saving" disclaimer. If Gemini returns nonsense, the user catches it before it hits the database.
- For D3: every analytics endpoint must be `require_role(UserRole.admin)`. Leaking aggregate data to customers is a privacy issue.
- For D1/D5: Twilio costs real money. The send functions must be no-ops when not configured, never throw, never block the user's main flow.
- For D4: do NOT attempt this without explicit deadline approval — it's a project-restructuring lift.
- All five features must have at least one new test (mock external APIs).
- Don't add new chart libraries — Recharts handles everything in D3.
- Don't add new image-handling libraries — Pillow is already in `requirements.txt` for D2.

---

**Stop after each chosen feature and report. Wait for human approval before continuing to the next.**
