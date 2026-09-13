from backend.app.database import engine
from sqlalchemy import text

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT COUNT(*) FROM products"))
        print(f"Products count: {result.scalar()}")
except Exception as e:
    print(f"Error: {e}")
