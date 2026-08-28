"""
Mundo 19: El Cuerpo -- Etapas 1-4. Sexto mundo del Bloque B
(vocabulario). Introduce el verbo 'have/has' por primera vez (primer
contacto con un verbo lexico nuevo desde presente simple, mundos 10-12)
-- 'has' es una excepcion irregular que se explica explicitamente, no
'haves'.

Map1 = 4 partes del cuerpo que tienes solo una, reusando 'This is my
___' (Mundo 8) SIN gramatica nueva: head, nose, mouth, stomach.
Map2 = 5 partes del cuerpo en par/plural, introduciendo 'have' (I/you/
we/they) y 'has' (he/she, excepcion): eyes, hands, legs, arms, ears.
Map3 = repaso mezclando ambos patrones.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README). El letrero del mapa "_square" va en (450, 550),
NUNCA en (450, 250) -- ahi esta la torre de clock_tower (lesson 12).

Terreno: combinaciones piso+decoracion nunca usadas juntas antes (lesson
9.5): "Grassy Ruins" (pasto + decoracion de ruinas de Mundo 7, antes solo
usada en combate) para dialogo, "Sandy Thicket" (arena de Mundo 16 +
arbustos de Mundo 10/15, nunca combinados) para combate.

Uso:
    python mundo19_cuerpo_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "body_grove_1"),
    ("the_village_2", "body_grove_2"),
    ("clock_tower", "body_square"),
    ("combate_town_1", "combate_body_1"),
    ("combate_town_2", "combate_body_2"),
    ("combat_town_boss", "combate_body_boss"),
]

# El letrero del mapa "_square" NUNCA va en (450,250) -- ahi esta la
# torre de clock_tower (area visual x:[282,618] y:[-51,351]). Usar
# (450,550), la posicion del letrero original (lesson 12 del README).
SIGNS = {
    "body_grove_1": (450, 250,
        "# 🧍 El cuerpo: partes unicas\n\n"
        "Usamos 'This is my ___' (ya conocido) para partes del cuerpo que tienes solo una.\n\n"
        "🗣️ **This is my head** - esta es mi cabeza\n"
        "👃 **This is my nose** - esta es mi nariz\n"
        "👄 **This is my mouth** - esta es mi boca\n"
        "🫃 **This is my stomach** - este es mi estomago\n\n"
        "💡 Sin gramatica nueva, solo vocabulario."),
    "body_grove_2": (450, 450,
        "# 👀 El cuerpo: partes dobles + have/has\n\n"
        "Introducimos el verbo **have** (tener) para partes que tienes dos o mas.\n\n"
        "👀 **I have two eyes** - yo tengo dos ojos\n"
        "✋ **You have two hands** - tu tienes dos manos\n"
        "🦵 **We have two legs** - nosotros tenemos dos piernas\n"
        "💪 **They have two arms** - ellos tienen dos brazos\n"
        "👂 **He has two ears / She has two ears**\n\n"
        "❗ Con he/she, 'have' cambia a 'has' -- NUNCA 'haves'."),
    "body_square": (450, 550,
        "# 🔁 Repaso: this is my ___ / have / has\n\n"
        "Antes del examen, repasa todo junto.\n\n"
        "👉 This is my head/nose/mouth/stomach\n"
        "👉 I/You/We/They have two eyes/hands/legs/arms\n"
        "👉 He/She has two ears\n\n"
        "💬 Recuerda: 'has', no 'haves', con he/she/it."),
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

    if dst in ("body_grove_1", "body_grove_2", "body_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Grassy Ruins": pasto + decoracion de ruinas (Mundo 7),
        # antes solo usada en mapas de combate, nunca en dialogo.
        GRASS_FLOOR = ["sprite1", "sprite2", "sprite3"]
        RUIN_DECOR = ["sprite34", "sprite35", "sprite43", "sprite44", "sprite61"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(GRASS_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.16:
                new_forest.append({"x": x, "y": y, "frame": random.choice(RUIN_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_body_1", "combate_body_2", "combate_body_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "Sandy Thicket": arena (Mundo 16) + arbustos (Mundo
        # 10/15), nunca combinados antes.
        SAND_FLOOR = ["sprite31", "sprite32", "sprite33", "sprite34"]
        BUSH = ["sprite39", "sprite40", "sprite48"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(SAND_FLOOR)
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
    dict(scene_key="body_grove_1", title="Cuerpo: head / nose / mouth / stomach",
         description_en="Practica head/nose/mouth/stomach con This is my ___",
         objective_en="Practica This is my ___", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="body_grove_2", title="Cuerpo: eyes / hands / legs / arms / ears (have/has)",
         description_en="Practica have/has con eyes/hands/legs/arms/ears",
         objective_en="Practica I/you/we/they have ___ / He-She has ___", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="body_square", title="Repaso: this is my ___ / have / has",
         description_en="Repasa todo antes del examen",
         objective_en="Repasa las 9 partes del cuerpo", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_body_1", title="Los ogros invaden el matorral arenoso",
         description_en="Defiende el matorral mientras repasas el cuerpo",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_body_2", title="Los ogros atacan el matorral arenoso",
         description_en="Elimina a los ogros del matorral",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_body_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas el cuerpo derrotando al jefe",
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
    ("body_grove_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a aprender partes del cuerpo con "
     "'This is my ___' y el verbo nuevo 'have/has'. Pregunta 'Are you ready?'. Si el "
     "jugador no sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. "
     "Completa la tarea si responde afirmativamente.",
     "Great! Let's learn about the body."),
    ("body_grove_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "'This is my head' reusa el patron ya conocido (this is + "
                       "posesivo + sustantivo) para hablar de partes del cuerpo "
                       "que tienes solo una.",
               ["This is my head", "This is my head, right?", "Yes, this is my head"]),
     "Great! Head -- you have one."),
    ("body_grove_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "'This is my nose' -- mismo patron, otra parte del cuerpo "
                       "que tienes solo una.",
               ["This is my nose", "This is my nose, right?", "Yes, this is my nose"]),
     "Perfect! Nose -- you have one."),
    ("body_grove_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "'This is my mouth' -- mismo patron.",
               ["This is my mouth", "This is my mouth, right?", "Yes, this is my mouth"]),
     "Exactly! Mouth -- you have one."),
    ("body_grove_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "'This is my stomach' -- mismo patron.",
               ["This is my stomach", "This is my stomach, right?", "Yes, this is my stomach"],
               extra="Ademas, para cerrar, pide un repaso de las 4 partes de este "
                     "mapa (head, nose, mouth, stomach) con 'This is my ___'."),
     "Amazing! You know 4 body parts now!"),

    ("body_grove_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "'I have two eyes' introduce el verbo 'have' (tener). Con "
                       "'I', 'you', 'we' y 'they' se usa 'have' sin cambios, igual "
                       "que otros verbos en presente simple.",
               ["I have two eyes", "I have two eyes, right?", "Yes, I have two eyes"]),
     "Great! I have -- two eyes."),
    ("body_grove_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "'You have two hands' -- mismo patron con 'you', usa "
                       "'have' sin cambios.",
               ["You have two hands", "You have two hands, right?", "Yes, you have two hands"]),
     "Perfect! You have -- two hands."),
    ("body_grove_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "'We have two legs' -- mismo patron con 'we', usa 'have' "
                       "sin cambios.",
               ["We have two legs", "We have two legs, right?", "Yes, we have two legs"]),
     "Exactly! We have -- two legs."),
    ("body_grove_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "'They have two arms' -- mismo patron con 'they', usa "
                       "'have' sin cambios.",
               ["They have two arms", "They have two arms, right?", "Yes, they have two arms"]),
     "Right! They have -- two arms."),
    ("body_grove_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "Con 'he' y 'she', el verbo 'have' cambia a 'has' -- una "
                       "excepcion irregular, NUNCA se dice 'haves'. 'He has two "
                       "ears' / 'She has two ears'.",
               ["He has two ears", "She has two ears", "He has two ears, and she has two ears too"],
               extra="Ademas, para cerrar, pide un repaso de have/has con "
                     "cualquiera de las 5 partes de este mapa (eyes, hands, legs, "
                     "arms, ears), remarcando que con he/she siempre es 'has'."),
     "Awesome! Has, not haves -- you got it!"),

    ("body_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: 'This is my head' y 'This is "
     "my nose' -- partes del cuerpo que tienes solo una. Dale a elegir: 'This is my "
     "head', 'This is my nose', 'This is my head and my nose'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Es repaso, no introduzcas "
     "partes nuevas.",
     "Great! Head and nose, still solid."),
    ("body_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: 'This is my mouth' y 'This is my "
     "stomach'. Dale a elegir: 'This is my mouth', 'This is my stomach', 'This is "
     "my mouth and my stomach'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Repaso, sin partes nuevas.",
     "Exactly! Mouth and stomach, well done."),
    ("body_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'I have two eyes' y 'You have two hands' "
     "-- 'have' con I/you, sin cambios. Dale a elegir: 'I have two eyes', 'You have "
     "two hands', 'I have two eyes and you have two hands'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin partes nuevas.",
     "Perfect! I have and you have, solid."),
    ("body_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'We have two legs', 'They have two arms', "
     "pero 'He has two ears' / 'She has two ears' -- 'has', no 'haves', con "
     "he/she. Dale a elegir: 'We have two legs', 'They have two arms', 'He has two "
     "ears'. Completa la tarea cuando el jugador diga correctamente al menos 3. "
     "Repaso, sin partes nuevas.",
     "Great! We have, they have, he/she has -- got it."),
    ("body_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: 'have' con I/you/we/they, 'has' con "
     "he/she/it (excepcion, nunca 'haves'). Este es el repaso final antes del "
     "examen. Pide al jugador que diga al menos 3 frases mezclando 'This is my "
     "___' y 'have/has' con cualquiera de las 9 partes del cuerpo vistas (head, "
     "nose, mouth, stomach, eyes, hands, legs, arms, ears). Completa la tarea "
     "cuando lo haga.",
     "Amazing! You know the whole body now!"),
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
    ("body_grove_1", 1, "Habla con Mochi", "talk_to_npc", ("body_grove_1", "Mochi"), None, 0),
    ("body_grove_1", 2, "Aprende 'head' con Joy", "talk_to_npc", ("body_grove_1", "Joy"), None, 0),
    ("body_grove_1", 3, "Aprende 'nose' con Ann", "talk_to_npc", ("body_grove_1", "Ann"), None, 0),
    ("body_grove_1", 4, "Aprende 'mouth' con Sam", "talk_to_npc", ("body_grove_1", "Sam"), None, 0),
    ("body_grove_1", 5, "Aprende 'stomach' con Amy", "talk_to_npc", ("body_grove_1", "Amy"), None, 0),

    ("body_grove_2", 1, "Aprende 'I have eyes' con Joy", "talk_to_npc", ("body_grove_2", "Joy"), None, 0),
    ("body_grove_2", 2, "Aprende 'You have hands' con Ann", "talk_to_npc", ("body_grove_2", "Ann"), None, 0),
    ("body_grove_2", 3, "Aprende 'We have legs' con Sam", "talk_to_npc", ("body_grove_2", "Sam"), None, 0),
    ("body_grove_2", 4, "Aprende 'They have arms' con Zoe", "talk_to_npc", ("body_grove_2", "Zoe"), None, 0),
    ("body_grove_2", 5, "Aprende 'He/She has ears' con Tom", "talk_to_npc", ("body_grove_2", "Tom"), None, 0),

    ("body_square", 1, "Repasa head/nose con Toro", "talk_to_npc", ("body_square", "Toro"), None, 0),
    ("body_square", 2, "Repasa mouth/stomach con Sam", "talk_to_npc", ("body_square", "Sam"), None, 0),
    ("body_square", 3, "Repasa I/you have con Joy", "talk_to_npc", ("body_square", "Joy"), None, 0),
    ("body_square", 4, "Repasa we/they have, he/she has con Ann", "talk_to_npc", ("body_square", "Ann"), None, 0),
    ("body_square", 5, "Repaso final con Tom", "talk_to_npc", ("body_square", "Tom"), None, 0),

    ("combate_body_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_body_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_body_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_body_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_body_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 19 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
