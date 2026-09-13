-- ============================================================================
-- TailorHub MySQL Schema  —  CANONICAL VERSION
-- ============================================================================
-- Source of truth: backend/app/models.py (SQLAlchemy)
-- This file is generated to mirror those models exactly. If you change models.py,
-- regenerate this file or use Alembic migrations to evolve the live database.
--
-- For new installs:
--   mysql -u root -p < database_schema.sql
--
-- For existing installs evolving over time:
--   Use Alembic migrations from backend/alembic/ instead of running this file
--   against a populated database (it will fail because tables already exist).
--
-- The default admin user is NOT created here — it is auto-seeded on FastAPI
-- startup using DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD from .env, with
-- a properly bcrypt-hashed password.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS tailorhub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tailorhub;


-- ── 1. USERS ────────────────────────────────────────────────────────────────
-- Customers, admins, and delivery staff. UUID primary key (matches SQLAlchemy
-- str(uuid.uuid4()) in the User model). password_hash is nullable so OAuth
-- users (Google/Facebook/Apple) can sign in without a local password.
CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(36)   NOT NULL,
  email           VARCHAR(255)  NOT NULL,
  password_hash   VARCHAR(255)  NULL,
  full_name       VARCHAR(150)  NULL,
  role            ENUM('customer', 'admin', 'delivery') NOT NULL DEFAULT 'customer',
  auth_provider   VARCHAR(50)   NULL DEFAULT 'local',
  oauth_id        VARCHAR(255)  NULL,
  email_verified  BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_email       (email),
  KEY idx_users_oauth_id    (oauth_id),
  KEY idx_users_role        (role)
) ENGINE=InnoDB;


-- ── 2. PRODUCTS ─────────────────────────────────────────────────────────────
-- Catalog items. The id is a slug-style string (e.g., 'prod-shirt-classic').
-- JSON-shaped fields (available_modes, colors, sizes, suit_options) are stored
-- as TEXT because the SQLAlchemy model uses Text and serializes via json.dumps.
CREATE TABLE IF NOT EXISTS products (
  id                    VARCHAR(64)    NOT NULL,
  name                  VARCHAR(255)   NOT NULL,
  description           TEXT           NOT NULL,
  price                 DOUBLE         NOT NULL,
  category              VARCHAR(64)    NOT NULL,
  wear_type             ENUM('traditional', 'western') NOT NULL,
  image                 TEXT           NOT NULL,
  available_modes       TEXT           NOT NULL,
  fabric                VARCHAR(120)   NULL,
  colors                TEXT           NOT NULL,
  sizes                 TEXT           NOT NULL,
  featured              BOOLEAN        NOT NULL DEFAULT FALSE,
  has_waistcoat_option  BOOLEAN        NOT NULL DEFAULT FALSE,
  suit_options          TEXT           NULL,
  brand                 VARCHAR(100)   NULL,
  is_sold_out           BOOLEAN        NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  KEY idx_products_category  (category),
  KEY idx_products_featured  (featured)
) ENGINE=InnoDB;


-- ── 3. ORDERS ───────────────────────────────────────────────────────────────
-- Nine-status pipeline reflecting the actual tailoring workflow.
-- assigned_to references the delivery staff user handling the order.
-- ON DELETE: assigned_to uses SET NULL so the user-delete endpoint can clean
-- up references without orphaning order rows. customer_id uses RESTRICT
-- because the application layer (DELETE /api/users/{id}) already blocks
-- deletion of customers with active orders.
CREATE TABLE IF NOT EXISTS orders (
  id              VARCHAR(32)   NOT NULL,
  customer_id     VARCHAR(36)   NOT NULL,
  customer_name   VARCHAR(150)  NOT NULL,
  customer_email  VARCHAR(255)  NOT NULL,
  status          ENUM(
                    'pending',
                    'confirmed',
                    'cutting',
                    'stitching',
                    'processing',
                    'ready',
                    'out_for_delivery',
                    'delivered',
                    'cancelled'
                  ) NOT NULL DEFAULT 'pending',
  total_amount    DOUBLE        NOT NULL,
  advance_amount  DOUBLE        NOT NULL DEFAULT 0,
  amount_paid     DOUBLE        NOT NULL DEFAULT 0,
  assigned_to     VARCHAR(36)   NULL,
  notes           TEXT          NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_customer_id  (customer_id),
  KEY idx_orders_assigned_to  (assigned_to),
  KEY idx_orders_status       (status),
  KEY idx_orders_created_at   (created_at),
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- ── 4. ORDER ITEMS ──────────────────────────────────────────────────────────
-- Cascades on order delete to mirror SQLAlchemy's cascade='all, delete-orphan'.
-- product_id is intentionally NOT a foreign key — products may be deleted from
-- the catalog without losing historical line items in customer orders.
CREATE TABLE IF NOT EXISTS order_items (
  id                 INT            NOT NULL AUTO_INCREMENT,
  order_id           VARCHAR(32)    NOT NULL,
  product_id         VARCHAR(64)    NOT NULL,
  product_name       VARCHAR(255)   NOT NULL,
  quantity           INT            NOT NULL,
  unit_price         DOUBLE         NOT NULL,
  color              VARCHAR(60)    NULL,
  size               VARCHAR(30)    NULL,
  purchase_mode      VARCHAR(30)    NULL,
  garment_category   VARCHAR(64)    NULL,
  measurement_type   VARCHAR(128)   NULL,
  measurements_json  TEXT           NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order_id  (order_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ── 5. MEASUREMENTS ─────────────────────────────────────────────────────────
-- Each customer's saved measurement profiles. unique_code (e.g. 'TH-M-1234')
-- lets a tailor look up measurements by short reference.
-- ON DELETE CASCADE: when a user is deleted, their measurements go with them.
CREATE TABLE IF NOT EXISTS measurements (
  id            INT            NOT NULL AUTO_INCREMENT,
  user_id       VARCHAR(36)    NOT NULL,
  unique_code   VARCHAR(20)    NOT NULL,
  garment_type  VARCHAR(64)    NOT NULL,
  label         VARCHAR(128)   NULL,
  data_json     TEXT           NOT NULL,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_measurements_unique_code (unique_code),
  KEY idx_measurements_user_id (user_id),
  CONSTRAINT fk_measurements_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ── 6. PAYMENTS ─────────────────────────────────────────────────────────────
-- One-to-one with orders. Stripe writes here on successful checkout. last4 and
-- card_brand are populated for card payments; null for COD.
-- Cascades on order delete to mirror SQLAlchemy's cascade='all, delete-orphan'.
CREATE TABLE IF NOT EXISTS payments (
  id              INT            NOT NULL AUTO_INCREMENT,
  order_id        VARCHAR(32)    NOT NULL,
  method          ENUM('card', 'cod') NOT NULL,
  status          ENUM('pending', 'completed', 'failed', 'refunded')
                    NOT NULL DEFAULT 'pending',
  amount          DOUBLE         NOT NULL,
  last4           VARCHAR(4)     NULL,
  card_brand      VARCHAR(20)    NULL,
  transaction_id  VARCHAR(64)    NULL,
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_order_id (order_id),
  KEY idx_payments_transaction_id (transaction_id),
  CONSTRAINT fk_payments_order
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ── 7. INVENTORY ────────────────────────────────────────────────────────────
-- Fabric and supply tracking for the tailor shop. threshold triggers low-stock
-- alerts in the admin dashboard via /api/inventory/alerts.
CREATE TABLE IF NOT EXISTS inventory_items (
  id              INT            NOT NULL AUTO_INCREMENT,
  name            VARCHAR(255)   NOT NULL,
  quantity        DOUBLE         NOT NULL DEFAULT 0,
  unit            VARCHAR(50)    NOT NULL DEFAULT 'meters',
  price_per_unit  DOUBLE         NOT NULL,
  threshold       DOUBLE         NOT NULL DEFAULT 10,
  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;


-- ── 8. KHATA ENTRIES (Customer Ledger) ─────────────────────────────────────
-- Pakistani 'khata' style accounting. type='credit' (customer owes us) vs
-- type='payment' (customer paid us). order_id is nullable so an entry can
-- survive its order being deleted (the DELETE /api/orders endpoint NULLs this
-- column rather than removing the ledger row).
CREATE TABLE IF NOT EXISTS khata_entries (
  id           INT            NOT NULL AUTO_INCREMENT,
  customer_id  VARCHAR(36)    NOT NULL,
  order_id     VARCHAR(32)    NULL,
  type         VARCHAR(20)    NOT NULL,
  amount       DOUBLE         NOT NULL,
  notes        TEXT           NULL,
  created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_khata_customer_id  (customer_id),
  KEY idx_khata_order_id     (order_id),
  KEY idx_khata_created_at   (created_at),
  CONSTRAINT fk_khata_customer
    FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_khata_order
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL
) ENGINE=InnoDB;


-- ── 9. EXPENSES ─────────────────────────────────────────────────────────────
-- Business operating expenses (rent, electricity, thread, etc.) used in the
-- /api/khata/summary endpoint to compute net profit.
CREATE TABLE IF NOT EXISTS expenses (
  id            INT            NOT NULL AUTO_INCREMENT,
  category      VARCHAR(100)   NOT NULL,
  amount        DOUBLE         NOT NULL,
  description   TEXT           NULL,
  expense_date  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_category      (category),
  KEY idx_expenses_expense_date  (expense_date)
) ENGINE=InnoDB;


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- The default admin user is auto-seeded by FastAPI on startup (see main.py
-- seed_defaults). Do NOT add an INSERT statement for it here, because the
-- password must be bcrypt-hashed at runtime using the application's hashing
-- function — a hash literal in SQL would either be invalid or insecure.
-- ============================================================================
