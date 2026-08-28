"""
Mundo 14: Colores -- Etapas 1-4. Primer mundo del Bloque B (vocabulario
funcional). Reusa el patron 'It is a/an [adjetivo] [sustantivo]' de
Mundo 5 sin gramatica nueva -- el color ocupa el mismo lugar que
cualquier otro adjetivo.

Map1 = 4 colores (red, blue, green, yellow).
Map2 = 5 colores (orange, purple, black, white, brown).
Map3 = repaso mezclando los 9 colores.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Sandy Bloom" (arena de Mundo 7 + flores de Mundo 5) para dialogo,
"Muddy Clearing" (tierra usada varias veces + tocones/musgo de Mundo 9)
para combate.

Uso:
    python mundo14_colores_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "color_grove_1"),
    ("the_village_2", "color_grove_2"),
    ("clock_tower", "color_square"),
    ("combate_town_1", "combate_color_1"),
    ("combate_town_2", "combate_color_2"),
    ("combat_town_boss", "combate_color_boss"),
]

SIGNS = {
    "color_grove_1": (450, 250,
        "# 🎨 Colores: red / blue / green / yellow\n\n"
        "El color va en el mismo lugar que cualquier adjetivo: **it is a/an [color] [sustantivo]**.\n\n"
        "🍎 **It is a red apple** - es una manzana roja\n"
        "🚗 **It is a blue car** - es un carro azul\n"
        "🌳 **It is a green tree** - es un arbol verde\n"
        "🍌 **It is a yellow banana** - es una banana amarilla\n\n"
        "💡 El color siempre va antes del sustantivo."),
    "color_grove_2": (450, 450,
        "# 🌈 Mas colores: orange / purple / black / white / brown\n\n"
        "Seguimos el mismo patron con mas colores.\n\n"
        "☂️ **It is an orange umbrella** - es un paraguas naranja\n"
        "🍇 **It is a purple grape** - es una uva morada\n"
        "🐱 **It is a black cat** - es un gato negro\n"
        "☁️ **It is a white cloud** - es una nube blanca\n"
        "🐶 **It is a brown dog** - es un perro cafe\n\n"
        "❗ 'Orange' empieza con sonido vocal, por eso usamos 'an'."),
    "color_square": (450, 250,
        "# 🔁 Repaso: los 9 colores\n\n"
        "Antes del examen, repasa todos juntos.\n\n"
        "👉 red, blue, green, yellow\n"
        "👉 orange, purple, black, white, brown\n\n"
        "💬 Practica: 'It is a/an [color] [sustantivo]' con cualquier color."),
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

    if dst in ("color_grove_1", "color_grove_2", "color_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Sandy Bloom": arena (Mundo 7) + flores (Mundo 5), nunca
        # combinados antes.
        SAND_FLOOR = ["sprite33", "sprite34", "sprite35", "sprite36"]
        FLOWERS = ["sprite32", "sprite33", "sprite34", "sprite35", "sprite41", "sprite42"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(SAND_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.16:
                new_forest.append({"x": x, "y": y, "frame": random.choice(FLOWERS)})
        wallsData["forest"] = new_forest

    if dst in ("combate_color_1", "combate_color_2", "combate_color_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Muddy Clearing": tierra + tocones/musgo (Mundo 9), nunca
        # combinados antes.
        DIRT_FLOOR = ["sprite25", "sprite26", "sprite27", "sprite28", "sprite29", "sprite30"]
        CLEARING_DECOR = ["sprite65", "sprite68", "sprite69", "sprite70", "sprite57"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(DIRT_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(CLEARING_DECOR)} for x, y in old_forest_positions
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
    dict(scene_key="color_grove_1", title="Colores: red / blue / green / yellow",
         description_en="Practica los colores red/blue/green/yellow",
         objective_en="Practica It is a/an [color] [sustantivo]", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="color_grove_2", title="Colores: orange / purple / black / white / brown",
         description_en="Practica los colores orange/purple/black/white/brown",
         objective_en="Practica It is a/an [color] [sustantivo]", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="color_square", title="Repaso: los 9 colores",
         description_en="Repasa los 9 colores antes del examen",
         objective_en="Repasa los 9 colores", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_color_1", title="Los ogros invaden el claro lodoso",
         description_en="Defiende el claro mientras repasas colores",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_color_2", title="Los ogros atacan el claro lodoso",
         description_en="Elimina a los ogros del claro",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_color_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas los colores derrotando al jefe",
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
    ("color_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a aprender colores con 'It is a/an "
     "[color] [sustantivo]'. Pregunta 'Are you ready?'. Si el jugador no sabe que "
     "responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea si "
     "responde afirmativamente.",
     "Great! Let's talk about colors."),
    ("color_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'It is a red apple' describe un objeto usando un color como "
                       "adjetivo. El color va en el mismo lugar que cualquier "
                       "adjetivo: despues del articulo, antes del sustantivo.",
               ["It is a red apple", "It is a red apple, right?", "Yes, it is a red apple"]),
     "Great! Red -- like an apple."),
    ("color_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'It is a blue car' -- mismo patron, el color 'blue' describe "
                       "el sustantivo 'car'.",
               ["It is a blue car", "It is a blue car, right?", "Yes, it is a blue car"]),
     "Perfect! Blue -- like the sky."),
    ("color_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'It is a green tree' -- el color va siempre antes del "
                       "sustantivo, igual que otros adjetivos ya vistos (good, big, "
                       "small).",
               ["It is a green tree", "It is a green tree, right?", "Yes, it is a green tree"]),
     "Exactly! Green -- like a tree."),
    ("color_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'It is a yellow banana' -- mismo patron con otro color.",
               ["It is a yellow banana", "It is a yellow banana, right?", "Yes, it is a yellow banana"],
               extra="Ademas, para cerrar, pide un repaso de los 4 colores de este "
                     "mapa (red, blue, green, yellow) con 'It is a/an [color] ___'."),
     "Amazing! You know 4 colors now!"),

    ("color_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'It is an orange umbrella' -- 'orange' empieza con sonido "
                       "vocal, por eso usamos 'an' en vez de 'a'.",
               ["It is an orange umbrella", "It is an orange umbrella, right?", "Yes, it is an orange umbrella"]),
     "Great! Orange -- with 'an', vowel sound."),
    ("color_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'It is a purple grape' -- mismo patron, 'purple' describe "
                       "'grape'.",
               ["It is a purple grape", "It is a purple grape, right?", "Yes, it is a purple grape"]),
     "Perfect! Purple -- like a grape."),
    ("color_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'It is a black cat' -- el color siempre va antes del "
                       "sustantivo.",
               ["It is a black cat", "It is a black cat, right?", "Yes, it is a black cat"]),
     "Exactly! Black -- like a cat."),
    ("color_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'It is a white cloud' -- mismo patron con otro color.",
               ["It is a white cloud", "It is a white cloud, right?", "Yes, it is a white cloud"]),
     "Right! White -- like a cloud."),
    ("color_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'It is a brown dog' -- recuerda: los colores van en el mismo "
                       "lugar que otros adjetivos, 'it is a/an [color] [sustantivo]'.",
               ["It is a brown dog", "It is a brown dog, right?", "Yes, it is a brown dog"],
               extra="Ademas, para cerrar, pide un repaso de los colores de este mapa "
                     "(orange, purple, black, white, brown) con 'It is a/an [color] "
                     "___'."),
     "Awesome! 5 more colors, well done!"),

    ("color_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'It is a red apple' y 'It is a "
     "blue car' -- el color siempre va antes del sustantivo. Dale a elegir: 'It is a "
     "red apple', 'It is a blue car', 'It is a red apple, not a blue car'. Completa "
     "la tarea cuando el jugador diga correctamente al menos 3. Es repaso, no "
     "introduzcas colores nuevos.",
     "Great! Red and blue, still solid."),
    ("color_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'It is a green tree' y 'It is a yellow "
     "banana'. Dale a elegir: 'It is a green tree', 'It is a yellow banana', 'It is a "
     "green tree and a yellow banana'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Repaso, sin colores nuevos.",
     "Exactly! Green and yellow, well done."),
    ("color_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'It is an orange umbrella' (an, sonido "
     "vocal) y 'It is a purple grape' (a, sonido consonante). Dale a elegir: 'It is "
     "an orange umbrella', 'It is a purple grape', 'It is an orange umbrella, not a "
     "purple grape'. Completa la tarea cuando el jugador diga correctamente al menos "
     "3. Repaso, sin colores nuevos.",
     "Perfect! Orange and purple, solid."),
    ("color_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'It is a black cat', 'It is a white cloud', "
     "'It is a brown dog' -- todos siguen el mismo patron. Dale a elegir: 'It is a "
     "black cat', 'It is a white cloud', 'It is a brown dog'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin colores nuevos.",
     "Great! Black, white, and brown, got it."),
    ("color_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: it is + a/an + color + sustantivo. "
     "Cualquier color puede ir ahi. Este es el repaso final antes del examen. Pide al "
     "jugador que diga al menos 3 frases usando 'It is a/an [color] [sustantivo]' con "
     "cualquiera de los 9 colores vistos (red, blue, green, yellow, orange, purple, "
     "black, white, brown). Completa la tarea cuando lo haga.",
     "Amazing! You know all the colors now!"),
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
    ("color_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("color_grove_1", "Mochi"), None, 0),
    ("color_grove_1", 2, "Aprende 'red' con Joy", "talk_to_npc", ("color_grove_1", "Joy"), None, 0),
    ("color_grove_1", 3, "Aprende 'blue' con Ann", "talk_to_npc", ("color_grove_1", "Ann"), None, 0),
    ("color_grove_1", 4, "Aprende 'green' con Sam", "talk_to_npc", ("color_grove_1", "Sam"), None, 0),
    ("color_grove_1", 5, "Aprende 'yellow' con Amy", "talk_to_npc", ("color_grove_1", "Amy"), None, 0),

    ("color_grove_2", 1, "Aprende 'orange' con Joy", "talk_to_npc", ("color_grove_2", "Joy"), None, 0),
    ("color_grove_2", 2, "Aprende 'purple' con Ann", "talk_to_npc", ("color_grove_2", "Ann"), None, 0),
    ("color_grove_2", 3, "Aprende 'black' con Sam", "talk_to_npc", ("color_grove_2", "Sam"), None, 0),
    ("color_grove_2", 4, "Aprende 'white' con Zoe", "talk_to_npc", ("color_grove_2", "Zoe"), None, 0),
    ("color_grove_2", 5, "Aprende 'brown' con Tom", "talk_to_npc", ("color_grove_2", "Tom"), None, 0),

    ("color_square", 1, "Repasa red/blue con Toro", "talk_to_npc", ("color_square", "Toro"), None, 0),
    ("color_square", 2, "Repasa green/yellow con Sam", "talk_to_npc", ("color_square", "Sam"), None, 0),
    ("color_square", 3, "Repasa orange/purple con Joy", "talk_to_npc", ("color_square", "Joy"), None, 0),
    ("color_square", 4, "Repasa black/white/brown con Ann", "talk_to_npc", ("color_square", "Ann"), None, 0),
    ("color_square", 5, "Repaso final con Tom", "talk_to_npc", ("color_square", "Tom"), None, 0),

    ("combate_color_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_color_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_color_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_color_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_color_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 14 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
