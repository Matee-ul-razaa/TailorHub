# Post-XAMPP Setup for TailorHub

Run these commands in order after XAMPP is installed.

## 1. Start MySQL
- Open XAMPP Manager
- Click "Start" next to MySQL
- Verify it says "Running" (green)

## 2. Create Database
```bash
# Connect to MySQL
mysql -u root -p

# Inside MySQL:
CREATE DATABASE tailorhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES;
EXIT;
```

## 3. Run Migrations
```bash
cd backend
source venv/bin/activate
alembic upgrade head
```

## 4. Start Backend
```bash
source venv/bin/activate
uvicorn app.main:app --port 3001 --reload
```

## 5. Start Frontend (in another terminal)
```bash
# From project root
npm run dev
```

## Verify
- Frontend: http://localhost:8080
- Backend API: http://localhost:3001/docs

## Notes
- MySQL password is empty by default in XAMPP
- If MySQL asks for password, just press Enter
- If port 3306 is busy, XAMPP MySQL may use 3307
