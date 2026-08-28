"""
Mundo 9: Plural y Articulos -- Fase final. Publica el mundo y sus 6
misiones.

Uso:
    python mundo9_plural_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo8 = next((w for w in worlds if w["key"] == "mundo_8"), None)
mundo9 = next((w for w in worlds if w["key"] == "mundo_9"), None)

if mundo9:
    print(f"[skip] mundo_9 ya existe (id={mundo9['id']})")
else:
    body = {
        "key": "mundo_9",
        "name": "Twofold Town",
        "description_en": "A world about this/that/these/those, a/an, and the -- singular vs plural nouns -- reinforced through repetition across three contexts.",
        "order": (mundo8["order"] + 1) if mundo8 else 9,
        "challenge_tags": ["plural-articles"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_9",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo9 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_9")

WORLD9_ID = mundo9["id"]
print("mundo_9 id:", WORLD9_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("twofold_market_1", 0, False),
    ("twofold_market_2", 1, False),
    ("twofold_square", 2, False),
    ("combate_twofold_1", 3, False),
    ("combate_twofold_2", 4, False),
    ("combate_twofold_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD9_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD9_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD9_ID}/pool-health", token=TOKEN)
print("\nmundo_9 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD9_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
