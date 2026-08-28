"""
Mundo 22: Presente Continuo -- Etapas 1-4. Segundo mundo del Bloque C.
Introduce 'to be' (am/is/are, ya conocido desde mundos 3-7) + verbo-ing
para describir acciones que pasan AHORA -- contraste directo con
presente simple (mundos 10-12, que describe rutinas/habitos).

Map1 = 4 frases con am/are + verbo-ing (I/you/we/they).
Map2 = 5 frases con is + verbo-ing (he/she/it).
Map3 = repaso contrastando am/is/are + verbo-ing, y con presente simple.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Wooden Ruins" (madera + decoracion de ruinas de Mundo 7/19/21,
nunca combinados) para dialogo, "Rocky Yard" (piso rocoso + arbustos/
helechos de Mundo 11/17, nunca combinados) para combate.

Uso:
    python mundo22_continuo_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "ing_grove_1"),
    ("the_village_2", "ing_grove_2"),
    ("clock_tower", "ing_square"),
    ("combate_town_1", "combate_ing_1"),
    ("combate_town_2", "combate_ing_2"),
    ("combat_town_boss", "combate_ing_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "ing_grove_1": (450, 250,
        "# 🏃 Presente Continuo: am / are + -ing\n\n"
        "Describe una accion que esta pasando AHORA MISMO.\n\n"
        "⚽ **I am playing** - estoy jugando (ahora)\n"
        "🔨 **You are working** - estas trabajando (ahora)\n"
        "🍳 **We are eating** - estamos comiendo (ahora)\n"
        "📖 **They are reading** - estan leyendo (ahora)\n\n"
        "💡 'Am'/'are' + verbo-ing, distinto del presente simple (rutina)."),
    "ing_grove_2": (450, 450,
        "# ☔ Presente Continuo: is + -ing\n\n"
        "Con he/she/it usamos 'is' + verbo-ing.\n\n"
        "⚽ **He is playing** - el esta jugando (ahora)\n"
        "🔨 **She is working** - ella esta trabajando (ahora)\n"
        "☔ **It is raining** - esta lloviendo (ahora)\n"
        "🍳 **He is eating** - el esta comiendo (ahora)\n"
        "📖 **She is reading** - ella esta leyendo (ahora)\n\n"
        "❗ Compara: 'She reads every day' (habito) vs 'She is reading now' (ahora)."),
    "ing_square": (450, 550,
        "# 🔁 Repaso: am / is / are + -ing\n\n"
        "Antes del examen, repasa el presente continuo completo.\n\n"
        "👉 I am / You are / We are / They are + -ing\n"
        "👉 He is / She is / It is + -ing\n\n"
        "💬 Recuerda el contraste: 'I play' (rutina) vs 'I am playing' (ahora)."),
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

    if dst in ("ing_grove_1", "ing_grove_2", "ing_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Wooden Ruins": madera + decoracion de ruinas (Mundo
        # 7/19/21), nunca combinados antes.
        WOOD_FLOOR = ["sprite49", "sprite50", "sprite51", "sprite52", "sprite53", "sprite54"]
        RUIN_DECOR = ["sprite34", "sprite35", "sprite43", "sprite44", "sprite61"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(WOOD_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(RUIN_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_ing_1", "combate_ing_2", "combate_ing_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Rocky Yard": piso rocoso + arbustos/helechos (Mundo
        # 11/17), nunca combinados antes.
        ROCK_FLOOR = ["sprite41", "sprite42", "sprite43", "sprite44", "sprite45", "sprite46", "sprite47", "sprite48"]
        YARD_DECOR = ["sprite51", "sprite56", "sprite36"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(ROCK_FLOOR)
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
    dict(scene_key="ing_grove_1", title="Presente continuo: am/are + -ing",
         description_en="Practica am/are + verbo-ing con I/you/we/they",
         objective_en="Practica I am/You are/We are/They are + verbo-ing", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="ing_grove_2", title="Presente continuo: is + -ing",
         description_en="Practica is + verbo-ing con he/she/it",
         objective_en="Practica He-She-It is + verbo-ing", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="ing_square", title="Repaso: am / is / are + -ing",
         description_en="Repasa el presente continuo antes del examen",
         objective_en="Repasa am/is/are + verbo-ing", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_ing_1", title="Los ogros invaden el patio rocoso",
         description_en="Defiende el patio mientras repasas presente continuo",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_ing_2", title="Los ogros atacan el patio rocoso",
         description_en="Elimina a los ogros del patio",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_ing_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas el presente continuo derrotando al jefe",
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
    ("ing_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a describir acciones que pasan "
     "AHORA con presente continuo (am/is/are + verbo-ing). Pregunta 'Are you "
     "ready?'. Si el jugador no sabe que responder, sugierele 'Sure', 'OK', 'Yes' "
     "o 'Let's go'. Completa la tarea si responde afirmativamente.",
     "Great! Let's see what's happening right now."),
    ("ing_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'I am playing' usa presente continuo: 'am' (ya conocido "
                       "de 'to be') + verbo-ing. Describe una accion que esta "
                       "pasando AHORA, distinto del presente simple ('I play' = "
                       "costumbre).",
               ["I am playing", "I am playing right now", "Yes, I am playing"]),
     "Great! I am playing -- right now."),
    ("ing_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'You are working' -- mismo patron con 'are' + verbo-ing.",
               ["You are working", "You are working right now", "Yes, you are working"]),
     "Perfect! You are working -- right now."),
    ("ing_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'We are eating' -- mismo patron con 'are' + verbo-ing.",
               ["We are eating", "We are eating right now", "Yes, we are eating"]),
     "Exactly! We are eating -- right now."),
    ("ing_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'They are reading' -- mismo patron con 'are' + verbo-ing.",
               ["They are reading", "They are reading right now", "Yes, they are reading"],
               extra="Ademas, para cerrar, pide un repaso de las 4 frases de este "
                     "mapa con am/are + verbo-ing."),
     "Amazing! You know am/are + -ing now!"),

    ("ing_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'He is playing' usa 'is' + verbo-ing, igual que con 'to "
                       "be' ya conocido.",
               ["He is playing", "He is playing right now", "Yes, he is playing"]),
     "Great! He is playing -- right now."),
    ("ing_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'She is working' -- mismo patron con 'is' + verbo-ing.",
               ["She is working", "She is working right now", "Yes, she is working"]),
     "Perfect! She is working -- right now."),
    ("ing_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'It is raining' -- mismo patron, para el clima AHORA "
                       "mismo (distinto del presente simple, que no se usa asi "
                       "para el clima).",
               ["It is raining", "It is raining right now", "Yes, it is raining"]),
     "Exactly! It is raining -- right now."),
    ("ing_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'He is eating' -- mismo patron con 'is' + verbo-ing.",
               ["He is eating", "He is eating right now", "Yes, he is eating"]),
     "Right! He is eating -- right now."),
    ("ing_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'She is reading' -- mismo patron con 'is' + verbo-ing.",
               ["She is reading", "She is reading right now", "Yes, she is reading"],
               extra="Ademas, para cerrar, pide un repaso de is + verbo-ing con "
                     "cualquiera de las 5 frases de este mapa."),
     "Awesome! Is + -ing, you got it!"),

    ("ing_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'I am playing' y 'You are "
     "working' -- am/are + verbo-ing. Dale a elegir: 'I am playing', 'You are "
     "working', 'I am playing and you are working'. Completa la tarea cuando el "
     "jugador diga correctamente al menos 3. Es repaso, no introduzcas verbos "
     "nuevos.",
     "Great! Am and are, still solid."),
    ("ing_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'We are eating' y 'They are reading' -- "
     "are + verbo-ing. Dale a elegir: 'We are eating', 'They are reading', 'We are "
     "eating and they are reading'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Exactly! Are + -ing, well done."),
    ("ing_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'He is playing' y 'She is working' -- is "
     "+ verbo-ing. Dale a elegir: 'He is playing', 'She is working', 'He is "
     "playing and she is working'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Perfect! Is + -ing, solid."),
    ("ing_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'It is raining', 'He is eating', 'She is "
     "reading' -- is + verbo-ing con he/she/it. Dale a elegir: 'It is raining', "
     "'He is eating', 'She is reading'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Great! It, he, she + is -- got it."),
    ("ing_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda el contraste: 'I play soccer every day' "
     "(presente simple, rutina) vs 'I am playing soccer now' (presente continuo, "
     "ahora mismo). Este es el repaso final antes del examen. Pide al jugador que "
     "diga al menos 3 frases con am/is/are + verbo-ing, usando cualquiera de los "
     "verbos vistos (play, work, eat, read, rain). Completa la tarea cuando lo "
     "haga.",
     "Amazing! You know present continuous now!"),
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
    ("ing_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("ing_grove_1", "Mochi"), None, 0),
    ("ing_grove_1", 2, "Aprende 'I am playing' con Joy", "talk_to_npc", ("ing_grove_1", "Joy"), None, 0),
    ("ing_grove_1", 3, "Aprende 'You are working' con Ann", "talk_to_npc", ("ing_grove_1", "Ann"), None, 0),
    ("ing_grove_1", 4, "Aprende 'We are eating' con Sam", "talk_to_npc", ("ing_grove_1", "Sam"), None, 0),
    ("ing_grove_1", 5, "Aprende 'They are reading' con Amy", "talk_to_npc", ("ing_grove_1", "Amy"), None, 0),

    ("ing_grove_2", 1, "Aprende 'He is playing' con Joy", "talk_to_npc", ("ing_grove_2", "Joy"), None, 0),
    ("ing_grove_2", 2, "Aprende 'She is working' con Ann", "talk_to_npc", ("ing_grove_2", "Ann"), None, 0),
    ("ing_grove_2", 3, "Aprende 'It is raining' con Sam", "talk_to_npc", ("ing_grove_2", "Sam"), None, 0),
    ("ing_grove_2", 4, "Aprende 'He is eating' con Zoe", "talk_to_npc", ("ing_grove_2", "Zoe"), None, 0),
    ("ing_grove_2", 5, "Aprende 'She is reading' con Tom", "talk_to_npc", ("ing_grove_2", "Tom"), None, 0),

    ("ing_square", 1, "Repasa am/are con Toro", "talk_to_npc", ("ing_square", "Toro"), None, 0),
    ("ing_square", 2, "Repasa are con Sam", "talk_to_npc", ("ing_square", "Sam"), None, 0),
    ("ing_square", 3, "Repasa is con Joy", "talk_to_npc", ("ing_square", "Joy"), None, 0),
    ("ing_square", 4, "Repasa is (it/he/she) con Ann", "talk_to_npc", ("ing_square", "Ann"), None, 0),
    ("ing_square", 5, "Repaso final con Tom", "talk_to_npc", ("ing_square", "Tom"), None, 0),

    ("combate_ing_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_ing_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_ing_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_ing_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_ing_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 22 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
