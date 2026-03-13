from app.db.database import engine
from sqlalchemy import inspect

try:
    inspector = inspect(engine)
    columns = inspector.get_columns('learning_challenges')
    print("=== SCHEMA PARA learning_challenges ===")
    for col in columns:
        print(f"{col['name']}: {col['type']}")
except Exception as e:
    print("Error:", e)
