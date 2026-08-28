"""
Mundo 13: There is / There are -- Etapas 1-4. Cierra el Bloque A del
roadmap (gramatica base). Describe que hay en un lugar, usando a/an
(Mundo 9) y plural -s (Mundo 9) ya conocidos.

Map1 = There is + a/an + sustantivo singular.
Map2 = There are + numero + sustantivo plural (-s).
Map3 = repaso contrastando singular vs plural con el mismo sustantivo.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README).

Terreno: siguiendo la lesson 9.5 (el atlas forest ya no tiene frames
100% nuevos), se cruzan combinaciones piso+decoracion que nunca se
usaron JUNTAS antes, aunque cada pieza ya existia por separado:
"Cobblestone Pines" (ladrillo de Mundo 11 + pinos de Mundo 10) para
dialogo, y "Driftwood Graveyard" (madera de Mundo 6 + arboles muertos de
Mundo 6, nunca combinados en un mismo mapa) para combate.

Uso:
    python mundo13_thereis_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "thereis_grove_1"),
    ("the_village_2", "thereis_grove_2"),
    ("clock_tower", "thereis_square"),
    ("combate_town_1", "combate_thereis_1"),
    ("combate_town_2", "combate_thereis_2"),
    ("combat_town_boss", "combate_thereis_boss"),
]

SIGNS = {
    "thereis_grove_1": (450, 250,
        "# 📍 There is + a/an (singular)\n\n"
        "Usamos **There is** para decir que existe UNA cosa en un lugar.\n\n"
        "🐱 **There is a cat** - hay un gato\n"
        "📕 **There is a book** - hay un libro\n"
        "🍎 **There is an apple** - hay una manzana\n"
        "🌳 **There is a tree** - hay un arbol\n\n"
        "💡 'An' antes de sonido vocal, igual que siempre."),
    "thereis_grove_2": (450, 450,
        "# 📍📍 There are + numero (plural)\n\n"
        "Usamos **There are** para decir que existen VARIAS cosas.\n\n"
        "🐱🐱 **There are two cats** - hay dos gatos\n"
        "📕📕📕 **There are three books** - hay tres libros\n"
        "🍎🍎 **There are two apples** - hay dos manzanas\n"
        "🌳🌳🌳🌳 **There are four trees** - hay cuatro arboles\n\n"
        "❗ Con 'there are', el sustantivo siempre lleva -s."),
    "thereis_square": (450, 250,
        "# 🔁 Repaso: There is vs There are\n\n"
        "Antes del examen, compara singular y plural.\n\n"
        "👉 **There is a cat** / **There are two cats**\n"
        "👉 **There is a book** / **There are three books**\n\n"
        "💬 'Is' con singular, 'are' con plural -- nunca al reves."),
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

    if dst in ("thereis_grove_1", "thereis_grove_2", "thereis_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Cobblestone Pines": ladrillo (Mundo 11) + pinos (Mundo 10),
        # nunca combinados antes en un mismo mapa.
        BRICK_FLOOR = ["sprite9", "sprite10", "sprite11"]
        PINE_MIX = ["sprite12", "sprite13", "sprite14"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(BRICK_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.16:
                new_forest.append({"x": x, "y": y, "frame": random.choice(PINE_MIX)})
        wallsData["forest"] = new_forest

    if dst in ("combate_thereis_1", "combate_thereis_2", "combate_thereis_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Driftwood Graveyard": madera (Mundo 6) + arboles muertos
        # (Mundo 6), nunca combinados en el mismo mapa.
        WOOD_FLOOR = ["sprite49", "sprite50", "sprite51", "sprite52", "sprite53", "sprite54"]
        DEAD_TREES = ["sprite6", "sprite15", "sprite19", "sprite20"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(WOOD_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(DEAD_TREES)} for x, y in old_forest_positions
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
    dict(scene_key="thereis_grove_1", title="There is + a/an (singular)",
         description_en="Practica There is + a/an + sustantivo",
         objective_en="Practica There is a/an ___", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="thereis_grove_2", title="There are + numero (plural)",
         description_en="Practica There are + numero + sustantivo plural",
         objective_en="Practica There are + numero + ___s", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="thereis_square", title="Repaso: There is vs There are",
         description_en="Repasa el contraste antes del examen",
         objective_en="Repasa There is vs There are", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_thereis_1", title="Los ogros invaden el cementerio de troncos",
         description_en="Defiende el area mientras repasas There is/are",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_thereis_2", title="Los ogros atacan el cementerio de troncos",
         description_en="Elimina a los ogros del area",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_thereis_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas There is/There are derrotando al jefe",
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
    ("thereis_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a describir que hay en un lugar con "
     "'There is a/an ___'. Pregunta 'Are you ready?'. Si el jugador no sabe que "
     "responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea si "
     "responde afirmativamente.",
     "Great! Let's see what's around here."),
    ("thereis_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'There is' + a/an + sustantivo singular describe que algo "
                       "existe en un lugar. Por ejemplo, 'There is a cat' dice que "
                       "hay un gato.",
               ["There is a cat", "There is a cat in the room", "Yes, there is a cat"]),
     "Great! There is a cat -- something exists here."),
    ("thereis_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'There is' se usa con sustantivos singulares: 'There is a "
                       "book' dice que hay un libro.",
               ["There is a book", "There is a book on the table", "Yes, there is a book"]),
     "Perfect! There is a book."),
    ("thereis_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "Con sustantivos que empiezan en sonido vocal, se usa 'an': "
                       "'There is an apple' dice que hay una manzana.",
               ["There is an apple", "There is an apple on the table", "Yes, there is an apple"]),
     "Exactly! There is an apple -- 'an' before vowel sound."),
    ("thereis_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'There is' tambien sirve para lugares al aire libre: 'There is "
                       "a tree' dice que hay un arbol.",
               ["There is a tree", "There is a tree in the garden", "Yes, there is a tree"],
               extra="Ademas, para cerrar, pide un repaso de los 4 sustantivos de este "
                     "mapa (cat, book, apple, tree) con 'There is a/an ___'."),
     "Amazing! You know 'there is' now!"),

    ("thereis_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'There are' + numero + sustantivo plural (con -s) describe que "
                       "hay varias cosas. Por ejemplo, 'There are two cats' dice que "
                       "hay dos gatos.",
               ["There are two cats", "There are two cats here", "Yes, there are two cats"]),
     "Great! There are two cats -- plural with -s."),
    ("thereis_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "Con 'there are', el sustantivo siempre lleva -s: 'There are "
                       "three books' dice que hay tres libros.",
               ["There are three books", "There are three books here", "Yes, there are three books"]),
     "Perfect! There are three books."),
    ("thereis_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'There are two apples' -- igual que con 'there is', 'apple' "
                       "solo agrega -s en plural, no cambia de forma.",
               ["There are two apples", "There are two apples here", "Yes, there are two apples"]),
     "Exactly! There are two apples."),
    ("thereis_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'There are four trees' -- se usa el numero exacto antes del "
                       "sustantivo plural.",
               ["There are four trees", "There are four trees here", "Yes, there are four trees"]),
     "Right! There are four trees."),
    ("thereis_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'There are three flowers' -- recuerda: singular 'there is', "
                       "plural 'there are'.",
               ["There are three flowers", "There are three flowers here", "Yes, there are three flowers"],
               extra="Ademas, para cerrar, pide un repaso de los sustantivos de este "
                     "mapa (cats, books, apples, trees, flowers) con 'There are' + "
                     "numero."),
     "Awesome! There are + number + plural, always!"),

    ("thereis_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'There is a cat' (uno) pero "
     "'There are two cats' (varios) -- 'is' con singular, 'are' con plural. Dale a "
     "elegir: 'There is a cat', 'There are two cats', 'There is a cat, there are two "
     "dogs'. Completa la tarea cuando el jugador diga correctamente al menos 3. Es "
     "repaso, no introduzcas sustantivos nuevos.",
     "Great! Is with singular, are with plural."),
    ("thereis_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'There is a book' / 'There are three books' "
     "-- el sustantivo agrega -s en plural. Dale a elegir: 'There is a book', 'There "
     "are three books', 'There is a book here, there are three books there'. Completa "
     "la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "sustantivos nuevos.",
     "Exactly! Book and books, well done."),
    ("thereis_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'There is an apple' / 'There are two apples' "
     "-- 'an' solo en singular, nunca en plural. Dale a elegir: 'There is an apple', "
     "'There are two apples', 'There is an apple, there are two apples too'. Completa "
     "la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "sustantivos nuevos.",
     "Perfect! An only in singular."),
    ("thereis_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'There is a tree' / 'There are four trees' "
     "-- singular con is, plural con are. Dale a elegir: 'There is a tree', 'There "
     "are four trees', 'There is a tree here, there are four trees there'. Completa "
     "la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "sustantivos nuevos.",
     "Great! Tree and trees, got it."),
    ("thereis_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: There is + a/an + singular. There are + "
     "numero + plural (-s). Nunca 'there is' con plural ni 'there are' con singular. "
     "Este es el repaso final antes del examen. Pide al jugador que diga al menos 3 "
     "frases mezclando 'there is'/'there are' con cualquiera de los sustantivos "
     "vistos (cat, book, apple, tree, flower). Completa la tarea cuando lo haga.",
     "Amazing! You've mastered there is/there are now!"),
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
    ("thereis_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("thereis_grove_1", "Mochi"), None, 0),
    ("thereis_grove_1", 2, "Aprende 'There is a cat' con Joy", "talk_to_npc", ("thereis_grove_1", "Joy"), None, 0),
    ("thereis_grove_1", 3, "Aprende 'There is a book' con Ann", "talk_to_npc", ("thereis_grove_1", "Ann"), None, 0),
    ("thereis_grove_1", 4, "Aprende 'There is an apple' con Sam", "talk_to_npc", ("thereis_grove_1", "Sam"), None, 0),
    ("thereis_grove_1", 5, "Aprende 'There is a tree' con Amy", "talk_to_npc", ("thereis_grove_1", "Amy"), None, 0),

    ("thereis_grove_2", 1, "Aprende 'There are two cats' con Joy", "talk_to_npc", ("thereis_grove_2", "Joy"), None, 0),
    ("thereis_grove_2", 2, "Aprende 'There are three books' con Ann", "talk_to_npc", ("thereis_grove_2", "Ann"), None, 0),
    ("thereis_grove_2", 3, "Aprende 'There are two apples' con Sam", "talk_to_npc", ("thereis_grove_2", "Sam"), None, 0),
    ("thereis_grove_2", 4, "Aprende 'There are four trees' con Zoe", "talk_to_npc", ("thereis_grove_2", "Zoe"), None, 0),
    ("thereis_grove_2", 5, "Aprende 'There are three flowers' con Tom", "talk_to_npc", ("thereis_grove_2", "Tom"), None, 0),

    ("thereis_square", 1, "Repasa cat/cats con Toro", "talk_to_npc", ("thereis_square", "Toro"), None, 0),
    ("thereis_square", 2, "Repasa book/books con Sam", "talk_to_npc", ("thereis_square", "Sam"), None, 0),
    ("thereis_square", 3, "Repasa apple/apples con Joy", "talk_to_npc", ("thereis_square", "Joy"), None, 0),
    ("thereis_square", 4, "Repasa tree/trees con Ann", "talk_to_npc", ("thereis_square", "Ann"), None, 0),
    ("thereis_square", 5, "Repaso final con Tom", "talk_to_npc", ("thereis_square", "Tom"), None, 0),

    ("combate_thereis_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_thereis_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_thereis_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_thereis_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_thereis_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 13 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
