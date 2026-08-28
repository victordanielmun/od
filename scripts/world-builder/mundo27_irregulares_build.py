"""
Mundo 27: Pasado Simple (verbos irregulares comunes) -- Etapas 1-4.
Cierra el bloque completo de pasado simple (mundos 24-27). No es una
regla gramatical nueva -- es memorizacion pura, los verbos irregulares
no siguen el patron '-ed' (go->went, have->had, etc).

Map1 = 4 verbos irregulares (go->went, have->had, see->saw, do->did).
Map2 = 5 verbos irregulares (eat->ate, make->made, take->took,
come->came, get->got).
Map3 = repaso + insight clave: en negativo/pregunta, los irregulares
TAMBIEN vuelven a forma base ('I didn't go', no 'I didn't went'),
exactamente igual que los regulares (mundos 25-26).

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12). El
letrero se excluye explicitamente del sorteo de `forest` (lesson 13).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Cave Garden" (piso de cueva de Mundo 9/21/23 + arbustos/helechos
de Mundo 11/17/22, nunca combinados) para dialogo, "Desert Ruins" (arena
+ decoracion de ruinas de Mundo 7/19/21/22/26, nunca combinados en
combate) para combate.

Uso:
    python mundo27_irregulares_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "irreg_grove_1"),
    ("the_village_2", "irreg_grove_2"),
    ("clock_tower", "irreg_square"),
    ("combate_town_1", "combate_irreg_1"),
    ("combate_town_2", "combate_irreg_2"),
    ("combat_town_boss", "combate_irreg_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "irreg_grove_1": (450, 250,
        "# 🧠 Verbos irregulares (parte 1)\n\n"
        "Estos verbos NO siguen la regla de '-ed' -- hay que memorizarlos.\n\n"
        "🏞️ **I went to the park** (go → went) - fui al parque\n"
        "😊 **You had a good day** (have → had) - tuviste un buen dia\n"
        "🎬 **He saw a movie** (see → saw) - el vio una pelicula\n"
        "📝 **She did her homework** (do → did) - ella hizo su tarea\n\n"
        "💡 No existe 'goed', 'haved', 'seed' ni 'doed'."),
    "irreg_grove_2": (450, 450,
        "# 🧠 Verbos irregulares (parte 2)\n\n"
        "Mas verbos para memorizar.\n\n"
        "🍳 **We ate breakfast** (eat → ate) - desayunamos\n"
        "🎂 **They made a cake** (make → made) - hicieron un pastel\n"
        "📸 **He took a photo** (take → took) - el tomo una foto\n"
        "🏠 **She came home late** (come → came) - ella llego tarde a casa\n"
        "🎁 **I got a present** (get → got) - recibi un regalo\n\n"
        "❗ No existe 'eated', 'maked', 'taked', 'comed' ni 'getted'."),
    "irreg_square": (450, 550,
        "# 🔁 Repaso: verbos irregulares\n\n"
        "Antes del examen, repasa los 9 verbos irregulares.\n\n"
        "👉 went, had, saw, did\n"
        "👉 ate, made, took, came, got\n\n"
        "💬 IMPORTANTE: en negativo/pregunta, vuelven a forma base -- "
        "'I didn't go' (no 'didn't went'), 'Did you go?' (no 'Did you went?')."),
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

    if dst in ("irreg_grove_1", "irreg_grove_2", "irreg_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Cave Garden": piso de cueva (Mundo 9/21/23) + arbustos/
        # helechos (Mundo 11/17/22), nunca combinados antes.
        CAVE_FLOOR = ["sprite57", "sprite58", "sprite61", "sprite62"]
        YARD_DECOR = ["sprite51", "sprite56", "sprite36"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(CAVE_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if sign_pos and (x, y) == sign_pos:
                continue
            if random.random() < 0.14:
                new_forest.append({"x": x, "y": y, "frame": random.choice(YARD_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_irreg_1", "combate_irreg_2", "combate_irreg_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Desert Ruins": arena + decoracion de ruinas (Mundo
        # 7/19/21/22/26), nunca combinados en un mapa de combate antes.
        SAND_FLOOR = ["sprite31", "sprite32", "sprite33", "sprite34"]
        RUIN_DECOR = ["sprite34", "sprite35", "sprite43", "sprite44", "sprite61"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(SAND_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(RUIN_DECOR)} for x, y in old_forest_positions
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
    dict(scene_key="irreg_grove_1", title="Irregulares: went / had / saw / did",
         description_en="Practica los verbos irregulares go/have/see/do en pasado",
         objective_en="Practica went/had/saw/did", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="irreg_grove_2", title="Irregulares: ate / made / took / came / got",
         description_en="Practica los verbos irregulares eat/make/take/come/get en pasado",
         objective_en="Practica ate/made/took/came/got", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="irreg_square", title="Repaso: verbos irregulares",
         description_en="Repasa los 9 verbos irregulares antes del examen",
         objective_en="Repasa los 9 verbos irregulares", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_irreg_1", title="Los ogros invaden las ruinas del desierto",
         description_en="Defiende las ruinas mientras repasas verbos irregulares",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_irreg_2", title="Los ogros atacan las ruinas del desierto",
         description_en="Elimina a los ogros de las ruinas",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_irreg_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas los verbos irregulares derrotando al jefe",
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
    ("irreg_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a memorizar verbos irregulares "
     "en pasado (no siguen la regla de '-ed'). Pregunta 'Are you ready?'. Si el "
     "jugador no sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. "
     "Completa la tarea si responde afirmativamente.",
     "Great! Let's memorize some tricky verbs."),
    ("irreg_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'Went' es el pasado irregular de 'go' -- no sigue la "
                       "regla de agregar '-ed', hay que memorizarlo. 'I went to "
                       "the park' significa que fui al parque.",
               ["I went to the park", "I went to the park yesterday", "Yes, I went to the park"]),
     "Great! Went -- not goed."),
    ("irreg_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'Had' es el pasado irregular de 'have' -- se memoriza, "
                       "no es 'haved'.",
               ["You had a good day", "You had a good day, right?", "Yes, you had a good day"]),
     "Perfect! Had -- not haved."),
    ("irreg_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'Saw' es el pasado irregular de 'see' -- se memoriza, "
                       "no es 'seed'.",
               ["He saw a movie", "He saw a movie yesterday", "Yes, he saw a movie"]),
     "Exactly! Saw -- not seed."),
    ("irreg_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'Did' es el pasado irregular de 'do' -- se memoriza, no "
                       "es 'doed'. (Es el mismo 'did' que usamos para "
                       "preguntar, pero aqui es el verbo principal.)",
               ["She did her homework", "She did her homework yesterday", "Yes, she did her homework"],
               extra="Ademas, para cerrar, pide un repaso de los 4 verbos de "
                     "este mapa (went, had, saw, did)."),
     "Amazing! You know 4 irregular verbs now!"),

    ("irreg_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'Ate' es el pasado irregular de 'eat' -- se memoriza, "
                       "no es 'eated'.",
               ["We ate breakfast", "We ate breakfast this morning", "Yes, we ate breakfast"]),
     "Great! Ate -- not eated."),
    ("irreg_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'Made' es el pasado irregular de 'make' -- se memoriza, "
                       "no es 'maked'.",
               ["They made a cake", "They made a cake yesterday", "Yes, they made a cake"]),
     "Perfect! Made -- not maked."),
    ("irreg_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'Took' es el pasado irregular de 'take' -- se memoriza, "
                       "no es 'taked'.",
               ["He took a photo", "He took a photo yesterday", "Yes, he took a photo"]),
     "Exactly! Took -- not taked."),
    ("irreg_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'Came' es el pasado irregular de 'come' -- se memoriza, "
                       "no es 'comed'.",
               ["She came home late", "She came home late yesterday", "Yes, she came home late"]),
     "Right! Came -- not comed."),
    ("irreg_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "'Got' es el pasado irregular de 'get' -- se memoriza, "
                       "no es 'getted'.",
               ["I got a present", "I got a present yesterday", "Yes, I got a present"],
               extra="Ademas, para cerrar, pide un repaso de los verbos de "
                     "este mapa (ate, made, took, came, got)."),
     "Awesome! 5 more irregular verbs, well done!"),

    ("irreg_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'went' (go) y 'had' "
     "(have) son irregulares -- se memorizan. Dale a elegir: 'I went to the "
     "park', 'You had a good day', 'I went to the park and had a good day'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Es "
     "repaso, no introduzcas verbos nuevos.",
     "Great! Went and had, still solid."),
    ("irreg_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'saw' (see) y 'did' (do) son "
     "irregulares -- se memorizan. Dale a elegir: 'He saw a movie', 'She did "
     "her homework', 'He saw a movie and she did her homework'. Completa la "
     "tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "verbos nuevos.",
     "Exactly! Saw and did, well done."),
    ("irreg_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'ate' (eat) y 'made' (make) son "
     "irregulares -- se memorizan. Dale a elegir: 'We ate breakfast', 'They "
     "made a cake', 'We ate breakfast and they made a cake'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin verbos "
     "nuevos.",
     "Perfect! Ate and made, solid."),
    ("irreg_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'took' (take), 'came' (come) y 'got' "
     "(get) son irregulares -- se memorizan. Dale a elegir: 'He took a photo', "
     "'She came home late', 'I got a present'. Completa la tarea cuando el "
     "jugador diga correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Great! Took, came, and got, got it."),
    ("irreg_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. IMPORTANTE: en negativo y pregunta, los verbos "
     "irregulares TAMBIEN vuelven a su forma base, igual que los regulares -- "
     "'I didn't go' (no 'I didn't went'), 'Did you go?' (no 'Did you went?'). "
     "Este es el repaso final antes del examen. Pide al jugador que diga al "
     "menos 3 frases usando cualquiera de los 9 verbos irregulares vistos (go, "
     "have, see, do, eat, make, take, come, get) en pasado. Completa la tarea "
     "cuando lo haga.",
     "Amazing! You know the irregular verbs now!"),
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
    ("irreg_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("irreg_grove_1", "Mochi"), None, 0),
    ("irreg_grove_1", 2, "Aprende 'went' con Joy", "talk_to_npc", ("irreg_grove_1", "Joy"), None, 0),
    ("irreg_grove_1", 3, "Aprende 'had' con Ann", "talk_to_npc", ("irreg_grove_1", "Ann"), None, 0),
    ("irreg_grove_1", 4, "Aprende 'saw' con Sam", "talk_to_npc", ("irreg_grove_1", "Sam"), None, 0),
    ("irreg_grove_1", 5, "Aprende 'did' con Amy", "talk_to_npc", ("irreg_grove_1", "Amy"), None, 0),

    ("irreg_grove_2", 1, "Aprende 'ate' con Joy", "talk_to_npc", ("irreg_grove_2", "Joy"), None, 0),
    ("irreg_grove_2", 2, "Aprende 'made' con Ann", "talk_to_npc", ("irreg_grove_2", "Ann"), None, 0),
    ("irreg_grove_2", 3, "Aprende 'took' con Sam", "talk_to_npc", ("irreg_grove_2", "Sam"), None, 0),
    ("irreg_grove_2", 4, "Aprende 'came' con Zoe", "talk_to_npc", ("irreg_grove_2", "Zoe"), None, 0),
    ("irreg_grove_2", 5, "Aprende 'got' con Tom", "talk_to_npc", ("irreg_grove_2", "Tom"), None, 0),

    ("irreg_square", 1, "Repasa went/had con Toro", "talk_to_npc", ("irreg_square", "Toro"), None, 0),
    ("irreg_square", 2, "Repasa saw/did con Sam", "talk_to_npc", ("irreg_square", "Sam"), None, 0),
    ("irreg_square", 3, "Repasa ate/made con Joy", "talk_to_npc", ("irreg_square", "Joy"), None, 0),
    ("irreg_square", 4, "Repasa took/came/got con Ann", "talk_to_npc", ("irreg_square", "Ann"), None, 0),
    ("irreg_square", 5, "Repaso final con Tom", "talk_to_npc", ("irreg_square", "Tom"), None, 0),

    ("combate_irreg_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_irreg_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_irreg_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_irreg_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_irreg_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 27 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
