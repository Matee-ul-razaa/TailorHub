"""Alembic migration environment — TailorHub Backend.

Key wiring:
  * DB URL is sourced from the same `app.config.settings` object used by FastAPI,
    so there is ONE source of truth (.env / environment variables).
  * target_metadata points at Base.metadata so `--autogenerate` can diff the live
    schema against the current models.
"""
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ---------------------------------------------------------------------------
# Make sure `app` package is importable from this env.py regardless of CWD.
# alembic.ini sets `prepend_sys_path = .` which adds the backend/ directory,
# so `from app.xxx import …` always resolves correctly.
# ---------------------------------------------------------------------------

# Load the Alembic Config object (gives access to values in alembic.ini).
config = context.config

# Set up Python logging as configured in alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------------------
# Import models & settings AFTER sys.path is ready.
# ---------------------------------------------------------------------------
from app.database import Base          # noqa: E402  (Base.metadata holds all tables)
from app.config import settings        # noqa: E402  (reads .env)
import app.models  # noqa: E402, F401  (registers all ORM models onto Base.metadata)

# Override sqlalchemy.url from alembic.ini with the real URL from .env.
config.set_main_option("sqlalchemy.url", settings.database_url)

# This is what Alembic diffs against when generating --autogenerate migrations.
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Migration runners
# ---------------------------------------------------------------------------

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection required).

    A URL is emitted into the generated SQL script rather than connecting to
    the database directly.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,           # detect column type changes
        compare_server_default=True, # detect server_default changes
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connects to the live database)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,           # detect column type changes
            compare_server_default=True, # detect server_default changes
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
