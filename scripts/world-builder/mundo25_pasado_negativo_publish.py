"""
Mundo 25: Pasado Simple (negativo) -- Fase final. Publica el mundo y
sus 6 misiones. Segundo mundo del trio "pasado simple regular"
(24=afirmativo, 25=negativo, 26=pregunta).

Uso:
    python mundo25_pasado_negativo_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo24 = next((w for w in worlds if w["key"] == "mundo_24"), None)
mundo25 = next((w for w in worlds if w["key"] == "mundo_25"), None)

if mundo25:
    print(f"[skip] mundo_25 ya existe (id={mundo25['id']})")
else:
    body = {
        "key": "mundo_25",
        "name": "Didn't Dell",
        "description_en": "A world about the simple past tense (regular verbs, negative) -- didn't + base verb -- reusing the 9 verbs from World 24 for a direct affirmative-to-negative contrast, reinforced through repetition across three contexts.",
        "order": (mundo24["order"] + 1) if mundo24 else 25,
        "challenge_tags": ["past-simple-negative"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_25",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo25 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_25")

WORLD25_ID = mundo25["id"]
print("mundo_25 id:", WORLD25_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("pastneg_grove_1", 0, False),
    ("pastneg_grove_2", 1, False),
    ("pastneg_square", 2, False),
    ("combate_pastneg_1", 3, False),
    ("combate_pastneg_2", 4, False),
    ("combate_pastneg_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD25_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD25_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD25_ID}/pool-health", token=TOKEN)
print("\nmundo_25 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD25_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
