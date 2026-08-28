"""
Mundo 16: Familia -- Fase final. Publica el mundo y sus 6 misiones.
Tercer mundo del Bloque B (vocabulario funcional).

Uso:
    python mundo16_familia_publish.py
"""
from _client import call, login, must

TOKEN = login()

status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo15 = next((w for w in worlds if w["key"] == "mundo_15"), None)
mundo16 = next((w for w in worlds if w["key"] == "mundo_16"), None)

if mundo16:
    print(f"[skip] mundo_16 ya existe (id={mundo16['id']})")
else:
    body = {
        "key": "mundo_16",
        "name": "Hearthwood",
        "description_en": "A world about family members -- This is my mother, He is my brother -- combining family vocabulary with possessives already learned (World 8) with no new grammar, reinforced through repetition across three contexts.",
        "order": (mundo15["order"] + 1) if mundo15 else 16,
        "challenge_tags": ["family"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_16",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo16 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_16")

WORLD16_ID = mundo16["id"]
print("mundo_16 id:", WORLD16_ID)

status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("family_grove_1", 0, False),
    ("family_grove_2", 1, False),
    ("family_square", 2, False),
    ("combate_family_1", 3, False),
    ("combate_family_2", 4, False),
    ("combate_family_boss", 5, True),
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD16_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD16_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

status, health = call("GET", f"/admin/worlds/{WORLD16_ID}/pool-health", token=TOKEN)
print("\nmundo_16 pool-health:", health)
status, wmissions = call("GET", f"/admin/worlds/{WORLD16_ID}/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
