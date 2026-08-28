"""
Mundo 4: "Tu eres / El es / Ella es..." -- Fase final.

Uso:
    python mundo4_youhehe_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo3 = next((w for w in worlds if w["key"] == "mundo_3"), None)
mundo4 = next((w for w in worlds if w["key"] == "mundo_4"), None)

if mundo4:
    print(f"[skip] mundo_4 ya existe (id={mundo4['id']})")
else:
    body = {
        "key": "mundo_4",
        "name": "Village People",
        "description_en": "A world about 'you are / he is / she is a/an ___' -- extending the verb to be to other people -- reinforced through repetition across three contexts.",
        "order": (mundo3["order"] + 1) if mundo3 else 4,
        "challenge_tags": ["to-be-you-he-she"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_4",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo4 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_4")

WORLD4_ID = mundo4["id"]
print("mundo_4 id:", WORLD4_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("you_are_village", 0, False),
    ("he_she_village", 1, False),
    ("subject_be_square", 2, False),
    ("combate_subject_1", 3, False),
    ("combate_subject_2", 4, False),
    ("combate_subject_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD4_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD4_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD4_ID}/pool-health", token=TOKEN)
print("\nmundo_4 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD4_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
