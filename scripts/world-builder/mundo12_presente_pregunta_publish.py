"""
Mundo 12: Presente Simple (pregunta) -- Fase final. Publica el mundo y
sus 6 misiones. Cierra el bloque "presente simple" (mundos 10-12).

Uso:
    python mundo12_presente_pregunta_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo11 = next((w for w in worlds if w["key"] == "mundo_11"), None)
mundo12 = next((w for w in worlds if w["key"] == "mundo_12"), None)

if mundo12:
    print(f"[skip] mundo_12 ya existe (id={mundo12['id']})")
else:
    body = {
        "key": "mundo_12",
        "name": "Boulder Query",
        "description_en": "A world about simple present yes/no questions -- Do you...? Does he/she/it...? -- and short answers, closing the simple-present block, reinforced through repetition across three contexts.",
        "order": (mundo11["order"] + 1) if mundo11 else 12,
        "challenge_tags": ["present-simple-question"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_12",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo12 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_12")

WORLD12_ID = mundo12["id"]
print("mundo_12 id:", WORLD12_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("doyou_grove", 0, False),
    ("doeshe_grove", 1, False),
    ("doesit_square", 2, False),
    ("combate_doyou_1", 3, False),
    ("combate_doyou_2", 4, False),
    ("combate_doyou_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD12_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD12_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD12_ID}/pool-health", token=TOKEN)
print("\nmundo_12 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD12_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
