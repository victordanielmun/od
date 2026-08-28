"""
Mundo 6: "No soy / No es..." -- Fase final.

Uso:
    python mundo6_negative_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo5 = next((w for w in worlds if w["key"] == "mundo_5"), None)
mundo6 = next((w for w in worlds if w["key"] == "mundo_6"), None)

if mundo6:
    print(f"[skip] mundo_6 ya existe (id={mundo6['id']})")
else:
    body = {
        "key": "mundo_6",
        "name": "No-Way Town",
        "description_en": "A world about the negative form of to be -- I'm not, you aren't, he/she isn't a/an ___ -- reinforced through repetition across three contexts.",
        "order": (mundo5["order"] + 1) if mundo5 else 6,
        "challenge_tags": ["to-be-negative"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_6",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo6 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_6")

WORLD6_ID = mundo6["id"]
print("mundo_6 id:", WORLD6_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("notme_village", 0, False),
    ("notyou_village", 1, False),
    ("negative_square", 2, False),
    ("combate_negative_1", 3, False),
    ("combate_negative_2", 4, False),
    ("combate_negative_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD6_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD6_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD6_ID}/pool-health", token=TOKEN)
print("\nmundo_6 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD6_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
