"""
Mundo 2: Pronombres -- Fase final (ver PLAN_CLONACION_MAPAS_MISION.md).

Crea el World 'mundo_2' y publica las 5 misiones ya construidas por
mundo2_pronombres_build.py (world_id + order_in_world + status='active').
Este es el UNICO paso de todo el pipeline que hace visible el contenido a
jugadores reales -- correrlo deliberadamente, despues de validar el build.

Idempotente: si ya existe el world o una mision ya esta publicada, la salta.

Uso:
    python mundo2_pronombres_publish.py
"""
from _client import call, login, must

TOKEN = login()

# ── crear (o reusar) el world 'mundo_2' ──
status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo1 = next((w for w in worlds if w["key"] == "mundo_1"), None)
mundo2 = next((w for w in worlds if w["key"] == "mundo_2"), None)

if mundo2:
    print(f"[skip] mundo_2 ya existe (id={mundo2['id']})")
else:
    body = {
        "key": "mundo_2",
        "name": "Pronoun Village",
        "description_en": "A world about personal pronouns, possessive pronouns, and present simple agreement.",
        "order": (mundo1["order"] + 1) if mundo1 else 2,
        "challenge_tags": ["pronouns"],
        "challenge_types": ["grammar"],
        "exam_tag": "final_mundo_2",
        "difficulty": "beginner",
        "status": "active",
    }
    mundo2 = must("POST", "/admin/worlds", body, TOKEN, "create world mundo_2")

WORLD2_ID = mundo2["id"]
print("mundo_2 id:", WORLD2_ID)

# ── publicar las 5 misiones: world_id + order_in_world + status=active ──
status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

publish_order = [
    ("pronoun_village", 0, False),
    ("pronoun_village_2", 1, False),
    ("pronoun_square", 2, False),
    ("combate_pronoun_1", 3, False),
    ("combate_pronoun_boss", 4, True),  # boss = examen final del mundo
]
for scene, order, isFinal in publish_order:
    m = byScene[scene]
    if m["world_id"] == WORLD2_ID and m["status"] == "active" and m["is_final"] == isFinal:
        print(f"[skip] {scene} ya publicada")
        continue
    body = dict(m)
    body["world_id"] = WORLD2_ID
    body["order_in_world"] = order
    body["is_final"] = isFinal
    body["status"] = "active"
    must("PUT", f"/admin/missions/{m['id']}", body, TOKEN, f"publish {scene}")

# ── verificacion final ──
status, health = call("GET", f"/admin/worlds/{WORLD2_ID}/pool-health", token=TOKEN)
print("\nmundo_2 pool-health:", health)

status, wmissions = call("GET", f"/admin/worlds/{WORLD2_ID}/missions", token=TOKEN)
summary = sorted((m["order_in_world"], m["scene_key"], m["status"], m["is_final"]) for m in wmissions)
print("mundo_2 misiones:")
for row in summary:
    print("  ", row)
