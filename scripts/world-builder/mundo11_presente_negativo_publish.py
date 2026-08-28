"""
Mundo 11: Presente Simple (negativo) -- Fase final. Publica el mundo y
sus 6 misiones. Segundo mundo del bloque "presente simple"
(10=afirmativo, 11=negativo, 12=pregunta).

Uso:
    python mundo11_presente_negativo_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo10 = next((w for w in worlds if w["key"] == "mundo_10"), None)
mundo11 = next((w for w in worlds if w["key"] == "mundo_11"), None)

if mundo11:
    print(f"[skip] mundo_11 ya existe (id={mundo11['id']})")
else:
    body = {
        "key": "mundo_11",
        "name": "Nevergreen Grove",
        "description_en": "A world about the simple present tense (negative) -- don't with I/you/we/they, doesn't with he/she/it -- reinforced through repetition across three contexts.",
        "order": (mundo10["order"] + 1) if mundo10 else 11,
        "challenge_tags": ["present-simple-negative"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_11",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo11 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_11")

WORLD11_ID = mundo11["id"]
print("mundo_11 id:", WORLD11_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("nevergreen_grove_1", 0, False),
    ("nevergreen_grove_2", 1, False),
    ("nevergreen_square", 2, False),
    ("combate_nevergreen_1", 3, False),
    ("combate_nevergreen_2", 4, False),
    ("combate_nevergreen_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD11_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD11_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD11_ID}/pool-health", token=TOKEN)
print("\nmundo_11 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD11_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
