"""
Mundo 17: Numeros y Cantidades -- Etapas 1-4. Cuarto mundo del Bloque B
(vocabulario). Reusa 'There are + numero + sustantivo plural' (Mundo 13)
para contar mas alla de 12 (13-20), y agrega 'How many [sustantivo] are
there?' como extension natural (misma logica compositiva que Mundo 9
combino this/that/these/those/a/an/the en un solo mundo).

Map1 = numeros 13-16 (thirteen, fourteen, fifteen, sixteen).
Map2 = numeros 17-20 (seventeen, eighteen, nineteen, twenty) + 'How
many...are there?'.
Map3 = repaso mezclando los 8 numeros y la pregunta.

Las instructions incluyen el contexto gramatical desde el diseno
inicial (lesson 9 del README). El letrero del mapa "_square" va en
(450, 550), NUNCA en (450, 250) -- ahi esta la torre de clock_tower
(lesson 12 del README).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Stone Garden" (piedra de Mundo 9/15 + arbustos/helechos de Mundo
11) para dialogo, "Wooden Clearing" (madera de Mundo 6/16 + tocones/musgo
de Mundo 9/17) para combate.

Uso:
    python mundo17_numeros_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "number_grove_1"),
    ("the_village_2", "number_grove_2"),
    ("clock_tower", "number_square"),
    ("combate_town_1", "combate_number_1"),
    ("combate_town_2", "combate_number_2"),
    ("combat_town_boss", "combate_number_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "number_grove_1": (450, 250,
        "# 🔢 Numeros: 13-16\n\n"
        "Seguimos contando mas alla de 12 con 'There are' + numero + plural.\n\n"
        "🍎 **There are thirteen apples** - hay trece manzanas\n"
        "📕 **There are fourteen books** - hay catorce libros\n"
        "🐱 **There are fifteen cats** - hay quince gatos\n"
        "🌳 **There are sixteen trees** - hay dieciseis arboles\n\n"
        "💡 El numero va antes del sustantivo plural, igual que siempre."),
    "number_grove_2": (450, 450,
        "# 🔢🔢 Numeros: 17-20 + How many?\n\n"
        "Terminamos de contar hasta 20 y aprendemos a preguntar cuantos hay.\n\n"
        "🌸 **There are seventeen flowers** - hay diecisiete flores\n"
        "🐶 **There are eighteen dogs** - hay dieciocho perros\n"
        "🐦 **There are nineteen birds** - hay diecinueve pajaros\n"
        "⭐ **There are twenty stars** - hay veinte estrellas\n\n"
        "❓ **How many apples are there? There are thirteen apples.**\n\n"
        "❗ La respuesta repite el patron 'There are [numero] [sustantivo]'."),
    "number_square": (450, 550,
        "# 🔁 Repaso: 13-20 y How many?\n\n"
        "Antes del examen, repasa todos los numeros.\n\n"
        "👉 thirteen, fourteen, fifteen, sixteen\n"
        "👉 seventeen, eighteen, nineteen, twenty\n\n"
        "💬 Practica: 'How many [sustantivo] are there? There are [numero] [sustantivo]'."),
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

    if dst in ("number_grove_1", "number_grove_2", "number_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Stone Garden": piedra (Mundo 9/15) + arbustos/helechos
        # (Mundo 11), nunca combinados antes.
        STONE_FLOOR = ["sprite13", "sprite14", "sprite15", "sprite16"]
        YARD_DECOR = ["sprite51", "sprite56", "sprite36"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(STONE_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.15:
                new_forest.append({"x": x, "y": y, "frame": random.choice(YARD_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_number_1", "combate_number_2", "combate_number_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Wooden Clearing": madera (Mundo 6/16) + tocones/musgo
        # (Mundo 9), nunca combinados antes.
        WOOD_FLOOR = ["sprite49", "sprite50", "sprite51", "sprite52", "sprite53", "sprite54"]
        CLEARING_DECOR = ["sprite65", "sprite68", "sprite69", "sprite70", "sprite57"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(WOOD_FLOOR)
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
    dict(scene_key="number_grove_1", title="Numeros: 13-16",
         description_en="Practica los numeros 13-16 con There are",
         objective_en="Practica There are [numero] [sustantivo]", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="number_grove_2", title="Numeros: 17-20 y How many?",
         description_en="Practica los numeros 17-20 y la pregunta How many",
         objective_en="Practica There are [numero] ___ / How many ___ are there?", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="number_square", title="Repaso: 13-20 y How many?",
         description_en="Repasa los numeros y la pregunta antes del examen",
         objective_en="Repasa 13-20 y How many", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_number_1", title="Los ogros invaden el claro de madera",
         description_en="Defiende el claro mientras repasas numeros",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_number_2", title="Los ogros atacan el claro de madera",
         description_en="Elimina a los ogros del claro",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_number_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas los numeros derrotando al jefe",
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
    ("number_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a seguir contando mas alla de 12 "
     "con 'There are [numero] [sustantivo]'. Pregunta 'Are you ready?'. Si el "
     "jugador no sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. "
     "Completa la tarea si responde afirmativamente.",
     "Great! Let's count higher."),
    ("number_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'Thirteen' es el numero 13. Con 'there are' + numero + "
                       "sustantivo plural, decimos cuantas cosas hay: 'There are "
                       "thirteen apples'.",
               ["There are thirteen apples", "There are thirteen apples here", "Yes, there are thirteen apples"]),
     "Great! Thirteen -- 13."),
    ("number_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'Fourteen' es el numero 14. Mismo patron: 'There are "
                       "fourteen books'.",
               ["There are fourteen books", "There are fourteen books here", "Yes, there are fourteen books"]),
     "Perfect! Fourteen -- 14."),
    ("number_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'Fifteen' es el numero 15. Mismo patron: 'There are fifteen "
                       "cats'.",
               ["There are fifteen cats", "There are fifteen cats here", "Yes, there are fifteen cats"]),
     "Exactly! Fifteen -- 15."),
    ("number_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'Sixteen' es el numero 16. Mismo patron: 'There are sixteen "
                       "trees'.",
               ["There are sixteen trees", "There are sixteen trees here", "Yes, there are sixteen trees"],
               extra="Ademas, para cerrar, pide un repaso de los 4 numeros de este "
                     "mapa (13, 14, 15, 16) con 'There are [numero] [sustantivo]'."),
     "Amazing! You know 13 to 16 now!"),

    ("number_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'Seventeen' es el numero 17. Mismo patron: 'There are "
                       "seventeen flowers'.",
               ["There are seventeen flowers", "There are seventeen flowers here", "Yes, there are seventeen flowers"]),
     "Great! Seventeen -- 17."),
    ("number_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'Eighteen' es el numero 18. Mismo patron: 'There are "
                       "eighteen dogs'.",
               ["There are eighteen dogs", "There are eighteen dogs here", "Yes, there are eighteen dogs"]),
     "Perfect! Eighteen -- 18."),
    ("number_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'Nineteen' es el numero 19. Mismo patron: 'There are "
                       "nineteen birds'.",
               ["There are nineteen birds", "There are nineteen birds here", "Yes, there are nineteen birds"]),
     "Exactly! Nineteen -- 19."),
    ("number_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'Twenty' es el numero 20. Mismo patron: 'There are twenty "
                       "stars'.",
               ["There are twenty stars", "There are twenty stars here", "Yes, there are twenty stars"]),
     "Right! Twenty -- 20."),
    ("number_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "Para preguntar cuantos hay, usamos 'How many [sustantivo "
                       "plural] are there?'. La respuesta repite el patron 'There "
                       "are [numero] [sustantivo]'. Por ejemplo: 'How many apples "
                       "are there? There are thirteen apples.'",
               ["How many apples are there?", "There are thirteen apples", "How many books are there? There are fourteen books"],
               extra="Ademas, para cerrar, pide un repaso de los numeros 17-20 y de "
                     "la pregunta 'How many ___ are there?'."),
     "Awesome! Now you can ask how many!"),

    ("number_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'There are thirteen apples' "
     "(13) y 'There are fourteen books' (14). Dale a elegir: 'There are thirteen "
     "apples', 'There are fourteen books', 'There are thirteen apples and fourteen "
     "books'. Completa la tarea cuando el jugador diga correctamente al menos 3. Es "
     "repaso, no introduzcas numeros nuevos.",
     "Great! Thirteen and fourteen, still solid."),
    ("number_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'There are fifteen cats' (15) y 'There are "
     "sixteen trees' (16). Dale a elegir: 'There are fifteen cats', 'There are "
     "sixteen trees', 'There are fifteen cats and sixteen trees'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin numeros nuevos.",
     "Exactly! Fifteen and sixteen, well done."),
    ("number_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'There are seventeen flowers' (17) y 'There "
     "are eighteen dogs' (18). Dale a elegir: 'There are seventeen flowers', 'There "
     "are eighteen dogs', 'There are seventeen flowers and eighteen dogs'. Completa "
     "la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin numeros "
     "nuevos.",
     "Perfect! Seventeen and eighteen, solid."),
    ("number_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'There are nineteen birds' (19) y 'There "
     "are twenty stars' (20). Dale a elegir: 'There are nineteen birds', 'There are "
     "twenty stars', 'There are nineteen birds and twenty stars'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin numeros nuevos.",
     "Great! Nineteen and twenty, got it."),
    ("number_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: 'How many [sustantivo] are there?' se "
     "responde con 'There are [numero] [sustantivo]'. Este es el repaso final antes "
     "del examen. Pide al jugador que diga al menos 3 frases mezclando los numeros "
     "13-20 con 'There are' o con la pregunta 'How many ___ are there?'. Completa la "
     "tarea cuando lo haga.",
     "Amazing! You can count to 20 and ask how many now!"),
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
    ("number_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("number_grove_1", "Mochi"), None, 0),
    ("number_grove_1", 2, "Aprende 'thirteen' con Joy", "talk_to_npc", ("number_grove_1", "Joy"), None, 0),
    ("number_grove_1", 3, "Aprende 'fourteen' con Ann", "talk_to_npc", ("number_grove_1", "Ann"), None, 0),
    ("number_grove_1", 4, "Aprende 'fifteen' con Sam", "talk_to_npc", ("number_grove_1", "Sam"), None, 0),
    ("number_grove_1", 5, "Aprende 'sixteen' con Amy", "talk_to_npc", ("number_grove_1", "Amy"), None, 0),

    ("number_grove_2", 1, "Aprende 'seventeen' con Joy", "talk_to_npc", ("number_grove_2", "Joy"), None, 0),
    ("number_grove_2", 2, "Aprende 'eighteen' con Ann", "talk_to_npc", ("number_grove_2", "Ann"), None, 0),
    ("number_grove_2", 3, "Aprende 'nineteen' con Sam", "talk_to_npc", ("number_grove_2", "Sam"), None, 0),
    ("number_grove_2", 4, "Aprende 'twenty' con Zoe", "talk_to_npc", ("number_grove_2", "Zoe"), None, 0),
    ("number_grove_2", 5, "Aprende 'How many...?' con Tom", "talk_to_npc", ("number_grove_2", "Tom"), None, 0),

    ("number_square", 1, "Repasa 13/14 con Toro", "talk_to_npc", ("number_square", "Toro"), None, 0),
    ("number_square", 2, "Repasa 15/16 con Sam", "talk_to_npc", ("number_square", "Sam"), None, 0),
    ("number_square", 3, "Repasa 17/18 con Joy", "talk_to_npc", ("number_square", "Joy"), None, 0),
    ("number_square", 4, "Repasa 19/20 con Ann", "talk_to_npc", ("number_square", "Ann"), None, 0),
    ("number_square", 5, "Repaso final con Tom", "talk_to_npc", ("number_square", "Tom"), None, 0),

    ("combate_number_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_number_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_number_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_number_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_number_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 17 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
