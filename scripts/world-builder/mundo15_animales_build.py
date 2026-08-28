"""
Mundo 15: Animales -- Etapas 1-4. Segundo mundo del Bloque B
(vocabulario). Reusa 'This is a/an ___' (Mundo 9) + 'It + verbo-s'
(presente simple, Mundo 10) sin gramatica nueva -- el patron es
'This is a/an [animal]. It lives in/on [habitat].'

Map1 = 4 animales (dog, cat, bird, fish).
Map2 = 5 animales (lion, elephant, rabbit, horse, monkey).
Map3 = repaso mezclando los 9 animales.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Stone Grove" (piso de piedra de Mundo 9 + arboles caidos de Mundo
12) para dialogo, "Rocky Thicket" (piso rocoso de Mundo 6/12 + arbustos
de Mundo 10) para combate.

Uso:
    python mundo15_animales_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "animal_grove_1"),
    ("the_village_2", "animal_grove_2"),
    ("clock_tower", "animal_square"),
    ("combate_town_1", "combate_animal_1"),
    ("combate_town_2", "combate_animal_2"),
    ("combat_town_boss", "combate_animal_boss"),
]

SIGNS = {
    "animal_grove_1": (450, 250,
        "# 🐾 Animales: dog / cat / bird / fish\n\n"
        "Presentamos el animal y decimos donde vive.\n\n"
        "🐶 **This is a dog. It lives on a farm.**\n"
        "🐱 **This is a cat. It lives in a house.**\n"
        "🐦 **This is a bird. It lives in a tree.**\n"
        "🐟 **This is a fish. It lives in the water.**\n\n"
        "💡 'It' + verbo-s, igual que el presente simple que ya conoces."),
    "animal_grove_2": (450, 450,
        "# 🦁 Mas animales: lion / elephant / rabbit / horse / monkey\n\n"
        "Seguimos el mismo patron con animales salvajes.\n\n"
        "🦁 **This is a lion. It lives in the jungle.**\n"
        "🐘 **This is an elephant. It lives in the jungle.**\n"
        "🐰 **This is a rabbit. It lives in the forest.**\n"
        "🐴 **This is a horse. It lives on a farm.**\n"
        "🐒 **This is a monkey. It lives in the jungle.**\n\n"
        "❗ 'Elephant' empieza con sonido vocal, por eso usamos 'an'."),
    "animal_square": (450, 250,
        "# 🔁 Repaso: los 9 animales\n\n"
        "Antes del examen, repasa todos juntos.\n\n"
        "👉 dog, cat, bird, fish\n"
        "👉 lion, elephant, rabbit, horse, monkey\n\n"
        "💬 Practica: 'This is a/an [animal]. It lives in/on [lugar].'"),
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

    if dst in ("animal_grove_1", "animal_grove_2", "animal_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Stone Grove": piso de piedra (Mundo 9) + arboles caidos
        # (Mundo 12), nunca combinados antes.
        STONE_FLOOR = ["sprite13", "sprite14", "sprite15", "sprite16"]
        FALLEN_DECOR = ["sprite3", "sprite4", "sprite55"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(STONE_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.16:
                new_forest.append({"x": x, "y": y, "frame": random.choice(FALLEN_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_animal_1", "combate_animal_2", "combate_animal_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Rocky Thicket": piso rocoso (Mundo 6/12) + arbustos
        # (Mundo 10), nunca combinados antes.
        ROCK_FLOOR = ["sprite41", "sprite42", "sprite43", "sprite44", "sprite45", "sprite46", "sprite47", "sprite48"]
        BUSH = ["sprite39", "sprite40", "sprite48"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(ROCK_FLOOR)
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
    dict(scene_key="animal_grove_1", title="Animales: dog / cat / bird / fish",
         description_en="Practica los animales dog/cat/bird/fish",
         objective_en="Practica This is a/an [animal]. It lives in/on ___", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="animal_grove_2", title="Animales: lion / elephant / rabbit / horse / monkey",
         description_en="Practica los animales lion/elephant/rabbit/horse/monkey",
         objective_en="Practica This is a/an [animal]. It lives in/on ___", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="animal_square", title="Repaso: los 9 animales",
         description_en="Repasa los 9 animales antes del examen",
         objective_en="Repasa los 9 animales", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_animal_1", title="Los ogros invaden el matorral rocoso",
         description_en="Defiende el matorral mientras repasas animales",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_animal_2", title="Los ogros atacan el matorral rocoso",
         description_en="Elimina a los ogros del matorral",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_animal_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas los animales derrotando al jefe",
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
    ("animal_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a aprender animales con 'This is "
     "a/an [animal]. It lives in/on [lugar]'. Pregunta 'Are you ready?'. Si el "
     "jugador no sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. "
     "Completa la tarea si responde afirmativamente.",
     "Great! Let's meet some animals."),
    ("animal_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'This is a dog' presenta el animal, y 'It lives on a farm' "
                       "dice donde vive, usando 'it' + verbo-s (presente simple ya "
                       "conocido).",
               ["This is a dog", "It lives on a farm", "This is a dog, it lives on a farm"]),
     "Great! Dogs live on farms."),
    ("animal_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'This is a cat' presenta el animal, y 'It lives in a house' "
                       "dice donde vive.",
               ["This is a cat", "It lives in a house", "This is a cat, it lives in a house"]),
     "Perfect! Cats live in houses."),
    ("animal_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'This is a bird' presenta el animal, y 'It lives in a tree' "
                       "dice donde vive.",
               ["This is a bird", "It lives in a tree", "This is a bird, it lives in a tree"]),
     "Exactly! Birds live in trees."),
    ("animal_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'This is a fish' presenta el animal, y 'It lives in the "
                       "water' dice donde vive.",
               ["This is a fish", "It lives in the water", "This is a fish, it lives in the water"],
               extra="Ademas, para cerrar, pide un repaso de los 4 animales de este "
                     "mapa (dog, cat, bird, fish) con su lugar donde viven."),
     "Amazing! You know 4 animals now!"),

    ("animal_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'This is a lion' presenta el animal, y 'It lives in the "
                       "jungle' dice donde vive.",
               ["This is a lion", "It lives in the jungle", "This is a lion, it lives in the jungle"]),
     "Great! Lions live in the jungle."),
    ("animal_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'This is an elephant' -- se usa 'an' porque 'elephant' "
                       "empieza con sonido vocal. 'It lives in the jungle' dice "
                       "donde vive.",
               ["This is an elephant", "It lives in the jungle", "This is an elephant, it lives in the jungle"]),
     "Perfect! An elephant -- vowel sound."),
    ("animal_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'This is a rabbit' presenta el animal, y 'It lives in the "
                       "forest' dice donde vive.",
               ["This is a rabbit", "It lives in the forest", "This is a rabbit, it lives in the forest"]),
     "Exactly! Rabbits live in the forest."),
    ("animal_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'This is a horse' presenta el animal, y 'It lives on a farm' "
                       "dice donde vive.",
               ["This is a horse", "It lives on a farm", "This is a horse, it lives on a farm"]),
     "Right! Horses live on farms."),
    ("animal_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'This is a monkey' presenta el animal, y 'It lives in the "
                       "jungle' dice donde vive.",
               ["This is a monkey", "It lives in the jungle", "This is a monkey, it lives in the jungle"],
               extra="Ademas, para cerrar, pide un repaso de los animales de este "
                     "mapa (lion, elephant, rabbit, horse, monkey) con su lugar "
                     "donde viven."),
     "Awesome! 5 more animals, well done!"),

    ("animal_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'This is a dog. It lives on a "
     "farm.' y 'This is a cat. It lives in a house.' Dale a elegir: 'This is a dog, "
     "it lives on a farm', 'This is a cat, it lives in a house', mezclando ambas. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Es repaso, "
     "no introduzcas animales nuevos.",
     "Great! Dog and cat, still solid."),
    ("animal_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'This is a bird. It lives in a tree.' y "
     "'This is a fish. It lives in the water.' Dale a elegir: 'This is a bird, it "
     "lives in a tree', 'This is a fish, it lives in the water', mezclando ambas. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "animales nuevos.",
     "Exactly! Bird and fish, well done."),
    ("animal_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'This is a lion' y 'This is an elephant' -- "
     "'an' con elephant por el sonido vocal, ambos viven en la selva. Dale a elegir: "
     "'This is a lion, it lives in the jungle', 'This is an elephant, it lives in the "
     "jungle'. Completa la tarea cuando el jugador diga correctamente al menos 3. "
     "Repaso, sin animales nuevos.",
     "Perfect! Lion and elephant, solid."),
    ("animal_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: rabbit vive en el bosque, horse en la "
     "granja, monkey en la selva. Dale a elegir: 'This is a rabbit, it lives in the "
     "forest', 'This is a horse, it lives on a farm', 'This is a monkey, it lives in "
     "the jungle'. Completa la tarea cuando el jugador diga correctamente al menos "
     "3. Repaso, sin animales nuevos.",
     "Great! Rabbit, horse, and monkey, got it."),
    ("animal_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide al "
     "jugador que diga al menos 3 frases completas ('This is a/an [animal]. It lives "
     "in/on [lugar]') con cualquiera de los 9 animales vistos (dog, cat, bird, fish, "
     "lion, elephant, rabbit, horse, monkey). Completa la tarea cuando lo haga.",
     "Amazing! You know all the animals now!"),
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
    ("animal_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("animal_grove_1", "Mochi"), None, 0),
    ("animal_grove_1", 2, "Aprende 'dog' con Joy", "talk_to_npc", ("animal_grove_1", "Joy"), None, 0),
    ("animal_grove_1", 3, "Aprende 'cat' con Ann", "talk_to_npc", ("animal_grove_1", "Ann"), None, 0),
    ("animal_grove_1", 4, "Aprende 'bird' con Sam", "talk_to_npc", ("animal_grove_1", "Sam"), None, 0),
    ("animal_grove_1", 5, "Aprende 'fish' con Amy", "talk_to_npc", ("animal_grove_1", "Amy"), None, 0),

    ("animal_grove_2", 1, "Aprende 'lion' con Joy", "talk_to_npc", ("animal_grove_2", "Joy"), None, 0),
    ("animal_grove_2", 2, "Aprende 'elephant' con Ann", "talk_to_npc", ("animal_grove_2", "Ann"), None, 0),
    ("animal_grove_2", 3, "Aprende 'rabbit' con Sam", "talk_to_npc", ("animal_grove_2", "Sam"), None, 0),
    ("animal_grove_2", 4, "Aprende 'horse' con Zoe", "talk_to_npc", ("animal_grove_2", "Zoe"), None, 0),
    ("animal_grove_2", 5, "Aprende 'monkey' con Tom", "talk_to_npc", ("animal_grove_2", "Tom"), None, 0),

    ("animal_square", 1, "Repasa dog/cat con Toro", "talk_to_npc", ("animal_square", "Toro"), None, 0),
    ("animal_square", 2, "Repasa bird/fish con Sam", "talk_to_npc", ("animal_square", "Sam"), None, 0),
    ("animal_square", 3, "Repasa lion/elephant con Joy", "talk_to_npc", ("animal_square", "Joy"), None, 0),
    ("animal_square", 4, "Repasa rabbit/horse/monkey con Ann", "talk_to_npc", ("animal_square", "Ann"), None, 0),
    ("animal_square", 5, "Repaso final con Tom", "talk_to_npc", ("animal_square", "Tom"), None, 0),

    ("combate_animal_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_animal_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_animal_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_animal_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_animal_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 15 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
