"""
Mundo 24: Pasado Simple (afirmativo) -- Fase final. Publica el mundo y
sus 6 misiones. Primer mundo del trio "pasado simple regular"
(24=afirmativo, 25=negativo, 26=pregunta).

Uso:
    python mundo24_pasado_afirmativo_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo23 = next((w for w in worlds if w["key"] == "mundo_23"), None)
mundo24 = next((w for w in worlds if w["key"] == "mundo_24"), None)

if mundo24:
    print(f"[skip] mundo_24 ya existe (id={mundo24['id']})")
else:
    body = {
        "key": "mundo_24",
        "name": "Yesterday Yard",
        "description_en": "A world about the simple past tense (regular verbs, affirmative) -- adding -ed, unchanged by subject -- reinforced through repetition across three contexts.",
        "order": (mundo23["order"] + 1) if mundo23 else 24,
        "challenge_tags": ["past-simple-affirmative"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_24",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo24 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_24")

WORLD24_ID = mundo24["id"]
print("mundo_24 id:", WORLD24_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("past_grove_1", 0, False),
    ("past_grove_2", 1, False),
    ("past_square", 2, False),
    ("combate_past_1", 3, False),
    ("combate_past_2", 4, False),
    ("combate_past_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD24_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD24_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD24_ID}/pool-health", token=TOKEN)
print("\nmundo_24 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD24_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
