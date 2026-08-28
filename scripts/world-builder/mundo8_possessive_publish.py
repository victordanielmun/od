"""
Mundo 8: Posesivos -- Fase final. Publica el mundo y sus 6 misiones.

Uso:
    python mundo8_possessive_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo7 = next((w for w in worlds if w["key"] == "mundo_7"), None)
mundo8 = next((w for w in worlds if w["key"] == "mundo_8"), None)

if mundo8:
    print(f"[skip] mundo_8 ya existe (id={mundo8['id']})")
else:
    body = {
        "key": "mundo_8",
        "name": "Possession Point",
        "description_en": "A world about possessive adjectives -- my/your/his/her/its/our/their -- reinforced through repetition across three contexts.",
        "order": (mundo7["order"] + 1) if mundo7 else 8,
        "challenge_tags": ["possessive-pronouns"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_8",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo8 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_8")

WORLD8_ID = mundo8["id"]
print("mundo_8 id:", WORLD8_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("possessive_village_1", 0, False),
    ("possessive_village_2", 1, False),
    ("possessive_square", 2, False),
    ("combate_possessive_1", 3, False),
    ("combate_possessive_2", 4, False),
    ("combate_possessive_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD8_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD8_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD8_ID}/pool-health", token=TOKEN)
print("\nmundo_8 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD8_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
