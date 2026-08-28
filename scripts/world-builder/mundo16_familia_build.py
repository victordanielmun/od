"""
Mundo 16: Familia -- Etapas 1-4. Tercer mundo del Bloque B (vocabulario).
Reusa posesivos (Mundo 8: my/your/his/her/our/their) + he is/she is
(Mundo 4) sin gramatica nueva -- el patron es 'This is [posesivo]
[familiar]' o '[He/She] is [posesivo] [familiar]'.

Map1 = 4 familiares (mother, father, brother, sister).
Map2 = 5 familiares (grandmother, grandfather, aunt, uncle, cousin).
Map3 = repaso mezclando los 9 familiares y posesivos.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Fallen Deck" (madera de Mundo 6 + arboles caidos de Mundo 12) para
dialogo, "Cactus Dunes" (arena + cactus de Mundo 8, nunca combinados)
para combate.

Uso:
    python mundo16_familia_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "family_grove_1"),
    ("the_village_2", "family_grove_2"),
    ("clock_tower", "family_square"),
    ("combate_town_1", "combate_family_1"),
    ("combate_town_2", "combate_family_2"),
    ("combat_town_boss", "combate_family_boss"),
]

SIGNS = {
    "family_grove_1": (450, 250,
        "# 👪 Familia: mother / father / brother / sister\n\n"
        "Usamos posesivos (ya conocidos) + el sustantivo de familia.\n\n"
        "👩 **This is my mother** - esta es mi mama\n"
        "👨 **This is my father** - este es mi papa\n"
        "👦 **He is my brother** - el es mi hermano\n"
        "👧 **She is my sister** - ella es mi hermana\n\n"
        "💡 'He'/'she' segun sea hombre o mujer, igual que siempre."),
    "family_grove_2": (450, 450,
        "# 👴 Mas familia: grandmother / grandfather / aunt / uncle / cousin\n\n"
        "Variamos el posesivo para practicar todos.\n\n"
        "👵 **This is her grandmother** - esta es su abuela (de ella)\n"
        "👴 **This is his grandfather** - este es su abuelo (de el)\n"
        "👩‍🦳 **This is our aunt** - esta es nuestra tia\n"
        "👨‍🦳 **This is their uncle** - este es su tio (de ellos)\n"
        "🧑 **This is my cousin** - este es mi primo\n\n"
        "❗ El posesivo cambia segun de quien es el familiar."),
    "family_square": (450, 250,
        "# 🔁 Repaso: los 9 familiares\n\n"
        "Antes del examen, repasa todos juntos.\n\n"
        "👉 mother, father, brother, sister\n"
        "👉 grandmother, grandfather, aunt, uncle, cousin\n\n"
        "💬 Practica: 'This is [posesivo] [familiar]' con cualquier combinacion."),
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

    if dst in ("family_grove_1", "family_grove_2", "family_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Fallen Deck": madera (Mundo 6) + arboles caidos (Mundo
        # 12), nunca combinados antes.
        WOOD_FLOOR = ["sprite49", "sprite50", "sprite51", "sprite52", "sprite53", "sprite54"]
        FALLEN_DECOR = ["sprite3", "sprite4", "sprite55"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(WOOD_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.14:
                new_forest.append({"x": x, "y": y, "frame": random.choice(FALLEN_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_family_1", "combate_family_2", "combate_family_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Cactus Dunes": arena + cactus (Mundo 8), nunca combinados
        # con piso de arena antes (Mundo 8 uso tierra, no arena).
        SAND_FLOOR = ["sprite31", "sprite32", "sprite33", "sprite34"]
        CACTUS = ["sprite50", "sprite52", "sprite59", "sprite62"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(SAND_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(CACTUS)} for x, y in old_forest_positions
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
    dict(scene_key="family_grove_1", title="Familia: mother / father / brother / sister",
         description_en="Practica mother/father/brother/sister con posesivos",
         objective_en="Practica This is my ___ / He-She is my ___", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="family_grove_2", title="Familia: grandmother / grandfather / aunt / uncle / cousin",
         description_en="Practica grandmother/grandfather/aunt/uncle/cousin con posesivos",
         objective_en="Practica This is [posesivo] ___", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="family_square", title="Repaso: los 9 familiares",
         description_en="Repasa los 9 familiares antes del examen",
         objective_en="Repasa los 9 familiares", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_family_1", title="Los ogros invaden las dunas",
         description_en="Defiende las dunas mientras repasas familia",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_family_2", title="Los ogros atacan las dunas",
         description_en="Elimina a los ogros de las dunas",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_family_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas la familia derrotando al jefe",
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
    ("family_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a hablar de la familia usando "
     "posesivos (my/his/her/our/their) + sustantivos de familia. Pregunta 'Are you "
     "ready?'. Si el jugador no sabe que responder, sugierele 'Sure', 'OK', 'Yes' o "
     "'Let's go'. Completa la tarea si responde afirmativamente.",
     "Great! Let's talk about family."),
    ("family_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'This is my mother' usa el posesivo 'my' (ya visto) + el "
                       "sustantivo de familia 'mother' (mama).",
               ["This is my mother", "This is my mother, right?", "Yes, this is my mother"]),
     "Great! Mother -- mama."),
    ("family_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'This is my father' -- mismo patron, 'father' es papa.",
               ["This is my father", "This is my father, right?", "Yes, this is my father"]),
     "Perfect! Father -- papa."),
    ("family_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'He is my brother' -- 'he' porque 'brother' es hombre, 'my' "
                       "indica que es de quien habla.",
               ["He is my brother", "He is my brother, right?", "Yes, he is my brother"]),
     "Exactly! Brother -- he, not she."),
    ("family_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'She is my sister' -- 'she' porque 'sister' es mujer.",
               ["She is my sister", "She is my sister, right?", "Yes, she is my sister"],
               extra="Ademas, para cerrar, pide un repaso de los 4 familiares de "
                     "este mapa (mother, father, brother, sister) con posesivos."),
     "Amazing! You know 4 family words now!"),

    ("family_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'This is her grandmother' -- 'her' indica que la abuela es "
                       "de otra persona (una mujer).",
               ["This is her grandmother", "This is her grandmother, right?", "Yes, this is her grandmother"]),
     "Great! Grandmother -- with 'her'."),
    ("family_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'This is his grandfather' -- 'his' indica que el abuelo es "
                       "de otra persona (un hombre).",
               ["This is his grandfather", "This is his grandfather, right?", "Yes, this is his grandfather"]),
     "Perfect! Grandfather -- with 'his'."),
    ("family_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'This is our aunt' -- 'our' indica que la tia es de ti y de "
                       "otras personas juntas.",
               ["This is our aunt", "This is our aunt, right?", "Yes, this is our aunt"]),
     "Exactly! Aunt -- with 'our'."),
    ("family_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'This is their uncle' -- 'their' indica que el tio es de un "
                       "grupo de personas.",
               ["This is their uncle", "This is their uncle, right?", "Yes, this is their uncle"]),
     "Right! Uncle -- with 'their'."),
    ("family_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'This is my cousin' -- 'my' indica que el primo/prima es de "
                       "quien habla.",
               ["This is my cousin", "This is my cousin, right?", "Yes, this is my cousin"],
               extra="Ademas, para cerrar, pide un repaso de los familiares de este "
                     "mapa (grandmother, grandfather, aunt, uncle, cousin) con sus "
                     "posesivos correspondientes."),
     "Awesome! 5 more family words, well done!"),

    ("family_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'This is my mother' y 'This is "
     "my father'. Dale a elegir: 'This is my mother', 'This is my father', 'This is "
     "my mother and my father'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Es repaso, no introduzcas familiares nuevos.",
     "Great! Mother and father, still solid."),
    ("family_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'He is my brother' y 'She is my sister'. "
     "Dale a elegir: 'He is my brother', 'She is my sister', 'He is my brother and "
     "she is my sister'. Completa la tarea cuando el jugador diga correctamente al "
     "menos 3. Repaso, sin familiares nuevos.",
     "Exactly! Brother and sister, well done."),
    ("family_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'This is her grandmother' y 'This is his "
     "grandfather' -- el posesivo cambia segun de quien es. Dale a elegir: 'This is "
     "her grandmother', 'This is his grandfather', 'This is her grandmother and his "
     "grandfather'. Completa la tarea cuando el jugador diga correctamente al menos "
     "3. Repaso, sin familiares nuevos.",
     "Perfect! Grandmother and grandfather, solid."),
    ("family_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'This is our aunt', 'This is their uncle', "
     "'This is my cousin' -- cada posesivo indica de quien es el familiar. Dale a "
     "elegir: 'This is our aunt', 'This is their uncle', 'This is my cousin'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "familiares nuevos.",
     "Great! Aunt, uncle, and cousin, got it."),
    ("family_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide al "
     "jugador que diga al menos 3 frases usando 'This is [posesivo] [familiar]' o "
     "'He/She is [posesivo] [familiar]' con cualquiera de los 9 familiares vistos "
     "(mother, father, brother, sister, grandmother, grandfather, aunt, uncle, "
     "cousin) y cualquier posesivo. Completa la tarea cuando lo haga.",
     "Amazing! You know the whole family now!"),
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
    ("family_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("family_grove_1", "Mochi"), None, 0),
    ("family_grove_1", 2, "Aprende 'mother' con Joy", "talk_to_npc", ("family_grove_1", "Joy"), None, 0),
    ("family_grove_1", 3, "Aprende 'father' con Ann", "talk_to_npc", ("family_grove_1", "Ann"), None, 0),
    ("family_grove_1", 4, "Aprende 'brother' con Sam", "talk_to_npc", ("family_grove_1", "Sam"), None, 0),
    ("family_grove_1", 5, "Aprende 'sister' con Amy", "talk_to_npc", ("family_grove_1", "Amy"), None, 0),

    ("family_grove_2", 1, "Aprende 'grandmother' con Joy", "talk_to_npc", ("family_grove_2", "Joy"), None, 0),
    ("family_grove_2", 2, "Aprende 'grandfather' con Ann", "talk_to_npc", ("family_grove_2", "Ann"), None, 0),
    ("family_grove_2", 3, "Aprende 'aunt' con Sam", "talk_to_npc", ("family_grove_2", "Sam"), None, 0),
    ("family_grove_2", 4, "Aprende 'uncle' con Zoe", "talk_to_npc", ("family_grove_2", "Zoe"), None, 0),
    ("family_grove_2", 5, "Aprende 'cousin' con Tom", "talk_to_npc", ("family_grove_2", "Tom"), None, 0),

    ("family_square", 1, "Repasa mother/father con Toro", "talk_to_npc", ("family_square", "Toro"), None, 0),
    ("family_square", 2, "Repasa brother/sister con Sam", "talk_to_npc", ("family_square", "Sam"), None, 0),
    ("family_square", 3, "Repasa grandmother/grandfather con Joy", "talk_to_npc", ("family_square", "Joy"), None, 0),
    ("family_square", 4, "Repasa aunt/uncle/cousin con Ann", "talk_to_npc", ("family_square", "Ann"), None, 0),
    ("family_square", 5, "Repaso final con Tom", "talk_to_npc", ("family_square", "Tom"), None, 0),

    ("combate_family_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_family_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_family_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_family_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_family_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 16 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
