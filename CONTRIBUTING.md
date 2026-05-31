# Contributing to TailorHub

Thank you for considering contributing to TailorHub! This document outlines the guidelines for code contributions.

---

## CSS Framework Policy: Bootstrap vs Tailwind

TailorHub is transitioning from Bootstrap to Tailwind CSS + shadcn/ui. To prevent technical debt during this migration:

### Rule: Don't Mix

**Never use Bootstrap classes in new code.** All new components and pages should use:
- Tailwind CSS utility classes
- shadcn/ui components (`src/components/ui/*`)
- Radix UI primitives (via shadcn)

### Bootstrap (Legacy Only)

Existing Bootstrap classes remain in these files (do not add more):
- `src/pages/AdminDashboard.jsx`
- `src/pages/Measurements.jsx`
- `src/pages/DeliveryDashboard.jsx`
- `src/pages/Cart.jsx`
- `src/pages/Catalog.jsx`
- `src/pages/Login.jsx`
- And 40+ other files (see grep for full list)

Common Bootstrap classes you'll see (but should NOT use):
| Bootstrap | Tailwind Equivalent |
|-----------|---------------------|
| `d-flex` | `flex` |
| `align-items-center` | `items-center` |
| `justify-content-between` | `justify-between` |
| `me-2` / `ms-2` | `mr-2` / `ml-2` or `me-2` / `ms-2` (Tailwind also supports logical props) |
| `mt-3 mb-3` | `my-3` or `mt-3 mb-3` |
| `text-muted` | `text-muted-foreground` |
| `btn btn-primary` | `<Button>` from `src/components/ui/button.jsx` |
| `container` | `container mx-auto` |
| `row` / `col-md-6` | `grid grid-cols-12` + `col-span-6` or Flexbox |

### Migration Path

When editing a file with existing Bootstrap:
1. Prefer adding Tailwind classes over Bootstrap
2. If the component needs significant rework, consider full Tailwind migration
3. Never introduce new Bootstrap classes

### Enforcement

CI does not (yet) enforce this. Reviewers should flag:
- New `className` containing Bootstrap classes
- `import 'bootstrap/dist/css/bootstrap.min.css'` in new files

---

## Code Conventions

### Frontend (React + Vite)

- **API Calls:** Always use `apiRequest()` from `src/lib/api.jsx`. Never call `fetch()` directly.
- **Auth Token:** Use `localStorage['tailorhub-auth-token']` and `tailorhub-auth-session`. Do not rename.
- **Styling:** Tailwind + shadcn/ui. No new Bootstrap.
- **i18n:** Every user-facing string must use `t('prefix.key', 'Fallback')` from `useLanguage()`. Add both `en` and `ur` to `src/context/LanguageContext.jsx`.
- **Forms:** Use `react-hook-form` + `zod` (already installed).
- **Toasts:** Use `sonner` (`import { toast } from 'sonner'`). No second toast library.

### Backend (FastAPI + SQLAlchemy)

- **Routers:** Live in `backend/app/routers_<domain>.py`. Register in `backend/app/main.py`.
- **Schemas:** All Pydantic schemas go in `backend/app/schemas.py` — do not split.
- **Models:** All ORM models go in `backend/app/models.py`. Use SQLAlchemy 2.0 `mapped_column` syntax.
- **DB Session:** `from .database import get_db` (FastAPI Depends).
- **Auth:** `from .deps import get_current_user, require_role`.
- **Migrations:** NEVER edit an existing migration. Always `alembic revision --autogenerate -m "message"`.
- **Background Tasks:** Use `asyncio.create_task(...)` in `on_startup`. No Celery.

### Identifiers (Do Not Change)

- Order ID: `ORD-<8 uppercase hex>` (e.g., `ORD-A1B2C3D4`)
- Measurement code: `TH-M-XXXX` (4-digit zero-padded)
- User PK: UUID (string)
- Product PK: slug (string), e.g., `prod-shirt-classic`

---

## Testing

### Backend

```bash
cd backend
pytest --cov=app
```

- Add tests to `backend/tests/test_<area>.py`
- Functions must be `def test_<behaviour>():`

### Frontend

```bash
npm test
```

- Tests co-located as `*.test.jsx` next to source, or under `src/test/`
- Setup file: `src/test/setup.jsx`

---

## Commit Hygiene

- One concern per commit
- Update `CHANGES.md` with entries matching "Feature N:" format

---

## Questions?

Open an issue or contact the maintainers.
