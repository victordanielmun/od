"""
Mundo 28: Comparativos y Superlativos -- Etapas 1-4. Reusa adjetivos de
Mundo 5 (big, small, fast, slow, old, new) + el irregular 'good' y dos
adjetivos largos nuevos (beautiful, expensive) para el patron 'more/
most'.

Map1 = 4 comparativos con '-er' + 'than' (bigger, smaller, faster,
better -- este ultimo irregular).
Map2 = 5 superlativos con '-est'/'most' + 'the' (slowest, oldest,
newest, most beautiful, most expensive).
Map3 = repaso mezclando comparativo y superlativo.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12). El
letrero se excluye explicitamente del sorteo de `forest` (lesson 13).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Sandy Yard" (arena + arbustos/helechos de Mundo 11/17/22/27,
nunca combinados) para dialogo, "Brick Cactus" (ladrillo, usado solo en
dialogo hasta ahora, + cactus de Mundo 8/16/24, primera vez en combate)
para combate.

Uso:
    python mundo28_comparativos_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "comp_grove_1"),
    ("the_village_2", "comp_grove_2"),
    ("clock_tower", "comp_square"),
    ("combate_town_1", "combate_comp_1"),
    ("combate_town_2", "combate_comp_2"),
    ("combat_town_boss", "combate_comp_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "comp_grove_1": (450, 250,
        "# 📏 Comparativos: -er + than\n\n"
        "Para comparar DOS cosas, agregamos **-er** al adjetivo corto + **than**.\n\n"
        "🚗 **A car is bigger than a bike** - un carro es mas grande que una bici\n"
        "🐭 **A mouse is smaller than a cat** - un raton es mas pequeño que un gato\n"
        "🚗 **A car is faster than a bike** - un carro es mas rapido que una bici\n"
        "📚 **This book is better than that one** - este libro es mejor que ese\n\n"
        "❗ 'Better' es el comparativo IRREGULAR de 'good' -- no 'gooder'."),
    "comp_grove_2": (450, 450,
        "# 🏆 Superlativos: -est / most + the\n\n"
        "Para decir que algo es el MAS de un grupo, usamos **the** + **-est**/**most**.\n\n"
        "🐢 **The turtle is the slowest animal** - la tortuga es la mas lenta\n"
        "👴 **My grandfather is the oldest person in my family** - mi abuelo es el mas viejo\n"
        "📱 **This is the newest phone** - este es el telefono mas nuevo\n"
        "🏞️ **This is the most beautiful place** - este es el lugar mas hermoso\n"
        "🚗 **This is the most expensive car** - este es el carro mas caro\n\n"
        "💡 Adjetivos largos (2+ silabas) usan 'most' en vez de '-est'."),
    "comp_square": (450, 550,
        "# 🔁 Repaso: comparativo vs superlativo\n\n"
        "Antes del examen, repasa ambos patrones.\n\n"
        "👉 Comparativo (dos cosas): adjetivo + -er + than\n"
        "👉 Superlativo (el mas de todos): the + adjetivo + -est/most\n\n"
        "💬 Recuerda: 'good' es irregular -- better, best."),
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

    if dst in ("comp_grove_1", "comp_grove_2", "comp_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Sandy Yard": arena + arbustos/helechos (Mundo
        # 11/17/22/27), nunca combinados antes.
        SAND_FLOOR = ["sprite31", "sprite32", "sprite33", "sprite34"]
        YARD_DECOR = ["sprite51", "sprite56", "sprite36"]
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
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(YARD_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_comp_1", "combate_comp_2", "combate_comp_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Brick Cactus": ladrillo (usado solo en dialogo hasta
        # ahora) + cactus (Mundo 8/16/24), primera vez en combate.
        BRICK_FLOOR = ["sprite9", "sprite10", "sprite11"]
        CACTUS = ["sprite50", "sprite52", "sprite59", "sprite62"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(BRICK_FLOOR)
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
    dict(scene_key="comp_grove_1", title="Comparativos: bigger / smaller / faster / better",
         description_en="Practica comparativos con -er + than",
         objective_en="Practica X is [adjetivo]-er than Y", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="comp_grove_2", title="Superlativos: slowest / oldest / newest / most beautiful / most expensive",
         description_en="Practica superlativos con -est/most + the",
         objective_en="Practica the [adjetivo]-est/most [adjetivo]", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="comp_square", title="Repaso: comparativo vs superlativo",
         description_en="Repasa comparativo y superlativo antes del examen",
         objective_en="Repasa -er/than y the -est/most", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_comp_1", title="Los ogros invaden el patio de cactus",
         description_en="Defiende el patio mientras repasas comparativos",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_comp_2", title="Los ogros atacan el patio de cactus",
         description_en="Elimina a los ogros del patio",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_comp_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas comparativos y superlativos derrotando al jefe",
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
    ("comp_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a comparar cosas con "
     "adjetivo + '-er' + 'than'. Pregunta 'Are you ready?'. Si el jugador no "
     "sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa "
     "la tarea si responde afirmativamente.",
     "Great! Let's compare things."),
    ("comp_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "Para comparar dos cosas, se agrega '-er' al adjetivo "
                       "corto + 'than'. 'A car is bigger than a bike' compara "
                       "dos cosas.",
               ["A car is bigger than a bike", "A car is bigger than a bike, right?", "Yes, a car is bigger than a bike"]),
     "Great! Bigger than -- comparing two things."),
    ("comp_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'Smaller' es el comparativo de 'small' -- mismo patron "
                       "con '-er' + 'than'.",
               ["A mouse is smaller than a cat", "A mouse is smaller than a cat, right?", "Yes, a mouse is smaller than a cat"]),
     "Perfect! Smaller than."),
    ("comp_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'Faster' es el comparativo de 'fast' -- mismo patron.",
               ["A car is faster than a bike", "A car is faster than a bike, right?", "Yes, a car is faster than a bike"]),
     "Exactly! Faster than."),
    ("comp_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'Better' es el comparativo IRREGULAR de 'good' -- no "
                       "se dice 'gooder'. Hay que memorizarlo.",
               ["This book is better than that one", "This book is better than that one, right?", "Yes, this book is better than that one"],
               extra="Ademas, para cerrar, pide un repaso de los 4 "
                     "comparativos de este mapa (bigger, smaller, faster, "
                     "better)."),
     "Amazing! You know 4 comparatives now!"),

    ("comp_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "Para decir que algo es el MAS de un grupo, se agrega "
                       "'-est' al adjetivo corto + 'the'. 'The turtle is the "
                       "slowest animal' dice que la tortuga es la mas lenta "
                       "de todas.",
               ["The turtle is the slowest animal", "The turtle is the slowest animal, right?", "Yes, the turtle is the slowest animal"]),
     "Great! The slowest -- superlative."),
    ("comp_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'Oldest' es el superlativo de 'old' -- mismo patron "
                       "con '-est' + 'the'.",
               ["My grandfather is the oldest person in my family", "My grandfather is the oldest person in my family, right?", "Yes, my grandfather is the oldest"]),
     "Perfect! The oldest."),
    ("comp_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'Newest' es el superlativo de 'new' -- mismo patron.",
               ["This is the newest phone", "This is the newest phone, right?", "Yes, this is the newest phone"]),
     "Exactly! The newest."),
    ("comp_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "Con adjetivos largos (2+ silabas), se usa 'most' en "
                       "vez de '-est': 'This is the most beautiful place'.",
               ["This is the most beautiful place", "This is the most beautiful place, right?", "Yes, this is the most beautiful place"]),
     "Right! Most beautiful -- long adjective."),
    ("comp_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'Most expensive' -- mismo patron con adjetivos largos.",
               ["This is the most expensive car", "This is the most expensive car, right?", "Yes, this is the most expensive car"],
               extra="Ademas, para cerrar, pide un repaso de los superlativos "
                     "de este mapa (slowest, oldest, newest, most beautiful, "
                     "most expensive)."),
     "Awesome! -est for short, most for long!"),

    ("comp_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'bigger' (big) y "
     "'smaller' (small) son comparativos -- adjetivo + -er + than. Dale a "
     "elegir: 'A car is bigger than a bike', 'A mouse is smaller than a cat'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Es "
     "repaso, no introduzcas adjetivos nuevos.",
     "Great! Bigger and smaller, still solid."),
    ("comp_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'faster' (fast) es comparativo, y "
     "'better' (good) es comparativo IRREGULAR. Dale a elegir: 'A car is "
     "faster than a bike', 'This book is better than that one'. Completa la "
     "tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "adjetivos nuevos.",
     "Exactly! Faster and better, well done."),
    ("comp_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'slowest' (slow) y 'oldest' (old) "
     "son superlativos -- the + adjetivo + -est. Dale a elegir: 'The turtle is "
     "the slowest animal', 'My grandfather is the oldest person'. Completa la "
     "tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "adjetivos nuevos.",
     "Perfect! Slowest and oldest, solid."),
    ("comp_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'newest' (new) usa -est, pero "
     "'most beautiful' y 'most expensive' (adjetivos largos) usan 'most'. Dale "
     "a elegir: 'This is the newest phone', 'This is the most beautiful "
     "place', 'This is the most expensive car'. Completa la tarea cuando el "
     "jugador diga correctamente al menos 3. Repaso, sin adjetivos nuevos.",
     "Great! -est and most, got it."),
    ("comp_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: comparativo (dos cosas) = adjetivo + "
     "-er + than. Superlativo (el mas de todos) = the + adjetivo + -est/most. "
     "'Good' es irregular: better, best. Este es el repaso final antes del "
     "examen. Pide al jugador que diga al menos 3 frases mezclando "
     "comparativo y superlativo con cualquiera de los adjetivos vistos (big, "
     "small, fast, good, slow, old, new, beautiful, expensive). Completa la "
     "tarea cuando lo haga.",
     "Amazing! You know comparatives and superlatives now!"),
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
    ("comp_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("comp_grove_1", "Mochi"), None, 0),
    ("comp_grove_1", 2, "Aprende 'bigger' con Joy", "talk_to_npc", ("comp_grove_1", "Joy"), None, 0),
    ("comp_grove_1", 3, "Aprende 'smaller' con Ann", "talk_to_npc", ("comp_grove_1", "Ann"), None, 0),
    ("comp_grove_1", 4, "Aprende 'faster' con Sam", "talk_to_npc", ("comp_grove_1", "Sam"), None, 0),
    ("comp_grove_1", 5, "Aprende 'better' con Amy", "talk_to_npc", ("comp_grove_1", "Amy"), None, 0),

    ("comp_grove_2", 1, "Aprende 'slowest' con Joy", "talk_to_npc", ("comp_grove_2", "Joy"), None, 0),
    ("comp_grove_2", 2, "Aprende 'oldest' con Ann", "talk_to_npc", ("comp_grove_2", "Ann"), None, 0),
    ("comp_grove_2", 3, "Aprende 'newest' con Sam", "talk_to_npc", ("comp_grove_2", "Sam"), None, 0),
    ("comp_grove_2", 4, "Aprende 'most beautiful' con Zoe", "talk_to_npc", ("comp_grove_2", "Zoe"), None, 0),
    ("comp_grove_2", 5, "Aprende 'most expensive' con Tom", "talk_to_npc", ("comp_grove_2", "Tom"), None, 0),

    ("comp_square", 1, "Repasa bigger/smaller con Toro", "talk_to_npc", ("comp_square", "Toro"), None, 0),
    ("comp_square", 2, "Repasa faster/better con Sam", "talk_to_npc", ("comp_square", "Sam"), None, 0),
    ("comp_square", 3, "Repasa slowest/oldest con Joy", "talk_to_npc", ("comp_square", "Joy"), None, 0),
    ("comp_square", 4, "Repasa newest/most con Ann", "talk_to_npc", ("comp_square", "Ann"), None, 0),
    ("comp_square", 5, "Repaso final con Tom", "talk_to_npc", ("comp_square", "Tom"), None, 0),

    ("combate_comp_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_comp_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_comp_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_comp_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_comp_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 28 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
