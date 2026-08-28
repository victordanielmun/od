"""
Mundo 20: La Casa -- Fase final. Publica el mundo y sus 6 misiones.
Septimo y ultimo mundo del Bloque B -- cierra el bloque completo
(mundos 14-20).

Uso:
    python mundo20_casa_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo19 = next((w for w in worlds if w["key"] == "mundo_19"), None)
mundo20 = next((w for w in worlds if w["key"] == "mundo_20"), None)

if mundo20:
    print(f"[skip] mundo_20 ya existe (id={mundo20['id']})")
else:
    body = {
        "key": "mundo_20",
        "name": "Household Hollow",
        "description_en": "A world about the house -- This is the kitchen (reusing 'the'), The table is in the kitchen / The book is on the table -- introducing simple place prepositions (in/on) as a preview of Block C, reinforced through repetition across three contexts. Closes Block B (vocabulary, worlds 14-20).",
        "order": (mundo19["order"] + 1) if mundo19 else 20,
        "challenge_tags": ["house-prepositions"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_20",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo20 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_20")

WORLD20_ID = mundo20["id"]
print("mundo_20 id:", WORLD20_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("house_grove_1", 0, False),
    ("house_grove_2", 1, False),
    ("house_square", 2, False),
    ("combate_house_1", 3, False),
    ("combate_house_2", 4, False),
    ("combate_house_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD20_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD20_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD20_ID}/pool-health", token=TOKEN)
print("\nmundo_20 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD20_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
