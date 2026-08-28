"""
Mundo 26: Pasado Simple (verbos regulares, pregunta) -- Etapas 1-4.
Tercer y ultimo mundo del trio "pasado simple regular" (24=afirmativo,
25=negativo, 26=pregunta) -- cierra el trio igual que Mundo 12 cerro
presente simple. Reusa los 9 verbos de Mundos 24-25 (play, work, walk,
watch, cook, dance, jump, climb, clean).

Map1 = 4 preguntas con 'Did' + I/you/we/they.
Map2 = 5 preguntas con 'Did' + he/she/it -- MISMO 'did', sin cambio (a
diferencia de presente simple, donde do/does si cambia).
Map3 = repaso mezclando preguntas + respuesta corta.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12). El
letrero se excluye explicitamente del sorteo de `forest` (lesson 13).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Stone Ruins" (piedra de Mundo 9/15/17 + decoracion de ruinas de
Mundo 7/19/21/22, nunca combinados) para dialogo, "Wooden Thicket"
(madera + arbustos de Mundo 10/15/19/22, nunca combinados) para combate.

Uso:
    python mundo26_pasado_pregunta_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "pastq_grove_1"),
    ("the_village_2", "pastq_grove_2"),
    ("clock_tower", "pastq_square"),
    ("combate_town_1", "combate_pastq_1"),
    ("combate_town_2", "combate_pastq_2"),
    ("combat_town_boss", "combate_pastq_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "pastq_grove_1": (450, 250,
        "# ❓⏳ Pasado pregunta: Did (parte 1)\n\n"
        "Para preguntar en pasado, usamos **Did** + sujeto + verbo BASE, sin importar el sujeto.\n\n"
        "⚽ **Did you play soccer yesterday?** - Yes, I did / No, I didn't\n"
        "🔨 **Did we work yesterday?** - Yes, we did / No, we didn't\n"
        "🚶 **Did they walk to school?** - Yes, they did / No, they didn't\n"
        "📺 **Did you watch a movie?** - Yes, I did / No, I didn't\n\n"
        "💡 La respuesta corta repite 'did'/'didn't', nunca el verbo completo."),
    "pastq_grove_2": (450, 450,
        "# ❓⏳ Pasado pregunta: Did (parte 2)\n\n"
        "Con he/she/it usamos el MISMO 'did' -- nunca cambia.\n\n"
        "🍳 **Did he cook dinner?** - Yes, he did / No, he didn't\n"
        "💃 **Did she dance all night?** - Yes, she did / No, she didn't\n"
        "🦘 **Did he jump over the fence?** - Yes, he did / No, he didn't\n"
        "🧗 **Did she climb the mountain?** - Yes, she did / No, she didn't\n"
        "🧹 **Did you clean your room?** - Yes, I did / No, I didn't\n\n"
        "❗ A diferencia de presente simple (do/does), 'did' es igual para todos."),
    "pastq_square": (450, 550,
        "# 🔁 Repaso: Did + respuesta corta\n\n"
        "Antes del examen, repasa las preguntas en pasado.\n\n"
        "👉 Did + I/you/we/they/he/she/it + verbo base + ?\n"
        "👉 Yes, [sujeto] did. / No, [sujeto] didn't.\n\n"
        "💬 'Did' nunca cambia, y el verbo siempre vuelve a forma base."),
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

    if dst in ("pastq_grove_1", "pastq_grove_2", "pastq_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Stone Ruins": piedra (Mundo 9/15/17) + decoracion de
        # ruinas (Mundo 7/19/21/22), nunca combinados antes.
        STONE_FLOOR = ["sprite13", "sprite14", "sprite15", "sprite16"]
        RUIN_DECOR = ["sprite34", "sprite35", "sprite43", "sprite44", "sprite61"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(STONE_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if sign_pos and (x, y) == sign_pos:
                continue
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(RUIN_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_pastq_1", "combate_pastq_2", "combate_pastq_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Wooden Thicket": madera + arbustos (Mundo 10/15/19/22),
        # nunca combinados antes.
        WOOD_FLOOR = ["sprite49", "sprite50", "sprite51", "sprite52", "sprite53", "sprite54"]
        BUSH = ["sprite39", "sprite40", "sprite48"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(WOOD_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(BUSH)} for x, y in old_forest_positions
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
    dict(scene_key="pastq_grove_1", title="Pasado pregunta: Did you/we/they...?",
         description_en="Practica preguntas en pasado con Did + I/you/we/they",
         objective_en="Practica Did you/we/they...? + respuesta corta", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="pastq_grove_2", title="Pasado pregunta: Did he/she...?",
         description_en="Practica preguntas en pasado con Did + he/she/it",
         objective_en="Practica Did he/she/it...? + respuesta corta", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="pastq_square", title="Repaso: Did + respuesta corta",
         description_en="Repasa las preguntas en pasado antes del examen",
         objective_en="Repasa Did...? + respuesta corta", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_pastq_1", title="Los ogros invaden el matorral de madera",
         description_en="Defiende el matorral mientras repasas el pasado en pregunta",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_pastq_2", title="Los ogros atacan el matorral de madera",
         description_en="Elimina a los ogros del matorral",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_pastq_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas el pasado simple derrotando al jefe",
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
    ("pastq_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a practicar preguntas en "
     "pasado con 'Did' + verbo base. Pregunta 'Are you ready?'. Si el jugador no "
     "sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa "
     "la tarea si responde afirmativamente.",
     "Great! Let's ask about yesterday."),
    ("pastq_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "Para preguntar en pasado, se usa 'Did' + sujeto + verbo "
                       "BASE, sin importar el sujeto. 'Did you play soccer "
                       "yesterday?'. La respuesta corta es 'Yes, I did' o 'No, "
                       "I didn't'.",
               ["Did you play soccer yesterday?", "Yes, I did", "No, I didn't"]),
     "Great! Did you...? -- Yes, I did."),
    ("pastq_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'Did we work yesterday?' -- mismo patron, 'did' no "
                       "cambia con 'we'.",
               ["Did we work yesterday?", "Yes, we did", "No, we didn't"]),
     "Perfect! Did we...? -- same pattern."),
    ("pastq_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'Did they walk to school?' -- mismo patron con 'they'.",
               ["Did they walk to school?", "Yes, they did", "No, they didn't"]),
     "Exactly! Did they...? -- Yes, they did."),
    ("pastq_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'Did you watch a movie?' -- mismo patron.",
               ["Did you watch a movie?", "Yes, I did", "No, I didn't"],
               extra="Ademas, para cerrar, pide un repaso de las 4 preguntas de "
                     "este mapa (play, work, walk, watch) con 'Did'."),
     "Amazing! Did works with I/you/we/they!"),

    ("pastq_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'Did he cook dinner?' -- 'did' TAMPOCO cambia con "
                       "he/she/it (a diferencia de presente simple, donde 'do' "
                       "se convierte en 'does'). Siempre 'did', para cualquier "
                       "sujeto.",
               ["Did he cook dinner?", "Yes, he did", "No, he didn't"]),
     "Great! Did he...? -- did never changes."),
    ("pastq_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'Did she dance all night?' -- mismo patron, 'did' no "
                       "cambia.",
               ["Did she dance all night?", "Yes, she did", "No, she didn't"]),
     "Perfect! Did she...? -- same did."),
    ("pastq_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'Did he jump over the fence?' -- mismo patron.",
               ["Did he jump over the fence?", "Yes, he did", "No, he didn't"]),
     "Exactly! Did he...? -- Yes, he did."),
    ("pastq_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'Did she climb the mountain?' -- mismo patron.",
               ["Did she climb the mountain?", "Yes, she did", "No, she didn't"]),
     "Right! Did she...? -- Yes, she did."),
    ("pastq_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'Did you clean your room?' -- mismo patron.",
               ["Did you clean your room?", "Yes, I did", "No, I didn't"],
               extra="Ademas, para cerrar, pide un repaso de las preguntas de "
                     "este mapa (cook, dance, jump, climb, clean) con 'Did', "
                     "remarcando que 'did' es igual para todos los sujetos."),
     "Awesome! Now you can ask about the past!"),

    ("pastq_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'Did you play soccer?' se "
     "responde 'Yes, I did' o 'No, I didn't'. Dale a elegir: 'Did you play "
     "soccer?', 'Yes, I did', 'No, I didn't'. Completa la tarea cuando el "
     "jugador diga correctamente al menos 3. Es repaso, no introduzcas verbos "
     "nuevos.",
     "Great! Did you...? still solid."),
    ("pastq_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'Did he cook dinner?' -- 'did' es "
     "igual para todos los sujetos, a diferencia de 'do/does' en presente "
     "simple. Dale a elegir: 'Did he cook dinner?', 'Yes, he did', 'No, he "
     "didn't'. Completa la tarea cuando el jugador diga correctamente al menos "
     "3. Repaso, sin verbos nuevos.",
     "Exactly! Did he...? well done."),
    ("pastq_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: despues de 'did', el verbo siempre "
     "vuelve a forma base (walk, not walked). Dale a elegir: 'Did they walk to "
     "school?', 'Did she watch a movie?', 'Yes, they did. Yes, she did'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. "
     "Repaso, sin verbos nuevos.",
     "Perfect! Did + base form, always."),
    ("pastq_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: la respuesta corta repite "
     "'did'/'didn't', nunca el verbo completo. Dale a elegir: 'Did we work "
     "yesterday? Yes, we did', 'Did it rain? No, it didn't'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin verbos "
     "nuevos.",
     "Great! Short answers with did/didn't, got it."),
    ("pastq_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: 'Did' + sujeto + verbo base + ?, para "
     "cualquier sujeto. Este es el repaso final antes del examen. Pide al "
     "jugador que haga al menos 3 preguntas con respuesta corta usando "
     "cualquiera de los 9 verbos vistos (play, work, walk, watch, cook, dance, "
     "jump, climb, clean) y cualquier sujeto. Completa la tarea cuando lo haga.",
     "Amazing! You've mastered the simple past now!"),
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
    ("pastq_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("pastq_grove_1", "Mochi"), None, 0),
    ("pastq_grove_1", 2, "Aprende 'Did you play' con Joy", "talk_to_npc", ("pastq_grove_1", "Joy"), None, 0),
    ("pastq_grove_1", 3, "Aprende 'Did we work' con Ann", "talk_to_npc", ("pastq_grove_1", "Ann"), None, 0),
    ("pastq_grove_1", 4, "Aprende 'Did they walk' con Sam", "talk_to_npc", ("pastq_grove_1", "Sam"), None, 0),
    ("pastq_grove_1", 5, "Aprende 'Did you watch' con Amy", "talk_to_npc", ("pastq_grove_1", "Amy"), None, 0),

    ("pastq_grove_2", 1, "Aprende 'Did he cook' con Joy", "talk_to_npc", ("pastq_grove_2", "Joy"), None, 0),
    ("pastq_grove_2", 2, "Aprende 'Did she dance' con Ann", "talk_to_npc", ("pastq_grove_2", "Ann"), None, 0),
    ("pastq_grove_2", 3, "Aprende 'Did he jump' con Sam", "talk_to_npc", ("pastq_grove_2", "Sam"), None, 0),
    ("pastq_grove_2", 4, "Aprende 'Did she climb' con Zoe", "talk_to_npc", ("pastq_grove_2", "Zoe"), None, 0),
    ("pastq_grove_2", 5, "Aprende 'Did you clean' con Tom", "talk_to_npc", ("pastq_grove_2", "Tom"), None, 0),

    ("pastq_square", 1, "Repasa Did you con Toro", "talk_to_npc", ("pastq_square", "Toro"), None, 0),
    ("pastq_square", 2, "Repasa Did he con Sam", "talk_to_npc", ("pastq_square", "Sam"), None, 0),
    ("pastq_square", 3, "Repasa Did they/she con Joy", "talk_to_npc", ("pastq_square", "Joy"), None, 0),
    ("pastq_square", 4, "Repasa respuestas cortas con Ann", "talk_to_npc", ("pastq_square", "Ann"), None, 0),
    ("pastq_square", 5, "Repaso final con Tom", "talk_to_npc", ("pastq_square", "Tom"), None, 0),

    ("combate_pastq_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_pastq_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_pastq_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_pastq_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_pastq_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 26 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
