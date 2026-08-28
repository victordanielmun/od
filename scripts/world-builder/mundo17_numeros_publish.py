"""
Mundo 17: Numeros y Cantidades -- Fase final. Publica el mundo y sus 6
misiones. Cuarto mundo del Bloque B (vocabulario funcional).

Uso:
    python mundo17_numeros_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo16 = next((w for w in worlds if w["key"] == "mundo_16"), None)
mundo17 = next((w for w in worlds if w["key"] == "mundo_17"), None)

if mundo17:
    print(f"[skip] mundo_17 ya existe (id={mundo17['id']})")
else:
    body = {
        "key": "mundo_17",
        "name": "Tally Town",
        "description_en": "A world about counting past 12 and asking how many -- There are [number] [noun], How many [noun] are there? -- reusing the there-is-are pattern from World 13 with no new grammar, reinforced through repetition across three contexts.",
        "order": (mundo16["order"] + 1) if mundo16 else 17,
        "challenge_tags": ["numbers-quantities"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_17",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo17 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_17")

WORLD17_ID = mundo17["id"]
print("mundo_17 id:", WORLD17_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("number_grove_1", 0, False),
    ("number_grove_2", 1, False),
    ("number_square", 2, False),
    ("combate_number_1", 3, False),
    ("combate_number_2", 4, False),
    ("combate_number_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD17_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD17_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD17_ID}/pool-health", token=TOKEN)
print("\nmundo_17 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD17_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
