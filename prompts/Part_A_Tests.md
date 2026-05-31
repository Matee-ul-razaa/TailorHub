# TailorHub — Part A: Test Coverage

> Paste this file into your AI coding assistant. End with: *"Start with A1. After each item completes, stop and report. Do not start A2 until I tell you to."*

**Goal**: build a real test suite — backend `pytest` and frontend `vitest`. The codebase has Vitest + Testing Library installed but currently has zero meaningful tests, and no backend tests at all.

**Effort**: ~10 hours (A1 ≈ 6h, A2 ≈ 4h)

---

## Project context

### What's already done (do NOT redo)

- ✅ FastAPI backend with SQLAlchemy 2 + MySQL (SQLite fallback)
- ✅ Auth flow: register / login / verify-email / resend-otp / forgot / reset / change-password (`backend/app/routers_auth.py`)
- ✅ DB-backed OTPs — bcrypt-hashed, 15-min TTL, 5-attempt lock (`backend/app/services/otp_service.py`)
- ✅ Stripe webhook idempotency via unique `(provider, event_id)` constraint (`backend/app/services/webhook_service.py`)
- ✅ Login rate limiting — 5 fails → 15-min lockout per email (`backend/app/rate_limiter.py`)
- ✅ Order pipeline (9 statuses), role-based filtering on `GET /api/orders`
- ✅ Cart pricing math in `src/context/CartContext.jsx`
- ✅ Centralised API client in `src/lib/api.jsx` (`apiRequest()`, 401 redirect, token injection)
- ✅ Vitest config exists at `vitest.config.js` — verify it points at `./src/test/setup.jsx` (the `.jsx` extension, not `.js`)

### Working conventions

- Backend tests: `backend/tests/test_<area>.py`, functions `def test_<behaviour>():`
- Frontend tests: co-located `*.test.jsx`, or under `src/test/<area>/`
- Auth token localStorage key: `tailorhub-auth-token`
- API base URL: `import.meta.env.VITE_API_BASE_URL`
- Order ID format: `ORD-<8 uppercase hex>`

---

# A1. Backend pytest scaffolding

## A1.1 Files to create

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

## A1.2 `backend/pytest.ini`

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

## A1.3 `backend/requirements-dev.txt`

```
-r requirements.txt
pytest==8.3.3
pytest-cov==5.0.0
freezegun==1.5.1
```

## A1.4 `backend/tests/conftest.py` — SQLite-in-memory fixtures

The conftest must:

1. Set required env vars **before importing the app**:
   ```python
   os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-minimum-32-characters-long-for-pytest")
   os.environ.setdefault("DEFAULT_ADMIN_EMAIL", "admin@test.local")
   os.environ.setdefault("DEFAULT_ADMIN_PASSWORD", "TestAdmin@2026!")
   os.environ.setdefault("DEFAULT_ADMIN_NAME", "Test Admin")
   os.environ["MYSQL_DATABASE"] = ""   # forces SQLite fallback in config.py
   ```

2. Create an in-memory SQLite engine using `StaticPool` so a single connection is shared:
   ```python
   test_engine = create_engine(
       "sqlite://",
       connect_args={"check_same_thread": False},
       poolclass=StaticPool,
   )
   TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
   ```

3. `@pytest.fixture(autouse=True) def reset_database()` — drops + recreates schema before each test.

4. Override the FastAPI `get_db` dependency to yield a session bound to the test engine. Inside a `client` fixture, set `app.dependency_overrides[get_db] = override`, yield `TestClient(app)`, then clear overrides.

5. Provide fixtures: `db_session`, `client`, `admin_user`, `admin_token`, `customer_user`, `customer_token`, `delivery_user`, `delivery_token`. Tokens come from `create_access_token(user.id, user.role.value)`.

6. Expose `auth_headers(token)` helper returning `{"Authorization": f"Bearer {token}"}`.

7. Auto-clear `app.rate_limiter._failed_attempts` between tests (it's an in-memory dict that survives across tests otherwise).

Reference `backend/app/database.py` to mirror engine/session construction.

## A1.5 Required test cases

### `test_auth.py` — at least 11 tests

- `test_register_creates_unverified_user_and_issues_otp` — verify a row in `otp_codes` exists and `code_hash` does NOT equal the plaintext code
- `test_register_rejects_weak_password`
- `test_register_rejects_duplicate_email`
- `test_verify_with_correct_code_succeeds` — spy on `create_otp` to capture the raw code, then post it
- `test_verify_with_wrong_code_fails_400`
- `test_login_success_returns_token`
- `test_login_wrong_password_returns_401`
- `test_login_unverified_user_returns_403`
- `test_login_5_failed_attempts_triggers_429_lockout`
- `test_forgot_password_returns_200_for_unknown_email` (no enumeration!)
- `test_change_password_requires_correct_current_password`

### `test_otp.py` — at least 7 tests

- `test_otp_is_bcrypt_hashed_in_db` — hash starts with `$2`, is NOT equal to raw code
- `test_resend_otp_invalidates_previous_code` — only one unconsumed code at a time
- `test_correct_code_succeeds`
- `test_wrong_code_increments_attempts`
- `test_5_wrong_attempts_locks_code`
- `test_expired_code_is_rejected` — use `freezegun` to fast-forward 16 minutes past creation
- `test_cleanup_deletes_records_older_than_24h`

### `test_webhook_idempotency.py` — at least 5 tests (most important suite)

- `test_first_record_returns_event_object`
- `test_duplicate_record_returns_none` — proves the `IntegrityError` catch in `record_event_or_skip()` works
- `test_first_event_marks_payment_completed_and_increments_amount_paid`
- `test_duplicate_event_does_NOT_double_charge` — post the same event twice, verify `amount_paid` only increases once
- `test_unhandled_event_type_is_marked_processed` — prevents infinite retry on unknown types

Fake event shape:
```python
{
  "id": "evt_test_1",
  "type": "checkout.session.completed",
  "data": {"object": {
    "client_reference_id": "ORD-DEADBEEF",
    "amount_total": 50000,   # paise → becomes 500.00
    "metadata": {"order_id": "ORD-DEADBEEF", "payment_type": "advance"},
    "payment_intent": "pi_test_1",
  }},
}
```

Patch `mark_invoice_paid`, `render_invoice_pdf`, and `send_invoice_email` to avoid SMTP calls.

### `test_orders.py` — at least 9 tests

- `test_customer_can_create_order` — verify `ORD-<8 hex>` format
- `test_create_order_without_garment_category_returns_400`
- `test_customer_only_sees_own_orders`
- `test_admin_sees_all_orders`
- `test_admin_can_update_status`
- `test_customer_cannot_update_status_returns_403`
- `test_invalid_status_value_returns_422`
- `test_admin_can_delete_pending_order_returns_204`
- `test_admin_cannot_delete_delivered_order_returns_400`

## A1.6 Acceptance criteria — A1

- [ ] `pip install -r backend/requirements-dev.txt` succeeds
- [ ] `cd backend && pytest` exits 0
- [ ] `pytest --cov=app` shows ≥70% line coverage on `routers_auth.py`, `routers_orders.py`, `services/webhook_service.py`, `services/otp_service.py`
- [ ] Full suite runs in under 30 seconds
- [ ] No tests are skipped or marked xfail

---

# A2. Frontend Vitest tests

`vitest.config.js` already points at `src/test/setup.jsx` (if it points at `.js`, fix it — the actual setup file extension is `.jsx`).

## A2.1 Files to create

```
src/
  lib/api.test.jsx
  context/CartContext.test.jsx
  context/AuthContext.test.jsx
  pages/Cart.test.jsx
  pages/Login.test.jsx
```

## A2.2 `src/lib/api.test.jsx` — must cover

- `apiRequest()` calls `fetch` with the configured base URL + path
- Bearer header auto-attached when token is in localStorage
- `skipAuth: true` omits the Bearer header
- Explicit `token` option overrides localStorage
- 204 returns `null`
- Pydantic array errors `{ detail: [{msg: 'x'}, ...] }` join into one readable message
- String `detail` field is used directly
- Network failure throws `"Unable to reach the server"`
- **401 handling**:
  - Clears localStorage AND sets `window.location.href = '/login'`
  - When `pathname.startsWith('/login')`: **no redirect** (loop guard)
  - When `skipAuth: true`: no redirect

Pattern for mocking `window.location`:
```jsx
beforeEach(() => {
  originalLocation = window.location;
  delete window.location;
  window.location = { href: "/", pathname: "/" };
});
afterEach(() => { window.location = originalLocation; });
```

## A2.3 `src/context/CartContext.test.jsx` — pricing math (CRITICAL)

The cart math determines what users actually pay. **Lock the exact behaviour** so a future refactor can't silently change it.

Source of truth: `CartContext.jsx` lines 39–47:
```
1. price = item.product.price
2. addWaistcoat       → price += 3000
3. suitOption '2-piece'     → price *= 0.75
4. suitOption 'blazer-only' → price *= 0.5
5. suitOption 'pants-only'  → price *= 0.3
6. purchaseMode 'unstitched' → price *= 0.6
7. sum += price * quantity
```

Test cases with `price=10000`:

| Customization | Expected totalPrice |
|---|---:|
| Base, no modifiers | **10000** |
| `addWaistcoat: true` | **13000** |
| `suitOption: '2-piece'` | **7500** |
| `suitOption: 'blazer-only'` | **5000** |
| `suitOption: 'pants-only'` | **3000** |
| `purchaseMode: 'unstitched'` | **6000** |
| Waistcoat + 2-piece + unstitched | **5850** ((10000+3000)×0.75×0.6) |
| Same customization added twice | qty=2, total=**20000** |
| Different colors (2 items) | 2 line items, total=**20000** |

Also test mutations:
- `removeFromCart(id)` removes the item
- `updateQuantity(id, 0)` removes the item
- `updateQuantity(id, 5)` sets quantity to 5
- `clearCart()` empties everything

Use `renderHook` from `@testing-library/react` with `<CartProvider>` wrapper.

## A2.4 `src/pages/Cart.test.jsx`

- Render with 1 item + customer logged in (mock contexts)
- Fill delivery address/city/phone fields
- Click "Cash on Delivery" radio
- Click "Place Order"
- Assert `apiRequest` was called with `POST /api/orders` and payload includes `paymentMethod: 'cod'` + address fields

## A2.5 `src/pages/Login.test.jsx` & `src/context/AuthContext.test.jsx`

- Login form rejects empty email
- Login form rejects invalid email format
- Successful login calls `setAuthToken()` with the returned access_token
- Signup → OTP step renders 6-digit input
- Wrong OTP shows error toast (assert `toast.error` was called)

## A2.6 Acceptance criteria — A2

- [ ] `npm run test` exits 0
- [ ] At least 5 test files, ≥25 individual test cases
- [ ] All cart pricing math is locked by tests
- [ ] No `console.error` warnings (catch React act() warnings — fix them, don't silence)

---

# CHANGES.md template (append after A is done)

```markdown
### Feature 6: Backend test suite (pytest)
- **Files added**: `backend/pytest.ini`, `backend/requirements-dev.txt`,
  `backend/tests/__init__.py`, `backend/tests/conftest.py`,
  `backend/tests/test_auth.py`, `test_otp.py`,
  `test_webhook_idempotency.py`, `test_orders.py`
- **Coverage**: ≥70% on routers_auth, routers_orders, webhook_service, otp_service
- **Run**: `cd backend && pytest --cov=app`

### Feature 7: Frontend test suite (Vitest)
- **Files added**: `src/lib/api.test.jsx`, `src/context/CartContext.test.jsx`,
  `src/context/AuthContext.test.jsx`, `src/pages/Cart.test.jsx`,
  `src/pages/Login.test.jsx`
- **Critical lock**: cart pricing math (waistcoat +3000 / 2-piece ×0.75 /
  blazer ×0.5 / pants ×0.3 / unstitched ×0.6) is now locked by tests
- **Run**: `npm run test`
```

---

## Hard rules (do not break)

- Don't mock anything that's actually being tested. If a test stubs `verify_password` to always return True, it's not testing auth — it's testing the mock.
- The webhook idempotency test must NOT be a happy-path test. Its whole purpose is proving the deduplication works. If `amount_paid` ends at 1000 instead of 500 after posting the same event twice, the test must fail.
- Don't change `cart pricing math` in `CartContext.jsx`. The tests lock the current behaviour. If you think the math is wrong, surface it — don't change it silently.
- Don't add new test runners (Jest, Mocha, etc). Vitest is the only one.
- Don't add new mocking libraries. Vitest's built-in `vi` is enough.

---

**Stop after A1 and report. Wait for human approval before starting A2.**
