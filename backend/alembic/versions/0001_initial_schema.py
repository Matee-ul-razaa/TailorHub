"""initial_schema

Revision ID: 07162a7b1b00
Revises:
Create Date: 2026-05-03 18:57:26

This is the canonical initial schema for TailorHub. It was generated via
`alembic revision --autogenerate` against the SQLAlchemy models in app/models.py
and then hand-polished to:

  * Add explicit ON DELETE rules (CASCADE / SET NULL / RESTRICT) on foreign keys
    so the database-level integrity matches the application-level behaviour
    enforced by the DELETE /api/orders and DELETE /api/users endpoints.

  * Give all foreign keys explicit names (fk_<table>_<column>) so future
    migrations can reference them when altering or dropping.

For new installs:
    alembic upgrade head

For evolving the schema later:
    alembic revision --autogenerate -m "describe your change"
    # review the generated file, then:
    alembic upgrade head
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07162a7b1b00'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all TailorHub tables in dependency order."""

    # ── 1. Users ────────────────────────────────────────────────────────────
    # password_hash is nullable so OAuth users (Google/Facebook/Apple) work.
    op.create_table(
        'users',
        sa.Column('id',              sa.String(length=36),  nullable=False),
        sa.Column('email',           sa.String(length=255), nullable=False),
        sa.Column('password_hash',   sa.String(length=255), nullable=True),
        sa.Column('full_name',       sa.String(length=150), nullable=True),
        sa.Column('role',            sa.Enum('customer', 'admin', 'delivery',
                                              name='userrole'), nullable=False),
        sa.Column('auth_provider',   sa.String(length=50),  nullable=True),
        sa.Column('oauth_id',        sa.String(length=255), nullable=True),
        sa.Column('email_verified',  sa.Boolean(),          nullable=False),
        sa.Column('created_at',      sa.DateTime(),         nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email', name='uq_users_email'),
    )
    op.create_index('ix_users_email',    'users', ['email'])
    op.create_index('ix_users_oauth_id', 'users', ['oauth_id'])

    # ── 2. Products ─────────────────────────────────────────────────────────
    # JSON-shaped fields (available_modes, colors, sizes, suit_options) are
    # stored as TEXT and serialized via json.dumps in the application layer.
    op.create_table(
        'products',
        sa.Column('id',                   sa.String(length=64),  nullable=False),
        sa.Column('name',                 sa.String(length=255), nullable=False),
        sa.Column('description',          sa.Text(),             nullable=False),
        sa.Column('price',                sa.Float(),            nullable=False),
        sa.Column('category',             sa.String(length=64),  nullable=False),
        sa.Column('wear_type',            sa.Enum('traditional', 'western',
                                                   name='weartype'), nullable=False),
        sa.Column('image',                sa.Text(),             nullable=False),
        sa.Column('available_modes',      sa.Text(),             nullable=False),
        sa.Column('fabric',               sa.String(length=120), nullable=True),
        sa.Column('colors',               sa.Text(),             nullable=False),
        sa.Column('sizes',                sa.Text(),             nullable=False),
        sa.Column('featured',             sa.Boolean(),          nullable=False),
        sa.Column('has_waistcoat_option', sa.Boolean(),          nullable=False),
        sa.Column('suit_options',         sa.Text(),             nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── 3. Orders ───────────────────────────────────────────────────────────
    # 9-status pipeline reflecting the actual tailoring workflow.
    # ON DELETE rules:
    #   customer_id  → RESTRICT  (app layer blocks deletion of customers with
    #                              active orders; DB enforces this as backstop)
    #   assigned_to  → SET NULL  (deleting a delivery user unassigns their orders
    #                              cleanly so an admin can reassign them)
    op.create_table(
        'orders',
        sa.Column('id',              sa.String(length=32),  nullable=False),
        sa.Column('customer_id',     sa.String(length=36),  nullable=False),
        sa.Column('customer_name',   sa.String(length=150), nullable=False),
        sa.Column('customer_email',  sa.String(length=255), nullable=False),
        sa.Column('status',          sa.Enum('pending', 'confirmed', 'cutting',
                                              'stitching', 'processing', 'ready',
                                              'out_for_delivery', 'delivered',
                                              'cancelled',
                                              name='orderstatus'), nullable=False),
        sa.Column('total_amount',    sa.Float(),            nullable=False),
        sa.Column('advance_amount',  sa.Float(),            nullable=False),
        sa.Column('amount_paid',     sa.Float(),            nullable=False),
        sa.Column('assigned_to',     sa.String(length=36),  nullable=True),
        sa.Column('notes',           sa.Text(),             nullable=True),
        sa.Column('created_at',      sa.DateTime(),         nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id'],
                                 name='fk_orders_customer',
                                 ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id'],
                                 name='fk_orders_assigned_to',
                                 ondelete='SET NULL'),
    )
    op.create_index('ix_orders_customer_id', 'orders', ['customer_id'])
    op.create_index('ix_orders_assigned_to', 'orders', ['assigned_to'])
    op.create_index('ix_orders_status',      'orders', ['status'])
    op.create_index('ix_orders_created_at',  'orders', ['created_at'])

    # ── 4. Order Items ──────────────────────────────────────────────────────
    # Cascades on order delete (mirrors SQLAlchemy cascade='all, delete-orphan').
    # product_id is intentionally NOT a foreign key — products may be deleted
    # from the catalog without losing historical line items in customer orders.
    op.create_table(
        'order_items',
        sa.Column('id',                sa.Integer(),          autoincrement=True, nullable=False),
        sa.Column('order_id',          sa.String(length=32),  nullable=False),
        sa.Column('product_id',        sa.String(length=64),  nullable=False),
        sa.Column('product_name',      sa.String(length=255), nullable=False),
        sa.Column('quantity',          sa.Integer(),          nullable=False),
        sa.Column('unit_price',        sa.Float(),            nullable=False),
        sa.Column('color',             sa.String(length=60),  nullable=True),
        sa.Column('size',              sa.String(length=30),  nullable=True),
        sa.Column('purchase_mode',     sa.String(length=30),  nullable=True),
        sa.Column('garment_category',  sa.String(length=64),  nullable=True),
        sa.Column('measurement_type',  sa.String(length=128), nullable=True),
        sa.Column('measurements_json', sa.Text(),             nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'],
                                 name='fk_order_items_order',
                                 ondelete='CASCADE'),
    )
    op.create_index('ix_order_items_order_id', 'order_items', ['order_id'])

    # ── 5. Measurements ─────────────────────────────────────────────────────
    # Each customer's saved measurement profiles. unique_code (e.g. 'TH-M-1234')
    # lets a tailor look up measurements by short reference.
    # ON DELETE CASCADE: a deleted user's measurements are removed too.
    op.create_table(
        'measurements',
        sa.Column('id',           sa.Integer(),          autoincrement=True, nullable=False),
        sa.Column('user_id',      sa.String(length=36),  nullable=False),
        sa.Column('unique_code',  sa.String(length=20),  nullable=False),
        sa.Column('garment_type', sa.String(length=64),  nullable=False),
        sa.Column('label',        sa.String(length=128), nullable=True),
        sa.Column('data_json',    sa.Text(),             nullable=False),
        sa.Column('created_at',   sa.DateTime(),         nullable=False),
        sa.Column('updated_at',   sa.DateTime(),         nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('unique_code', name='uq_measurements_unique_code'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'],
                                 name='fk_measurements_user',
                                 ondelete='CASCADE'),
    )
    op.create_index('ix_measurements_user_id', 'measurements', ['user_id'])

    # ── 6. Payments ─────────────────────────────────────────────────────────
    # One-to-one with orders. Stripe writes here on successful checkout.
    # last4 and card_brand are populated for card payments; null for COD.
    op.create_table(
        'payments',
        sa.Column('id',             sa.Integer(),         autoincrement=True, nullable=False),
        sa.Column('order_id',       sa.String(length=32), nullable=False),
        sa.Column('method',         sa.Enum('card', 'cod', name='paymentmethod'),
                                     nullable=False),
        sa.Column('status',         sa.Enum('pending', 'completed', 'failed',
                                              'refunded', name='paymentstatus'),
                                     nullable=False),
        sa.Column('amount',         sa.Float(),           nullable=False),
        sa.Column('last4',          sa.String(length=4),  nullable=True),
        sa.Column('card_brand',     sa.String(length=20), nullable=True),
        sa.Column('transaction_id', sa.String(length=64), nullable=True),
        sa.Column('created_at',     sa.DateTime(),        nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id', name='uq_payments_order_id'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'],
                                 name='fk_payments_order',
                                 ondelete='CASCADE'),
    )
    op.create_index('ix_payments_transaction_id', 'payments', ['transaction_id'])

    # ── 7. Inventory ────────────────────────────────────────────────────────
    op.create_table(
        'inventory_items',
        sa.Column('id',             sa.Integer(),         autoincrement=True, nullable=False),
        sa.Column('name',           sa.String(length=255), nullable=False),
        sa.Column('quantity',       sa.Float(),            nullable=False),
        sa.Column('unit',           sa.String(length=50),  nullable=False),
        sa.Column('price_per_unit', sa.Float(),            nullable=False),
        sa.Column('threshold',      sa.Float(),            nullable=False),
        sa.Column('updated_at',     sa.DateTime(),         nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── 8. Khata Entries (Customer Ledger) ──────────────────────────────────
    # Pakistani 'khata' style accounting. type='credit' (customer owes us) vs
    # type='payment' (customer paid us). order_id is nullable so a ledger entry
    # can survive its order being deleted.
    # ON DELETE rules:
    #   customer_id → CASCADE   (a deleted customer's ledger goes with them)
    #   order_id    → SET NULL  (preserves ledger after an order is deleted —
    #                             matches the DELETE /api/orders endpoint logic)
    op.create_table(
        'khata_entries',
        sa.Column('id',          sa.Integer(),         autoincrement=True, nullable=False),
        sa.Column('customer_id', sa.String(length=36), nullable=False),
        sa.Column('order_id',    sa.String(length=32), nullable=True),
        sa.Column('type',        sa.String(length=20), nullable=False),
        sa.Column('amount',      sa.Float(),           nullable=False),
        sa.Column('notes',       sa.Text(),            nullable=True),
        sa.Column('created_at',  sa.DateTime(),        nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id'],
                                 name='fk_khata_customer',
                                 ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'],
                                 name='fk_khata_order',
                                 ondelete='SET NULL'),
    )
    op.create_index('ix_khata_customer_id', 'khata_entries', ['customer_id'])
    op.create_index('ix_khata_order_id',    'khata_entries', ['order_id'])

    # ── 9. Expenses ─────────────────────────────────────────────────────────
    # Business operating expenses (rent, electricity, thread, etc.) used in the
    # /api/khata/summary endpoint to compute net profit.
    op.create_table(
        'expenses',
        sa.Column('id',           sa.Integer(),          autoincrement=True, nullable=False),
        sa.Column('category',     sa.String(length=100), nullable=False),
        sa.Column('amount',       sa.Float(),            nullable=False),
        sa.Column('description',  sa.Text(),             nullable=True),
        sa.Column('expense_date', sa.DateTime(),         nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_expenses_category',     'expenses', ['category'])
    op.create_index('ix_expenses_expense_date', 'expenses', ['expense_date'])


def downgrade() -> None:
    """Drop all tables in reverse dependency order.

    On MySQL/MariaDB, dropping a table automatically drops its indexes, so we
    do not need explicit op.drop_index() calls — and explicit drops would
    actually FAIL with error 1553 ("Cannot drop index … needed in a foreign
    key constraint") because indexes on FK columns can't be dropped while the
    constraint exists. Dropping the table is the atomic safe operation.
    """
    op.drop_table('expenses')
    op.drop_table('khata_entries')
    op.drop_table('inventory_items')
    op.drop_table('payments')
    op.drop_table('measurements')
    op.drop_table('order_items')
    op.drop_table('orders')
    op.drop_table('products')
    op.drop_table('users')
