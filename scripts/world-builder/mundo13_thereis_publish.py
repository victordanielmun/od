"""
Mundo 13: There is / There are -- Fase final. Publica el mundo y sus 6
misiones. Cierra el Bloque A del roadmap (gramatica base).

Uso:
    python mundo13_thereis_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo12 = next((w for w in worlds if w["key"] == "mundo_12"), None)
mundo13 = next((w for w in worlds if w["key"] == "mundo_13"), None)

if mundo13:
    print(f"[skip] mundo_13 ya existe (id={mundo13['id']})")
else:
    body = {
        "key": "mundo_13",
        "name": "Thereabouts",
        "description_en": "A world about describing what exists in a place -- There is a/an ___ (singular), There are + number + ___s (plural) -- reinforced through repetition across three contexts. Closes Block A of the grammar roadmap.",
        "order": (mundo12["order"] + 1) if mundo12 else 13,
        "challenge_tags": ["there-is-are"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_13",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo13 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_13")

WORLD13_ID = mundo13["id"]
print("mundo_13 id:", WORLD13_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("thereis_grove_1", 0, False),
    ("thereis_grove_2", 1, False),
    ("thereis_square", 2, False),
    ("combate_thereis_1", 3, False),
    ("combate_thereis_2", 4, False),
    ("combate_thereis_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD13_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD13_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD13_ID}/pool-health", token=TOKEN)
print("\nmundo_13 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD13_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
