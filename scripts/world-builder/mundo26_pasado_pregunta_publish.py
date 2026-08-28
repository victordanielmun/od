"""
Mundo 26: Pasado Simple (pregunta) -- Fase final. Publica el mundo y sus
6 misiones. Cierra el trio "pasado simple regular" (mundos 24-26).

Uso:
    python mundo26_pasado_pregunta_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo25 = next((w for w in worlds if w["key"] == "mundo_25"), None)
mundo26 = next((w for w in worlds if w["key"] == "mundo_26"), None)

if mundo26:
    print(f"[skip] mundo_26 ya existe (id={mundo26['id']})")
else:
    body = {
        "key": "mundo_26",
        "name": "Query Quarry",
        "description_en": "A world about simple past yes/no questions -- Did you...? Did he/she...? -- and short answers, closing the regular-past-simple block, reusing the 9 verbs from Worlds 24-25, reinforced through repetition across three contexts.",
        "order": (mundo25["order"] + 1) if mundo25 else 26,
        "challenge_tags": ["past-simple-question"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_26",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo26 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_26")

WORLD26_ID = mundo26["id"]
print("mundo_26 id:", WORLD26_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("pastq_grove_1", 0, False),
    ("pastq_grove_2", 1, False),
    ("pastq_square", 2, False),
    ("combate_pastq_1", 3, False),
    ("combate_pastq_2", 4, False),
    ("combate_pastq_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD26_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD26_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD26_ID}/pool-health", token=TOKEN)
print("\nmundo_26 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD26_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
