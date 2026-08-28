"""
Mundo 9: Plural y Articulos (this/that/these/those, a/an, the) -- Etapas
1-4. Un solo tema (senalar/describir objetos, singular vs plural) repetido
en 3 mapas, igual logica que Mundo 8 con los posesivos.

Map1 = singular this/a-an / that/a-an (4 sustantivos con contraste a/an).
Map2 = plural these/those + -s (mismos 4 sustantivos, plural regular).
Map3 = repaso mezclando this/that/these/those + introduccion de "the".

Terreno nuevo (no usado en mundos anteriores): plaza de piedra con musgo
y troncos (dialogo) + caverna rocosa oscura (combate).

Uso:
    python mundo9_plural_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "twofold_market_1"),
    ("the_village_2", "twofold_market_2"),
    ("clock_tower", "twofold_square"),
    ("combate_town_1", "combate_twofold_1"),
    ("combate_town_2", "combate_twofold_2"),
    ("combat_town_boss", "combate_twofold_boss"),
]

SIGNS = {
    "twofold_market_1": (450, 250,
        "# 🍎 A vs An: this / that\n\n"
        "Usamos **a** antes de sonido consonante, **an** antes de sonido vocal.\n\n"
        "🐱 **This is a cat** - este es un gato\n"
        "🍎 **This is an apple** - esta es una manzana\n"
        "🐶 **That is a dog** - ese es un perro\n"
        "🍊 **That is an orange** - esa es una naranja\n\n"
        "💡 'This/these' = cerca, 'that/those' = lejos."),
    "twofold_market_2": (450, 450,
        "# 📚 Plural: these / those + -s\n\n"
        "Para hablar de varias cosas, agregamos **-s** y cambiamos this→these, that→those.\n\n"
        "🐱 **These are cats** - estos son gatos\n"
        "🍎 **These are apples** - estas son manzanas\n"
        "🐶 **Those are dogs** - esos son perros\n"
        "🍊 **Those are oranges** - esas son naranjas\n\n"
        "❗ Singular: this/that + a/an. Plural: these/those + -s (sin a/an)."),
    "twofold_square": (450, 250,
        "# 🔁 Repaso: this / that / these / those / the\n\n"
        "Antes del examen, repasa todo junto.\n\n"
        "👉 Singular cerca: **this is a/an ___**\n"
        "👉 Singular lejos: **that is a/an ___**\n"
        "👉 Plural cerca: **these are ___s**\n"
        "👉 Plural lejos: **those are ___s**\n"
        "👉 Algo especifico: **the ___**\n\n"
        "💬 Practica mezclando todas las formas."),
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

    if dst in ("twofold_market_1", "twofold_market_2", "twofold_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "plaza de piedra": piso de losas grises + musgo/troncos dispersos.
        STONE_FLOOR = ["sprite13", "sprite14", "sprite15", "sprite16"]
        CLEARING_DECOR = ["sprite65", "sprite68", "sprite69", "sprite70", "sprite57"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(STONE_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(CLEARING_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_twofold_1", "combate_twofold_2", "combate_twofold_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "caverna oscura": piso de roca de cueva + musgo/vides escasas.
        CAVE_FLOOR = ["sprite57", "sprite58", "sprite61", "sprite62"]
        CAVE_DECOR = ["sprite65", "sprite61"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(CAVE_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(CAVE_DECOR)} for x, y in old_forest_positions
                      if random.random() < 0.5]
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
    dict(scene_key="twofold_market_1", title="Singular: this/that + a/an",
         description_en="Practica this/that con a/an",
         objective_en="Practica This is a/an ___ / That is a/an ___", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="twofold_market_2", title="Plural: these/those + -s",
         description_en="Practica these/those con plural -s",
         objective_en="Practica These are ___s / Those are ___s", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="twofold_square", title="Repaso: this/that/these/those/the",
         description_en="Repasa todos los determinantes antes del examen",
         objective_en="Repasa this/that/these/those/the", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_twofold_1", title="Los ogros invaden la caverna",
         description_en="Defiende la caverna mientras repasas plurales",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_twofold_2", title="Los ogros atacan en la caverna",
         description_en="Elimina a los ogros de la caverna",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_twofold_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas plurales y articulos derrotando al jefe",
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
def npc_instr(name, pattern_examples, focus_note=""):
    ex = "', '".join(pattern_examples)
    return (f"Eres {name}, hablas ingles. Ensena estas frases al jugador, dale la "
            f"lista completa y dile que las puede repetir tal cual: '{ex}'. Completa "
            f"la tarea cuando el jugador diga correctamente AL MENOS 3 de estas frases "
            f"(repetir la misma frase varias veces tambien cuenta). {focus_note}")

npcs = [
    ("twofold_market_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a aprender a senalar objetos con "
     "'this/that' y los articulos 'a/an'. Pregunta 'Are you ready?'. Si el jugador no "
     "sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la "
     "tarea si responde afirmativamente.",
     "Great! Let's point at some things."),
    ("twofold_market_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", ["This is a cat", "This is an apple",
                        "This is a cat, this is an apple"],
               focus_note="Aclara que 'a' va antes de sonido consonante (cat) y 'an' "
                          "antes de sonido vocal (apple)."),
     "Great! A cat, an apple -- nice work!"),
    ("twofold_market_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", ["That is a dog", "That is an orange",
                        "That is a dog, that is an orange"]),
     "Perfect! That's far away, so we say 'that'."),
    ("twofold_market_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", ["This is a book", "This is an egg",
                        "This is a book, this is an egg"]),
     "Exactly! A book, an egg."),
    ("twofold_market_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", ["That is a house", "That is an umbrella",
                        "This is a cat and that is a house"],
               focus_note="Ademas, para cerrar, pide un repaso mezclando this/that con "
                          "a/an de los 4 objetos vistos en este mapa."),
     "Amazing! You know this/that with a/an now!"),

    ("twofold_market_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", ["These are cats", "These are apples",
                        "These are cats, these are apples"],
               focus_note="Aclara que en plural no se usa 'a/an', solo se agrega -s."),
     "Great! These are cats, these are apples."),
    ("twofold_market_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", ["Those are dogs", "Those are oranges",
                        "Those are dogs, those are oranges"]),
     "Perfect! Those are dogs, far away."),
    ("twofold_market_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", ["These are books", "These are eggs",
                        "These are books, these are eggs"]),
     "Exactly! These are books, these are eggs."),
    ("twofold_market_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", ["Those are houses", "Those are umbrellas",
                        "Those are houses, those are umbrellas"]),
     "Right! Those are houses, those are umbrellas."),
    ("twofold_market_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", ["These are cats and those are dogs",
                        "These are apples and those are oranges",
                        "These are books and those are houses"],
               focus_note="Ademas, para cerrar, pide un repaso de these/those con "
                          "cualquiera de los 8 sustantivos vistos."),
     "Awesome! These and those, solid now!"),

    ("twofold_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Repasa singular vs plural cercano: "
     "'This is a cat' vs 'These are cats'. Dale a elegir: 'This is a cat', "
     "'These are cats', 'This is a cat, not these are cats'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Es repaso, no introduzcas "
     "vocabulario nuevo.",
     "Great! Singular and plural, near -- still solid."),
    ("twofold_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Repasa singular vs plural lejano: 'That is a dog' "
     "vs 'Those are dogs'. Dale a elegir: 'That is a dog', 'Those are dogs', "
     "'That is a dog, those are dogs'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Repaso, sin vocabulario nuevo.",
     "Exactly! Singular and plural, far -- well done."),
    ("twofold_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Repasa 'a' vs 'an' segun el sonido. Dale a elegir: "
     "'This is a cat', 'This is an apple', 'That is an orange'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin vocabulario "
     "nuevo.",
     "Perfect! A before consonant sound, an before vowel sound."),
    ("twofold_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Introduce brevemente 'the' para algo especifico ya "
     "mencionado, en contraste con 'a/an'. Dale a elegir: 'The cat is black', "
     "'The apple is red', 'I have a cat, the cat is black'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3.",
     "Great! 'The' for something specific."),
    ("twofold_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide al "
     "jugador que diga al menos 3 frases mezclando this/that/these/those/a/an/the "
     "con cualquier sustantivo visto (cat, apple, dog, orange, book, egg, house, "
     "umbrella). Completa la tarea cuando lo haga.",
     "Amazing! You've got this/that/these/those/the now!"),
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
    ("twofold_market_1", 1, "Habla con Mochi", "talk_to_npc", ("twofold_market_1", "Mochi"), None, 0),
    ("twofold_market_1", 2, "Aprende 'a cat / an apple' con Joy", "talk_to_npc", ("twofold_market_1", "Joy"), None, 0),
    ("twofold_market_1", 3, "Aprende 'a dog / an orange' con Ann", "talk_to_npc", ("twofold_market_1", "Ann"), None, 0),
    ("twofold_market_1", 4, "Aprende 'a book / an egg' con Sam", "talk_to_npc", ("twofold_market_1", "Sam"), None, 0),
    ("twofold_market_1", 5, "Aprende 'a house / an umbrella' con Amy", "talk_to_npc", ("twofold_market_1", "Amy"), None, 0),

    ("twofold_market_2", 1, "Aprende 'these are cats/apples' con Joy", "talk_to_npc", ("twofold_market_2", "Joy"), None, 0),
    ("twofold_market_2", 2, "Aprende 'those are dogs/oranges' con Ann", "talk_to_npc", ("twofold_market_2", "Ann"), None, 0),
    ("twofold_market_2", 3, "Aprende 'these are books/eggs' con Sam", "talk_to_npc", ("twofold_market_2", "Sam"), None, 0),
    ("twofold_market_2", 4, "Aprende 'those are houses/umbrellas' con Zoe", "talk_to_npc", ("twofold_market_2", "Zoe"), None, 0),
    ("twofold_market_2", 5, "Repaso plural con Tom", "talk_to_npc", ("twofold_market_2", "Tom"), None, 0),

    ("twofold_square", 1, "Repasa singular/plural cercano con Toro", "talk_to_npc", ("twofold_square", "Toro"), None, 0),
    ("twofold_square", 2, "Repasa singular/plural lejano con Sam", "talk_to_npc", ("twofold_square", "Sam"), None, 0),
    ("twofold_square", 3, "Repasa a/an con Joy", "talk_to_npc", ("twofold_square", "Joy"), None, 0),
    ("twofold_square", 4, "Aprende 'the' con Ann", "talk_to_npc", ("twofold_square", "Ann"), None, 0),
    ("twofold_square", 5, "Repaso final con Tom", "talk_to_npc", ("twofold_square", "Tom"), None, 0),

    ("combate_twofold_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_twofold_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_twofold_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_twofold_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_twofold_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 9 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
