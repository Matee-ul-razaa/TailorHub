from sqlalchemy import text
from app.database import engine

with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE inventory_items
        ADD COLUMN is_sold_out BOOLEAN NOT NULL DEFAULT FALSE;
    """))
    conn.commit()
    print("Column is_sold_out added successfully.")
