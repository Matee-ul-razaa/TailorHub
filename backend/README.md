# TailorHub Python Backend (FastAPI + MySQL)

## 1) Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## 2) Create DB schema

Use your MySQL client and run:

```sql
CREATE DATABASE IF NOT EXISTS tailorhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Tables are auto-created on startup by SQLAlchemy.

## 3) Run server

```bash
uvicorn app.main:app --reload --port 3001
```

## 4) API base URL

Frontend already has:

- `VITE_API_BASE_URL=http://localhost:3001`

## 5) Default admin (auto seeded)

- Email: `admin@tailorhub.pk`
- Password: `admin123`

## Implemented API groups

- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- Products: `/api/products` (public list + admin CRUD)
- Orders: `/api/orders` (create/list/status/assign/tracking)
- Team/roles: `/api/users/team`, `/api/users/{id}/role`
