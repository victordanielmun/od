"""
Mundo 21: Preposiciones de Lugar -- Fase final. Publica el mundo y sus
6 misiones. Primer mundo del Bloque C (gramatica intermedia temprana).

Uso:
    python mundo21_preposiciones_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo20 = next((w for w in worlds if w["key"] == "mundo_20"), None)
mundo21 = next((w for w in worlds if w["key"] == "mundo_21"), None)

if mundo21:
    print(f"[skip] mundo_21 ya existe (id={mundo21['id']})")
else:
    body = {
        "key": "mundo_21",
        "name": "Position Point",
        "description_en": "A world about place prepositions -- under, next to, between -- completing the set started in World 20 (in/on), reinforced through repetition across three contexts.",
        "order": (mundo20["order"] + 1) if mundo20 else 21,
        "challenge_tags": ["prepositions-place"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_21",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo21 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_21")

WORLD21_ID = mundo21["id"]
print("mundo_21 id:", WORLD21_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("prep_grove_1", 0, False),
    ("prep_grove_2", 1, False),
    ("prep_square", 2, False),
    ("combate_prep_1", 3, False),
    ("combate_prep_2", 4, False),
    ("combate_prep_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD21_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD21_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD21_ID}/pool-health", token=TOKEN)
print("\nmundo_21 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD21_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
