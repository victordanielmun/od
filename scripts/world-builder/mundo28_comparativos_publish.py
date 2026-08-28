"""
Mundo 28: Comparativos y Superlativos -- Fase final. Publica el mundo y
sus 6 misiones.

Uso:
    python mundo28_comparativos_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo27 = next((w for w in worlds if w["key"] == "mundo_27"), None)
mundo28 = next((w for w in worlds if w["key"] == "mundo_28"), None)

if mundo28:
    print(f"[skip] mundo_28 ya existe (id={mundo28['id']})")
else:
    body = {
        "key": "mundo_28",
        "name": "Superlative Sands",
        "description_en": "A world about comparatives and superlatives -- adjective + -er + than for comparing two things, the + adjective + -est/most for the top of a group, plus the irregular good/better/best -- reusing adjectives from World 5, reinforced through repetition across three contexts.",
        "order": (mundo27["order"] + 1) if mundo27 else 28,
        "challenge_tags": ["comparatives-superlatives"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_28",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo28 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_28")

WORLD28_ID = mundo28["id"]
print("mundo_28 id:", WORLD28_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("comp_grove_1", 0, False),
    ("comp_grove_2", 1, False),
    ("comp_square", 2, False),
    ("combate_comp_1", 3, False),
    ("combate_comp_2", 4, False),
    ("combate_comp_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD28_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD28_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD28_ID}/pool-health", token=TOKEN)
print("\nmundo_28 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD28_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
