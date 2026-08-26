"""
Mundo 2: Pronombres -- validaciones de solo lectura contra la API real.
Util despues de correr build (antes de publicar) o publish (antes de
avisar que el mundo ya esta jugable).

Uso:
    python mundo2_pronombres_validate.py
"""
import json

from _client import call, login

TOKEN = login()

print("=== 1. Mapas clonados: existen y tienen el letrero embebido ===")
for scene in ["pronoun_village", "pronoun_village_2", "pronoun_square", "combate_pronoun_1", "combate_pronoun_boss"]:
    status, cfg = call("GET", f"/maps/config?scene_key={scene}", token=TOKEN)
    if status != 200:
        print(f"  FALLO {scene}: status={status}")
        continue
    w = json.loads(cfg["walls_json"])
    npcCount = len(w.get("npcZones", []))
    signCount = sum(1 for it in w.get("furniture3", []) if it.get("readText"))
    print(f"  {scene}: status={status} npcZones={npcCount} letreros={signCount}")

print("\n=== 2. Misiones: estado actual (draft/world_id=NULL antes de publicar) ===")
status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}
for key in ["pronoun_village", "pronoun_village_2", "pronoun_square", "combate_pronoun_1", "combate_pronoun_boss"]:
    m = byScene.get(key)
    if not m:
        print(f"  FALLO: {key} no encontrada")
        continue
    print(f"  {key}: id={m['id']} type={m['type']} status={m['status']} world_id={m['world_id']} is_final={m['is_final']}")

print("\n=== 3. Tareas de cada mision nueva ===")
for key in ["pronoun_village", "pronoun_village_2", "pronoun_square", "combate_pronoun_1", "combate_pronoun_boss"]:
    m = byScene.get(key)
    if not m:
        continue
    status, tasks = call("GET", f"/admin/missions/{m['id']}/tasks", token=TOKEN)
    tasks_sorted = sorted(tasks, key=lambda t: t["order"]) if status == 200 else []
    summary = ", ".join(
        f"#{t['order']}:{t['type']}" + (f"->npc{t['target_npc_template_id']}" if t.get('target_npc_template_id') else f"->{t.get('required_enemy')}x{t.get('required_kills')}")
        for t in tasks_sorted
    )
    print(f"  {key} ({len(tasks_sorted)} tareas): {summary}")

print("\n=== 4. NPCs: contenido de instructions no vacio ===")
for scene in ["pronoun_village", "pronoun_village_2", "pronoun_square"]:
    status, tmpls = call("GET", f"/admin/npc-instances?scene_key={scene}", token=TOKEN)
    if status != 200:
        print(f"  FALLO {scene}: {status}")
        continue
    empties = [t["id"] for t in tmpls if not t.get("instructions")]
    print(f"  {scene}: {len(tmpls)} npcs, sin-instructions={empties or 'ninguno (correcto)'}")

print("\n=== 5. Challenges: conteo por tag ===")
status, challenges = call("GET", "/admin/challenges", token=TOKEN)
if status == 200:
    pronouns = [c for c in challenges if "pronouns" in c.get("tags", [])]
    final2 = [c for c in challenges if "final_mundo_2" in c.get("tags", [])]
    print(f"  tag=pronouns: {len(pronouns)}  tag=final_mundo_2: {len(final2)}")
    bad = [c["question"] for c in pronouns + final2 if not (1 <= c.get("correct_option", 0) <= 3)]
    print(f"  correct_option fuera de rango: {bad or 'ninguno (correcto)'}")

print("\n=== 6. World 1: pool-health ===")
status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo1 = next((w for w in worlds if w["key"] == "mundo_1"), None) if status == 200 else None
if mundo1:
    status, health = call("GET", f"/admin/worlds/{mundo1['id']}/pool-health", token=TOKEN)
    print(f"  {health}")
    status, wmissions = call("GET", f"/admin/worlds/{mundo1['id']}/missions", token=TOKEN)
    scenes = sorted(m["scene_key"] for m in wmissions) if status == 200 else []
    print(f"  misiones de mundo_1 ({len(scenes)}): {scenes}")

print("\n=== 7. World 2: existe y su pool-health (solo si ya se publico) ===")
mundo2 = next((w for w in worlds if w["key"] == "mundo_2"), None) if status == 200 else None
if not mundo2:
    print("  mundo_2 NO existe todavia (falta correr mundo2_pronombres_publish.py)")
else:
    status, health = call("GET", f"/admin/worlds/{mundo2['id']}/pool-health", token=TOKEN)
    print(f"  {health}")
    status, wmissions = call("GET", f"/admin/worlds/{mundo2['id']}/missions", token=TOKEN)
    for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
        print(f"    {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
