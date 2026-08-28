"""
Mundo 29: Futuro (going to vs will) -- Fase final. Publica el mundo y
sus 6 misiones. Cierra el Bloque C completo (mundos 21-29).

Uso:
    python mundo29_futuro_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo28 = next((w for w in worlds if w["key"] == "mundo_28"), None)
mundo29 = next((w for w in worlds if w["key"] == "mundo_29"), None)

if mundo29:
    print(f"[skip] mundo_29 ya existe (id={mundo29['id']})")
else:
    body = {
        "key": "mundo_29",
        "name": "Tomorrow Town",
        "description_en": "A world about the future tense -- going to (a planned decision, reusing am/is/are) vs will (a spontaneous decision, promise, or prediction, no to be needed) -- closing Block C, reinforced through repetition across three contexts.",
        "order": (mundo28["order"] + 1) if mundo28 else 29,
        "challenge_tags": ["future-tense"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_29",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo29 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_29")

WORLD29_ID = mundo29["id"]
print("mundo_29 id:", WORLD29_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("future_grove_1", 0, False),
    ("future_grove_2", 1, False),
    ("future_square", 2, False),
    ("combate_future_1", 3, False),
    ("combate_future_2", 4, False),
    ("combate_future_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD29_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD29_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD29_ID}/pool-health", token=TOKEN)
print("\nmundo_29 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD29_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
