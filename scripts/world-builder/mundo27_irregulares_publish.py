"""
Mundo 27: Pasado Simple (verbos irregulares) -- Fase final. Publica el
mundo y sus 6 misiones. Cierra el bloque completo de pasado simple
(mundos 24-27).

Uso:
    python mundo27_irregulares_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo26 = next((w for w in worlds if w["key"] == "mundo_26"), None)
mundo27 = next((w for w in worlds if w["key"] == "mundo_27"), None)

if mundo27:
    print(f"[skip] mundo_27 ya existe (id={mundo27['id']})")
else:
    body = {
        "key": "mundo_27",
        "name": "Memory Mine",
        "description_en": "A world about common irregular verbs in the simple past -- went, had, saw, did, ate, made, took, came, got -- pure memorization since they don't follow the -ed rule, reinforced through repetition across three contexts. Closes the full simple-past block (Worlds 24-27).",
        "order": (mundo26["order"] + 1) if mundo26 else 27,
        "challenge_tags": ["past-simple-irregular"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_27",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo27 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_27")

WORLD27_ID = mundo27["id"]
print("mundo_27 id:", WORLD27_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("irreg_grove_1", 0, False),
    ("irreg_grove_2", 1, False),
    ("irreg_square", 2, False),
    ("combate_irreg_1", 3, False),
    ("combate_irreg_2", 4, False),
    ("combate_irreg_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD27_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD27_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD27_ID}/pool-health", token=TOKEN)
print("\nmundo_27 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD27_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
