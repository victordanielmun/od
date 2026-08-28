"""
Mundo 7: "Eres...? / Es...?" -- Fase final. Cierra el bloque "to be"
(mundos 3-7).

Uso:
    python mundo7_question_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo6 = next((w for w in worlds if w["key"] == "mundo_6"), None)
mundo7 = next((w for w in worlds if w["key"] == "mundo_7"), None)

if mundo7:
    print(f"[skip] mundo_7 ya existe (id={mundo7['id']})")
else:
    body = {
        "key": "mundo_7",
        "name": "Question Harbor",
        "description_en": "A world about yes/no questions with to be -- Are you...? Is he/she...? -- and short answers, closing the to-be block, reinforced through repetition across three contexts.",
        "order": (mundo6["order"] + 1) if mundo6 else 7,
        "challenge_tags": ["to-be-question"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_7",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo7 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_7")

WORLD7_ID = mundo7["id"]
print("mundo_7 id:", WORLD7_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("areyou_village", 0, False),
    ("ishe_village", 1, False),
    ("question_square", 2, False),
    ("combate_question_1", 3, False),
    ("combate_question_2", 4, False),
    ("combate_question_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD7_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD7_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD7_ID}/pool-health", token=TOKEN)
print("\nmundo_7 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD7_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
