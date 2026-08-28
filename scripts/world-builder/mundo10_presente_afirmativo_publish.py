"""
Mundo 10: Presente Simple (afirmativo) -- Fase final. Publica el mundo y
sus 6 misiones. Primer mundo del bloque "presente simple" (10=afirmativo,
11=negativo, 12=pregunta).

Uso:
    python mundo10_presente_afirmativo_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo9 = next((w for w in worlds if w["key"] == "mundo_9"), None)
mundo10 = next((w for w in worlds if w["key"] == "mundo_10"), None)

if mundo10:
    print(f"[skip] mundo_10 ya existe (id={mundo10['id']})")
else:
    body = {
        "key": "mundo_10",
        "name": "Daily Grove",
        "description_en": "A world about the simple present tense (affirmative) -- base form with I/you/we/they, -s form with he/she/it -- reinforced through repetition across three contexts.",
        "order": (mundo9["order"] + 1) if mundo9 else 10,
        "challenge_tags": ["present-simple-affirmative"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_10",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo10 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_10")

WORLD10_ID = mundo10["id"]
print("mundo_10 id:", WORLD10_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("daily_grove_1", 0, False),
    ("daily_grove_2", 1, False),
    ("daily_square", 2, False),
    ("combate_daily_1", 3, False),
    ("combate_daily_2", 4, False),
    ("combate_daily_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD10_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD10_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD10_ID}/pool-health", token=TOKEN)
print("\nmundo_10 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD10_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
