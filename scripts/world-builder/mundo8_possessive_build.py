"""
Mundo 8: Posesivos (my/your/his/her/its/our/their) -- Etapas 1-4. Los 7
posesivos juntos en un solo mundo (misma logica que Mundo 2 con los 7
pronombres sujeto), repartidos en 3 mapas con sustantivos simples
(book/pen/car/house/dog/bag/toy).

Map1 = my/your/his/her (4). Map2 = its/our/their (3) + repaso extra.
Map3 = repaso de los 7.

Mismo patron de NPC: saludo limpio + AL MENOS 3 repeticiones resueltas.

Uso:
    python mundo8_possessive_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "possessive_village_1"),
    ("the_village_2", "possessive_village_2"),
    ("clock_tower", "possessive_square"),
    ("combate_town_1", "combate_possessive_1"),
    ("combate_town_2", "combate_possessive_2"),
    ("combat_town_boss", "combate_possessive_boss"),
]

SIGNS = {
    "possessive_village_1": (450, 250,
        "# 🎒 Posesivos: my / your / his / her\n\n"
        "Estos pronombres indican de quien es algo.\n\n"
        "📕 **This is my book** - este es mi libro\n"
        "🖊️ **Is this your pen?** - es este tu boligrafo?\n"
        "🚗 **This is his car** - este es su carro (de el)\n"
        "🏠 **This is her house** - esta es su casa (de ella)\n\n"
        "💡 El posesivo va antes del sustantivo, igual que el articulo."),
    "possessive_village_2": (450, 450,
        "# 🐶 Mas posesivos: its / our / their\n\n"
        "'Its' es para animales/objetos (sin apostrofe).\n\n"
        "🐶 **The dog wags its tail** - el perro mueve su cola\n"
        "🎒 **This is our bag** - esta es nuestra mochila\n"
        "🧸 **This is their toy** - este es su juguete (de ellos)\n\n"
        "❗ 'Its' nunca lleva apostrofe (its ≠ it's)."),
    "possessive_square": (450, 250,
        "# 🔁 Repaso: los 7 posesivos\n\n"
        "Antes del examen, repasa todos juntos.\n\n"
        "👉 my, your, his, her\n"
        "👉 its, our, their\n\n"
        "💬 Practica: 'This is ___ ___' con cualquier posesivo y sustantivo."),
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

    if dst in ("possessive_village_1", "possessive_village_2", "possessive_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "jardin de cabana": pasto + hongos/flores pequenas mezcladas.
        GARDEN_DECOR = ["sprite34", "sprite35", "sprite32", "sprite41", "sprite42", "sprite38"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(["sprite1", "sprite2", "sprite3"])
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.20:
                new_forest.append({"x": x, "y": y, "frame": random.choice(GARDEN_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_possessive_1", "combate_possessive_2", "combate_possessive_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "llanura polvorienta": tierra + cactus escasos.
        DIRT = ["sprite25", "sprite26", "sprite27", "sprite28", "sprite29"]
        CACTUS = ["sprite50", "sprite52", "sprite59", "sprite62"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(DIRT)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(CACTUS)} for x, y in old_forest_positions
                      if random.random() < 0.7]
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
    dict(scene_key="possessive_village_1", title="Posesivos: my / your / his / her",
         description_en="Practica los posesivos my/your/his/her",
         objective_en="Practica This is my/your/his/her ___", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="possessive_village_2", title="Posesivos: its / our / their",
         description_en="Practica los posesivos its/our/their",
         objective_en="Practica This is its/our/their ___", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="possessive_square", title="Repaso: los 7 posesivos",
         description_en="Repasa los 7 posesivos antes del examen",
         objective_en="Repasa my/your/his/her/its/our/their", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_possessive_1", title="Los ogros invaden la llanura",
         description_en="Defiende la llanura mientras repasas posesivos",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_possessive_2", title="Los ogros atacan a Ben",
         description_en="Salva a Ben, elimina a los ogros",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_possessive_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas los posesivos derrotando al jefe",
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
def npc_instr(name, possessive_en, possessive_es, noun_en, noun_es, examples, extra=""):
    ex = "', '".join(examples)
    return (f"Eres {name}, hablas ingles. Ensena el posesivo '{possessive_en}' "
            f"({possessive_es}) con 'This is {possessive_en} {noun_en}'. Dale al jugador "
            f"estas frases para repetir: '{ex}'. Completa la tarea cuando el jugador diga "
            f"correctamente AL MENOS 3 de estas frases (repetir la misma frase varias "
            f"veces tambien cuenta). {extra}")

npcs = [
    ("possessive_village_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a aprender posesivos con 'my/"
     "your/his/her/its/our/their'. Pregunta 'Are you ready?'. Si el jugador no "
     "sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la "
     "tarea si responde afirmativamente.",
     "Great! Let's learn about possessions."),
    ("possessive_village_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "my", "mi", "book", "libro",
               ["This is my book", "This is my book, right?", "Yes, this is my book"]),
     "Great! This is my book."),
    ("possessive_village_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "your", "tu", "pen", "boligrafo",
               ["Is this your pen?", "Yes, this is your pen", "No, this isn't your pen"]),
     "Perfect! Is this your pen?"),
    ("possessive_village_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "his", "su (de el)", "car", "carro",
               ["This is his car", "This is his car, right?", "Yes, this is his car"]),
     "Exactly! This is his car."),
    ("possessive_village_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "her", "su (de ella)", "house", "casa",
               ["This is her house", "This is her house, right?", "Yes, this is her house"],
               extra="Ademas, para cerrar, pide un repaso de los 4 posesivos de este "
                     "mapa (my, your, his, her) con 'This is ___ ___'."),
     "Amazing! You know 4 possessives now!"),

    ("possessive_village_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "its", "su (de eso)", "tail", "cola",
               ["The dog wags its tail", "It wags its tail, right?", "Yes, it wags its tail"],
               extra="Aclara que 'its' NUNCA lleva apostrofe (its, no it's)."),
     "Great! Its -- no apostrophe, remember!"),
    ("possessive_village_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "our", "nuestro/a", "bag", "mochila",
               ["This is our bag", "This is our bag, right?", "Yes, this is our bag"]),
     "Perfect! This is our bag."),
    ("possessive_village_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "their", "su (de ellos)", "toy", "juguete",
               ["This is their toy", "This is their toy, right?", "Yes, this is their toy"]),
     "Exactly! This is their toy."),
    ("possessive_village_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "our", "nuestro/a", "house", "casa",
               ["This is our house", "This is our house, right?", "Yes, this is our house"]),
     "Right! This is our house."),
    ("possessive_village_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "their", "su (de ellos)", "car", "carro",
               ["This is their car", "This is their car, right?", "Yes, this is their car"],
               extra="Ademas, para cerrar, pide un repaso de its/our/their con 'This is "
                     "___ ___'."),
     "Awesome! Its, our, their -- solid now!"),

    ("possessive_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Repasa 'my' y 'your'. Dale a elegir: "
     "'This is my book', 'Is this your pen?', 'This is my book, not your pen'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Es "
     "repaso, no introduzcas posesivos nuevos.",
     "Great! My and your, still solid."),
    ("possessive_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Repasa 'his' y 'her'. Dale a elegir: 'This is his "
     "car', 'This is her house', 'This is his car and her house'. Completa la "
     "tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "posesivos nuevos.",
     "Exactly! His and her, well done."),
    ("possessive_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Repasa 'its'. Dale a elegir: 'The dog wags its "
     "tail', 'The cat likes its toy', 'It has its own bed'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin posesivos "
     "nuevos.",
     "Perfect! Its, no apostrophe, you got it."),
    ("possessive_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Repasa 'our' y 'their'. Dale a elegir: 'This is "
     "our bag', 'This is their toy', 'This is our bag, not their toy'. Completa "
     "la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "posesivos nuevos.",
     "Great! Our and their, solid."),
    ("possessive_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide al "
     "jugador que diga al menos 3 frases usando 'This is ___ ___' con posesivos "
     "distintos de los 7 vistos (my, your, his, her, its, our, their). Completa "
     "la tarea cuando lo haga.",
     "Amazing! You know all 7 possessives now!"),
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
    ("possessive_village_1", 1, "Habla con Mochi", "talk_to_npc", ("possessive_village_1", "Mochi"), None, 0),
    ("possessive_village_1", 2, "Aprende 'my' con Joy", "talk_to_npc", ("possessive_village_1", "Joy"), None, 0),
    ("possessive_village_1", 3, "Aprende 'your' con Ann", "talk_to_npc", ("possessive_village_1", "Ann"), None, 0),
    ("possessive_village_1", 4, "Aprende 'his' con Sam", "talk_to_npc", ("possessive_village_1", "Sam"), None, 0),
    ("possessive_village_1", 5, "Aprende 'her' con Amy", "talk_to_npc", ("possessive_village_1", "Amy"), None, 0),

    ("possessive_village_2", 1, "Aprende 'its' con Joy", "talk_to_npc", ("possessive_village_2", "Joy"), None, 0),
    ("possessive_village_2", 2, "Aprende 'our' con Ann", "talk_to_npc", ("possessive_village_2", "Ann"), None, 0),
    ("possessive_village_2", 3, "Aprende 'their' con Sam", "talk_to_npc", ("possessive_village_2", "Sam"), None, 0),
    ("possessive_village_2", 4, "Repasa 'our' con Zoe", "talk_to_npc", ("possessive_village_2", "Zoe"), None, 0),
    ("possessive_village_2", 5, "Repasa 'their' con Tom", "talk_to_npc", ("possessive_village_2", "Tom"), None, 0),

    ("possessive_square", 1, "Repasa 'my'/'your' con Toro", "talk_to_npc", ("possessive_square", "Toro"), None, 0),
    ("possessive_square", 2, "Repasa 'his'/'her' con Sam", "talk_to_npc", ("possessive_square", "Sam"), None, 0),
    ("possessive_square", 3, "Repasa 'its' con Joy", "talk_to_npc", ("possessive_square", "Joy"), None, 0),
    ("possessive_square", 4, "Repasa 'our'/'their' con Ann", "talk_to_npc", ("possessive_square", "Ann"), None, 0),
    ("possessive_square", 5, "Repaso final con Tom", "talk_to_npc", ("possessive_square", "Tom"), None, 0),

    ("combate_possessive_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_possessive_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_possessive_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_possessive_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_possessive_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 8 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
