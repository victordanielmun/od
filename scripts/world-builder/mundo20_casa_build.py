"""
Mundo 20: La Casa -- Etapas 1-4. Septimo y ultimo mundo del Bloque B
(vocabulario funcional) -- cierra el bloque completo (mundos 14-20).
Reusa 'This is the ___' (articulo 'the', Mundo 9) para habitaciones SIN
gramatica nueva, y agrega un primer contacto con preposiciones de lugar
simples ('in'/'on') como anticipo del Bloque C.

Map1 = 4 habitaciones con 'This is the ___' (kitchen, bedroom, bathroom,
living room) -- sin gramatica nueva.
Map2 = 5 objetos con preposiciones: 'in' (table, bed, chair -- dentro de
una habitacion) y 'on' (book, lamp -- encima de una superficie).
Map3 = repaso mezclando habitaciones y preposiciones.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Brick Clearing" (ladrillo de Mundo 11/13 + tocones/musgo de Mundo
9, nunca combinados) para dialogo, "Driftwood Cactus" (madera de Mundo
6/16/17 + cactus de Mundo 8/16, nunca combinados) para combate.

Uso:
    python mundo20_casa_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "house_grove_1"),
    ("the_village_2", "house_grove_2"),
    ("clock_tower", "house_square"),
    ("combate_town_1", "combate_house_1"),
    ("combate_town_2", "combate_house_2"),
    ("combat_town_boss", "combate_house_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "house_grove_1": (450, 250,
        "# 🏠 La casa: las habitaciones\n\n"
        "Usamos 'This is the ___' (ya conocido, con articulo especifico) para las habitaciones.\n\n"
        "🍳 **This is the kitchen** - esta es la cocina\n"
        "🛏️ **This is the bedroom** - esta es la habitacion\n"
        "🚿 **This is the bathroom** - este es el baño\n"
        "🛋️ **This is the living room** - esta es la sala\n\n"
        "💡 'The' porque hablamos de una habitacion especifica de TU casa."),
    "house_grove_2": (450, 450,
        "# 📍 Objetos: in / on\n\n"
        "Aprendemos dos preposiciones de lugar simples.\n\n"
        "🪑 **The table is in the kitchen** - la mesa esta en la cocina\n"
        "🛏️ **The bed is in the bedroom** - la cama esta en la habitacion\n"
        "🪑 **The chair is in the living room** - la silla esta en la sala\n"
        "📖 **The book is on the table** - el libro esta sobre la mesa\n"
        "💡 **The lamp is on the table** - la lampara esta sobre la mesa\n\n"
        "❗ 'In' = dentro de un lugar. 'On' = encima de una superficie."),
    "house_square": (450, 550,
        "# 🔁 Repaso: habitaciones y in/on\n\n"
        "Antes del examen, repasa todo junto.\n\n"
        "👉 kitchen, bedroom, bathroom, living room\n"
        "👉 in the kitchen/bedroom/living room\n"
        "👉 on the table\n\n"
        "💬 Recuerda: 'in' = dentro, 'on' = encima."),
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

    if dst in ("house_grove_1", "house_grove_2", "house_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Brick Clearing": ladrillo (Mundo 11/13) + tocones/musgo
        # (Mundo 9), nunca combinados antes.
        BRICK_FLOOR = ["sprite9", "sprite10", "sprite11"]
        CLEARING_DECOR = ["sprite65", "sprite68", "sprite69", "sprite70", "sprite57"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(BRICK_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(CLEARING_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_house_1", "combate_house_2", "combate_house_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Driftwood Cactus": madera (Mundo 6/16/17) + cactus (Mundo
        # 8/16), nunca combinados antes.
        WOOD_FLOOR = ["sprite49", "sprite50", "sprite51", "sprite52", "sprite53", "sprite54"]
        CACTUS = ["sprite50", "sprite52", "sprite59", "sprite62"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(WOOD_FLOOR)
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
    dict(scene_key="house_grove_1", title="La casa: kitchen / bedroom / bathroom / living room",
         description_en="Practica las habitaciones con This is the ___",
         objective_en="Practica This is the ___", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="house_grove_2", title="La casa: objetos con in / on",
         description_en="Practica las preposiciones in/on con table/bed/chair/book/lamp",
         objective_en="Practica The ___ is in/on the ___", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="house_square", title="Repaso: habitaciones y in / on",
         description_en="Repasa todo antes del examen",
         objective_en="Repasa las habitaciones y las preposiciones", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_house_1", title="Los ogros invaden el claro de ladrillo",
         description_en="Defiende el claro mientras repasas la casa",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_house_2", title="Los ogros atacan el claro de ladrillo",
         description_en="Elimina a los ogros del claro",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_house_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas la casa derrotando al jefe",
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
    ("house_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a conocer las habitaciones de la "
     "casa con 'This is the ___'. Pregunta 'Are you ready?'. Si el jugador no sabe "
     "que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea "
     "si responde afirmativamente.",
     "Great! Let's tour the house."),
    ("house_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'This is the kitchen' usa 'the' (articulo especifico, ya "
                       "conocido) porque hablamos de UNA habitacion en particular "
                       "de la casa.",
               ["This is the kitchen", "This is the kitchen, right?", "Yes, this is the kitchen"]),
     "Great! The kitchen."),
    ("house_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'This is the bedroom' -- mismo patron con otra habitacion.",
               ["This is the bedroom", "This is the bedroom, right?", "Yes, this is the bedroom"]),
     "Perfect! The bedroom."),
    ("house_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'This is the bathroom' -- mismo patron.",
               ["This is the bathroom", "This is the bathroom, right?", "Yes, this is the bathroom"]),
     "Exactly! The bathroom."),
    ("house_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'This is the living room' -- mismo patron.",
               ["This is the living room", "This is the living room, right?", "Yes, this is the living room"],
               extra="Ademas, para cerrar, pide un repaso de las 4 habitaciones de "
                     "este mapa (kitchen, bedroom, bathroom, living room) con "
                     "'This is the ___'."),
     "Amazing! You know 4 rooms now!"),

    ("house_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'The table is in the kitchen' introduce la preposicion "
                       "'in' para decir que algo esta DENTRO de una habitacion.",
               ["The table is in the kitchen", "The table is in the kitchen, right?", "Yes, the table is in the kitchen"]),
     "Great! In the kitchen -- inside a room."),
    ("house_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'The bed is in the bedroom' -- mismo patron con 'in'.",
               ["The bed is in the bedroom", "The bed is in the bedroom, right?", "Yes, the bed is in the bedroom"]),
     "Perfect! In the bedroom."),
    ("house_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'The chair is in the living room' -- mismo patron con "
                       "'in'.",
               ["The chair is in the living room", "The chair is in the living room, right?", "Yes, the chair is in the living room"]),
     "Exactly! In the living room."),
    ("house_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'The book is on the table' introduce la preposicion 'on' "
                       "para decir que algo esta ENCIMA de una superficie, "
                       "distinto de 'in'.",
               ["The book is on the table", "The book is on the table, right?", "Yes, the book is on the table"]),
     "Right! On the table -- on top of a surface."),
    ("house_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'The lamp is on the table' -- mismo patron con 'on'. "
                       "Recuerda: 'in' es dentro de un lugar, 'on' es encima de "
                       "una superficie.",
               ["The lamp is on the table", "The lamp is on the table, right?", "Yes, the lamp is on the table"],
               extra="Ademas, para cerrar, pide un repaso de los objetos de este "
                     "mapa contrastando 'in' (table/bed/chair) y 'on' (book/lamp)."),
     "Awesome! In vs on -- you got it!"),

    ("house_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'This is the kitchen' y "
     "'This is the bedroom'. Dale a elegir: 'This is the kitchen', 'This is the "
     "bedroom', 'This is the kitchen and this is the bedroom'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Es repaso, no introduzcas "
     "habitaciones nuevas.",
     "Great! Kitchen and bedroom, still solid."),
    ("house_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'This is the bathroom' y 'This is the "
     "living room'. Dale a elegir: 'This is the bathroom', 'This is the living "
     "room', 'This is the bathroom and this is the living room'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin habitaciones "
     "nuevas.",
     "Exactly! Bathroom and living room, well done."),
    ("house_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'in' es dentro de un lugar -- 'The table "
     "is in the kitchen', 'The bed is in the bedroom'. Dale a elegir: 'The table "
     "is in the kitchen', 'The bed is in the bedroom', 'The chair is in the living "
     "room'. Completa la tarea cuando el jugador diga correctamente al menos 3. "
     "Repaso, sin objetos nuevos.",
     "Perfect! In -- inside a room."),
    ("house_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'on' es encima de una superficie -- 'The "
     "book is on the table', 'The lamp is on the table'. Dale a elegir: 'The book "
     "is on the table', 'The lamp is on the table', 'The book and the lamp are on "
     "the table'. Completa la tarea cuando el jugador diga correctamente al menos "
     "3. Repaso, sin objetos nuevos.",
     "Great! On -- on top of a surface, got it."),
    ("house_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: 'in' es dentro de un lugar, 'on' es "
     "encima de una superficie. Este es el repaso final antes del examen. Pide al "
     "jugador que diga al menos 3 frases mezclando 'This is the ___' (habitaciones) "
     "y 'The ___ is in/on the ___' (objetos) con cualquiera de las 9 palabras "
     "vistas. Completa la tarea cuando lo haga.",
     "Amazing! You know the whole house now!"),
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
    ("house_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("house_grove_1", "Mochi"), None, 0),
    ("house_grove_1", 2, "Aprende 'kitchen' con Joy", "talk_to_npc", ("house_grove_1", "Joy"), None, 0),
    ("house_grove_1", 3, "Aprende 'bedroom' con Ann", "talk_to_npc", ("house_grove_1", "Ann"), None, 0),
    ("house_grove_1", 4, "Aprende 'bathroom' con Sam", "talk_to_npc", ("house_grove_1", "Sam"), None, 0),
    ("house_grove_1", 5, "Aprende 'living room' con Amy", "talk_to_npc", ("house_grove_1", "Amy"), None, 0),

    ("house_grove_2", 1, "Aprende 'table in' con Joy", "talk_to_npc", ("house_grove_2", "Joy"), None, 0),
    ("house_grove_2", 2, "Aprende 'bed in' con Ann", "talk_to_npc", ("house_grove_2", "Ann"), None, 0),
    ("house_grove_2", 3, "Aprende 'chair in' con Sam", "talk_to_npc", ("house_grove_2", "Sam"), None, 0),
    ("house_grove_2", 4, "Aprende 'book on' con Zoe", "talk_to_npc", ("house_grove_2", "Zoe"), None, 0),
    ("house_grove_2", 5, "Aprende 'lamp on' con Tom", "talk_to_npc", ("house_grove_2", "Tom"), None, 0),

    ("house_square", 1, "Repasa kitchen/bedroom con Toro", "talk_to_npc", ("house_square", "Toro"), None, 0),
    ("house_square", 2, "Repasa bathroom/living room con Sam", "talk_to_npc", ("house_square", "Sam"), None, 0),
    ("house_square", 3, "Repasa 'in' con Joy", "talk_to_npc", ("house_square", "Joy"), None, 0),
    ("house_square", 4, "Repasa 'on' con Ann", "talk_to_npc", ("house_square", "Ann"), None, 0),
    ("house_square", 5, "Repaso final con Tom", "talk_to_npc", ("house_square", "Tom"), None, 0),

    ("combate_house_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_house_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_house_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_house_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_house_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 20 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
