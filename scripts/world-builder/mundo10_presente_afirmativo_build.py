"""
Mundo 10: Presente Simple (afirmativo) -- Etapas 1-4. Primer paso del
bloque "presente simple", partido en 3 mundos (10=afirmativo,
11=negativo, 12=pregunta) por la misma razon que "to be" se partio en 5
(mundos 3-7): es un salto de gramatica grande para un solo mundo.

Un solo tema (forma base I/you/we/they vs forma -s he/she/it), repetido
en 3 mapas. A diferencia de mundos anteriores, esta vez el contexto
gramatical (CUANDO se usa cada forma) va incluido desde el diseño inicial
de las instructions, no como parche posterior (lesson 9 del README).

Map1 = forma base (I/you/we/they + verbo sin cambios).
Map2 = forma -s (he/she/it + verbo-s).
Map3 = repaso contrastando ambas formas con el mismo verbo.

Terreno nuevo: bosque de pinos y arces (dialogo) + matorral tupido con
arbustos (combate) -- frames nunca usados en mundos anteriores
(sprite12/13/14 y sprite39/40/48 del atlas forest, verificados con
crop_atlas.py).

Uso:
    python mundo10_presente_afirmativo_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "daily_grove_1"),
    ("the_village_2", "daily_grove_2"),
    ("clock_tower", "daily_square"),
    ("combate_town_1", "combate_daily_1"),
    ("combate_town_2", "combate_daily_2"),
    ("combat_town_boss", "combate_daily_boss"),
]

SIGNS = {
    "daily_grove_1": (450, 250,
        "# 🌲 Presente Simple: forma base\n\n"
        "Con **I / you / we / they**, el verbo NO cambia (forma base).\n\n"
        "⚽ **I play soccer** - yo juego futbol\n"
        "🍕 **You like pizza** - a ti te gusta la pizza\n"
        "🔨 **We work here** - nosotros trabajamos aqui\n"
        "🏠 **They live nearby** - ellos viven cerca\n\n"
        "💡 Usamos esta forma para hablar de rutinas y habitos."),
    "daily_grove_2": (450, 450,
        "# 🍁 Presente Simple: forma -s\n\n"
        "Con **he / she / it**, el verbo agrega **-s**.\n\n"
        "⚽ **He plays soccer** - el juega futbol\n"
        "🍕 **She likes pizza** - a ella le gusta la pizza\n"
        "⚙️ **It works well** - funciona bien\n"
        "🍳 **She eats breakfast** - ella desayuna\n\n"
        "❗ 'Play' → 'plays'. Solo cambia con he/she/it, nunca con I/you/we/they."),
    "daily_square": (450, 250,
        "# 🔁 Repaso: forma base vs forma -s\n\n"
        "Antes del examen, compara el mismo verbo con distintos sujetos.\n\n"
        "👉 **I play** / **He plays**\n"
        "👉 **You like** / **She likes**\n"
        "👉 **We work** / **It works**\n\n"
        "💬 Con I/you/we/they: sin -s. Con he/she/it: con -s."),
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

    if dst in ("daily_grove_1", "daily_grove_2", "daily_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "bosque de pinos y arces": pasto + pinos/arboles de otono.
        PINE_MIX = ["sprite12", "sprite13", "sprite14"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(["sprite1", "sprite2", "sprite3"])
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.18:
                new_forest.append({"x": x, "y": y, "frame": random.choice(PINE_MIX)})
        wallsData["forest"] = new_forest

    if dst in ("combate_daily_1", "combate_daily_2", "combate_daily_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "matorral tupido": pasto + arbustos redondos escasos.
        BUSH = ["sprite39", "sprite40", "sprite48"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(["sprite1", "sprite2", "sprite3"])
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(BUSH)} for x, y in old_forest_positions
                      if random.random() < 0.6]
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
    dict(scene_key="daily_grove_1", title="Presente simple: forma base",
         description_en="Practica la forma base con I/you/we/they",
         objective_en="Practica I/you/we/they + verbo sin cambios", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="daily_grove_2", title="Presente simple: forma -s",
         description_en="Practica la forma -s con he/she/it",
         objective_en="Practica he/she/it + verbo-s", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="daily_square", title="Repaso: forma base vs forma -s",
         description_en="Repasa el contraste antes del examen",
         objective_en="Repasa I play vs He plays", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_daily_1", title="Los ogros invaden el matorral",
         description_en="Defiende el matorral mientras repasas presente simple",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_daily_2", title="Los ogros atacan el matorral",
         description_en="Elimina a los ogros del matorral",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_daily_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas el presente simple afirmativo derrotando al jefe",
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
    ("daily_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a practicar el presente simple con "
     "rutinas diarias (I play, you like, we work, they live). Pregunta 'Are you ready?'. "
     "Si el jugador no sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. "
     "Completa la tarea si responde afirmativamente.",
     "Great! Let's talk about everyday things."),
    ("daily_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'I play' usa la forma base del verbo (sin cambios) porque el "
                       "sujeto es 'I'. Con I/you/we/they, el verbo siempre queda igual.",
               ["I play soccer", "I play soccer every day", "Yes, I play soccer"]),
     "Great! I play -- no changes with I."),
    ("daily_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'You like' usa la forma base del verbo (sin cambios) porque el "
                       "sujeto es 'you'. Con I/you/we/they, el verbo siempre queda igual.",
               ["You like pizza", "You like pizza, right?", "Yes, you like pizza"]),
     "Perfect! You like -- same rule."),
    ("daily_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'We work' usa la forma base del verbo (sin cambios) porque el "
                       "sujeto es 'we'. Con I/you/we/they, el verbo siempre queda igual.",
               ["We work here", "We work here every day", "Yes, we work here"]),
     "Exactly! We work -- no -s needed."),
    ("daily_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'They live' usa la forma base del verbo (sin cambios) porque el "
                       "sujeto es 'they'. Con I/you/we/they, el verbo siempre queda igual.",
               ["They live nearby", "They live nearby, right?", "Yes, they live nearby"],
               extra="Ademas, para cerrar, pide un repaso de los 4 verbos de este mapa "
                     "(play, like, work, live) con I/you/we/they, sin -s."),
     "Amazing! I/you/we/they -- always the base form!"),

    ("daily_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "Con 'he', el verbo en presente simple agrega '-s': 'play' se "
                       "convierte en 'plays'. Por eso decimos 'He plays soccer'.",
               ["He plays soccer", "He plays soccer every day", "Yes, he plays soccer"]),
     "Great! Play -- plays, with he."),
    ("daily_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "Con 'she', el verbo agrega '-s': 'like' se convierte en 'likes'. "
                       "Por eso decimos 'She likes pizza'.",
               ["She likes pizza", "She likes pizza, right?", "Yes, she likes pizza"]),
     "Perfect! Like -- likes, with she."),
    ("daily_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "Con 'it', el verbo agrega '-s': 'work' se convierte en 'works'. "
                       "Por eso decimos 'It works well'.",
               ["It works well", "It works well, right?", "Yes, it works well"]),
     "Exactly! Work -- works, with it."),
    ("daily_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "Con 'he', el verbo agrega '-s': 'live' se convierte en 'lives'. "
                       "Por eso decimos 'He lives nearby'.",
               ["He lives nearby", "He lives nearby, right?", "Yes, he lives nearby"]),
     "Right! Live -- lives, with he."),
    ("daily_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "Con 'she', el verbo agrega '-s': 'eat' se convierte en 'eats'. "
                       "Por eso decimos 'She eats breakfast'.",
               ["She eats breakfast", "She eats breakfast every day", "Yes, she eats breakfast"],
               extra="Ademas, para cerrar, pide un repaso de los verbos de este mapa "
                     "(plays, likes, works, lives, eats) con he/she/it, siempre con -s."),
     "Awesome! He/she/it -- always add -s!"),

    ("daily_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'I play' (sin -s) pero 'He plays' "
     "(con -s) -- el mismo verbo cambia segun el sujeto. Dale a elegir: 'I play soccer', "
     "'He plays soccer', 'I play soccer, he plays soccer too'. Completa la tarea cuando "
     "el jugador diga correctamente al menos 3. Es repaso, no introduzcas verbos nuevos.",
     "Great! Play and plays, still solid."),
    ("daily_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'You like' (sin -s) pero 'She likes' (con -s). "
     "Dale a elegir: 'You like pizza', 'She likes pizza', 'You like pizza and she likes "
     "it too'. Completa la tarea cuando el jugador diga correctamente al menos 3. "
     "Repaso, sin verbos nuevos.",
     "Exactly! Like and likes, well done."),
    ("daily_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'We work' (sin -s) pero 'It works' (con -s). "
     "Dale a elegir: 'We work here', 'It works well', 'We work here and it works well'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "verbos nuevos.",
     "Perfect! Work and works, solid."),
    ("daily_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'They live' (sin -s) pero 'He lives' (con -s). "
     "Dale a elegir: 'They live nearby', 'He lives nearby', 'They live nearby and he "
     "lives nearby too'. Completa la tarea cuando el jugador diga correctamente al "
     "menos 3. Repaso, sin verbos nuevos.",
     "Great! Live and lives, got it."),
    ("daily_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: con I/you/we/they el verbo queda igual; con "
     "he/she/it se agrega '-s'. Este es el repaso final antes del examen. Pide al "
     "jugador que diga al menos 3 frases mezclando ambas formas con cualquiera de los "
     "verbos vistos (play, like, work, live, eat). Completa la tarea cuando lo haga.",
     "Amazing! You've got the simple present now!"),
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
    ("daily_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("daily_grove_1", "Mochi"), None, 0),
    ("daily_grove_1", 2, "Aprende 'I play' con Joy", "talk_to_npc", ("daily_grove_1", "Joy"), None, 0),
    ("daily_grove_1", 3, "Aprende 'You like' con Ann", "talk_to_npc", ("daily_grove_1", "Ann"), None, 0),
    ("daily_grove_1", 4, "Aprende 'We work' con Sam", "talk_to_npc", ("daily_grove_1", "Sam"), None, 0),
    ("daily_grove_1", 5, "Aprende 'They live' con Amy", "talk_to_npc", ("daily_grove_1", "Amy"), None, 0),

    ("daily_grove_2", 1, "Aprende 'He plays' con Joy", "talk_to_npc", ("daily_grove_2", "Joy"), None, 0),
    ("daily_grove_2", 2, "Aprende 'She likes' con Ann", "talk_to_npc", ("daily_grove_2", "Ann"), None, 0),
    ("daily_grove_2", 3, "Aprende 'It works' con Sam", "talk_to_npc", ("daily_grove_2", "Sam"), None, 0),
    ("daily_grove_2", 4, "Aprende 'He lives' con Zoe", "talk_to_npc", ("daily_grove_2", "Zoe"), None, 0),
    ("daily_grove_2", 5, "Aprende 'She eats' con Tom", "talk_to_npc", ("daily_grove_2", "Tom"), None, 0),

    ("daily_square", 1, "Repasa play/plays con Toro", "talk_to_npc", ("daily_square", "Toro"), None, 0),
    ("daily_square", 2, "Repasa like/likes con Sam", "talk_to_npc", ("daily_square", "Sam"), None, 0),
    ("daily_square", 3, "Repasa work/works con Joy", "talk_to_npc", ("daily_square", "Joy"), None, 0),
    ("daily_square", 4, "Repasa live/lives con Ann", "talk_to_npc", ("daily_square", "Ann"), None, 0),
    ("daily_square", 5, "Repaso final con Tom", "talk_to_npc", ("daily_square", "Tom"), None, 0),

    ("combate_daily_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_daily_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_daily_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_daily_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_daily_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 10 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
