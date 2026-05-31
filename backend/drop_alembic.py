from sqlalchemy import create_engine, text
engine = create_engine('mysql+pymysql://root:@localhost:3306/tailorhub')
with engine.connect() as conn:
    conn.execute(text('DROP TABLE IF EXISTS alembic_version'))
    conn.commit()
