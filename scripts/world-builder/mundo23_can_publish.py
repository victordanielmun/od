"""
Mundo 23: Can / Can't -- Fase final. Publica el mundo y sus 6 misiones.
Tercer mundo del Bloque C.

Uso:
    python mundo23_can_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo22 = next((w for w in worlds if w["key"] == "mundo_22"), None)
mundo23 = next((w for w in worlds if w["key"] == "mundo_23"), None)

if mundo23:
    print(f"[skip] mundo_23 ya existe (id={mundo23['id']})")
else:
    body = {
        "key": "mundo_23",
        "name": "Can-Do Cavern",
        "description_en": "A world about the modal verb can/can't -- ability, expressing what you can and can't do, always in base form with no -s even with he/she/it -- reinforced through repetition across three contexts.",
        "order": (mundo22["order"] + 1) if mundo22 else 23,
        "challenge_tags": ["can-cant"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_23",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo23 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_23")

WORLD23_ID = mundo23["id"]
print("mundo_23 id:", WORLD23_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("can_grove_1", 0, False),
    ("can_grove_2", 1, False),
    ("can_square", 2, False),
    ("combate_can_1", 3, False),
    ("combate_can_2", 4, False),
    ("combate_can_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD23_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD23_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD23_ID}/pool-health", token=TOKEN)
print("\nmundo_23 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD23_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
