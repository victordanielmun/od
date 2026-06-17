import psycopg2
conn = psycopg2.connect(
    host='18.221.199.221', port=5433, user='postgres', password='postgres', dbname='gather_rpg'
)
cur = conn.cursor()
cur.execute("SELECT * FROM npc_definitions WHERE name ILIKE '%Mochi%';")
print(cur.fetchall())
