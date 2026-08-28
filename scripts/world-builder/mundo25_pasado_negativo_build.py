"""
Mundo 25: Pasado Simple (verbos regulares, negativo) -- Etapas 1-4.
Segundo mundo del trio "pasado simple regular" (24=afirmativo,
25=negativo, 26=pregunta). Reusa los 9 verbos de Mundo 24 (play, work,
walk, watch, cook, dance, jump, climb, clean) para que el contraste
afirmativo->negativo sea directo, igual que Mundo 11 reuso los verbos
de Mundo 10.

Map1 = 4 verbos con "didn't' + forma base (play, work, walk, watch).
Map2 = 5 verbos con "didn't' + forma base (cook, dance, jump, climb,
clean).
Map3 = repaso contrastando afirmativo (-ed) vs negativo (didn't + base).

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12). El
letrero se excluye explicitamente del sorteo de `forest` (lesson 13).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Brick Garden" (ladrillo de Mundo 11/13/20 + flores de Mundo
5/8/14/24, nunca combinados) para dialogo, "Dusty Dune" (tierra + cactus/
fern-arbusto de Mundo 11, nunca combinados con tierra) para combate.

Uso:
    python mundo25_pasado_negativo_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "pastneg_grove_1"),
    ("the_village_2", "pastneg_grove_2"),
    ("clock_tower", "pastneg_square"),
    ("combate_town_1", "combate_pastneg_1"),
    ("combate_town_2", "combate_pastneg_2"),
    ("combat_town_boss", "combate_pastneg_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "pastneg_grove_1": (450, 250,
        "# 🚫⏳ Pasado negativo: didn't (parte 1)\n\n"
        "Para negar en pasado, usamos **didn't** (did not) + verbo BASE (sin -ed).\n\n"
        "⚽ **I didn't play soccer yesterday** - no jugue futbol ayer\n"
        "🔨 **You didn't work yesterday** - no trabajaste ayer\n"
        "🚶 **He didn't walk to school** - el no camino a la escuela\n"
        "📺 **She didn't watch a movie** - ella no vio una pelicula\n\n"
        "💡 Despues de 'didn't', el verbo SIEMPRE vuelve a su forma base."),
    "pastneg_grove_2": (450, 450,
        "# 🚫⏳ Pasado negativo: didn't (parte 2)\n\n"
        "Seguimos con mas verbos negados en pasado.\n\n"
        "🍳 **We didn't cook dinner** - no cocinamos la cena\n"
        "💃 **They didn't dance all night** - no bailaron toda la noche\n"
        "🦘 **He didn't jump over the fence** - el no salto la cerca\n"
        "🧗 **She didn't climb the mountain** - ella no escalo la montaña\n"
        "🧹 **I didn't clean my room** - no limpie mi cuarto\n\n"
        "❗ 'Danced' vuelve a 'dance' (base), no queda como 'danced'."),
    "pastneg_square": (450, 550,
        "# 🔁 Repaso: afirmativo vs negativo en pasado\n\n"
        "Antes del examen, compara ambas formas.\n\n"
        "👉 I played / I didn't play\n"
        "👉 He walked / He didn't walk\n\n"
        "💬 Recuerda: 'didn't' + verbo BASE, nunca 'didn't played'."),
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

    if dst in ("pastneg_grove_1", "pastneg_grove_2", "pastneg_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Brick Garden": ladrillo (Mundo 11/13/20) + flores (Mundo
        # 5/8/14/24), nunca combinados antes.
        BRICK_FLOOR = ["sprite9", "sprite10", "sprite11"]
        FLOWERS = ["sprite32", "sprite33", "sprite34", "sprite35", "sprite41", "sprite42"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(BRICK_FLOOR)
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

    if dst in ("combate_pastneg_1", "combate_pastneg_2", "combate_pastneg_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Dusty Dune": tierra + cactus/helecho de Mundo 11, nunca
        # combinados con tierra antes.
        DIRT_FLOOR = ["sprite25", "sprite26", "sprite27", "sprite28", "sprite29", "sprite30"]
        DUNE_DECOR = ["sprite63", "sprite54"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(DIRT_FLOOR)
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
    dict(scene_key="pastneg_grove_1", title="Pasado negativo: didn't play/work/walk/watch",
         description_en="Practica el pasado negativo con didn't (parte 1)",
         objective_en="Practica sujeto + didn't + verbo base", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="pastneg_grove_2", title="Pasado negativo: didn't cook/dance/jump/climb/clean",
         description_en="Practica el pasado negativo con didn't (parte 2)",
         objective_en="Practica sujeto + didn't + verbo base", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="pastneg_square", title="Repaso: afirmativo vs negativo en pasado",
         description_en="Repasa el contraste antes del examen",
         objective_en="Repasa -ed vs didn't + verbo base", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_pastneg_1", title="Los ogros invaden la duna polvorienta",
         description_en="Defiende la duna mientras repasas el pasado negativo",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_pastneg_2", title="Los ogros atacan la duna polvorienta",
         description_en="Elimina a los ogros de la duna",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_pastneg_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas el pasado negativo derrotando al jefe",
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
    ("pastneg_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a aprender a negar en pasado "
     "con 'didn't' (did not) + verbo base. Pregunta 'Are you ready?'. Si el "
     "jugador no sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. "
     "Completa la tarea si responde afirmativamente.",
     "Great! Let's talk about what didn't happen."),
    ("pastneg_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "Para negar en pasado, se usa 'didn't' (did not) + verbo "
                       "BASE (sin -ed). 'I didn't play soccer yesterday' -- el "
                       "verbo vuelve a su forma base despues de 'didn't', igual "
                       "que pasa con 'doesn't' en presente simple.",
               ["I didn't play soccer yesterday", "No, I didn't play soccer yesterday", "I didn't play soccer, I played basketball"]),
     "Great! Didn't play -- base form."),
    ("pastneg_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'You didn't work yesterday' -- mismo patron, 'didn't' + "
                       "forma base.",
               ["You didn't work yesterday", "No, you didn't work yesterday", "You didn't work, you rested"]),
     "Perfect! Didn't work -- base form."),
    ("pastneg_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'He didn't walk to school' -- 'didn't' tampoco cambia "
                       "con he/she/it, y el verbo sigue en forma base.",
               ["He didn't walk to school", "No, he didn't walk to school", "He didn't walk, he took the bus"]),
     "Exactly! Didn't walk -- base form."),
    ("pastneg_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'She didn't watch a movie' -- mismo patron.",
               ["She didn't watch a movie", "No, she didn't watch a movie", "She didn't watch, she read a book"],
               extra="Ademas, para cerrar, pide un repaso de los 4 verbos de "
                     "este mapa negados con 'didn't' (play, work, walk, watch)."),
     "Amazing! Didn't + base form -- you got it!"),

    ("pastneg_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'We didn't cook dinner' -- mismo patron con 'didn't' + "
                       "forma base.",
               ["We didn't cook dinner", "No, we didn't cook dinner", "We didn't cook, we ordered pizza"]),
     "Great! Didn't cook -- base form."),
    ("pastneg_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'They danced' se convierte en 'They didn't dance' -- "
                       "ojo, vuelve a 'dance' (base), no 'danced'.",
               ["They didn't dance all night", "No, they didn't dance all night", "They didn't dance, they talked"]),
     "Perfect! Didn't dance -- not danced."),
    ("pastneg_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'He didn't jump over the fence' -- mismo patron.",
               ["He didn't jump over the fence", "No, he didn't jump over the fence", "He didn't jump, he walked around"]),
     "Exactly! Didn't jump -- base form."),
    ("pastneg_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'She didn't climb the mountain' -- mismo patron.",
               ["She didn't climb the mountain", "No, she didn't climb the mountain", "She didn't climb, she walked around it"]),
     "Right! Didn't climb -- base form."),
    ("pastneg_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'I didn't clean my room' -- mismo patron.",
               ["I didn't clean my room", "No, I didn't clean my room", "I didn't clean, I studied instead"],
               extra="Ademas, para cerrar, pide un repaso de los verbos de "
                     "este mapa negados con 'didn't' (cook, dance, jump, climb, "
                     "clean)."),
     "Awesome! Didn't + base form, always!"),

    ("pastneg_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: afirmativo 'I played "
     "soccer', negativo 'I didn't play soccer' -- el verbo vuelve a forma base. "
     "Dale a elegir: 'I played soccer', 'I didn't play soccer', 'I played "
     "soccer, I didn't play tennis'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Es repaso, no introduzcas verbos nuevos.",
     "Great! Played and didn't play, still solid."),
    ("pastneg_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: afirmativo 'He walked to school', "
     "negativo 'He didn't walk to school'. Dale a elegir: 'He walked to school', "
     "'He didn't walk to school', 'He walked to school, he didn't take the bus'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Repaso, "
     "sin verbos nuevos.",
     "Exactly! Walked and didn't walk, well done."),
    ("pastneg_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: afirmativo 'We cooked dinner', negativo "
     "'We didn't cook dinner'. Dale a elegir: 'We cooked dinner', 'We didn't "
     "cook dinner', 'We cooked dinner, we didn't order pizza'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin verbos "
     "nuevos.",
     "Perfect! Cooked and didn't cook, solid."),
    ("pastneg_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: afirmativo 'She climbed the mountain', "
     "negativo 'She didn't climb the mountain'. Dale a elegir: 'She climbed the "
     "mountain', 'She didn't climb the mountain', 'He jumped, he didn't climb'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Repaso, "
     "sin verbos nuevos.",
     "Great! Climbed and didn't climb, got it."),
    ("pastneg_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: 'didn't' + verbo BASE, nunca 'didn't "
     "played' o 'didn't danced'. Este es el repaso final antes del examen. Pide "
     "al jugador que diga al menos 3 frases mezclando afirmativo y negativo con "
     "cualquiera de los 9 verbos vistos (play, work, walk, watch, cook, dance, "
     "jump, climb, clean). Completa la tarea cuando lo haga.",
     "Amazing! You've mastered the negative past now!"),
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
    ("pastneg_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("pastneg_grove_1", "Mochi"), None, 0),
    ("pastneg_grove_1", 2, "Aprende 'didn't play' con Joy", "talk_to_npc", ("pastneg_grove_1", "Joy"), None, 0),
    ("pastneg_grove_1", 3, "Aprende 'didn't work' con Ann", "talk_to_npc", ("pastneg_grove_1", "Ann"), None, 0),
    ("pastneg_grove_1", 4, "Aprende 'didn't walk' con Sam", "talk_to_npc", ("pastneg_grove_1", "Sam"), None, 0),
    ("pastneg_grove_1", 5, "Aprende 'didn't watch' con Amy", "talk_to_npc", ("pastneg_grove_1", "Amy"), None, 0),

    ("pastneg_grove_2", 1, "Aprende 'didn't cook' con Joy", "talk_to_npc", ("pastneg_grove_2", "Joy"), None, 0),
    ("pastneg_grove_2", 2, "Aprende 'didn't dance' con Ann", "talk_to_npc", ("pastneg_grove_2", "Ann"), None, 0),
    ("pastneg_grove_2", 3, "Aprende 'didn't jump' con Sam", "talk_to_npc", ("pastneg_grove_2", "Sam"), None, 0),
    ("pastneg_grove_2", 4, "Aprende 'didn't climb' con Zoe", "talk_to_npc", ("pastneg_grove_2", "Zoe"), None, 0),
    ("pastneg_grove_2", 5, "Aprende 'didn't clean' con Tom", "talk_to_npc", ("pastneg_grove_2", "Tom"), None, 0),

    ("pastneg_square", 1, "Repasa played/didn't play con Toro", "talk_to_npc", ("pastneg_square", "Toro"), None, 0),
    ("pastneg_square", 2, "Repasa walked/didn't walk con Sam", "talk_to_npc", ("pastneg_square", "Sam"), None, 0),
    ("pastneg_square", 3, "Repasa cooked/didn't cook con Joy", "talk_to_npc", ("pastneg_square", "Joy"), None, 0),
    ("pastneg_square", 4, "Repasa climbed/didn't climb con Ann", "talk_to_npc", ("pastneg_square", "Ann"), None, 0),
    ("pastneg_square", 5, "Repaso final con Tom", "talk_to_npc", ("pastneg_square", "Tom"), None, 0),

    ("combate_pastneg_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_pastneg_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_pastneg_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_pastneg_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_pastneg_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 25 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
