"""
Mundo 23: Can / Can't -- Etapas 1-4. Tercer mundo del Bloque C. Modal
verb 'can' (habilidad, afirmativo) / "can't' (negativo) -- estructura
corta, buen 'descanso' antes del pasado simple. Punto clave: 'can'/
"can't' NUNCA cambian de forma, ni siquiera con he/she/it (nunca
'cans'/'can'ts').

Map1 = 4 frases con 'can' (swim, run, sing, dance).
Map2 = 5 frases con "can't' (fly, climb, cook, drive, jump).
Map3 = repaso mezclando can/can't.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12). El
letrero tambien se excluye explicitamente del sorteo de `forest` para
que nunca quede en el mismo tile que un arbol/arbusto (lesson 13).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Cave Deadfall" (piso de cueva de Mundo 9/21 + arboles caidos de
Mundo 12/16/18, nunca combinados) para dialogo, "Sandy Pines" (arena +
pinos de Mundo 10/13/18/22, nunca combinados) para combate.

Uso:
    python mundo23_can_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "can_grove_1"),
    ("the_village_2", "can_grove_2"),
    ("clock_tower", "can_square"),
    ("combate_town_1", "combate_can_1"),
    ("combate_town_2", "combate_can_2"),
    ("combat_town_boss", "combate_can_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "can_grove_1": (450, 250,
        "# 💪 Can: habilidad (afirmativo)\n\n"
        "'Can' expresa que SI se puede hacer algo. NUNCA cambia de forma.\n\n"
        "🏊 **I can swim** - yo se nadar\n"
        "🏃 **You can run** - tu sabes correr\n"
        "🎤 **He can sing** - el sabe cantar\n"
        "💃 **She can dance** - ella sabe bailar\n\n"
        "❗ Nunca se dice 'he cans sing' -- 'can' es siempre igual."),
    "can_grove_2": (450, 450,
        "# 🚫 Can't: habilidad (negativo)\n\n"
        "'Can't' (cannot) expresa que NO se puede hacer algo.\n\n"
        "🕊️ **I can't fly** - yo no se volar\n"
        "🧗 **You can't climb** - tu no sabes escalar\n"
        "🍳 **He can't cook** - el no sabe cocinar\n"
        "🚗 **She can't drive** - ella no sabe manejar\n"
        "🦘 **It can't jump** - no puede saltar\n\n"
        "💡 'Can't' tampoco cambia, igual que 'can'."),
    "can_square": (450, 550,
        "# 🔁 Repaso: can / can't\n\n"
        "Antes del examen, repasa ambas formas.\n\n"
        "👉 I/You/He/She/It/We/They + can + verbo\n"
        "👉 I/You/He/She/It/We/They + can't + verbo\n\n"
        "💬 Recuerda: 'can'/'can't' NUNCA agregan -s, ni con he/she/it."),
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

    sign_pos = (SIGNS[dst][0], SIGNS[dst][1]) if dst in SIGNS else None

    if dst in ("can_grove_1", "can_grove_2", "can_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Cave Deadfall": piso de cueva (Mundo 9/21) + arboles
        # caidos (Mundo 12/16/18), nunca combinados antes.
        CAVE_FLOOR = ["sprite57", "sprite58", "sprite61", "sprite62"]
        FALLEN_DECOR = ["sprite3", "sprite4", "sprite55"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(CAVE_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if sign_pos and (x, y) == sign_pos:
                continue
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(FALLEN_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_can_1", "combate_can_2", "combate_can_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Sandy Pines": arena + pinos (Mundo 10/13/18/22), nunca
        # combinados antes.
        SAND_FLOOR = ["sprite37", "sprite38", "sprite39", "sprite40"]
        PINE_MIX = ["sprite12", "sprite13", "sprite14"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(SAND_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(PINE_MIX)} for x, y in old_forest_positions
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
    dict(scene_key="can_grove_1", title="Can: swim / run / sing / dance",
         description_en="Practica 'can' con swim/run/sing/dance",
         objective_en="Practica I/You/He/She can + verbo", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="can_grove_2", title="Can't: fly / climb / cook / drive / jump",
         description_en="Practica 'can't' con fly/climb/cook/drive/jump",
         objective_en="Practica I/You/He/She/It can't + verbo", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="can_square", title="Repaso: can / can't",
         description_en="Repasa can/can't antes del examen",
         objective_en="Repasa can y can't", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_can_1", title="Los ogros invaden el pinar arenoso",
         description_en="Defiende el pinar mientras repasas can/can't",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_can_2", title="Los ogros atacan el pinar arenoso",
         description_en="Elimina a los ogros del pinar",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_can_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas can/can't derrotando al jefe",
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
    ("can_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a hablar de habilidades con "
     "'can' (poder/saber hacer algo). Pregunta 'Are you ready?'. Si el jugador no "
     "sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la "
     "tarea si responde afirmativamente.",
     "Great! Let's talk about abilities."),
    ("can_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'Can' expresa habilidad (poder hacer algo). 'I can swim' "
                       "significa que se nadar. IMPORTANTE: 'can' nunca cambia, "
                       "ni siquiera con he/she/it (nunca se dice 'cans').",
               ["I can swim", "I can swim, right?", "Yes, I can swim"]),
     "Great! I can swim -- can never changes."),
    ("can_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'You can run' -- mismo patron, 'can' + verbo base, sin "
                       "cambios.",
               ["You can run", "You can run, right?", "Yes, you can run"]),
     "Perfect! You can run."),
    ("can_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'He can sing' -- aunque sea 'he', 'can' NO agrega -s (a "
                       "diferencia de otros verbos en presente simple). Nunca "
                       "'he cans sing'.",
               ["He can sing", "He can sing, right?", "Yes, he can sing"]),
     "Exactly! He can sing -- no -s."),
    ("can_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'She can dance' -- mismo patron, 'can' siempre igual.",
               ["She can dance", "She can dance, right?", "Yes, she can dance"],
               extra="Ademas, para cerrar, pide un repaso de las 4 frases de "
                     "este mapa con 'can', remarcando que nunca cambia."),
     "Amazing! Can never changes -- you got it!"),

    ("can_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'Can't' es la contraccion de 'cannot', expresa que NO se "
                       "puede hacer algo. 'I can't fly' significa que no se "
                       "puede volar.",
               ["I can't fly", "I can't fly, right?", "No, I can't fly"]),
     "Great! I can't fly -- nobody can!"),
    ("can_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'You can't climb' -- mismo patron con 'can't'.",
               ["You can't climb", "You can't climb, right?", "No, you can't climb"]),
     "Perfect! You can't climb."),
    ("can_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'He can't cook' -- 'can't' tampoco cambia con he/she/it.",
               ["He can't cook", "He can't cook, right?", "No, he can't cook"]),
     "Exactly! He can't cook -- no -s either."),
    ("can_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'She can't drive' -- mismo patron.",
               ["She can't drive", "She can't drive, right?", "No, she can't drive"]),
     "Right! She can't drive."),
    ("can_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'It can't jump' -- mismo patron, para objetos/animales.",
               ["It can't jump", "It can't jump, right?", "No, it can't jump"],
               extra="Ademas, para cerrar, pide un repaso de las frases de este "
                     "mapa con 'can't', remarcando que nunca cambia."),
     "Awesome! Can't never changes either!"),

    ("can_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'I can swim' y 'You can "
     "run' -- 'can' nunca cambia. Dale a elegir: 'I can swim', 'You can run', 'I "
     "can swim and you can run'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Es repaso, no introduzcas verbos nuevos.",
     "Great! Can, still solid."),
    ("can_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'He can sing' y 'She can dance' -- ni "
     "siquiera con he/she se agrega -s a 'can'. Dale a elegir: 'He can sing', "
     "'She can dance', 'He can sing and she can dance'. Completa la tarea cuando "
     "el jugador diga correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Exactly! Can with he/she, well done."),
    ("can_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'I can't fly' y 'You can't climb' -- "
     "'can't' = no poder. Dale a elegir: 'I can't fly', 'You can't climb', 'I "
     "can't fly and you can't climb'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Perfect! Can't, solid."),
    ("can_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'He can't cook' y 'She can't drive' -- "
     "'can't' tampoco cambia. Dale a elegir: 'He can't cook', 'She can't drive', "
     "'He can't cook and she can't drive'. Completa la tarea cuando el jugador "
     "diga correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Great! Can't with he/she, got it."),
    ("can_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: 'can'/'can't' NUNCA agregan -s, ni con "
     "he/she/it. Este es el repaso final antes del examen. Pide al jugador que "
     "diga al menos 3 frases mezclando 'can'/'can't' con cualquiera de los "
     "verbos vistos (swim, run, sing, dance, fly, climb, cook, drive, jump). "
     "Completa la tarea cuando lo haga.",
     "Amazing! You've mastered can and can't now!"),
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
    ("can_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("can_grove_1", "Mochi"), None, 0),
    ("can_grove_1", 2, "Aprende 'I can swim' con Joy", "talk_to_npc", ("can_grove_1", "Joy"), None, 0),
    ("can_grove_1", 3, "Aprende 'You can run' con Ann", "talk_to_npc", ("can_grove_1", "Ann"), None, 0),
    ("can_grove_1", 4, "Aprende 'He can sing' con Sam", "talk_to_npc", ("can_grove_1", "Sam"), None, 0),
    ("can_grove_1", 5, "Aprende 'She can dance' con Amy", "talk_to_npc", ("can_grove_1", "Amy"), None, 0),

    ("can_grove_2", 1, "Aprende 'I can't fly' con Joy", "talk_to_npc", ("can_grove_2", "Joy"), None, 0),
    ("can_grove_2", 2, "Aprende 'You can't climb' con Ann", "talk_to_npc", ("can_grove_2", "Ann"), None, 0),
    ("can_grove_2", 3, "Aprende 'He can't cook' con Sam", "talk_to_npc", ("can_grove_2", "Sam"), None, 0),
    ("can_grove_2", 4, "Aprende 'She can't drive' con Zoe", "talk_to_npc", ("can_grove_2", "Zoe"), None, 0),
    ("can_grove_2", 5, "Aprende 'It can't jump' con Tom", "talk_to_npc", ("can_grove_2", "Tom"), None, 0),

    ("can_square", 1, "Repasa can (swim/run) con Toro", "talk_to_npc", ("can_square", "Toro"), None, 0),
    ("can_square", 2, "Repasa can (sing/dance) con Sam", "talk_to_npc", ("can_square", "Sam"), None, 0),
    ("can_square", 3, "Repasa can't (fly/climb) con Joy", "talk_to_npc", ("can_square", "Joy"), None, 0),
    ("can_square", 4, "Repasa can't (cook/drive) con Ann", "talk_to_npc", ("can_square", "Ann"), None, 0),
    ("can_square", 5, "Repaso final con Tom", "talk_to_npc", ("can_square", "Tom"), None, 0),

    ("combate_can_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_can_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_can_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_can_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_can_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 23 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
