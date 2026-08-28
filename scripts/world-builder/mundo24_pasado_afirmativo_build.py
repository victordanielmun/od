"""
Mundo 24: Pasado Simple (verbos regulares, afirmativo) -- Etapas 1-4.
Primer mundo del trio "pasado simple regular" (24=afirmativo,
25=negativo, 26=pregunta), partido por la misma razon que "to be"
(mundos 3-7) y presente simple (mundos 10-12): es un salto de gramatica
grande para un solo mundo. Reusa verbos ya conocidos (play, work,
cook, dance, jump, climb de mundos 10/23) en su forma pasada.

Map1 = 4 verbos con -ed (play, work, walk, watch).
Map2 = 5 verbos con -ed (cook, dance, jump, climb, clean).
Map3 = repaso: el pasado simple NUNCA cambia segun el sujeto (a
diferencia del presente simple).

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12). El
letrero se excluye explicitamente del sorteo de `forest` (lesson 13).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Sandy Flowerbed" (arena de Mundo 11/21/23 + flores de Mundo
5/8/14, nunca combinadas) para dialogo, "Cactus Meadow" (pasto + cactus
de Mundo 8/16, nunca combinados) para combate.

Uso:
    python mundo24_pasado_afirmativo_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "past_grove_1"),
    ("the_village_2", "past_grove_2"),
    ("clock_tower", "past_square"),
    ("combate_town_1", "combate_past_1"),
    ("combate_town_2", "combate_past_2"),
    ("combat_town_boss", "combate_past_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "past_grove_1": (450, 250,
        "# ⏳ Pasado Simple: -ed (parte 1)\n\n"
        "Para hablar de acciones terminadas, agregamos **-ed** al verbo.\n\n"
        "⚽ **I played soccer yesterday** - jugue futbol ayer\n"
        "🔨 **You worked yesterday** - trabajaste ayer\n"
        "🚶 **He walked to school** - el camino a la escuela\n"
        "📺 **She watched a movie** - ella vio una pelicula\n\n"
        "💡 El pasado simple NUNCA cambia segun el sujeto."),
    "past_grove_2": (450, 450,
        "# ⏳ Pasado Simple: -ed (parte 2)\n\n"
        "Seguimos con mas verbos en pasado.\n\n"
        "🍳 **We cooked dinner** - cocinamos la cena\n"
        "💃 **They danced all night** - bailaron toda la noche\n"
        "🦘 **He jumped over the fence** - salto la cerca\n"
        "🧗 **She climbed the mountain** - escalo la montaña\n"
        "🧹 **I cleaned my room** - limpie mi cuarto\n\n"
        "❗ 'Dance' termina en 'e', asi que solo se agrega '-d': danced."),
    "past_square": (450, 550,
        "# 🔁 Repaso: pasado simple con -ed\n\n"
        "Antes del examen, repasa los 9 verbos.\n\n"
        "👉 played, worked, walked, watched\n"
        "👉 cooked, danced, jumped, climbed, cleaned\n\n"
        "💬 Recuerda: -ed nunca cambia segun el sujeto (I/you/he/she/we/they)."),
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

    if dst in ("past_grove_1", "past_grove_2", "past_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Sandy Flowerbed": arena (Mundo 11/21/23) + flores (Mundo
        # 5/8/14), nunca combinadas antes.
        SAND_FLOOR = ["sprite37", "sprite38", "sprite39", "sprite40"]
        FLOWERS = ["sprite32", "sprite33", "sprite34", "sprite35", "sprite41", "sprite42"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(SAND_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if sign_pos and (x, y) == sign_pos:
                continue
            if random.random() < 0.16:
                new_forest.append({"x": x, "y": y, "frame": random.choice(FLOWERS)})
        wallsData["forest"] = new_forest

    if dst in ("combate_past_1", "combate_past_2", "combate_past_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Cactus Meadow": pasto + cactus (Mundo 8/16), nunca
        # combinados en un mapa de pasto antes.
        GRASS_FLOOR = ["sprite1", "sprite2", "sprite3"]
        CACTUS = ["sprite50", "sprite52", "sprite59", "sprite62"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(GRASS_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(CACTUS)} for x, y in old_forest_positions
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
    dict(scene_key="past_grove_1", title="Pasado simple: played / worked / walked / watched",
         description_en="Practica el pasado simple con -ed (parte 1)",
         objective_en="Practica sujeto + verbo-ed", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="past_grove_2", title="Pasado simple: cooked / danced / jumped / climbed / cleaned",
         description_en="Practica el pasado simple con -ed (parte 2)",
         objective_en="Practica sujeto + verbo-ed", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="past_square", title="Repaso: pasado simple con -ed",
         description_en="Repasa los 9 verbos antes del examen",
         objective_en="Repasa los 9 verbos en pasado", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_past_1", title="Los ogros invaden el prado de cactus",
         description_en="Defiende el prado mientras repasas el pasado simple",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_past_2", title="Los ogros atacan el prado de cactus",
         description_en="Elimina a los ogros del prado",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_past_boss", title="El examen final: vence al jefe",
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
    ("past_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a hablar del pasado con verbos "
     "que terminan en '-ed'. Pregunta 'Are you ready?'. Si el jugador no sabe que "
     "responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea si "
     "responde afirmativamente.",
     "Great! Let's talk about yesterday."),
    ("past_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'Played' es el pasado de 'play' -- se forma agregando "
                       "'-ed'. 'I played soccer yesterday' dice que jugue ayer. "
                       "El pasado simple NUNCA cambia segun el sujeto (a "
                       "diferencia del presente simple).",
               ["I played soccer yesterday", "I played soccer yesterday, right?", "Yes, I played soccer yesterday"]),
     "Great! Played -- yesterday."),
    ("past_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'Worked' es el pasado de 'work' -- mismo patron, "
                       "agregar '-ed'.",
               ["You worked yesterday", "You worked yesterday, right?", "Yes, you worked yesterday"]),
     "Perfect! Worked -- yesterday."),
    ("past_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'Walked' es el pasado de 'walk' -- mismo patron.",
               ["He walked to school", "He walked to school, right?", "Yes, he walked to school"]),
     "Exactly! Walked -- to school."),
    ("past_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'Watched' es el pasado de 'watch' -- mismo patron.",
               ["She watched a movie", "She watched a movie, right?", "Yes, she watched a movie"],
               extra="Ademas, para cerrar, pide un repaso de los 4 verbos de "
                     "este mapa (played, worked, walked, watched)."),
     "Amazing! You know 4 past verbs now!"),

    ("past_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'Cooked' es el pasado de 'cook' -- mismo patron, "
                       "agregar '-ed'.",
               ["We cooked dinner", "We cooked dinner, right?", "Yes, we cooked dinner"]),
     "Great! Cooked -- dinner."),
    ("past_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'Danced' es el pasado de 'dance' -- como 'dance' ya "
                       "termina en 'e', solo se agrega '-d'.",
               ["They danced all night", "They danced all night, right?", "Yes, they danced all night"]),
     "Perfect! Danced -- all night."),
    ("past_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'Jumped' es el pasado de 'jump' -- mismo patron.",
               ["He jumped over the fence", "He jumped over the fence, right?", "Yes, he jumped over the fence"]),
     "Exactly! Jumped -- over the fence."),
    ("past_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'Climbed' es el pasado de 'climb' -- mismo patron.",
               ["She climbed the mountain", "She climbed the mountain, right?", "Yes, she climbed the mountain"]),
     "Right! Climbed -- the mountain."),
    ("past_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'Cleaned' es el pasado de 'clean' -- mismo patron.",
               ["I cleaned my room", "I cleaned my room, right?", "Yes, I cleaned my room"],
               extra="Ademas, para cerrar, pide un repaso de los verbos de "
                     "este mapa (cooked, danced, jumped, climbed, cleaned)."),
     "Awesome! 5 more past verbs, well done!"),

    ("past_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'I played soccer' y 'You "
     "worked yesterday' -- el pasado con -ed nunca cambia segun el sujeto. Dale a "
     "elegir: 'I played soccer', 'You worked yesterday', 'I played soccer and you "
     "worked yesterday'. Completa la tarea cuando el jugador diga correctamente al "
     "menos 3. Es repaso, no introduzcas verbos nuevos.",
     "Great! Played and worked, still solid."),
    ("past_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'He walked to school' y 'She watched a "
     "movie'. Dale a elegir: 'He walked to school', 'She watched a movie', 'He "
     "walked to school and she watched a movie'. Completa la tarea cuando el "
     "jugador diga correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Exactly! Walked and watched, well done."),
    ("past_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'We cooked dinner' y 'They danced all "
     "night'. Dale a elegir: 'We cooked dinner', 'They danced all night', 'We "
     "cooked dinner and they danced all night'. Completa la tarea cuando el "
     "jugador diga correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Perfect! Cooked and danced, solid."),
    ("past_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'He jumped over the fence', 'She "
     "climbed the mountain', 'I cleaned my room'. Dale a elegir: 'He jumped over "
     "the fence', 'She climbed the mountain', 'I cleaned my room'. Completa la "
     "tarea cuando el jugador diga correctamente al menos 3. Repaso, sin verbos "
     "nuevos.",
     "Great! Jumped, climbed, and cleaned, got it."),
    ("past_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: el pasado simple con -ed NUNCA cambia "
     "segun el sujeto (I/you/he/she/we/they todos usan la misma forma). Este es "
     "el repaso final antes del examen. Pide al jugador que diga al menos 3 "
     "frases en pasado con cualquiera de los 9 verbos vistos (play, work, walk, "
     "watch, cook, dance, jump, climb, clean). Completa la tarea cuando lo haga.",
     "Amazing! You know the simple past now!"),
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
    ("past_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("past_grove_1", "Mochi"), None, 0),
    ("past_grove_1", 2, "Aprende 'played' con Joy", "talk_to_npc", ("past_grove_1", "Joy"), None, 0),
    ("past_grove_1", 3, "Aprende 'worked' con Ann", "talk_to_npc", ("past_grove_1", "Ann"), None, 0),
    ("past_grove_1", 4, "Aprende 'walked' con Sam", "talk_to_npc", ("past_grove_1", "Sam"), None, 0),
    ("past_grove_1", 5, "Aprende 'watched' con Amy", "talk_to_npc", ("past_grove_1", "Amy"), None, 0),

    ("past_grove_2", 1, "Aprende 'cooked' con Joy", "talk_to_npc", ("past_grove_2", "Joy"), None, 0),
    ("past_grove_2", 2, "Aprende 'danced' con Ann", "talk_to_npc", ("past_grove_2", "Ann"), None, 0),
    ("past_grove_2", 3, "Aprende 'jumped' con Sam", "talk_to_npc", ("past_grove_2", "Sam"), None, 0),
    ("past_grove_2", 4, "Aprende 'climbed' con Zoe", "talk_to_npc", ("past_grove_2", "Zoe"), None, 0),
    ("past_grove_2", 5, "Aprende 'cleaned' con Tom", "talk_to_npc", ("past_grove_2", "Tom"), None, 0),

    ("past_square", 1, "Repasa played/worked con Toro", "talk_to_npc", ("past_square", "Toro"), None, 0),
    ("past_square", 2, "Repasa walked/watched con Sam", "talk_to_npc", ("past_square", "Sam"), None, 0),
    ("past_square", 3, "Repasa cooked/danced con Joy", "talk_to_npc", ("past_square", "Joy"), None, 0),
    ("past_square", 4, "Repasa jumped/climbed/cleaned con Ann", "talk_to_npc", ("past_square", "Ann"), None, 0),
    ("past_square", 5, "Repaso final con Tom", "talk_to_npc", ("past_square", "Tom"), None, 0),

    ("combate_past_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_past_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_past_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_past_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_past_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 24 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
