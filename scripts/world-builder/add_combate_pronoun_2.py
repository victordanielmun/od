"""
Mundo 2: Pronombres -- completa el patron de 6 mapas (3 NPC + 2 combate +
1 jefe), calcado de mundo_1 (the_village/the_village_2/clock_tower +
combate_town_1 + combate_town_2 + combat_town_boss). Faltaba el segundo
mapa de combate, equivalente a combate_town_2.

Etapa 1: clona combate_town_2 -> combate_pronoun_2 (layout ya generado con
tema "Bosque Otonal", distinto del lago de combate_pronoun_1 y el desierto
de combate_pronoun_boss).
Etapa 2: mision (mismo mode/reward que combate_town_2, world_id=2 directo
porque mundo_2 ya esta publicado).
Etapa 4: 2 tareas identicas a combate_town_2 (9 Ogre Warrior + 4 Ogre).
Reordena combate_pronoun_boss a order_in_world=5 para dejarle lugar.

Uso:
    python add_combate_pronoun_2.py
"""
import json

from _client import call, login, must

TOKEN = login()

# ── Etapa 1: clonar el mapa (ya diseñado, ver combate_pronoun_2_new.json) ──
status, existing = call("GET", "/maps/config?scene_key=combate_pronoun_2", token=TOKEN)
if status == 200:
    print("[skip] map combate_pronoun_2 ya existe")
else:
    new_layout = json.load(open("combate_pronoun_2_new.json"))
    status, srcCfg = call("GET", "/maps/config?scene_key=combate_town_2", token=TOKEN)
    body = {
        "scene_key": "combate_pronoun_2",
        "walls_json": json.dumps(new_layout),
        "map_data": srcCfg["map_data"],
        "is_public": srcCfg.get("is_public", True),
        "max_users": srcCfg.get("max_users", 50),
    }
    must("POST", "/admin/maps", body, TOKEN, "map combate_pronoun_2 <- combate_town_2 (Bosque Otonal)")

# ── Etapa 2: mision (directo a world_id=2, mundo_2 ya esta publicado) ──
status, missions = call("GET", "/admin/missions", token=TOKEN)
byScene = {m["scene_key"]: m for m in missions}

if "combate_pronoun_2" in byScene:
    mission = byScene["combate_pronoun_2"]
    print(f"[skip] mission combate_pronoun_2 ya existe (id={mission['id']})")
else:
    HEALTH_POTION = "bfd1359a-b574-45a1-9b55-adc7330a788f"
    body = dict(
        scene_key="combate_pronoun_2", title="Los ogros atacan a Ben",
        description_en="Salva a Ben, elimina a los ogros",
        objective_en="Elimina a los ogros", type="kill_all",
        reward_item_id=HEALTH_POTION, reward_quantity=1,
        reward_gold=20000, reward_xp=2000,
        status="active", mode="individual", difficulty="beginner",
        is_premium=False, world_id=2, is_final=False, order_in_world=4,
    )
    mission = must("POST", "/admin/missions", body, TOKEN, "mission combate_pronoun_2")

MISSION_ID = mission["id"]

# ── Reordenar el jefe a order_in_world=5 para dejar el hueco 4 a este mapa ──
boss = byScene.get("combate_pronoun_boss")
if boss and boss["order_in_world"] != 5:
    body = dict(boss)
    body["order_in_world"] = 5
    must("PUT", f"/admin/missions/{boss['id']}", body, TOKEN, "combate_pronoun_boss -> order_in_world=5")
else:
    print("[skip] combate_pronoun_boss ya en order_in_world=5")

# ── Etapa 4: 2 tareas, identicas a combate_town_2 ──
status, tasks = call("GET", f"/admin/missions/{MISSION_ID}/tasks", token=TOKEN)
existing_orders = {t["order"] for t in tasks} if status == 200 else set()

task_plan = [
    (1, "Elimina a todos los ogros guerreros", "Ogre Warrior", 9),
    (2, "Elimina a todos los ogros lanzadores", "Ogre", 4),
]
for order, desc, enemy, kills in task_plan:
    if order in existing_orders:
        print(f"[skip] task combate_pronoun_2#{order} ya existe")
        continue
    body = {"type": "kill_all", "order": order, "description_en": desc,
            "required_enemy": enemy, "required_kills": kills}
    must("POST", f"/admin/missions/{MISSION_ID}/tasks", body, TOKEN, f"task combate_pronoun_2#{order}")

# ── verificacion ──
status, health = call("GET", "/admin/worlds/2/pool-health", token=TOKEN)
print("\nmundo_2 pool-health:", health)
status, wmissions = call("GET", "/admin/worlds/2/missions", token=TOKEN)
for m in sorted(wmissions, key=lambda m: m["order_in_world"]):
    print(f"  {m['order_in_world']} {m['scene_key']} status={m['status']} is_final={m['is_final']}")
