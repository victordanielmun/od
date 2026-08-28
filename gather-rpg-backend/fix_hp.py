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
cur.execute("UPDATE player_stats SET hp_current = hp_max WHERE hp_current = 0;")
cur.execute("UPDATE player_stats SET mp_current = mp_max WHERE mp_current = 0;")
conn.commit()
print("Updated player stats")
