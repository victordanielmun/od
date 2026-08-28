"""
Mundo 22: Presente Continuo -- Fase final. Publica el mundo y sus 6
misiones. Segundo mundo del Bloque C.

Uso:
    python mundo22_continuo_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo21 = next((w for w in worlds if w["key"] == "mundo_21"), None)
mundo22 = next((w for w in worlds if w["key"] == "mundo_22"), None)

if mundo22:
    print(f"[skip] mundo_22 ya existe (id={mundo22['id']})")
else:
    body = {
        "key": "mundo_22",
        "name": "Motion Meadow",
        "description_en": "A world about the present continuous tense -- am/is/are + verb-ing -- describing actions happening right now, contrasted directly with the simple present (Worlds 10-12), reinforced through repetition across three contexts.",
        "order": (mundo21["order"] + 1) if mundo21 else 22,
        "challenge_tags": ["present-continuous"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_22",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo22 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_22")

WORLD22_ID = mundo22["id"]
print("mundo_22 id:", WORLD22_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("ing_grove_1", 0, False),
    ("ing_grove_2", 1, False),
    ("ing_square", 2, False),
    ("combate_ing_1", 3, False),
    ("combate_ing_2", 4, False),
    ("combate_ing_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD22_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD22_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD22_ID}/pool-health", token=TOKEN)
print("\nmundo_22 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD22_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
