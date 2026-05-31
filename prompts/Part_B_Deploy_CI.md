# TailorHub — Part B: Deployment & CI

> Paste this file into your AI coding assistant. End with: *"Start with B1. After each item completes, stop and report. Do not start the next until I tell you to."*

**Goal**: turn the project into a deployable, CI-guarded service. Add a multi-stage Dockerfile that bundles the SPA into the backend image, deploy configs for Render and Vercel, and a GitHub Actions workflow that runs lint + tests + build + Docker smoke on every PR.

**Effort**: ~7 hours (B1 ≈ 3h, B2/B3 ≈ 2h, B4 ≈ 2h)

**Prerequisite**: Part A is done (so CI has tests to run).

---

## Project context

### What's already there

- `firebase.json` — Hosting config for static frontend deploy (rewrites all routes to `index.html`)
- `backend/requirements.txt` — Python deps including FastAPI, uvicorn, SQLAlchemy 2, PyMySQL
- `package.json` — npm scripts: `dev`, `build`, `lint`, `test`, `preview`
- `.env` template at `backend/.env.example` enumerating all required env vars

### What's missing

- No `Dockerfile`
- No `.dockerignore`
- No `render.yaml` or `vercel.json`
- No `.github/workflows/` directory
- The backend serves only `/api/*` — no SPA static-mount

---

# B1. Multi-stage Dockerfile

Goal: a single image that contains the built React SPA AND runs the FastAPI backend. Backend serves the SPA from `/` and the API from `/api/*`.

## B1.1 Create `Dockerfile` at repo root

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

## B1.2 Add SPA static-mount to `backend/app/main.py`

At the bottom of the file, **after** the existing `app.include_router(...)` calls:

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
        # Don't intercept API or docs paths
        if full_path.startswith(("api/", "health", "docs", "redoc", "openapi.json")):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        index = os.path.join(_STATIC_DIR, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return JSONResponse({"detail": "Not Found"}, status_code=404)
```

The `if os.path.isdir(_STATIC_DIR)` guard means this is a no-op when the static dir doesn't exist (i.e. local dev without a build), so it doesn't disrupt the existing dev workflow.

Also add this import at the top of the file (alongside existing imports):
```python
import os
from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
```

## B1.3 Create `.dockerignore` at repo root

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
.eslintcache
```

The `.env` exclusion is critical — never bake secrets into the image.

## B1.4 Acceptance — B1

- [ ] `docker build -t tailorhub .` succeeds on a clean clone
- [ ] `docker run -p 8000:8000 -e JWT_SECRET_KEY=$(python -c 'import secrets;print(secrets.token_hex(32))') -e DEFAULT_ADMIN_PASSWORD='Strong@Pass1!' -e MYSQL_HOST=... -e MYSQL_PASSWORD=... -e MYSQL_DATABASE=tailorhub tailorhub` boots, runs migrations, serves both `/api/health` AND the SPA at `/`
- [ ] Logging in as the seed admin works in the dockerized app
- [ ] Image size under 1.5 GB (verify with `docker images tailorhub`)

---

# B2. `render.yaml` Blueprint

Render is the recommended target for the backend. This file lets you spin up the whole environment with one click from the Render dashboard.

## B2.1 Create `render.yaml` at repo root

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

`sync: false` = secret values that you fill in via the Render dashboard, never committed.

## B2.2 MySQL vs Postgres on Render

**Render's managed `databases:` is Postgres-only.** TailorHub uses MySQL via PyMySQL. Two options:

- **(A) External MySQL provider** (PlanetScale, Aiven, Filess.io) — recommended. Codebase stays unchanged. Set `MYSQL_HOST/USER/PASSWORD` in Render dashboard.
- **(B) Switch to Postgres**:
  - Add `psycopg2-binary` to `backend/requirements.txt`
  - Change `database_url` in `backend/app/config.py`:
    ```python
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}"
    ```
  - Add `databases:` block to `render.yaml`

Pick one. **Document the choice in `CHANGES.md`** before any deploy.

## B2.3 Acceptance — B2

- [ ] First deploy succeeds (build + migrations + health check 200)
- [ ] `https://<your-app>.onrender.com/health` returns `{"ok": true}`
- [ ] Login as seed admin works on the deployed URL
- [ ] All env vars marked `sync: false` are filled in via dashboard

---

# B3. `vercel.json` (only if frontend is hosted separately)

**Skip this if the SPA is bundled into the backend Docker image (B1).** Use it only when frontend deploys to Vercel and backend to Render separately.

## B3.1 Create `vercel.json` at repo root

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

Replace `tailorhub-api.onrender.com` with your actual Render URL.

## B3.2 Acceptance — B3

- [ ] `vercel deploy` succeeds
- [ ] Deployed SPA calls reach the Render API (no CORS errors)
- [ ] `CORS_ORIGINS` on Render includes the Vercel domain

---

# B4. GitHub Actions CI

Three jobs: frontend (lint + test + build), backend (pytest with coverage), docker-build (smoke build, depends on first two).

## B4.1 Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  frontend:
    name: Frontend (lint + test + build)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
        env:
          VITE_API_BASE_URL: http://localhost:3001
      - uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: dist
          retention-days: 7

  backend:
    name: Backend (pytest)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
          cache-dependency-path: |
            backend/requirements.txt
            backend/requirements-dev.txt
      - run: |
          pip install --upgrade pip
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
      - env:
          MYSQL_DATABASE: ""
          JWT_SECRET_KEY: test-secret-key-minimum-32-characters-long-for-ci
          DEFAULT_ADMIN_EMAIL: admin@test.local
          DEFAULT_ADMIN_PASSWORD: TestAdmin@2026!
          DEFAULT_ADMIN_NAME: Test Admin
        run: pytest --cov=app --cov-report=term-missing --cov-report=xml
      - uses: actions/upload-artifact@v4
        with:
          name: backend-coverage
          path: backend/coverage.xml
          retention-days: 7

  docker-build:
    name: Docker image (smoke build)
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

## B4.2 Acceptance — B4

- [ ] First PR triggers all 3 jobs
- [ ] All 3 jobs pass green
- [ ] Push to `main`/`master` runs the workflow
- [ ] Intentionally breaking one test causes the workflow to fail (verify, then revert)
- [ ] Docker job runs only after frontend + backend pass

---

# CHANGES.md template (append after B is done)

```markdown
### Feature 8: Docker single-image deploy
- **Files added**: `Dockerfile`, `.dockerignore`
- **Files changed**: `backend/app/main.py` — SPA static-mount + fallback handler
- **Run locally**: `docker build -t tailorhub . && docker run -p 8000:8000 ... tailorhub`

### Feature 9: GitHub Actions CI
- **Files added**: `.github/workflows/ci.yml`
- **Jobs**: frontend (lint/test/build) → backend (pytest+coverage) → docker-build smoke
- **Triggers**: push/PR to main and master

### Feature 10: Render + Vercel deploy configs
- **Files added**: `render.yaml`, `vercel.json`
- **Render**: one-click Blueprint deploy of the backend Docker image
- **Vercel**: optional frontend-only deploy with /api rewrite
- **MySQL note**: chose option (A) external MySQL via PlanetScale  [or update to (B) if you picked Postgres]
```

---

## Hard rules (do not break)

- Never commit `.env` files — `.dockerignore` and `.gitignore` exclude them. Verify before pushing.
- Render env vars marked `sync: false` are set in the dashboard, NOT in `render.yaml`. Do not paste secrets into the YAML.
- Do not edit existing Alembic migrations to "fix" anything that breaks the Docker `alembic upgrade head` step. Create a NEW migration if you need a schema change.
- The Docker CMD runs migrations BEFORE starting uvicorn. If migrations fail, the container fails fast — that's intentional.
- The CI workflow must run on `pull_request`, not just `push`. Don't change that.
- The backend test env in CI explicitly sets `MYSQL_DATABASE=""` to force SQLite — do not override this.

---

**Stop after B1 and report. Wait for human approval before starting B2.**
