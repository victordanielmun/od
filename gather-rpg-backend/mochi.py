import os
import psycopg2

conn = psycopg2.connect(
    host=os.getenv('DB_HOST', '127.0.0.1'),
    port=int(os.getenv('DB_PORT', '5433')),
    user=os.getenv('DB_USER', 'postgres'),
    password=os.getenv('DB_PASSWORD', ''),
    dbname=os.getenv('DB_NAME', 'gather_rpg')
)
cur = conn.cursor()
cur.execute("SELECT * FROM npc_definitions WHERE name ILIKE '%Mochi%';")
print(cur.fetchall())
