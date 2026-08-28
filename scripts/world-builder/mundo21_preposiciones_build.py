"""
Mundo 21: Preposiciones de Lugar -- Etapas 1-4. Primer mundo del Bloque
C (gramatica intermedia temprana) -- cierra el trio in/on/under/next
to/between empezado en Mundo 20 (in/on). Reusa vocabulario de la casa
(Mundo 20) y objetos/animales simples (cat, dog, ball, box).

Map1 = 4 frases con 'under' (debajo de).
Map2 = 3 frases con 'next to' (al lado de) + 2 con 'between' (entre,
necesita dos lugares).
Map3 = repaso mezclando under/next to/between.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Sandy Ruins" (arena de Mundo 11 + decoracion de ruinas de Mundo
7/19, nunca combinados) para dialogo, "Cave Thicket" (piso de cueva de
Mundo 9 + arbustos de Mundo 10/15/19, nunca combinados) para combate.

Uso:
    python mundo21_preposiciones_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "prep_grove_1"),
    ("the_village_2", "prep_grove_2"),
    ("clock_tower", "prep_square"),
    ("combate_town_1", "combate_prep_1"),
    ("combate_town_2", "combate_prep_2"),
    ("combat_town_boss", "combate_prep_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "prep_grove_1": (450, 250,
        "# ⬇️ Preposicion: under\n\n"
        "'Under' significa **debajo de**.\n\n"
        "🐱 **The cat is under the table** - el gato esta debajo de la mesa\n"
        "🐶 **The dog is under the bed** - el perro esta debajo de la cama\n"
        "⚽ **The ball is under the chair** - la pelota esta debajo de la silla\n"
        "📦 **The box is under the bed** - la caja esta debajo de la cama\n\n"
        "💡 Reusa el vocabulario de la casa (Mundo 20: table, bed, chair)."),
    "prep_grove_2": (450, 450,
        "# ↔️ Preposiciones: next to / between\n\n"
        "'Next to' significa **al lado de**. 'Between' significa **entre** (necesita DOS lugares).\n\n"
        "🪑 **The chair is next to the table** - la silla esta al lado de la mesa\n"
        "💡 **The lamp is next to the book** - la lampara esta al lado del libro\n"
        "🐱 **The cat is next to the dog** - el gato esta al lado del perro\n"
        "📖 **The book is between the lamp and the chair** - el libro esta entre la lampara y la silla\n"
        "⚽ **The ball is between the table and the bed** - la pelota esta entre la mesa y la cama\n\n"
        "❗ 'Between' siempre necesita dos cosas conectadas con 'and'."),
    "prep_square": (450, 550,
        "# 🔁 Repaso: under / next to / between\n\n"
        "Antes del examen, repasa las 3 preposiciones.\n\n"
        "👉 under = debajo de\n"
        "👉 next to = al lado de\n"
        "👉 between = entre (dos lugares)\n\n"
        "💬 Practica con cualquier combinacion de objetos vistos."),
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

    if dst in ("prep_grove_1", "prep_grove_2", "prep_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Sandy Ruins": arena (Mundo 11) + decoracion de ruinas
        # (Mundo 7/19), nunca combinados antes.
        SAND_FLOOR = ["sprite37", "sprite38", "sprite39", "sprite40"]
        RUIN_DECOR = ["sprite34", "sprite35", "sprite43", "sprite44", "sprite61"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(SAND_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(RUIN_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_prep_1", "combate_prep_2", "combate_prep_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Cave Thicket": piso de cueva (Mundo 9) + arbustos (Mundo
        # 10/15/19), nunca combinados antes.
        CAVE_FLOOR = ["sprite57", "sprite58", "sprite61", "sprite62"]
        BUSH = ["sprite39", "sprite40", "sprite48"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(CAVE_FLOOR)
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
    dict(scene_key="prep_grove_1", title="Preposiciones: under",
         description_en="Practica 'under' con cat/dog/ball/box",
         objective_en="Practica The ___ is under the ___", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="prep_grove_2", title="Preposiciones: next to / between",
         description_en="Practica 'next to' y 'between'",
         objective_en="Practica The ___ is next to/between ___", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="prep_square", title="Repaso: under / next to / between",
         description_en="Repasa las 3 preposiciones antes del examen",
         objective_en="Repasa under/next to/between", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_prep_1", title="Los ogros invaden la cueva tupida",
         description_en="Defiende la cueva mientras repasas preposiciones",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_prep_2", title="Los ogros atacan la cueva tupida",
         description_en="Elimina a los ogros de la cueva",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_prep_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas las preposiciones derrotando al jefe",
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
    ("prep_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a aprender la preposicion "
     "'under' (debajo de). Pregunta 'Are you ready?'. Si el jugador no sabe que "
     "responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea si "
     "responde afirmativamente.",
     "Great! Let's find out what's under things."),
    ("prep_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'Under' es una preposicion de lugar nueva que significa "
                       "'debajo de'. 'The cat is under the table' dice que el "
                       "gato esta debajo de la mesa.",
               ["The cat is under the table", "The cat is under the table, right?", "Yes, the cat is under the table"]),
     "Great! Under -- debajo de."),
    ("prep_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'The dog is under the bed' -- mismo patron, 'under' = "
                       "debajo de.",
               ["The dog is under the bed", "The dog is under the bed, right?", "Yes, the dog is under the bed"]),
     "Perfect! Under the bed."),
    ("prep_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'The ball is under the chair' -- mismo patron.",
               ["The ball is under the chair", "The ball is under the chair, right?", "Yes, the ball is under the chair"]),
     "Exactly! Under the chair."),
    ("prep_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'The box is under the bed' -- mismo patron.",
               ["The box is under the bed", "The box is under the bed, right?", "Yes, the box is under the bed"],
               extra="Ademas, para cerrar, pide un repaso de las 4 frases de este "
                     "mapa con 'under'."),
     "Amazing! You know 'under' now!"),

    ("prep_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'Next to' es otra preposicion de lugar, significa 'al "
                       "lado de'. 'The chair is next to the table' dice que la "
                       "silla esta al lado de la mesa.",
               ["The chair is next to the table", "The chair is next to the table, right?", "Yes, the chair is next to the table"]),
     "Great! Next to -- al lado de."),
    ("prep_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'The lamp is next to the book' -- mismo patron con 'next "
                       "to'.",
               ["The lamp is next to the book", "The lamp is next to the book, right?", "Yes, the lamp is next to the book"]),
     "Perfect! Next to the book."),
    ("prep_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'The cat is next to the dog' -- mismo patron.",
               ["The cat is next to the dog", "The cat is next to the dog, right?", "Yes, the cat is next to the dog"]),
     "Exactly! Next to the dog."),
    ("prep_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'Between' significa 'entre', y necesita DOS lugares: "
                       "'The book is between the lamp and the chair' dice que el "
                       "libro esta entre la lampara y la silla.",
               ["The book is between the lamp and the chair", "The book is between the lamp and the chair, right?", "Yes, the book is between the lamp and the chair"]),
     "Right! Between -- needs two places."),
    ("prep_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'The ball is between the table and the bed' -- mismo "
                       "patron con 'between'.",
               ["The ball is between the table and the bed", "The ball is between the table and the bed, right?", "Yes, the ball is between the table and the bed"],
               extra="Ademas, para cerrar, pide un repaso de 'next to' y "
                     "'between' con cualquiera de los objetos de este mapa."),
     "Awesome! Next to and between -- you got it!"),

    ("prep_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'under' = debajo de. 'The "
     "cat is under the table' y 'The dog is under the bed'. Dale a elegir: 'The "
     "cat is under the table', 'The dog is under the bed', 'The cat is under the "
     "table, not the dog'. Completa la tarea cuando el jugador diga correctamente "
     "al menos 3. Es repaso, no introduzcas preposiciones nuevas.",
     "Great! Under, still solid."),
    ("prep_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'under' = debajo de. 'The ball is under "
     "the chair' y 'The box is under the bed'. Dale a elegir: 'The ball is under "
     "the chair', 'The box is under the bed', 'The ball and the box are under "
     "things'. Completa la tarea cuando el jugador diga correctamente al menos 3. "
     "Repaso, sin preposiciones nuevas.",
     "Exactly! Under, well done."),
    ("prep_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'next to' = al lado de. 'The chair is "
     "next to the table' y 'The cat is next to the dog'. Dale a elegir: 'The "
     "chair is next to the table', 'The cat is next to the dog', 'The lamp is "
     "next to the book'. Completa la tarea cuando el jugador diga correctamente "
     "al menos 3. Repaso, sin preposiciones nuevas.",
     "Perfect! Next to, solid."),
    ("prep_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'between' = entre (necesita dos "
     "lugares). 'The book is between the lamp and the chair'. Dale a elegir: 'The "
     "book is between the lamp and the chair', 'The ball is between the table and "
     "the bed'. Completa la tarea cuando el jugador diga correctamente al menos "
     "3. Repaso, sin preposiciones nuevas.",
     "Great! Between, got it."),
    ("prep_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: under = debajo de, next to = al lado de, "
     "between = entre (dos lugares). Este es el repaso final antes del examen. "
     "Pide al jugador que diga al menos 3 frases mezclando las 3 preposiciones "
     "con cualquiera de los objetos vistos (cat, dog, ball, box, table, chair, "
     "bed, lamp, book). Completa la tarea cuando lo haga.",
     "Amazing! You know all the prepositions now!"),
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
    ("prep_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("prep_grove_1", "Mochi"), None, 0),
    ("prep_grove_1", 2, "Aprende 'cat under table' con Joy", "talk_to_npc", ("prep_grove_1", "Joy"), None, 0),
    ("prep_grove_1", 3, "Aprende 'dog under bed' con Ann", "talk_to_npc", ("prep_grove_1", "Ann"), None, 0),
    ("prep_grove_1", 4, "Aprende 'ball under chair' con Sam", "talk_to_npc", ("prep_grove_1", "Sam"), None, 0),
    ("prep_grove_1", 5, "Aprende 'box under bed' con Amy", "talk_to_npc", ("prep_grove_1", "Amy"), None, 0),

    ("prep_grove_2", 1, "Aprende 'chair next to table' con Joy", "talk_to_npc", ("prep_grove_2", "Joy"), None, 0),
    ("prep_grove_2", 2, "Aprende 'lamp next to book' con Ann", "talk_to_npc", ("prep_grove_2", "Ann"), None, 0),
    ("prep_grove_2", 3, "Aprende 'cat next to dog' con Sam", "talk_to_npc", ("prep_grove_2", "Sam"), None, 0),
    ("prep_grove_2", 4, "Aprende 'book between lamp and chair' con Zoe", "talk_to_npc", ("prep_grove_2", "Zoe"), None, 0),
    ("prep_grove_2", 5, "Aprende 'ball between table and bed' con Tom", "talk_to_npc", ("prep_grove_2", "Tom"), None, 0),

    ("prep_square", 1, "Repasa 'under' (cat/dog) con Toro", "talk_to_npc", ("prep_square", "Toro"), None, 0),
    ("prep_square", 2, "Repasa 'under' (ball/box) con Sam", "talk_to_npc", ("prep_square", "Sam"), None, 0),
    ("prep_square", 3, "Repasa 'next to' con Joy", "talk_to_npc", ("prep_square", "Joy"), None, 0),
    ("prep_square", 4, "Repasa 'between' con Ann", "talk_to_npc", ("prep_square", "Ann"), None, 0),
    ("prep_square", 5, "Repaso final con Tom", "talk_to_npc", ("prep_square", "Tom"), None, 0),

    ("combate_prep_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_prep_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_prep_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_prep_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_prep_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 21 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
