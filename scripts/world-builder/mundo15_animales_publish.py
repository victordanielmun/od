"""
Mundo 15: Animales -- Fase final. Publica el mundo y sus 6 misiones.
Segundo mundo del Bloque B (vocabulario funcional).

Uso:
    python mundo15_animales_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo14 = next((w for w in worlds if w["key"] == "mundo_14"), None)
mundo15 = next((w for w in worlds if w["key"] == "mundo_15"), None)

if mundo15:
    print(f"[skip] mundo_15 ya existe (id={mundo15['id']})")
else:
    body = {
        "key": "mundo_15",
        "name": "Critter Cove",
        "description_en": "A world about animals -- This is a/an [animal]. It lives in/on [place] -- reusing the this-is and present-simple patterns already learned with no new grammar, reinforced through repetition across three contexts.",
        "order": (mundo14["order"] + 1) if mundo14 else 15,
        "challenge_tags": ["animals"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_15",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo15 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_15")

WORLD15_ID = mundo15["id"]
print("mundo_15 id:", WORLD15_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("animal_grove_1", 0, False),
    ("animal_grove_2", 1, False),
    ("animal_square", 2, False),
    ("combate_animal_1", 3, False),
    ("combate_animal_2", 4, False),
    ("combate_animal_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD15_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD15_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD15_ID}/pool-health", token=TOKEN)
print("\nmundo_15 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD15_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
