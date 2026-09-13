import os
import pymysql
from dotenv import load_dotenv

load_dotenv("backend/.env")

host = os.getenv("MYSQL_HOST", "127.0.0.1")
port = int(os.getenv("MYSQL_PORT", 3306))
user = os.getenv("MYSQL_USER", "root")
password = os.getenv("MYSQL_PASSWORD", "")
database = os.getenv("MYSQL_DATABASE", "tailorhub")

try:
    connection = pymysql.connect(host=host, port=port, user=user, password=password, database=database)
    with connection.cursor() as cursor:
        try:
            cursor.execute("ALTER TABLE products ADD COLUMN is_sold_out BOOLEAN NOT NULL DEFAULT 0;")
            print("Successfully added is_sold_out to products table.")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("Column is_sold_out already exists.")
            else:
                print(f"Error altering table: {e}")
    connection.commit()
    connection.close()
except Exception as e:
    print(f"Connection error: {e}")
