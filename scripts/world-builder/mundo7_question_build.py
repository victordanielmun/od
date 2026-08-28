"""
Mundo 7: "Eres...? / Es...?" (Are you...? Yes, I am. / Is he/she...? Yes,
he is. / No, he isn't.) -- Etapas 1-4. Cierra el bloque "to be" (mundos
3-7). Map1 = preguntas con 'you'. Map2 = preguntas con 'he/she'. Map3 =
repaso mezclando pregunta+respuesta con los 4 sujetos.

Mismo patron de NPC: saludo limpio + AL MENOS 3 repeticiones resueltas.

Uso:
    python mundo7_question_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "areyou_village"),
    ("the_village_2", "ishe_village"),
    ("clock_tower", "question_square"),
    ("combate_town_1", "combate_question_1"),
    ("combate_town_2", "combate_question_2"),
    ("combat_town_boss", "combate_question_boss"),
]

SIGNS = {
    "areyou_village": (450, 250,
        "# ❓ Eres...? Are you a/an ___?\n\n"
        "Para preguntar con 'you', invierte 'you' y 'are'.\n\n"
        "👨‍🌾 **Are you a farmer? Yes, I am.**\n"
        "👩‍🏫 **Are you a teacher? No, I'm not.**\n"
        "🎓 **Are you a student? Yes, I am.**\n\n"
        "💡 Respuesta corta: 'Yes, I am' o 'No, I'm not' (nunca 'Yes, I'm')."),
    "ishe_village": (450, 450,
        "# ❓ Es...? Is he/she a/an ___?\n\n"
        "Con 'he' y 'she' se invierte 'is'.\n\n"
        "👦 **Is he a chef? Yes, he is.**\n"
        "👧 **Is she a nurse? No, she isn't.**\n"
        "👦 **Is he an artist? Yes, he is.**\n\n"
        "❗ Respuesta corta: 'Yes, he is' / 'No, he isn't' (nunca 'Yes, he's')."),
    "question_square": (450, 250,
        "# 🔁 Repaso: preguntas y respuestas cortas\n\n"
        "Antes del examen, repasa los 4 sujetos.\n\n"
        "❓ **Are you...?** → Yes, I am. / No, I'm not.\n"
        "❓ **Is he...?** → Yes, he is. / No, he isn't.\n"
        "❓ **Is she...?** → Yes, she is. / No, she isn't.\n\n"
        "💬 Practica pregunta + respuesta corta con cualquier profesion."),
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

    if dst in ("areyou_village", "ishe_village", "question_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "oasis de arena": piso de arena + palmeras.
        SAND_FLOOR = ["sprite33", "sprite34", "sprite35", "sprite36"]
        PALM_TREES = ["sprite5", "sprite59", "sprite60", "sprite62"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(SAND_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.16:
                new_forest.append({"x": x, "y": y, "frame": random.choice(PALM_TREES)})
        wallsData["forest"] = new_forest

    if dst in ("combate_question_1", "combate_question_2", "combate_question_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "ruinas cubiertas de musgo": pasto + hongos/vides.
        GRASS = ["sprite1", "sprite2", "sprite3"]
        RUIN_DECOR = ["sprite34", "sprite35", "sprite43", "sprite44", "sprite61"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(GRASS)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(RUIN_DECOR)} for x, y in old_forest_positions
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
    dict(scene_key="areyou_village", title="Eres...? (Are you)",
         description_en="Practica 'Are you a/an ___?' y respuesta corta",
         objective_en="Practica Are you a farmer? Yes, I am.", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="ishe_village", title="Es...? (Is he / Is she)",
         description_en="Practica 'Is he/she a/an ___?' y respuesta corta",
         objective_en="Practica Is he/she a chef? Yes, he is.", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="question_square", title="Repaso: preguntas y respuestas cortas",
         description_en="Repasa pregunta + respuesta corta antes del examen",
         objective_en="Repasa Are you/Is he/Is she con respuesta corta", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_question_1", title="Los ogros invaden las ruinas",
         description_en="Defiende las ruinas mientras repasas preguntas",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_question_2", title="Los ogros atacan a Ben",
         description_en="Salva a Ben, elimina a los ogros",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_question_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas preguntas y respuestas derrotando al jefe",
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
def npc_instr(name, question, profession_en, examples, extra=""):
    ex = "', '".join(examples)
    return (f"Eres {name}, hablas ingles. Ensena la pregunta '{question} {profession_en}?' "
            f"y su respuesta corta. Dale al jugador estas frases para repetir: '{ex}'. "
            f"Completa la tarea cuando el jugador diga correctamente AL MENOS 3 de "
            f"estas frases (repetir la misma frase varias veces tambien cuenta). {extra}")

npcs = [
    ("areyou_village", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a practicar preguntas 'Are "
     "you...?' y respuestas cortas. Pregunta 'Are you ready?'. Si el jugador no "
     "sabe que responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la "
     "tarea si responde afirmativamente.",
     "Great! Let's ask some questions."),
    ("areyou_village", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "Are you a", "farmer",
               ["Are you a farmer?", "Yes, I am", "No, I'm not"]),
     "Great! Are you a farmer? Yes, I am."),
    ("areyou_village", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "Are you a", "teacher",
               ["Are you a teacher?", "Yes, I am", "No, I'm not"]),
     "Perfect! Question and short answer."),
    ("areyou_village", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "Are you a", "doctor",
               ["Are you a doctor?", "Yes, I am", "No, I'm not"]),
     "Exactly! Are you a doctor?"),
    ("areyou_village", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "Are you a", "student",
               ["Are you a student?", "Yes, I am", "No, I'm not"],
               extra="Ademas, para cerrar, pide un repaso de 'Are you a ___?' con las "
                     "4 profesiones de este mapa (farmer, teacher, doctor, student)."),
     "Amazing! You can ask and answer now!"),

    ("ishe_village", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "Is he a", "chef",
               ["Is he a chef?", "Yes, he is", "No, he isn't"]),
     "Great! Is he a chef? Yes, he is."),
    ("ishe_village", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "Is she a", "nurse",
               ["Is she a nurse?", "Yes, she is", "No, she isn't"]),
     "Perfect! Is she a nurse?"),
    ("ishe_village", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "Is he a", "driver",
               ["Is he a driver?", "Yes, he is", "No, he isn't"]),
     "Exactly! Is he a driver?"),
    ("ishe_village", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "Is she an", "artist",
               ["Is she an artist?", "Yes, she is", "No, she isn't"]),
     "Right! Is she an artist?"),
    ("ishe_village", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "Is he a", "police officer",
               ["Is he a police officer?", "Yes, he is", "No, he isn't"],
               extra="Ademas, para cerrar, pide un repaso de 'Is he/she a ___?' con las "
                     "5 profesiones de este mapa (chef, nurse, driver, artist, police officer)."),
     "Awesome! Questions and short answers, solid!"),

    ("question_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Repasa 'Are you a farmer?' con "
     "respuesta corta. Dale a elegir: 'Are you a farmer?', 'Yes, I am', "
     "'No, I'm not'. Completa la tarea cuando el jugador diga correctamente al "
     "menos 3. Es repaso, no introduzcas profesiones nuevas.",
     "Great! Are you...? still works."),
    ("question_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Repasa 'Is he a doctor?' con respuesta corta. Dale "
     "a elegir: 'Is he a doctor?', 'Yes, he is', 'No, he isn't'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3.",
     "Exactly! Is he...? solid."),
    ("question_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Repasa 'Is she a teacher?' con respuesta corta. "
     "Dale a elegir: 'Is she a teacher?', 'Yes, she is', 'No, she isn't'. Completa "
     "la tarea cuando el jugador diga correctamente al menos 3.",
     "Perfect! Is she...? you got it."),
    ("question_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Repaso libre: pide al jugador que combine cualquier "
     "sujeto (you/he/she) en pregunta + respuesta corta, con ejemplos como 'Are "
     "you a nurse?', 'Yes, I am'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3 frases distintas.",
     "Great! Mixing questions, well done."),
    ("question_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide al "
     "jugador que haga al menos 3 preguntas con respuesta corta usando Are you/Is "
     "he/Is she, con cualquier profesion vista. Completa la tarea cuando lo haga.",
     "Amazing! You can ask and answer everything now!"),
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
    ("areyou_village", 1, "Habla con Mochi", "talk_to_npc", ("areyou_village", "Mochi"), None, 0),
    ("areyou_village", 2, "Aprende 'Are you a farmer?' con Joy", "talk_to_npc", ("areyou_village", "Joy"), None, 0),
    ("areyou_village", 3, "Aprende 'Are you a teacher?' con Ann", "talk_to_npc", ("areyou_village", "Ann"), None, 0),
    ("areyou_village", 4, "Aprende 'Are you a doctor?' con Sam", "talk_to_npc", ("areyou_village", "Sam"), None, 0),
    ("areyou_village", 5, "Aprende 'Are you a student?' con Amy", "talk_to_npc", ("areyou_village", "Amy"), None, 0),

    ("ishe_village", 1, "Aprende 'Is he a chef?' con Joy", "talk_to_npc", ("ishe_village", "Joy"), None, 0),
    ("ishe_village", 2, "Aprende 'Is she a nurse?' con Ann", "talk_to_npc", ("ishe_village", "Ann"), None, 0),
    ("ishe_village", 3, "Aprende 'Is he a driver?' con Sam", "talk_to_npc", ("ishe_village", "Sam"), None, 0),
    ("ishe_village", 4, "Aprende 'Is she an artist?' con Zoe", "talk_to_npc", ("ishe_village", "Zoe"), None, 0),
    ("ishe_village", 5, "Aprende 'Is he a police officer?' con Tom", "talk_to_npc", ("ishe_village", "Tom"), None, 0),

    ("question_square", 1, "Repasa 'Are you...?' con Toro", "talk_to_npc", ("question_square", "Toro"), None, 0),
    ("question_square", 2, "Repasa 'Is he...?' con Sam", "talk_to_npc", ("question_square", "Sam"), None, 0),
    ("question_square", 3, "Repasa 'Is she...?' con Joy", "talk_to_npc", ("question_square", "Joy"), None, 0),
    ("question_square", 4, "Repaso libre con Ann", "talk_to_npc", ("question_square", "Ann"), None, 0),
    ("question_square", 5, "Repaso final con Tom", "talk_to_npc", ("question_square", "Tom"), None, 0),

    ("combate_question_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_question_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_question_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_question_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_question_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 7 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
