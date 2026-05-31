# ✂️ TailorHub

**TailorHub** is a comprehensive, full-stack web application designed to digitize and streamline the bespoke tailoring business in Pakistan. It bridges the gap between traditional tailoring craftsmanship and modern e-commerce by providing a seamless experience for customers, delivery riders, and shop administrators.

---

## 🚀 Features

### For Customers
*   **Bilingual Interface:** Full support for English and Urdu (RTL) with 250+ translation keys.
*   **Secure Authentication:** Email verification with OTP, Google/Facebook OAuth (Apple WIP), and JWT-based sessions.
*   **Smart Catalog:** Browse tailored clothing with filtering (traditional, western, ready-to-wear, unstitched).
*   **Customization Engine:** Specify body measurements, fabric colors, and suit options during checkout.
*   **Order Tracking:** 9-state order pipeline from `pending` to `delivered` with progress indicators.
*   **PDF Invoicing:** Branded invoices with scannable QR codes, auto-emailed on delivery.
*   **Payments:** Stripe Checkout (card) and Cash-on-Delivery (COD) options.

#### Known Limitations
*   **Apple Sign-In:** Basic OAuth mapping exists; full E2E testing pending (marked WIP).
*   **Bootstrap:** Present but on deprecation path — migrating to Tailwind/shadcn.

### For Administrators
*   **God-Mode Dashboard:** Complete overview of the tailoring business.
*   **Khata (Ledger) System:** Track revenues, outstanding balances, custom credit entries, and daily shop expenses.
*   **Order & Inventory Management:** Update order statuses, assign delivery riders, and manage stock thresholds.
*   **Invoice Management:** View all system-wide invoices, manually mark as paid (for Cash-on-Delivery), and re-send PDF receipts.
*   **Team Roles:** Invite and manage staff with specific roles (`admin`, `delivery`, `customer`).

### For Delivery Riders
*   **Restricted Rider App:** A clean, focused interface that hides customer shopping features and only displays active deliveries.
*   **Order Tracking Updates:** Riders can update orders to `delivered` in real-time, instantly triggering backend invoice balance generation.

---

## 🛠️ Technology Stack

**Frontend:**
*   React 18 + Vite
*   React Router 6
*   shadcn/ui (Radix) + Bootstrap 5 utility classes
*   Lucide React (Icons)
*   Sonner (Toast Notifications)

**Backend:**
*   FastAPI (Python 3.10+)
*   SQLAlchemy 2.0 (ORM)
*   MySQL (Database)
*   Alembic (Database Migrations)
*   `fpdf2` & `qrcode[pil]` (PDF Invoice Generation)
*   Stripe SDK (Payments)
*   Python `smtplib` (Email Service)

---

## 💻 Local Setup Instructions

### 1. Database Setup
Ensure you have MySQL running locally. Create the database:
```sql
CREATE DATABASE IF NOT EXISTS tailorhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend Setup
Navigate to the `backend` directory and set up your Python environment:
```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations to build the tables
alembic upgrade head
```

Create a `.env` file inside the `backend` folder (you can copy `.env.example`) and fill in your MySQL credentials and Stripe API keys.

Start the backend server:
```bash
uvicorn app.main:app --reload --port 3001
```

### 3. Frontend Setup
Open a new terminal and navigate to the project root:
```bash
# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend will be available at `http://localhost:8080/`.

---

## 🔒 Default Admin Account
Upon running the backend migrations, a default administrator account is seeded:
*   **Email:** `admin@tailorhub.pk`
*   **Password:** `TailorHub@Dev2026!`

---

## 📈 Stripe Webhook Testing (Local)
To test payments locally, use the Stripe CLI to forward events to your local backend:
```bash
stripe listen --forward-to localhost:3001/api/payments/webhook
```

---

## 🧪 Testing

### Backend Tests (pytest)
```bash
cd backend
pip install -r requirements-dev.txt
pytest --cov=app
```
- 32 tests covering auth, OTP, webhooks, orders
- Coverage: 70%+ on core modules

### Frontend Tests (Vitest)
```bash
npm test
```
- 41 tests covering API, CartContext, AuthContext, pages
- Cart pricing math is locked (base, modifiers, combinations)

---

## ⚙️ Configuration

Key environment variables (see `backend/.env.example`):

| Variable | Purpose | Required |
|----------|---------|----------|
| `JWT_SECRET_KEY` | Signing key for tokens (≥32 chars) | Yes |
| `DEFAULT_ADMIN_PASSWORD` | Seed admin password (≥12 chars) | Yes |
| `MYSQL_DATABASE` | MySQL database name | Yes* |
| `MYSQL_PASSWORD` | MySQL password | Yes* |
| `STRIPE_SECRET_KEY` | Stripe payments (sk_test_...) | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification | No |
| `GOOGLE_CLIENT_ID` | Google OAuth | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | No |
| `SMTP_USER` / `SMTP_PASSWORD` | Gmail App Password for OTP email | No |
| `GEMINI_API_KEY` | Virtual Try-On AI feature | No |

*Leave `MYSQL_DATABASE` empty to use SQLite (dev/test only).

---

## 📁 Architecture Notes

- **Token storage:** `localStorage['tailorhub-auth-token']` and `tailorhub-auth-session`
- **API client:** All requests go through `apiRequest()` in `src/lib/api.jsx`
- **Router naming:** `routers_<domain>.py` pattern in backend
- **ID formats:**
  - Order: `ORD-<8 hex>` (e.g., `ORD-A1B2C3D4`)
  - Measurement: `TH-M-XXXX` (4-digit zero-padded)
  - User: UUID string
  - Product: slug (e.g., `prod-shirt-classic`)
- **Migrations:** Alembic — never edit existing migrations, always create new

---
*TailorHub — Crafted for You.*
