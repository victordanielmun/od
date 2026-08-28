"""
Mundo 18: Comida y Bebidas -- Fase final. Publica el mundo y sus 6
misiones. Quinto mundo del Bloque B (vocabulario funcional).

Uso:
    python mundo18_comida_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo17 = next((w for w in worlds if w["key"] == "mundo_17"), None)
mundo18 = next((w for w in worlds if w["key"] == "mundo_18"), None)

if mundo18:
    print(f"[skip] mundo_18 ya existe (id={mundo18['id']})")
else:
    body = {
        "key": "mundo_18",
        "name": "Snack Shore",
        "description_en": "A world about food and drinks -- I like bread, I don't like water -- reusing the simple present affirmative/negative patterns already learned (Worlds 10-11) with no new grammar, reinforced through repetition across three contexts.",
        "order": (mundo17["order"] + 1) if mundo17 else 18,
        "challenge_tags": ["food-drinks"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_18",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo18 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_18")

WORLD18_ID = mundo18["id"]
print("mundo_18 id:", WORLD18_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("food_grove_1", 0, False),
    ("food_grove_2", 1, False),
    ("food_square", 2, False),
    ("combate_food_1", 3, False),
    ("combate_food_2", 4, False),
    ("combate_food_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD18_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD18_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD18_ID}/pool-health", token=TOKEN)
print("\nmundo_18 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD18_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
