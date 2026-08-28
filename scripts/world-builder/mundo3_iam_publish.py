"""
Mundo 3: "Yo soy..." -- Fase final. Crea el World 'mundo_3' y publica las
6 misiones (world_id + order_in_world + status='active').

Uso:
    python mundo3_iam_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo2 = next((w for w in worlds if w["key"] == "mundo_2"), None)
mundo3 = next((w for w in worlds if w["key"] == "mundo_3"), None)

if mundo3:
    print(f"[skip] mundo_3 ya existe (id={mundo3['id']})")
else:
    body = {
        "key": "mundo_3",
        "name": "Career Village",
        "description_en": "A world entirely about 'I am a/an ___' -- stating your profession with the verb to be -- reinforced through repetition across three contexts.",
        "order": (mundo2["order"] + 1) if mundo2 else 3,
        "challenge_tags": ["to-be-i-am"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_3",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo3 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_3")

WORLD3_ID = mundo3["id"]
print("mundo_3 id:", WORLD3_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("career_village_1", 0, False),
    ("career_village_2", 1, False),
    ("career_square", 2, False),
    ("combate_career_1", 3, False),
    ("combate_career_2", 4, False),
    ("combate_career_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD3_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD3_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD3_ID}/pool-health", token=TOKEN)
print("\nmundo_3 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD3_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
