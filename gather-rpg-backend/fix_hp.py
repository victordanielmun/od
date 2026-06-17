import psycopg2
conn = psycopg2.connect(
    host='18.221.199.221', port=5433, user='postgres', password='postgres', dbname='gather_rpg'
)
cur = conn.cursor()
cur.execute("UPDATE player_stats SET hp_current = hp_max WHERE hp_current = 0;")
cur.execute("UPDATE player_stats SET mp_current = mp_max WHERE mp_current = 0;")
conn.commit()
print("Updated player stats")
