"""
Mundo 14: Colores -- Fase final. Publica el mundo y sus 6 misiones.
Primer mundo del Bloque B (vocabulario funcional).

Uso:
    python mundo14_colores_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo13 = next((w for w in worlds if w["key"] == "mundo_13"), None)
mundo14 = next((w for w in worlds if w["key"] == "mundo_14"), None)

if mundo14:
    print(f"[skip] mundo_14 ya existe (id={mundo14['id']})")
else:
    body = {
        "key": "mundo_14",
        "name": "Hue Harbor",
        "description_en": "A world about colors -- It is a/an [color] [noun] -- reusing the it-is-plus-adjective pattern from World 5 with no new grammar, reinforced through repetition across three contexts.",
        "order": (mundo13["order"] + 1) if mundo13 else 14,
        "challenge_tags": ["colors"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_14",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo14 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_14")

WORLD14_ID = mundo14["id"]
print("mundo_14 id:", WORLD14_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("color_grove_1", 0, False),
    ("color_grove_2", 1, False),
    ("color_square", 2, False),
    ("combate_color_1", 3, False),
    ("combate_color_2", 4, False),
    ("combate_color_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD14_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD14_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD14_ID}/pool-health", token=TOKEN)
print("\nmundo_14 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD14_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
