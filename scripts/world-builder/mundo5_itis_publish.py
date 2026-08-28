"""
Mundo 5: "Eso es... (bueno/grande)" -- Fase final.

Uso:
    python mundo5_itis_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo4 = next((w for w in worlds if w["key"] == "mundo_4"), None)
mundo5 = next((w for w in worlds if w["key"] == "mundo_5"), None)

if mundo5:
    print(f"[skip] mundo_5 ya existe (id={mundo5['id']})")
else:
    body = {
        "key": "mundo_5",
        "name": "Wonderland",
        "description_en": "A world about 'it is a/an [adjective] ___' -- describing objects and animals -- the first contact with adjectives, reinforced through repetition across three contexts.",
        "order": (mundo4["order"] + 1) if mundo4 else 5,
        "challenge_tags": ["to-be-it-is-adj"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_5",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo5 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_5")

WORLD5_ID = mundo5["id"]
print("mundo_5 id:", WORLD5_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("itis_village_1", 0, False),
    ("itis_village_2", 1, False),
    ("itis_square", 2, False),
    ("combate_itis_1", 3, False),
    ("combate_itis_2", 4, False),
    ("combate_itis_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD5_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD5_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD5_ID}/pool-health", token=TOKEN)
print("\nmundo_5 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD5_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
