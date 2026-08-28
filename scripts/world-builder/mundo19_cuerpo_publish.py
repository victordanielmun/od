"""
Mundo 19: El Cuerpo -- Fase final. Publica el mundo y sus 6 misiones.
Sexto mundo del Bloque B (vocabulario funcional).

Uso:
    python mundo19_cuerpo_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo18 = next((w for w in worlds if w["key"] == "mundo_18"), None)
mundo19 = next((w for w in worlds if w["key"] == "mundo_19"), None)

if mundo19:
    print(f"[skip] mundo_19 ya existe (id={mundo19['id']})")
else:
    body = {
        "key": "mundo_19",
        "name": "Anatomy Grove",
        "description_en": "A world about body parts -- This is my head (reusing possessives), I have two eyes / He has two ears -- introducing the verb have/has for the first time, reinforced through repetition across three contexts.",
        "order": (mundo18["order"] + 1) if mundo18 else 19,
        "challenge_tags": ["body-parts"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_19",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo19 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_19")

WORLD19_ID = mundo19["id"]
print("mundo_19 id:", WORLD19_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("body_grove_1", 0, False),
    ("body_grove_2", 1, False),
    ("body_square", 2, False),
    ("combate_body_1", 3, False),
    ("combate_body_2", 4, False),
    ("combate_body_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD19_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD19_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD19_ID}/pool-health", token=TOKEN)
print("\nmundo_19 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD19_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
