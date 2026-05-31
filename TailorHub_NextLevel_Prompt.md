# TailorHub — Next Level Master Prompt

> **Paste this entire document into your AI coding assistant** (Cursor / Copilot / Claude Code / similar). It contains everything the assistant needs to upgrade your TailorHub project from its current baseline to a deployment-ready, test-covered, production-grade state.
>
> **Tell the assistant**: *"Start with priority #1 in the table at the bottom. After each priority is complete, stop and report. Do not start the next priority until I tell you to."*

---

## How this prompt is organized

| Part | What it adds | When to run |
|------|-------------|-------------|
| **0. Working Conventions** | Codebase patterns the AI must follow. | Always — read first. |
| **A. Test Coverage** | Backend `pytest` + frontend `vitest` tests. | First — safety net. |
| **B. Deployment & CI** | Dockerfile, `render.yaml`, `vercel.json`, GitHub Actions. | After A. |
| **C. Polish & Hardening** | Audit log, in-app notifications, README audit, Bootstrap cleanup, stock decrement, refund flow. | After B; each subsection independent. |
| **D. Wow Features** | Pick **2 of 5** for demo punch. | Optional, after A/B/C green. |
| **Priority Table** | Execution order + hour estimates. | The assistant follows this. |

Paste the whole file at once, or just one Part — every section is self-contained.

---

## What is already done (do NOT redo)

Verified against the codebase. Skip these:

- ✅ Auth: register / login / verify-email / resend-otp / forgot-password / reset-password / change-password (`backend/app/routers_auth.py`)
- ✅ OAuth: Google, Facebook, Apple (stubs wire up via env vars) (`backend/app/routers_oauth.py`)
- ✅ **DB-backed OTPs** — `otp_codes` table, bcrypt-hashed codes, 15-min TTL, 5-attempt lock, 6-hourly cleanup task (`backend/app/services/otp_service.py`)
- ✅ **Stripe webhook idempotency** — `webhook_events` table with unique `(provider, event_id)`, `record_event_or_skip()` returns `None` on `IntegrityError` (`backend/app/services/webhook_service.py`)
- ✅ Login rate limiting — 5 attempts → 15-min lockout per email (`backend/app/rate_limiter.py`)
- ✅ Password UIs with strength validation: `src/pages/Login.jsx`, `ForgotPassword.jsx`, `ChangePassword.jsx`
- ✅ 9-state order pipeline + role-filtered listing (`backend/app/routers_orders.py`)
- ✅ COD vs card payment split (`Payment.method` enum, `Cart.jsx` radio)
- ✅ PDF invoices with QR codes, auto-emailed on `delivered` (`backend/app/invoice_service.py`)
- ✅ Khata ledger, inventory, expenses
- ✅ Bilingual i18n (English + Urdu RTL), 250+ keys (`src/context/LanguageContext.jsx`)
- ✅ Role-based routing (`src/components/auth/ProtectedRoute.jsx`)
- ✅ 4 Alembic migrations (initial / invoices / otp+webhook+delivery / brand-column)
- ✅ `Link` import in `Login.jsx` (already fixed)

**The receiving AI must NOT re-create any of the above.** Treat any apparent overlap as "extend, don't rebuild."

---

# 0. Working Conventions

## 0.1 Backend (FastAPI + SQLAlchemy 2 + MySQL)

- **Routers** live in `backend/app/routers_<domain>.py`. Register new ones in `backend/app/main.py` via `app.include_router(...)` at the bottom.
- **All Pydantic schemas** go into the single `backend/app/schemas.py` file — do not split.
- **All ORM models** go into `backend/app/models.py`. Use SQLAlchemy 2.0 `mapped_column` syntax.
- **DB session**: `from .database import get_db` (FastAPI Depends).
- **Auth dependencies**: `from .deps import get_current_user, require_role`. Use `require_role(UserRole.admin)` as the role guard.
- **Migrations**: NEVER edit an existing migration. Always `alembic revision --autogenerate -m "<message>"`, review, then `alembic upgrade head`. Current head is `e8e959ff5e42` (the brand-column migration). New migrations should descend from there.
- **Background tasks**: one `async def` started via `asyncio.create_task(...)` inside `on_startup`. Don't pull in Celery/RQ/Arq — overkill for FYP scope.
- **Config**: read from `backend/app/config.py` (`settings.X`). Add new env vars to both `config.py` and `backend/.env.example`.
- **Email**: `email_service.send_otp_email` and `send_invoice_email` are synchronous in request handlers. Don't change this without instruction.

## 0.2 Frontend (React 18 + Vite + shadcn/ui)

- **Every API call** must go through `apiRequest()` in `src/lib/api.jsx`. Do **not** call `fetch()` directly.
- **Auth token** lives in `localStorage['tailorhub-auth-token']`. Session under `tailorhub-auth-session`. Do not rename — would orphan logged-in users.
- **API base URL** comes from `import.meta.env.VITE_API_BASE_URL` (falls back to `http://127.0.0.1:3001`).
- **Routes** are declared in `src/App.jsx`. Wrap protected ones in `<ProtectedRoute>` (optional `requiredRole`).
- **i18n**: every user-facing string MUST go through `t('prefix.key', 'Fallback English')` from `useLanguage()`. Add **both** `en` and `ur` entries in `src/context/LanguageContext.jsx`. Existing prefixes: `nav`, `hero`, `catalog`, `measurements`, `tracking`, `delivery`, `admin`, `forgot`, `change`, `skintone`, `tryon`, `onboarding`.
- **UI components**: prefer `src/components/ui/*` (shadcn). Don't add new Bootstrap classes (Bootstrap is on a deprecation path — see C2).
- **Forms**: `react-hook-form` + `zod` (already installed).
- **Toasts**: `sonner` (`import { toast } from 'sonner'`). Don't add a second toast library.

## 0.3 Identifiers (do not change format)

- Order ID: `ORD-<8 uppercase hex>` (e.g. `ORD-A1B2C3D4`)
- Measurement code: `TH-M-XXXX` (4-digit zero-padded)
- User PK: UUID (string)
- Product PK: slug (string), e.g. `prod-shirt-classic`

## 0.4 Test discipline

- Backend: `backend/tests/test_<area>.py`, functions `def test_<behaviour>():`
- Frontend: co-located `*.test.jsx` next to the file under test, or under `src/test/<area>/`. Setup file is `src/test/setup.jsx` (note the `.jsx` extension — vitest.config.js was previously pointing at the wrong file; verify it points at `./src/test/setup.jsx`).

## 0.5 Commit hygiene

- One concern per commit.
- After each Part, append an entry to `CHANGES.md` matching the existing "Fix N:" / "Feature N:" format.

---

# Part A — Test Coverage

The codebase has Vitest + Testing Library installed but **zero actual tests** beyond an `example.test.jsx`. No backend tests at all.

## A1. Backend pytest scaffolding

### A1.1 Files to create

```
backend/
  pytest.ini
  requirements-dev.txt
  tests/
    __init__.py
    conftest.py
    test_auth.py
    test_otp.py
    test_webhook_idempotency.py
    test_orders.py
```

### A1.2 `backend/pytest.ini`

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -ra --strict-markers --tb=short
filterwarnings =
    ignore::DeprecationWarning:passlib.*
    ignore::DeprecationWarning:pydantic.*
    ignore::PendingDeprecationWarning
```

### A1.3 `backend/requirements-dev.txt`

```
-r requirements.txt
pytest==8.3.3
pytest-cov==5.0.0
freezegun==1.5.1
```

### A1.4 `backend/tests/conftest.py` — SQLite-in-memory fixtures

The conftest must:
1. Set required env vars (`JWT_SECRET_KEY`, `DEFAULT_ADMIN_PASSWORD`, `MYSQL_DATABASE=""` to force SQLite fallback) **before importing the app**.
2. Create an in-memory SQLite engine using `StaticPool` so a single connection is shared.
3. Override the FastAPI `get_db` dependency to use the test engine.
4. Provide fixtures: `db_session`, `client` (TestClient), `admin_user`, `admin_token`, `customer_user`, `customer_token`, `delivery_user`, `delivery_token`.
5. Provide an `auth_headers(token)` helper returning `{"Authorization": f"Bearer {token}"}`.
6. Auto-clear the in-memory rate-limiter dict between tests.

Reference `backend/app/database.py` for how `engine` and `SessionLocal` are constructed — mirror it with SQLite.

### A1.5 Required test cases

**`test_auth.py`** — 9 minimum:
- `test_register_creates_unverified_user_and_issues_otp` (verify OTP row exists, code_hash is NOT plaintext)
- `test_register_rejects_weak_password`
- `test_register_rejects_duplicate_email`
- `test_verify_with_correct_code_succeeds` (spy on `create_otp` to capture the raw code)
- `test_verify_with_wrong_code_fails`
- `test_login_success_returns_token`
- `test_login_wrong_password_returns_401`
- `test_login_unverified_user_is_rejected_with_403`
- `test_login_5_failed_attempts_triggers_429_lockout`
- `test_forgot_password_returns_200_for_unknown_email` (no enumeration!)
- `test_change_password_requires_correct_current_password`

**`test_otp.py`** — 7 tests:
- `test_otp_is_bcrypt_hashed_in_db` (hash starts with `$2`, NOT equal to raw code)
- `test_resend_otp_invalidates_previous_code`
- `test_correct_code_succeeds`
- `test_wrong_code_increments_attempts`
- `test_5_wrong_attempts_locks_code`
- `test_expired_code_is_rejected` (use freezegun to fast-forward 16 minutes)
- `test_cleanup_deletes_records_older_than_24h`

**`test_webhook_idempotency.py`** — 5 tests, the most important suite:
- `test_first_record_returns_event_object`
- `test_duplicate_record_returns_none` (proves IntegrityError catch works)
- `test_first_event_marks_payment_completed_and_increments_amount_paid`
- `test_duplicate_event_does_NOT_double_charge` (post the same event twice, verify `amount_paid` increases once)
- `test_unhandled_event_type_is_marked_processed` (no infinite retry)

Fake event shape:
```python
{
  "id": "evt_test_1",
  "type": "checkout.session.completed",
  "data": {"object": {
    "client_reference_id": "ORD-DEADBEEF",
    "amount_total": 50000,
    "metadata": {"order_id": "ORD-DEADBEEF", "payment_type": "advance"},
    "payment_intent": "pi_test_1",
  }},
}
```

Patch `mark_invoice_paid`, `render_invoice_pdf`, and `send_invoice_email` to avoid SMTP.

**`test_orders.py`** — 8 tests:
- `test_customer_can_create_order` (verify `ORD-<8 hex>` ID format)
- `test_create_order_without_garment_category_is_rejected_400`
- `test_customer_only_sees_own_orders`
- `test_admin_sees_all_orders`
- `test_admin_can_update_status`
- `test_customer_cannot_update_status`
- `test_status_change_to_invalid_value_returns_422`
- `test_admin_can_delete_pending_order`
- `test_admin_cannot_delete_delivered_order_returns_400`

### A1.6 Acceptance — A1

- [ ] `pip install -r backend/requirements-dev.txt` succeeds
- [ ] `cd backend && pytest` exits 0
- [ ] `pytest --cov=app` shows ≥70% line coverage on `routers_auth.py`, `routers_orders.py`, `services/webhook_service.py`, `services/otp_service.py`
- [ ] Suite runs in under 30 seconds
- [ ] No skips or xfails

## A2. Frontend Vitest tests

`vitest.config.js` already points at `src/test/setup.jsx` (or fix it if it points at `setup.js`). Tests just need to be written.

### A2.1 Files to create

```
src/
  lib/api.test.jsx
  context/CartContext.test.jsx
  context/AuthContext.test.jsx
  pages/Cart.test.jsx
  pages/Login.test.jsx
```

### A2.2 `src/lib/api.test.jsx` — must cover

- `apiRequest` calls `fetch` with the configured base URL + path
- Bearer header is auto-attached when a token is in localStorage
- `skipAuth: true` omits the Bearer header
- Explicit `token` option overrides localStorage
- 204 returns `null`
- Pydantic array errors (`{ detail: [{msg: 'x'}, ...] }`) join into one message
- String `detail` field is used directly
- Network failure throws "Unable to reach the server"
- 401: clears localStorage, sets `window.location.href = '/login'`
- 401 on `/login` page: **no redirect** (loop guard)
- 401 with `skipAuth: true`: no redirect

### A2.3 `src/context/CartContext.test.jsx` — pricing math

The cart math determines what users pay. **Lock the exact behaviour.** Source of truth is `CartContext.jsx` lines 39–47:

```
1. Start with item.product.price
2. addWaistcoat   → +3000  (flat)
3. suitOption '2-piece'      → *0.75
4. suitOption 'blazer-only'  → *0.5
5. suitOption 'pants-only'   → *0.3
6. purchaseMode 'unstitched' → *0.6
7. multiply by quantity
```

Test cases with price=10000:
- Base, no modifiers → 10000
- Waistcoat → 13000
- 2-piece → 7500
- Blazer-only → 5000
- Pants-only → 3000
- Unstitched → 6000
- Waistcoat + 2-piece + unstitched → **5850** ((10000+3000) × 0.75 × 0.6)
- Adding same customization twice → quantity 2, totalPrice 20000
- Adding different colours → 2 line items
- `removeFromCart`, `updateQuantity`, `clearCart` semantics

### A2.4 `src/pages/Cart.test.jsx`

- Render with 1 item + a customer logged in (mock contexts)
- Fill delivery address/city/phone
- Click "Cash on Delivery"
- Click "Place Order"
- Assert `apiRequest` was called with `POST /api/orders` and payload includes `paymentMethod: 'cod'` + address fields

### A2.5 `src/pages/Login.test.jsx` & `AuthContext.test.jsx`

- Login form rejects empty email
- Login form rejects invalid email format
- Successful login calls `setAuthToken()`
- Signup → OTP step renders 6-digit input
- Wrong OTP shows error toast

### A2.6 Acceptance — A2

- [ ] `npm run test` exits 0
- [ ] ≥5 test files, ≥25 individual test cases
- [ ] All cart pricing math is locked
- [ ] No `console.error` (React act() warnings)

---

# Part B — Deployment & CI

Currently the only deploy config is `firebase.json` (static frontend only). Add a real backend deploy story.

## B1. Multi-stage Dockerfile

Build React `dist/` in stage 1, bundle into FastAPI image in stage 2.

### B1.1 Create `Dockerfile` at repo root

```dockerfile
# ── Stage 1: build the React frontend ───────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ── Stage 2: backend runtime ────────────────────────────────────────────────
FROM python:3.11-slim AS backend
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential default-libmysqlclient-dev pkg-config \
      libjpeg-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
COPY --from=frontend /app/dist ./backend/app/static
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
EXPOSE 8000
WORKDIR /app/backend
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

### B1.2 Add SPA static-mount to `backend/app/main.py`

After the existing `app.include_router(...)` block:

```python
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
```

### B1.3 Create `.dockerignore`

```
node_modules
dist
build
.venv
backend/.venv
backend/venv
**/__pycache__
**/*.pyc
.pytest_cache
.git
.env
backend/.env
*.log
.DS_Store
coverage
htmlcov
```

### B1.4 Acceptance — B1

- [ ] `docker build -t tailorhub .` succeeds on clean clone
- [ ] `docker run -p 8000:8000 -e MYSQL_HOST=... -e MYSQL_PASSWORD=... -e JWT_SECRET_KEY=... -e DEFAULT_ADMIN_PASSWORD=... tailorhub` boots, runs migrations, serves both `/api/health` AND the SPA at `/`
- [ ] Login as seed admin works through the dockerized app

## B2. `render.yaml` Blueprint

```yaml
services:
  - type: web
    name: tailorhub-api
    env: docker
    plan: starter
    dockerfilePath: ./Dockerfile
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - { key: PORT,                value: 8000 }
      - { key: JWT_SECRET_KEY,      generateValue: true }
      - { key: JWT_ALGORITHM,       value: HS256 }
      - { key: JWT_EXPIRE_MINUTES,  value: 60 }
      - { key: DEFAULT_ADMIN_EMAIL, value: admin@tailorhub.pk }
      - { key: DEFAULT_ADMIN_PASSWORD, sync: false }
      - { key: DEFAULT_ADMIN_NAME,  value: TailorHub Admin }
      - { key: MYSQL_HOST,          sync: false }
      - { key: MYSQL_PORT,          value: 3306 }
      - { key: MYSQL_DATABASE,      value: tailorhub }
      - { key: MYSQL_USER,          sync: false }
      - { key: MYSQL_PASSWORD,      sync: false }
      - { key: STRIPE_SECRET_KEY,     sync: false }
      - { key: STRIPE_WEBHOOK_SECRET, sync: false }
      - { key: SMTP_HOST,           value: smtp.gmail.com }
      - { key: SMTP_PORT,           value: 587 }
      - { key: SMTP_USER,           sync: false }
      - { key: SMTP_PASSWORD,       sync: false }
      - { key: SMTP_FROM_EMAIL,     value: noreply@tailorhub.pk }
      - { key: SMTP_USE_TLS,        value: true }
      - { key: GOOGLE_CLIENT_ID,    sync: false }
      - { key: GOOGLE_CLIENT_SECRET, sync: false }
      - { key: GEMINI_API_KEY,      sync: false }
      - { key: HUGGINGFACE_TOKEN,   sync: false }
      - { key: CORS_ORIGINS,        value: https://tailorhub-api.onrender.com }
      - { key: FRONTEND_URL,        value: https://tailorhub-api.onrender.com }
```

**Note**: Render's managed `databases:` is Postgres-only. Use an external MySQL provider (PlanetScale, Aiven) and supply `MYSQL_*` as env vars, OR migrate to Postgres by changing `database_url` in `config.py`. Document the decision in CHANGES.md.

### B2.2 Acceptance — B2

- [ ] First deploy succeeds (build + migrations + health check 200)
- [ ] `https://tailorhub-api.onrender.com/health` returns `{"ok": true}`
- [ ] Logging in as seed admin works on the deployed URL

## B3. `vercel.json` (optional — frontend-only deploy)

Skip if the SPA is bundled into the backend Docker image.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://tailorhub-api.onrender.com/api/$1" },
    { "source": "/((?!assets/|favicon).*)", "destination": "/index.html" }
  ]
}
```

## B4. GitHub Actions CI

### B4.1 `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
        env: { VITE_API_BASE_URL: http://localhost:3001 }
      - uses: actions/upload-artifact@v4
        with: { name: frontend-dist, path: dist, retention-days: 7 }

  backend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
          cache-dependency-path: |
            backend/requirements.txt
            backend/requirements-dev.txt
      - run: pip install --upgrade pip && pip install -r requirements.txt && pip install -r requirements-dev.txt
      - env:
          MYSQL_DATABASE: ""
          JWT_SECRET_KEY: test-secret-key-minimum-32-characters-long-for-ci
          DEFAULT_ADMIN_EMAIL: admin@test.local
          DEFAULT_ADMIN_PASSWORD: TestAdmin@2026!
          DEFAULT_ADMIN_NAME: Test Admin
        run: pytest --cov=app --cov-report=term-missing --cov-report=xml

  docker-build:
    runs-on: ubuntu-latest
    needs: [frontend, backend]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          tags: tailorhub:ci
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### B4.2 Acceptance — B4

- [ ] First PR triggers all 3 jobs
- [ ] All 3 jobs pass
- [ ] Push to main runs the workflow
- [ ] Intentionally breaking a test fails the workflow (verify, then revert)

---

# Part C — Polish & Hardening

Each subsection is independent — do in any order.

## C1. README accuracy audit

The current `README.md` is short (~3.9 KB) and makes a few unverified claims. Rewrite it:

### Claims to verify

| Claim | Verify by | Action |
|-------|-----------|--------|
| "Email verification with OTP" | Existing — keep | — |
| "Google/Facebook/Apple OAuth" | `routers_oauth.py` — confirm Apple is a stub | Mark Apple WIP if not E2E tested |
| "Bilingual UI ... full support" | grep `LanguageContext.jsx` for missing `ur` keys | List gaps under "Known limitations" |
| "PDF invoices with QR codes" | Run the test client, scan one | Confirm |
| "Full Stripe Checkout" | `routers_payments.py` — both checkout creation AND webhook live | Confirm |
| Bootstrap usage | `package.json` — Bootstrap is present | See C2 for deprecation plan |

### Required new sections

- **Deployment** — link to Render URL when deployed; mention Docker, Vercel, Firebase options
- **Testing** — `pytest` and `npm run test` invocations
- **Configuration** — table of every env var with one-line descriptions, sourced from `backend/.env.example`
- **Architecture notes** — token key, `apiRequest()` discipline, router naming, migration discipline, ID formats

### Acceptance — C1
- [ ] Every Features claim verifiable from code
- [ ] No claim mentions a stubbed-only feature without a "WIP" label
- [ ] Deployment / Testing / Configuration sections exist

## C2. Bootstrap removal (recommended) OR boundary doc

The frontend has `bootstrap@5.3.8` AND Tailwind + shadcn/ui. Two utility systems coexisting is a contributor footgun.

### Decision: pick one

**(a) Remove Bootstrap** (recommended):
1. `grep -rn "from 'bootstrap'\\|import 'bootstrap" src/`
2. `grep -rnE "className=\"[^\"]*\\\\b(btn|container|row|col-|d-flex|me-|ms-|mt-|mb-|p-)" src/`
3. Replace each class with the Tailwind equivalent:
   - `d-flex` → `flex`
   - `align-items-center` → `items-center`
   - `justify-content-between` → `justify-between`
   - `me-2` → `mr-2`; `ms-2` → `ml-2`
   - `mt-3 mb-3` → `my-3`
   - `text-muted` → `text-muted-foreground`
   - `btn btn-primary` → `<Button>` from `src/components/ui/button.jsx`
   - `container` → `container mx-auto`
4. Remove `import 'bootstrap/dist/css/bootstrap.min.css'` from `src/main.jsx`
5. `npm uninstall bootstrap`
6. Update README's tech stack

**(b) Document the boundary** (safer): add a `CONTRIBUTING.md` with the Bootstrap-vs-Tailwind rule. Don't mix going forward.

### Acceptance — C2
- [ ] (a) `bootstrap` removed from `package.json`, no imports remain. OR
- [ ] (b) `CONTRIBUTING.md` exists with explicit rule
- [ ] Visual regression: click through Index → Catalog → Cart → Tracking — no breakage

## C3. Audit log table + middleware

Admin writes leave no trace today. Add an append-only audit log.

### C3.1 New model in `backend/app/models.py`

```python
class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_email: Mapped[str] = mapped_column(String(255), nullable=True)  # snapshot after delete
    actor_role: Mapped[str] = mapped_column(String(20), nullable=True)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)
```

### C3.2 Alembic migration (descends from `e8e959ff5e42`)

```bash
cd backend && alembic revision --autogenerate -m "add audit_log table"
# Review the generated file, then:
alembic upgrade head
```

### C3.3 Middleware — `backend/app/middleware_audit.py` (new)

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
            if request.method not in AUDITED_METHODS: return response
            if not any(request.url.path.startswith(p) for p in AUDITED_PATH_PREFIXES): return response

            actor_id, actor_email, actor_role = None, None, None
            auth = request.headers.get("authorization", "")
            if auth.lower().startswith("bearer "):
                try:
                    payload = jwt.decode(auth.split(" ",1)[1], settings.JWT_SECRET_KEY,
                                          algorithms=[settings.JWT_ALGORITHM])
                    actor_id = payload.get("sub")
                    actor_role = payload.get("role")
                except JWTError: pass

            if actor_id and not actor_email:
                from .models import User
                db_lookup = SessionLocal()
                try:
                    user = db_lookup.get(User, actor_id)
                    if user: actor_email = user.email
                finally: db_lookup.close()

            db = SessionLocal()
            try:
                db.add(AuditLog(
                    actor_id=actor_id, actor_email=actor_email, actor_role=actor_role,
                    method=request.method, path=request.url.path,
                    status_code=response.status_code,
                    ip_address=request.client.host if request.client else None,
                    timestamp=datetime.utcnow(),
                ))
                db.commit()
            finally: db.close()
        except Exception as e:
            print(f"[AUDIT] failed to log: {e}")
        return response
```

Register in `main.py`:
```python
from .middleware_audit import AuditMiddleware
app.add_middleware(AuditMiddleware)  # AFTER CORS + Session
```

### C3.4 Admin endpoint — `backend/app/routers_audit.py`

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
    if method: q = q.filter(AuditLog.method == method.upper())
    rows = q.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [{
        "id": r.id, "actor_email": r.actor_email, "actor_role": r.actor_role,
        "method": r.method, "path": r.path, "status_code": r.status_code,
        "ip_address": r.ip_address, "timestamp": r.timestamp.isoformat(),
    } for r in rows]
```

Register in `main.py`. Add an "Audit Log" tab to `src/pages/AdminDashboard.jsx` that fetches `/api/audit/logs` and renders a sortable table.

### C3.5 i18n keys (LanguageContext.jsx, prefix `admin`)
- `admin.auditTab` — Audit Log / آڈٹ لاگ
- `admin.auditActor` — Actor / صارف
- `admin.auditAction` — Action / عمل
- `admin.auditTime` — Time / وقت

### C3.6 Acceptance — C3

- [ ] Migration runs forward + backward cleanly
- [ ] Deleting an order as admin creates an `audit_log` row (`DELETE`, `200`)
- [ ] Customer DELETE (403) is still logged with `status_code=403`
- [ ] Audit tab in admin dashboard renders the log
- [ ] Test: `test_admin_delete_is_audited` added to `test_orders.py`

## C4. In-app notifications

Customers don't see status changes when offline. Add a `notifications` table + bell-icon dropdown.

### C4.1 New model

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

### C4.2 Service helper — `backend/app/services/notification_service.py`

```python
from sqlalchemy.orm import Session
from ..models import Notification

def notify(db: Session, user_id: str, title: str, body: str, link: str | None = None):
    try:
        n = Notification(user_id=user_id, title=title, body=body, link=link)
        db.add(n); db.commit(); db.refresh(n)
        return n
    except Exception as e:
        print(f"[NOTIFY] failed: {e}")
        db.rollback()
        return None
```

Wire into `routers_orders.py` `update_order_status` handler — after `db.commit()` if status changed:

```python
from .services.notification_service import notify
notify(db, order.customer_id,
       f"Order {order.id} update",
       f"Status changed to {payload.status.value.replace('_', ' ').title()}",
       link=f"/tracking?order={order.id}")
```

### C4.3 Endpoints — `backend/app/routers_notifications.py`

- `GET /api/notifications?limit=50` → `{ unread_count, notifications: [...] }` for current user, newest first
- `POST /api/notifications/{id}/read`
- `POST /api/notifications/read-all`

All require auth via `Depends(get_current_user)`. The `{id}/read` endpoint must 404 if the notification belongs to another user.

### C4.4 Frontend bell icon — `src/components/layout/NotificationBell.jsx`

- Bell icon in Navbar, polls `GET /api/notifications` every 30s while authenticated
- Unread count badge
- Dropdown: last 10, "Mark all as read", links navigate to `notification.link`
- Click outside closes dropdown
- i18n under `nav.notifications.*`

### C4.5 Acceptance — C4

- [ ] Migration runs
- [ ] Admin updating an order's status produces a row in `notifications` for that customer
- [ ] Bell shows unread count within 30s
- [ ] Marking read clears the badge
- [ ] User cannot mark another user's notification read (returns 404)
- [ ] Test: `test_status_change_creates_notification` in `test_orders.py`

## C5. Stock decrement on cutting

`inventory_items` exists but isn't tied to orders. When admin transitions an order to `cutting`, linked fabric should decrement.

### C5.1 Schema change (Alembic)

Add `inventory_item_id INT NULL` to `order_items`, FK to `inventory_items.id`, ondelete=SET NULL.

### C5.2 Logic in `routers_orders.py` (PATCH /{id}/status)

```python
if new_status == OrderStatus.cutting and old_status != OrderStatus.cutting:
    from .models import InventoryItem
    for item in order.items:
        if not item.inventory_item_id: continue
        inv = db.get(InventoryItem, item.inventory_item_id)
        if not inv: continue
        if inv.quantity < item.quantity:
            if not request.headers.get("X-Stock-Override"):
                raise HTTPException(409, f"Insufficient stock for {inv.name}")
        inv.quantity = max(0, inv.quantity - item.quantity)
    db.commit()
```

### C5.3 Frontend admin override

In `AdminDashboard.jsx` order panel, when transitioning to `cutting` and API returns 409: show "Stock insufficient — proceed anyway?" dialog. If confirmed, retry with `X-Stock-Override: 1` header (extend `apiRequest()` to accept a `headers` option).

### C5.4 Acceptance — C5

- [ ] Moving to `cutting` decrements linked `inventory_items.quantity`
- [ ] Insufficient stock returns 409 by default
- [ ] Override header bypasses the check
- [ ] Tests: `test_cutting_decrements_inventory`, `test_insufficient_stock_blocks_without_override`

## C6. Stripe refund flow

`OrderStatus.cancelled` exists but doesn't refund. Add `POST /api/orders/{id}/cancel`.

### C6.1 Endpoint in `routers_orders.py`

```python
@router.post("/{order_id}/cancel")
def cancel_order(order_id: str, db: Session = Depends(get_db), user = Depends(get_current_user)):
    order = db.get(Order, order_id)
    if not order: raise HTTPException(404, "Order not found")

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

    # Reverse khata if applicable
    db.query(KhataEntry).filter(KhataEntry.order_id == order_id).update({KhataEntry.order_id: None})

    notify(db, order.customer_id, "Order cancelled",
           f"Your order {order.id} has been cancelled.",
           link=f"/tracking?order={order.id}")
    return {"ok": True, "refunded": refunded}
```

### C6.2 Frontend cancel button

- `src/pages/Tracking.jsx`: customer "Cancel order" button when `status === 'pending'`
- `src/pages/AdminDashboard.jsx`: admin-side cancel control in order detail panel
- Both POST to `/api/orders/<id>/cancel`

### C6.3 Acceptance — C6

- [ ] Customer can cancel only their own pending orders
- [ ] Admin can cancel any non-delivered order
- [ ] Stripe-paid cancel issues a real refund (verify in Stripe test mode)
- [ ] COD cancel sets status without calling Stripe
- [ ] Tests: `test_customer_cancels_pending`, `test_customer_cannot_cancel_others`, `test_admin_cancels_with_refund` (mock `stripe.Refund.create`)

---

# Part D — Wow Features (pick 2)

For an FYP demo, two are more impressive than five half-done. **Recommended pairing: D2 + D3** (one customer-facing AI feature, one admin analytics dashboard).

## D1. WhatsApp order notifications (Twilio)

- `pip install twilio` (add to `requirements.txt`)
- Env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- New `backend/app/services/whatsapp_service.py` with `send_whatsapp(to_phone, body)` — silent no-op if not configured
- New column `users.whatsapp_opt_in BOOLEAN DEFAULT FALSE`
- Wire into status changes alongside `notify()`
- Profile UI toggle to opt in
- Acceptance: toggle off → no SMS sent; toggle on → status change sends via Twilio sandbox

## D2. AI body measurement from photo (Gemini Vision) — RECOMMENDED

- New page `src/pages/AIMeasurements.jsx` with front + side photo inputs
- Multipart POST to `/api/measurements/extract`
- Gemini Vision returns shoulder/chest/waist/hip estimates in cm
- Pre-fill the existing measurement form with a clear "AI estimated — verify before saving" banner
- **Never auto-save** — user reviews and clicks Save
- Endpoint requires auth + `GEMINI_API_KEY`; returns 503 if unset
- Acceptance: two photos → estimates appear → banner shown → estimates not saved until user clicks Save

## D3. Customer analytics dashboard — RECOMMENDED

Recharts is already a dependency.

- `GET /api/analytics/orders-by-month` → last 12 months `[{month, count, revenue}]`
- `GET /api/analytics/popular-categories` → category counts
- `GET /api/analytics/repeat-rate` → % customers with ≥2 orders in 6 months
- `GET /api/analytics/avg-lead-time` → avg days `confirmed → delivered`
- New "Analytics" tab in `AdminDashboard.jsx` with LineChart, BarChart, 2 KPI cards
- i18n under `admin.analytics.*`
- Acceptance: 4 widgets render; empty-data state doesn't crash; admin-only (403 for customer)

## D4. Multi-tailor marketplace (v2 — flag as scope expansion)

Big lift — ≥2 weeks. Only attempt if FYP timeline permits.

- New `tailor_shops` table
- `users.tailor_shop_id`, `products.tailor_shop_id`
- Customer-facing `/shops` page with shop catalog
- Admin dashboard scoped to a shop (or platform-admin role)
- Migration of existing single-shop data to a default shop

## D5. SMS OTP fallback (Twilio SMS)

- When SMTP fails OR user opts in, send OTP via SMS
- `users.phone` column (check `models.py` for existing field first)
- Twilio SMS env vars + service
- Registration UI: "Receive OTP by SMS"
- Acceptance: SMTP fail + SMS opt-in → SMS arrives; SMTP success → no SMS

---

# Implementation Priority Table

**Follow this order. Stop and report after each item. Wait for human review.**

| # | Item | Part | Hours | Why this order |
|---|------|------|------|---|
| 1 | Backend pytest scaffolding + tests | A1 | 6 | Safety net before any other change |
| 2 | Frontend Vitest tests | A2 | 4 | Locks pricing math + auth flow |
| 3 | Dockerfile + SPA static mount | B1 | 3 | Single artifact for deploy |
| 4 | GitHub Actions CI | B4 | 2 | Guards every PR from now on |
| 5 | render.yaml (and/or vercel.json) | B2 / B3 | 2 | One-click deploy |
| 6 | README accuracy audit | C1 | 2 | Prevents future drift |
| 7 | Bootstrap removal OR boundary doc | C2 | 4 | Clean architecture |
| 8 | Audit log (table + middleware + admin tab) | C3 | 5 | Traceability |
| 9 | In-app notifications | C4 | 5 | Real product polish |
| 10 | Stock decrement on cutting | C5 | 3 | Closes inventory loop |
| 11 | Stripe refund flow | C6 | 4 | Closes payment loop |
| 12 | **Wow feature 1 — D2 (AI measurements)** | D | 8 | Demo-grade impressive |
| 13 | **Wow feature 2 — D3 (analytics)** | D | 6 | Visual punch for admin demo |

**Total core (1–11)**: ~40 hours. **With both wow features**: ~54 hours.

---

# Final Notes for the Receiving AI

1. **After each item**, append to `CHANGES.md`:
   ```
   ### Feature N: <name>
   - **Files added**: ...
   - **Tables added** (if any): ...
   - **Migration**: alembic/versions/<hash>_<name>.py
   - **Tests**: test_<name> in test_<file>.py
   ```

2. **Before moving to N+1**, confirm:
   - All new tests pass
   - `npm run lint` passes
   - Dev server boots without warnings
   - `CHANGES.md` is updated

3. **If you find a real-vs-prompt inconsistency**, STOP and report — don't guess.

4. **Never fabricate** an env var, package, or file path. If missing, surface it.

5. **Never bypass existing patterns**:
   - Don't `fetch()` directly (use `apiRequest()`)
   - Don't hardcode English strings (use `t('key', 'fallback')`)
   - Don't edit a published Alembic migration (always new one)
   - Don't rename localStorage keys (`tailorhub-auth-token`, `tailorhub-auth-session`)

6. **i18n discipline**: every new user-facing string needs both `en` and `ur` entries. List the new keys at the bottom of each commit message.

7. **No new toast libraries, state libraries, CSS frameworks, or HTTP clients.** Use what's already installed.

---

*End of next-level master prompt. Paste the whole thing — or any single Part — into your AI assistant. Let it work through the priority table.*
