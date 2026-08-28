"""
Mundo 18: Comida y Bebidas -- Etapas 1-4. Quinto mundo del Bloque B
(vocabulario). Reusa presente simple afirmativo (Mundo 10) y negativo
(Mundo 11) sin gramatica nueva -- el patron es 'I like [comida]' / 'I
don't like [comida]'.

Map1 = 4 alimentos con 'I like' (bread, rice, chicken, milk).
Map2 = 5 alimentos con "I don't like' (water, juice, cheese, eggs, fish).
Map3 = repaso mezclando like/don't like con los 9 alimentos.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Dusty Pines" (tierra + pinos de Mundo 10/13/15, nunca combinados
con tierra) para dialogo, "Rocky Deadfall" (piso rocoso + arboles
caidos de Mundo 12/16, nunca combinados) para combate.

Uso:
    python mundo18_comida_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "food_grove_1"),
    ("the_village_2", "food_grove_2"),
    ("clock_tower", "food_square"),
    ("combate_town_1", "combate_food_1"),
    ("combate_town_2", "combate_food_2"),
    ("combat_town_boss", "combate_food_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "food_grove_1": (450, 250,
        "# 🍞 Comida: I like ___\n\n"
        "Usamos presente simple afirmativo (ya conocido) para decir que algo te gusta.\n\n"
        "🍞 **I like bread** - me gusta el pan\n"
        "🍚 **I like rice** - me gusta el arroz\n"
        "🍗 **I like chicken** - me gusta el pollo\n"
        "🥛 **I like milk** - me gusta la leche\n\n"
        "💡 'I like' + comida, sin cambios en el verbo."),
    "food_grove_2": (450, 450,
        "# 🚫🍽️ Comida: I don't like ___\n\n"
        "Usamos presente simple negativo (ya conocido) para decir que algo NO te gusta.\n\n"
        "💧 **I don't like water** - no me gusta el agua\n"
        "🧃 **I don't like juice** - no me gusta el jugo\n"
        "🧀 **I don't like cheese** - no me gusta el queso\n"
        "🥚 **I don't like eggs** - no me gustan los huevos\n"
        "🐟 **I don't like fish** - no me gusta el pescado\n\n"
        "❗ 'Eggs' es plural, pero 'I don't like' no cambia."),
    "food_square": (450, 550,
        "# 🔁 Repaso: like / don't like\n\n"
        "Antes del examen, repasa todos los alimentos.\n\n"
        "👉 bread, rice, chicken, milk\n"
        "👉 water, juice, cheese, eggs, fish\n\n"
        "💬 Practica: 'I like ___' y 'I don't like ___' con cualquier alimento."),
}

for src, dst in clones:
    status, existing = call("GET", f"/maps/config?scene_key={dst}", token=TOKEN)
    if status == 200:
        print(f"[skip] map {dst} ya existe")
        continue
    status, srcCfg = call("GET", f"/maps/config?scene_key={src}", token=TOKEN)
    if status != 200:
        print(f"FAILED fetching source map {src}: {status} {srcCfg}")
        raise SystemExit(1)

    wallsData = json.loads(srcCfg["walls_json"])
    wallsData["furniture"] = []
    wallsData["furniture2"] = []
    wallsData["furniture3"] = []

    if dst in ("food_grove_1", "food_grove_2", "food_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Dusty Pines": tierra + pinos, nunca combinados antes
        # (tierra solo se habia usado en mapas de combate).
        DIRT_FLOOR = ["sprite25", "sprite26", "sprite27", "sprite28", "sprite29", "sprite30"]
        PINE_MIX = ["sprite12", "sprite13", "sprite14"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(DIRT_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(PINE_MIX)})
        wallsData["forest"] = new_forest

    if dst in ("combate_food_1", "combate_food_2", "combate_food_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Rocky Deadfall": piso rocoso + arboles caidos, nunca
        # combinados antes.
        ROCK_FLOOR = ["sprite41", "sprite42", "sprite43", "sprite44", "sprite45", "sprite46", "sprite47", "sprite48"]
        FALLEN_DECOR = ["sprite3", "sprite4", "sprite55"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(ROCK_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(FALLEN_DECOR)} for x, y in old_forest_positions
                      if random.random() < 0.55]
        wallsData["forest"] = new_forest

    if dst in SIGNS:
        x, y, text = SIGNS[dst]
        wallsData.setdefault("furniture", []).append({
            "x": x, "y": y, "frame": "sprite63",
            "minigameType": "read", "minigameId": "", "readText": text,
        })

    body = {
        "scene_key": dst,
        "walls_json": json.dumps(wallsData),
        "map_data": srcCfg["map_data"],
        "is_public": srcCfg.get("is_public", True),
        "max_users": srcCfg.get("max_users", 50),
    }
    must("POST", "/admin/maps", body, TOKEN, f"map {dst} <- {src}")

# ── ETAPA 2: misiones ──
HEALTH_POTION = "bfd1359a-b574-45a1-9b55-adc7330a788f"
MANA_POTION = "bfd1359a-b574-45a1-9b55-adc7330a7890"

mission_specs = [
    dict(scene_key="food_grove_1", title="Comida: I like bread/rice/chicken/milk",
         description_en="Practica I like con bread/rice/chicken/milk",
         objective_en="Practica I like [comida]", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="food_grove_2", title="Comida: I don't like water/juice/cheese/eggs/fish",
         description_en="Practica I don't like con water/juice/cheese/eggs/fish",
         objective_en="Practica I don't like [comida]", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="food_square", title="Repaso: like / don't like",
         description_en="Repasa like/don't like antes del examen",
         objective_en="Repasa los 9 alimentos", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_food_1", title="Los ogros invaden las rocas caidas",
         description_en="Defiende el area mientras repasas comida",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_food_2", title="Los ogros atacan las rocas caidas",
         description_en="Elimina a los ogros del area",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_food_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas la comida derrotando al jefe",
         objective_en="Vence al jefe", type="kill_boss",
         reward_item_id=MANA_POTION, reward_quantity=3, reward_gold=100000, reward_xp=20000),
]

status, existingMissions = call("GET", "/admin/missions", token=TOKEN)
existingByScene = {m["scene_key"]: m for m in existingMissions} if status == 200 else {}
mission_ids = {}
for spec in mission_specs:
    key = spec["scene_key"]
    if key in existingByScene:
        mission_ids[key] = existingByScene[key]["id"]
        print(f"[skip] mission {key} ya existe (id={mission_ids[key]})")
        continue
    body = dict(spec)
    body.update(status="draft", mode="individual", difficulty="beginner",
                is_premium=False, world_id=None, is_final=False, order_in_world=0)
    created = must("POST", "/admin/missions", body, TOKEN, f"mission {key}")
    mission_ids[key] = created["id"]

print("mission_ids:", mission_ids)

# ── ETAPA 3: NPCs ──
def npc_instr(name, context, examples, extra=""):
    ex = "', '".join(examples)
    return (f"Eres {name}, hablas ingles. {context} Dale al jugador estas frases para "
            f"repetir: '{ex}'. Completa la tarea cuando el jugador diga correctamente "
            f"AL MENOS 3 de estas frases (repetir la misma frase varias veces tambien "
            f"cuenta como repeticion valida). {extra}")

npcs = [
    ("food_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a hablar de comida usando 'I "
     "like [comida]'. Pregunta 'Are you ready?'. Si el jugador no sabe que "
     "responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea si "
     "responde afirmativamente.",
     "Great! Let's talk about food."),
    ("food_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'I like bread' usa el presente simple afirmativo (ya "
                       "conocido) para decir que algo te gusta.",
               ["I like bread", "I like bread a lot", "Yes, I like bread"]),
     "Great! Bread -- I like it."),
    ("food_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'I like rice' -- mismo patron con otro alimento.",
               ["I like rice", "I like rice a lot", "Yes, I like rice"]),
     "Perfect! Rice -- I like it."),
    ("food_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'I like chicken' -- mismo patron.",
               ["I like chicken", "I like chicken a lot", "Yes, I like chicken"]),
     "Exactly! Chicken -- I like it."),
    ("food_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'I like milk' -- mismo patron.",
               ["I like milk", "I like milk a lot", "Yes, I like milk"],
               extra="Ademas, para cerrar, pide un repaso de los 4 alimentos de "
                     "este mapa (bread, rice, chicken, milk) con 'I like ___'."),
     "Amazing! You know 4 foods now!"),

    ("food_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'I don't like water' usa el presente simple negativo (ya "
                       "conocido) para decir que algo NO te gusta.",
               ["I don't like water", "No, I don't like water", "I don't like water, I like juice"]),
     "Great! I don't like water -- negative form."),
    ("food_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'I don't like juice' -- mismo patron.",
               ["I don't like juice", "No, I don't like juice", "I don't like juice, I like water"]),
     "Perfect! I don't like juice."),
    ("food_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'I don't like cheese' -- mismo patron.",
               ["I don't like cheese", "No, I don't like cheese", "I don't like cheese, I like milk"]),
     "Exactly! I don't like cheese."),
    ("food_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'I don't like eggs' -- mismo patron. 'Eggs' es plural, pero "
                       "'I don't like' no cambia.",
               ["I don't like eggs", "No, I don't like eggs", "I don't like eggs, I like bread"]),
     "Right! I don't like eggs."),
    ("food_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'I don't like fish' -- mismo patron.",
               ["I don't like fish", "No, I don't like fish", "I don't like fish, I like chicken"],
               extra="Ademas, para cerrar, pide un repaso de los alimentos de este "
                     "mapa (water, juice, cheese, eggs, fish) con 'I don't like "
                     "___'."),
     "Awesome! 5 more foods, well done!"),

    ("food_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'I like bread' y 'I like "
     "rice'. Dale a elegir: 'I like bread', 'I like rice', 'I like bread and rice'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Es repaso, "
     "no introduzcas alimentos nuevos.",
     "Great! Bread and rice, still solid."),
    ("food_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'I like chicken' y 'I like milk'. Dale a "
     "elegir: 'I like chicken', 'I like milk', 'I like chicken and milk'. Completa "
     "la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "alimentos nuevos.",
     "Exactly! Chicken and milk, well done."),
    ("food_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'I don't like water' y 'I don't like "
     "juice'. Dale a elegir: 'I don't like water', 'I don't like juice', 'I don't "
     "like water or juice'. Completa la tarea cuando el jugador diga correctamente "
     "al menos 3. Repaso, sin alimentos nuevos.",
     "Perfect! Water and juice, solid."),
    ("food_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'I don't like cheese', 'I don't like "
     "eggs', 'I don't like fish'. Dale a elegir: 'I don't like cheese', 'I don't "
     "like eggs', 'I don't like fish'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Repaso, sin alimentos nuevos.",
     "Great! Cheese, eggs, and fish, got it."),
    ("food_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide al "
     "jugador que diga al menos 3 frases mezclando 'I like ___' y 'I don't like "
     "___' con cualquiera de los 9 alimentos vistos (bread, rice, chicken, milk, "
     "water, juice, cheese, eggs, fish). Completa la tarea cuando lo haga.",
     "Amazing! You know all the food words now!"),
]

npc_ids = {}
for scene, name, defid, x, y, greeting, instructions, success in npcs:
    status, list_resp = call("GET", f"/admin/npc-instances?scene_key={scene}", token=TOKEN)
    found = None
    if status == 200 and isinstance(list_resp, list):
        for row in list_resp:
            if row.get("npc_definition_id") == defid and row.get("position_x") == x and row.get("position_y") == y:
                found = row
                break
    if found:
        npc_ids.setdefault(scene, {})[name] = found["id"]
        print(f"[skip] npc {scene}/{name} ya existe (id={found['id']})")
        continue
    body = dict(scene_key=scene, npc_definition_id=defid, position_x=x, position_y=y,
                facing_direction="right", default_state="idle", movement_type="static",
                interaction_radius=64, greeting=greeting, instructions=instructions, success_message=success)
    created = must("POST", "/admin/npcs", body, TOKEN, f"npc {scene}/{name}")
    npc_ids.setdefault(scene, {})[name] = created["id"]

print("npc_ids:", npc_ids)

# ── ETAPA 4: tareas ──
tasks = [
    ("food_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("food_grove_1", "Mochi"), None, 0),
    ("food_grove_1", 2, "Aprende 'bread' con Joy", "talk_to_npc", ("food_grove_1", "Joy"), None, 0),
    ("food_grove_1", 3, "Aprende 'rice' con Ann", "talk_to_npc", ("food_grove_1", "Ann"), None, 0),
    ("food_grove_1", 4, "Aprende 'chicken' con Sam", "talk_to_npc", ("food_grove_1", "Sam"), None, 0),
    ("food_grove_1", 5, "Aprende 'milk' con Amy", "talk_to_npc", ("food_grove_1", "Amy"), None, 0),

    ("food_grove_2", 1, "Aprende 'water' con Joy", "talk_to_npc", ("food_grove_2", "Joy"), None, 0),
    ("food_grove_2", 2, "Aprende 'juice' con Ann", "talk_to_npc", ("food_grove_2", "Ann"), None, 0),
    ("food_grove_2", 3, "Aprende 'cheese' con Sam", "talk_to_npc", ("food_grove_2", "Sam"), None, 0),
    ("food_grove_2", 4, "Aprende 'eggs' con Zoe", "talk_to_npc", ("food_grove_2", "Zoe"), None, 0),
    ("food_grove_2", 5, "Aprende 'fish' con Tom", "talk_to_npc", ("food_grove_2", "Tom"), None, 0),

    ("food_square", 1, "Repasa bread/rice con Toro", "talk_to_npc", ("food_square", "Toro"), None, 0),
    ("food_square", 2, "Repasa chicken/milk con Sam", "talk_to_npc", ("food_square", "Sam"), None, 0),
    ("food_square", 3, "Repasa water/juice con Joy", "talk_to_npc", ("food_square", "Joy"), None, 0),
    ("food_square", 4, "Repasa cheese/eggs/fish con Ann", "talk_to_npc", ("food_square", "Ann"), None, 0),
    ("food_square", 5, "Repaso final con Tom", "talk_to_npc", ("food_square", "Tom"), None, 0),

    ("combate_food_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_food_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_food_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_food_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_food_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
]

for missionKey, order, desc, ttype, npcRef, enemy, kills in tasks:
    missionID = mission_ids[missionKey]
    status, existingTasks = call("GET", f"/admin/missions/{missionID}/tasks", token=TOKEN)
    already = any(t.get("order") == order for t in existingTasks) if status == 200 and isinstance(existingTasks, list) else False
    if already:
        print(f"[skip] task {missionKey}#{order} ya existe")
        continue
    body = {"type": ttype, "order": order, "description_en": desc}
    if ttype == "talk_to_npc":
        sk, nm = npcRef
        body["target_npc_template_id"] = npc_ids[sk][nm]
    else:
        body["required_enemy"] = enemy
        body["required_kills"] = kills
    must("POST", f"/admin/missions/{missionID}/tasks", body, TOKEN, f"task {missionKey}#{order}")

print("\n[ok] Mundo 18 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
