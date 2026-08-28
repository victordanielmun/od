"""
Mundo 11: Presente Simple (negativo) -- Etapas 1-4. Segundo paso del
bloque "presente simple" (10=afirmativo, 11=negativo, 12=pregunta).
Reusa los 5 verbos de Mundo 10 (play, like, work, live, eat) para que el
contraste afirmativo->negativo sea directo, igual que Mundo 6 reuso las
profesiones de Mundo 3 para el negativo de "to be".

Map1 = I/you/we/they + don't (forma base).
Map2 = he/she/it + doesn't (forma base -- el verbo pierde la -s).
Map3 = repaso contrastando afirmativo vs negativo.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README), no como parche posterior.

Terreno nuevo: patio de piedra/ladrillo gris (dialogo) + duna arenosa
(combate) -- combinaciones de sprite no usadas antes (verificado con
crop_atlas.py: terrain sprite9-11 y sprite37-40, forest sprite51/56/36 y
63/54).

Uso:
    python mundo11_presente_negativo_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "nevergreen_grove_1"),
    ("the_village_2", "nevergreen_grove_2"),
    ("clock_tower", "nevergreen_square"),
    ("combate_town_1", "combate_nevergreen_1"),
    ("combate_town_2", "combate_nevergreen_2"),
    ("combat_town_boss", "combate_nevergreen_boss"),
]

SIGNS = {
    "nevergreen_grove_1": (450, 250,
        "# 🚫 Presente Simple negativo: don't\n\n"
        "Con **I / you / we / they**, para negar se usa **don't** + verbo base.\n\n"
        "⚽ **I don't play soccer** - yo no juego futbol\n"
        "🍕 **You don't like pizza** - a ti no te gusta la pizza\n"
        "🔨 **We don't work here** - nosotros no trabajamos aqui\n"
        "🏠 **They don't live nearby** - ellos no viven cerca\n\n"
        "💡 'Don't' = 'do not'."),
    "nevergreen_grove_2": (450, 450,
        "# ⛔ Presente Simple negativo: doesn't\n\n"
        "Con **he / she / it**, para negar se usa **doesn't** + verbo base (sin -s).\n\n"
        "⚽ **He doesn't play soccer** - el no juega futbol\n"
        "🍕 **She doesn't like pizza** - a ella no le gusta la pizza\n"
        "⚙️ **It doesn't work well** - no funciona bien\n"
        "🍳 **She doesn't eat breakfast** - ella no desayuna\n\n"
        "❗ 'Doesn't' ya tiene la -s, por eso el verbo vuelve a su forma base."),
    "nevergreen_square": (450, 250,
        "# 🔁 Repaso: afirmativo vs negativo\n\n"
        "Antes del examen, compara ambas formas con el mismo verbo.\n\n"
        "👉 **I play** / **I don't play**\n"
        "👉 **He plays** / **He doesn't play**\n"
        "👉 **It works** / **It doesn't work**\n\n"
        "💬 Don't con I/you/we/they. Doesn't con he/she/it (y el verbo pierde la -s)."),
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

    if dst in ("nevergreen_grove_1", "nevergreen_grove_2", "nevergreen_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "patio de ladrillo gris": piso de ladrillo + arbustos/helechos escasos.
        BRICK_FLOOR = ["sprite9", "sprite10", "sprite11"]
        YARD_DECOR = ["sprite51", "sprite56", "sprite36"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(BRICK_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(YARD_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_nevergreen_1", "combate_nevergreen_2", "combate_nevergreen_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "duna arenosa": piso de arena + cactus/matorral escasos.
        DUNE_FLOOR = ["sprite37", "sprite38", "sprite39", "sprite40"]
        DUNE_DECOR = ["sprite63", "sprite54"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(DUNE_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(DUNE_DECOR)} for x, y in old_forest_positions
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
    dict(scene_key="nevergreen_grove_1", title="Presente simple negativo: don't",
         description_en="Practica don't con I/you/we/they",
         objective_en="Practica I/you/we/they + don't + verbo", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="nevergreen_grove_2", title="Presente simple negativo: doesn't",
         description_en="Practica doesn't con he/she/it",
         objective_en="Practica he/she/it + doesn't + verbo", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="nevergreen_square", title="Repaso: afirmativo vs negativo",
         description_en="Repasa el contraste antes del examen",
         objective_en="Repasa I play vs I don't play", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_nevergreen_1", title="Los ogros invaden la duna",
         description_en="Defiende la duna mientras repasas presente simple negativo",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_nevergreen_2", title="Los ogros atacan la duna",
         description_en="Elimina a los ogros de la duna",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_nevergreen_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas el presente simple negativo derrotando al jefe",
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
    ("nevergreen_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a practicar como negar en presente "
     "simple con 'don't' (I don't play, you don't like...). Pregunta 'Are you ready?'. "
     "Si el jugador no sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. "
     "Completa la tarea si responde afirmativamente.",
     "Great! Let's learn how to say no."),
    ("nevergreen_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "Para negar con 'I', se usa 'don't' + verbo base: 'I don't play "
                       "soccer' (I do not play soccer).",
               ["I don't play soccer", "No, I don't play soccer", "I don't play soccer, I read"]),
     "Great! I don't -- do not, shortened."),
    ("nevergreen_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "Para negar con 'you', se usa 'don't' + verbo base: 'You don't "
                       "like pizza' (you do not like pizza).",
               ["You don't like pizza", "No, you don't like pizza", "You don't like pizza, right?"]),
     "Perfect! You don't -- same rule."),
    ("nevergreen_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "Para negar con 'we', se usa 'don't' + verbo base: 'We don't "
                       "work here' (we do not work here).",
               ["We don't work here", "No, we don't work here", "We don't work here, we study"]),
     "Exactly! We don't -- no changes to the verb."),
    ("nevergreen_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "Para negar con 'they', se usa 'don't' + verbo base: 'They "
                       "don't live nearby' (they do not live nearby).",
               ["They don't live nearby", "No, they don't live nearby", "They don't live nearby, they live far"],
               extra="Ademas, para cerrar, pide un repaso de los 4 verbos de este mapa "
                     "(play, like, work, live) negados con 'don't'."),
     "Amazing! Don't works with I/you/we/they!"),

    ("nevergreen_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "Para negar con 'he', se usa 'doesn't' + verbo base (sin -s): "
                       "'He doesn't play soccer' (he does not play soccer). 'Doesn't' "
                       "ya tiene la -s, por eso el verbo vuelve a su forma base.",
               ["He doesn't play soccer", "No, he doesn't play soccer", "He doesn't play soccer, he swims"]),
     "Great! Doesn't -- and the verb loses the -s."),
    ("nevergreen_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "Para negar con 'she', se usa 'doesn't' + verbo base (sin -s): "
                       "'She doesn't like pizza'.",
               ["She doesn't like pizza", "No, she doesn't like pizza", "She doesn't like pizza, she likes pasta"]),
     "Perfect! Doesn't like -- not likes."),
    ("nevergreen_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "Para negar con 'it', se usa 'doesn't' + verbo base (sin -s): "
                       "'It doesn't work well'.",
               ["It doesn't work well", "No, it doesn't work well", "It doesn't work well, it's broken"]),
     "Exactly! Doesn't work -- not works."),
    ("nevergreen_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "Para negar con 'he', se usa 'doesn't' + verbo base (sin -s): "
                       "'He doesn't live nearby'.",
               ["He doesn't live nearby", "No, he doesn't live nearby", "He doesn't live nearby, he lives far"]),
     "Right! Doesn't live -- not lives."),
    ("nevergreen_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "Para negar con 'she', se usa 'doesn't' + verbo base (sin -s): "
                       "'She doesn't eat breakfast'.",
               ["She doesn't eat breakfast", "No, she doesn't eat breakfast", "She doesn't eat breakfast, she eats lunch"],
               extra="Ademas, para cerrar, pide un repaso de los verbos de este mapa "
                     "negados con 'doesn't' (play, like, work, live, eat), siempre en "
                     "forma base sin -s."),
     "Awesome! Doesn't + base form, always!"),

    ("nevergreen_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: afirmativo 'I play' (sin -s), "
     "negativo 'I don't play' -- 'don't' con I/you/we/they. Dale a elegir: 'I play "
     "soccer', 'I don't play soccer', 'I play soccer, I don't play tennis'. Completa "
     "la tarea cuando el jugador diga correctamente al menos 3. Es repaso, no "
     "introduzcas verbos nuevos.",
     "Great! Play and don't play, still solid."),
    ("nevergreen_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: afirmativo 'He plays' (con -s), negativo 'He "
     "doesn't play' (el verbo vuelve a su forma base). Dale a elegir: 'He plays "
     "soccer', 'He doesn't play soccer', 'He plays soccer, he doesn't play tennis'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "verbos nuevos.",
     "Exactly! Plays and doesn't play, well done."),
    ("nevergreen_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: afirmativo 'We work'/'It works', negativo "
     "'We don't work'/'It doesn't work'. Dale a elegir: 'We work here', 'It doesn't "
     "work well', 'We work here but it doesn't work well'. Completa la tarea cuando el "
     "jugador diga correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Perfect! Work/works and don't/doesn't work, solid."),
    ("nevergreen_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: afirmativo 'They live'/'He lives', negativo "
     "'They don't live'/'He doesn't live'. Dale a elegir: 'They live nearby', 'He "
     "doesn't live nearby', 'They live nearby, he doesn't'. Completa la tarea cuando "
     "el jugador diga correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Great! Live/lives and don't/doesn't live, got it."),
    ("nevergreen_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: 'don't' con I/you/we/they, 'doesn't' con "
     "he/she/it -- y el verbo vuelve a su forma base despues de 'doesn't'. Este es el "
     "repaso final antes del examen. Pide al jugador que diga al menos 3 frases "
     "mezclando afirmativo y negativo con cualquiera de los verbos vistos (play, like, "
     "work, live, eat). Completa la tarea cuando lo haga.",
     "Amazing! You've got the negative present simple now!"),
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
    ("nevergreen_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("nevergreen_grove_1", "Mochi"), None, 0),
    ("nevergreen_grove_1", 2, "Aprende 'I don't play' con Joy", "talk_to_npc", ("nevergreen_grove_1", "Joy"), None, 0),
    ("nevergreen_grove_1", 3, "Aprende 'You don't like' con Ann", "talk_to_npc", ("nevergreen_grove_1", "Ann"), None, 0),
    ("nevergreen_grove_1", 4, "Aprende 'We don't work' con Sam", "talk_to_npc", ("nevergreen_grove_1", "Sam"), None, 0),
    ("nevergreen_grove_1", 5, "Aprende 'They don't live' con Amy", "talk_to_npc", ("nevergreen_grove_1", "Amy"), None, 0),

    ("nevergreen_grove_2", 1, "Aprende 'He doesn't play' con Joy", "talk_to_npc", ("nevergreen_grove_2", "Joy"), None, 0),
    ("nevergreen_grove_2", 2, "Aprende 'She doesn't like' con Ann", "talk_to_npc", ("nevergreen_grove_2", "Ann"), None, 0),
    ("nevergreen_grove_2", 3, "Aprende 'It doesn't work' con Sam", "talk_to_npc", ("nevergreen_grove_2", "Sam"), None, 0),
    ("nevergreen_grove_2", 4, "Aprende 'He doesn't live' con Zoe", "talk_to_npc", ("nevergreen_grove_2", "Zoe"), None, 0),
    ("nevergreen_grove_2", 5, "Aprende 'She doesn't eat' con Tom", "talk_to_npc", ("nevergreen_grove_2", "Tom"), None, 0),

    ("nevergreen_square", 1, "Repasa play/don't play con Toro", "talk_to_npc", ("nevergreen_square", "Toro"), None, 0),
    ("nevergreen_square", 2, "Repasa plays/doesn't play con Sam", "talk_to_npc", ("nevergreen_square", "Sam"), None, 0),
    ("nevergreen_square", 3, "Repasa work/doesn't work con Joy", "talk_to_npc", ("nevergreen_square", "Joy"), None, 0),
    ("nevergreen_square", 4, "Repasa live/doesn't live con Ann", "talk_to_npc", ("nevergreen_square", "Ann"), None, 0),
    ("nevergreen_square", 5, "Repaso final con Tom", "talk_to_npc", ("nevergreen_square", "Tom"), None, 0),

    ("combate_nevergreen_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_nevergreen_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_nevergreen_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_nevergreen_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_nevergreen_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 11 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
