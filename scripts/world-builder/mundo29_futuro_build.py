"""
Mundo 29: Futuro (going to vs will) -- Etapas 1-4. Cierra el Bloque C
completo (mundos 21-29) y el bloque de tiempos verbales. Reusa 'to be'
(am/is/are, mundos 3-7) para 'going to' + verbo base.

Map1 = 4 frases con 'going to' (plan futuro, ya decidido).
Map2 = 5 frases con 'will' (decision espontanea / prediccion / promesa,
sin 'to be').
Map3 = repaso contrastando going to (planeado) vs will (espontaneo).

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12). El
letrero se excluye explicitamente del sorteo de `forest` (lesson 13).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Wooden Garden" (madera + flores de Mundo 5/8/14/24/25, nunca
combinadas) para dialogo, "Dusty Yard" (tierra + arbustos/helechos de
Mundo 11/17/22/27/28, nunca combinados) para combate.

Uso:
    python mundo29_futuro_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "future_grove_1"),
    ("the_village_2", "future_grove_2"),
    ("clock_tower", "future_square"),
    ("combate_town_1", "combate_future_1"),
    ("combate_town_2", "combate_future_2"),
    ("combat_town_boss", "combate_future_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "future_grove_1": (450, 250,
        "# 🗓️ Futuro: going to (plan)\n\n"
        "'Going to' + verbo base describe un PLAN futuro, algo ya decidido.\n\n"
        "⚽ **I am going to play soccer tomorrow** - voy a jugar futbol mañana\n"
        "🔨 **You are going to work tomorrow** - vas a trabajar mañana\n"
        "✈️ **He is going to travel next week** - el va a viajar la proxima semana\n"
        "📚 **She is going to study tonight** - ella va a estudiar esta noche\n\n"
        "💡 'Am/is/are' (ya conocido) + 'going to' + verbo base."),
    "future_grove_2": (450, 450,
        "# ⚡ Futuro: will (espontaneo)\n\n"
        "'Will' + verbo base se usa para decisiones espontaneas, promesas o predicciones.\n\n"
        "🤝 **I will help you** - te ayudare (decision en el momento)\n"
        "🌧️ **It will rain tomorrow** - lloverá mañana (prediccion)\n"
        "🏆 **They will win the game** - ganaran el juego (prediccion)\n"
        "👵 **We will visit grandma** - visitaremos a la abuela\n"
        "📞 **She will call you later** - ella te llamara despues\n\n"
        "❗ 'Will' no usa 'to be', va directo: sujeto + will + verbo base."),
    "future_square": (450, 550,
        "# 🔁 Repaso: going to vs will\n\n"
        "Antes del examen, compara ambos futuros.\n\n"
        "👉 Going to = plan ya decidido: 'I am going to study'\n"
        "👉 Will = espontaneo/promesa/prediccion: 'I will help you'\n\n"
        "💬 Ambos + verbo base, pero 'going to' usa am/is/are y 'will' no."),
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

    if dst in ("future_grove_1", "future_grove_2", "future_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Wooden Garden": madera + flores (Mundo 5/8/14/24/25),
        # nunca combinadas antes.
        WOOD_FLOOR = ["sprite49", "sprite50", "sprite51", "sprite52", "sprite53", "sprite54"]
        FLOWERS = ["sprite32", "sprite33", "sprite34", "sprite35", "sprite41", "sprite42"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(WOOD_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if sign_pos and (x, y) == sign_pos:
                continue
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(FLOWERS)})
        wallsData["forest"] = new_forest

    if dst in ("combate_future_1", "combate_future_2", "combate_future_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Dusty Yard": tierra + arbustos/helechos (Mundo
        # 11/17/22/27/28), nunca combinados antes.
        DIRT_FLOOR = ["sprite25", "sprite26", "sprite27", "sprite28", "sprite29", "sprite30"]
        YARD_DECOR = ["sprite51", "sprite56", "sprite36"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(DIRT_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(YARD_DECOR)} for x, y in old_forest_positions
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
    dict(scene_key="future_grove_1", title="Futuro: going to (plan)",
         description_en="Practica 'going to' para planes futuros",
         objective_en="Practica sujeto + am/is/are + going to + verbo", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="future_grove_2", title="Futuro: will (espontaneo)",
         description_en="Practica 'will' para decisiones espontaneas y predicciones",
         objective_en="Practica sujeto + will + verbo", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="future_square", title="Repaso: going to vs will",
         description_en="Repasa el contraste antes del examen",
         objective_en="Repasa going to vs will", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_future_1", title="Los ogros invaden el patio polvoriento",
         description_en="Defiende el patio mientras repasas el futuro",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_future_2", title="Los ogros atacan el patio polvoriento",
         description_en="Elimina a los ogros del patio",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_future_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas el futuro derrotando al jefe",
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
    ("future_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a hablar de planes futuros con "
     "'going to'. Pregunta 'Are you ready?'. Si el jugador no sabe que responder, "
     "sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea si responde "
     "afirmativamente.",
     "Great! Let's talk about plans."),
    ("future_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'Going to' + verbo base describe un PLAN futuro, algo "
                       "ya decidido. 'I am going to play soccer tomorrow' usa "
                       "'am' (ya conocido) + 'going to' + verbo base.",
               ["I am going to play soccer tomorrow", "I am going to play soccer tomorrow, right?", "Yes, I am going to play soccer tomorrow"]),
     "Great! Going to -- a plan."),
    ("future_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'You are going to work tomorrow' -- mismo patron con "
                       "'are'.",
               ["You are going to work tomorrow", "You are going to work tomorrow, right?", "Yes, you are going to work tomorrow"]),
     "Perfect! You are going to work."),
    ("future_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'He is going to travel next week' -- mismo patron con "
                       "'is'.",
               ["He is going to travel next week", "He is going to travel next week, right?", "Yes, he is going to travel next week"]),
     "Exactly! He is going to travel."),
    ("future_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'She is going to study tonight' -- mismo patron.",
               ["She is going to study tonight", "She is going to study tonight, right?", "Yes, she is going to study tonight"],
               extra="Ademas, para cerrar, pide un repaso de las 4 frases de "
                     "este mapa con 'going to'."),
     "Amazing! You know 'going to' now!"),

    ("future_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'Will' + verbo base se usa para decisiones "
                       "espontaneas o promesas, sin 'to be'. 'I will help "
                       "you' es una promesa que decides en el momento.",
               ["I will help you", "I will help you, I promise", "Yes, I will help you"]),
     "Great! I will help you -- a promise."),
    ("future_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'It will rain tomorrow' -- 'will' tambien se usa para "
                       "predicciones sin evidencia clara.",
               ["It will rain tomorrow", "It will rain tomorrow, I think", "Yes, it will rain tomorrow"]),
     "Perfect! It will rain -- a prediction."),
    ("future_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'They will win the game' -- mismo patron, "
                       "prediccion.",
               ["They will win the game", "They will win the game, I think", "Yes, they will win the game"]),
     "Exactly! They will win."),
    ("future_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'We will visit grandma' -- mismo patron, "
                       "decision/promesa.",
               ["We will visit grandma", "We will visit grandma this weekend", "Yes, we will visit grandma"]),
     "Right! We will visit grandma."),
    ("future_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'She will call you later' -- mismo patron.",
               ["She will call you later", "She will call you later, I promise", "Yes, she will call you later"],
               extra="Ademas, para cerrar, pide un repaso de las frases de "
                     "este mapa con 'will' (help, rain, win, visit, call)."),
     "Awesome! Will + base verb, always!"),

    ("future_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'going to' es un plan ya "
     "decidido -- 'I am going to play soccer' y 'You are going to work'. Dale a "
     "elegir: 'I am going to play soccer', 'You are going to work', 'I am going "
     "to play soccer and you are going to work'. Completa la tarea cuando el "
     "jugador diga correctamente al menos 3. Es repaso, no introduzcas verbos "
     "nuevos.",
     "Great! Going to, still solid."),
    ("future_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'He is going to travel' y 'She is "
     "going to study' -- planes ya decididos. Dale a elegir: 'He is going to "
     "travel next week', 'She is going to study tonight'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin verbos "
     "nuevos.",
     "Exactly! Going to with he/she, well done."),
    ("future_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'will' es espontaneo, sin 'to be' -- "
     "'I will help you' y 'It will rain tomorrow'. Dale a elegir: 'I will help "
     "you', 'It will rain tomorrow', 'I will help you if it rains'. Completa la "
     "tarea cuando el jugador diga correctamente al menos 3. Repaso, sin verbos "
     "nuevos.",
     "Perfect! Will, no 'to be' needed."),
    ("future_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'will' para predicciones y promesas -- "
     "'They will win the game', 'We will visit grandma', 'She will call you "
     "later'. Dale a elegir estas 3 frases. Completa la tarea cuando el jugador "
     "diga correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Great! Will for predictions and promises, got it."),
    ("future_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: 'going to' = plan ya decidido (usa "
     "am/is/are), 'will' = espontaneo/promesa/prediccion (sin 'to be'). Este es "
     "el repaso final antes del examen. Pide al jugador que diga al menos 3 "
     "frases mezclando 'going to' y 'will' con cualquiera de los verbos vistos "
     "(play, work, travel, study, help, rain, win, visit, call). Completa la "
     "tarea cuando lo haga.",
     "Amazing! You've mastered the future tense now!"),
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
    ("future_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("future_grove_1", "Mochi"), None, 0),
    ("future_grove_1", 2, "Aprende 'going to play' con Joy", "talk_to_npc", ("future_grove_1", "Joy"), None, 0),
    ("future_grove_1", 3, "Aprende 'going to work' con Ann", "talk_to_npc", ("future_grove_1", "Ann"), None, 0),
    ("future_grove_1", 4, "Aprende 'going to travel' con Sam", "talk_to_npc", ("future_grove_1", "Sam"), None, 0),
    ("future_grove_1", 5, "Aprende 'going to study' con Amy", "talk_to_npc", ("future_grove_1", "Amy"), None, 0),

    ("future_grove_2", 1, "Aprende 'will help' con Joy", "talk_to_npc", ("future_grove_2", "Joy"), None, 0),
    ("future_grove_2", 2, "Aprende 'will rain' con Ann", "talk_to_npc", ("future_grove_2", "Ann"), None, 0),
    ("future_grove_2", 3, "Aprende 'will win' con Sam", "talk_to_npc", ("future_grove_2", "Sam"), None, 0),
    ("future_grove_2", 4, "Aprende 'will visit' con Zoe", "talk_to_npc", ("future_grove_2", "Zoe"), None, 0),
    ("future_grove_2", 5, "Aprende 'will call' con Tom", "talk_to_npc", ("future_grove_2", "Tom"), None, 0),

    ("future_square", 1, "Repasa going to (play/work) con Toro", "talk_to_npc", ("future_square", "Toro"), None, 0),
    ("future_square", 2, "Repasa going to (travel/study) con Sam", "talk_to_npc", ("future_square", "Sam"), None, 0),
    ("future_square", 3, "Repasa will (help/rain) con Joy", "talk_to_npc", ("future_square", "Joy"), None, 0),
    ("future_square", 4, "Repasa will (win/visit/call) con Ann", "talk_to_npc", ("future_square", "Ann"), None, 0),
    ("future_square", 5, "Repaso final con Tom", "talk_to_npc", ("future_square", "Tom"), None, 0),

    ("combate_future_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_future_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_future_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_future_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_future_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 29 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
