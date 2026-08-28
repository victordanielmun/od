"""
Mundo 4: "Tu eres / El es / Ella es..." (You are / He is / She is a/an ___)
-- Etapas 1-4. Reusa las profesiones de Mundo 3 a proposito (el vocabulario
ya se conoce; lo nuevo es SOLO la conjugacion you are/he is/she is), para
no cargar dos cosas nuevas a la vez.

Map1 = "You are..." (un solo sujeto). Map2 = "He is / She is..." (dos
sujetos). Map3 = repaso contrastando I am/you are/he is/she is juntos.

Mismo patron de NPC que Mundo 3: saludo limpio + AL MENOS 3 repeticiones
resueltas por el jugador.

Uso:
    python mundo4_youhehe_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "you_are_village"),
    ("the_village_2", "he_she_village"),
    ("clock_tower", "subject_be_square"),
    ("combate_town_1", "combate_subject_1"),
    ("combate_town_2", "combate_subject_2"),
    ("combat_town_boss", "combate_subject_boss"),
]

SIGNS = {
    "you_are_village": (450, 250,
        "# 🫵 Tu eres... You are a/an ___\n\n"
        "Ahora practicamos 'you are' (tu eres) con las mismas profesiones.\n\n"
        "👨‍🌾 **You are a farmer** - tu eres granjero\n"
        "👩‍🏫 **You are a teacher** - tu eres maestro/a\n"
        "👨‍⚕️ **You are a doctor** - tu eres doctor\n"
        "🎓 **You are a student** - tu eres estudiante\n\n"
        "💡 'You are' se usa siempre, sin importar si es una persona o varias."),
    "he_she_village": (450, 450,
        "# 👫 El es / Ella es... He is / She is\n\n"
        "Con 'he' (el) y 'she' (ella) se usa **is**, igual que con 'it'.\n\n"
        "👨‍🍳 **He is a chef** - el es cocinero\n"
        "👩‍⚕️ **She is a nurse** - ella es enfermera\n"
        "🚗 **He is a driver** - el es conductor\n"
        "🎨 **She is an artist** - ella es artista\n"
        "👮 **He is a police officer** - el es policia\n\n"
        "❗ He/She/It siempre van con 'is', nunca 'are'."),
    "subject_be_square": (450, 250,
        "# 🔁 Repaso: I am / You are / He is / She is\n\n"
        "Antes del examen, repasa los 4 juntos.\n\n"
        "🙋 **I am** - yo soy\n"
        "🫵 **You are** - tu eres\n"
        "👦 **He is** - el es\n"
        "👧 **She is** - ella es\n\n"
        "💬 Practica: la misma profesion con cada sujeto, por ejemplo "
        "'I am a teacher, you are a teacher, he is a teacher'."),
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
    # Limpiar cualquier mueble heredado del mapa fuente ANTES de agregar el
    # nuevo (lección de Mundo 3 -- ver README.md punto 8).
    wallsData["furniture"] = []
    wallsData["furniture2"] = []
    wallsData["furniture3"] = []

    if dst in ("you_are_village", "he_she_village", "subject_be_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "cantera rocosa": tierra + rocas, distinto del huerto (Mundo 3)
        # y del pino/meadow/plaza (Mundo 2).
        DIRT = ["sprite25", "sprite26", "sprite27", "sprite28"]
        ROCKY = ["sprite63", "sprite65"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(["sprite1", "sprite2", "sprite3"] + DIRT[:1])
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.18:
                new_forest.append({"x": x, "y": y, "frame": random.choice(ROCKY)})
        wallsData["forest"] = new_forest

    if dst in ("combate_subject_1", "combate_subject_2", "combate_subject_boss"):
        random.seed(hash(dst) & 0xffff)
        DIRT = ["sprite25", "sprite26", "sprite27", "sprite28", "sprite29", "sprite30"]
        ROCKY = ["sprite63", "sprite65"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(DIRT)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(ROCKY)} for x, y in old_forest_positions
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
    dict(scene_key="you_are_village", title="Tu eres... (You are)",
         description_en="Practica 'you are a/an' con profesiones",
         objective_en="Practica You are a farmer/teacher/doctor/student", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="he_she_village", title="El es / Ella es (He is / She is)",
         description_en="Practica 'he is' y 'she is' con profesiones",
         objective_en="Practica He is / She is a/an", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="subject_be_square", title="Repaso: I am / You are / He is / She is",
         description_en="Repasa los 4 sujetos antes del examen",
         objective_en="Repasa I am/You are/He is/She is", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_subject_1", title="Los ogros invaden la cantera",
         description_en="Defiende la cantera mientras repasas you are/he is/she is",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_subject_2", title="Los ogros atacan a Ben",
         description_en="Salva a Ben, elimina a los ogros",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_subject_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas you are/he is/she is derrotando al jefe",
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
def npc_instr(name, subject_form, profession_en, profession_es, examples, extra=""):
    ex = "', '".join(examples)
    return (f"Eres {name}, hablas ingles. Ensena '{subject_form} {profession_en}' "
            f"({profession_es}). Dale al jugador estas frases para repetir: '{ex}'. "
            f"Completa la tarea cuando el jugador diga correctamente AL MENOS 3 de "
            f"estas frases (repetir la misma frase varias veces tambien cuenta). {extra}")

npcs = [
    ("you_are_village", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a practicar 'you are a/an ___'. "
     "Pregunta 'Are you ready?'. Si el jugador no sabe que responder, sugierele "
     "'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea si responde afirmativamente.",
     "Great! Let's practice 'you are'."),
    ("you_are_village", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "You are a", "farmer", "granjero",
               ["You are a farmer", "You are a farmer, right?", "Yes, you are a farmer"]),
     "Great! You are a farmer."),
    ("you_are_village", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "You are a", "teacher", "maestro/a",
               ["You are a teacher", "You are a teacher, right?", "Yes, you are a teacher"]),
     "Perfect! You are a teacher."),
    ("you_are_village", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "You are a", "doctor", "doctor",
               ["You are a doctor", "You are a doctor, right?", "Yes, you are a doctor"]),
     "Exactly! You are a doctor."),
    ("you_are_village", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "You are a", "student", "estudiante",
               ["You are a student", "You are a student, right?", "Yes, you are a student"],
               extra="Ademas, para cerrar, pide un repaso de las 4 profesiones con "
                     "'you are a ___' (farmer, teacher, doctor, student)."),
     "Amazing! You are all of these!"),

    ("he_she_village", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "He is a", "chef", "cocinero",
               ["He is a chef", "He is a chef, right?", "Yes, he is a chef"]),
     "Great! He is a chef."),
    ("he_she_village", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "She is a", "nurse", "enfermera",
               ["She is a nurse", "She is a nurse, right?", "Yes, she is a nurse"]),
     "Perfect! She is a nurse."),
    ("he_she_village", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "He is a", "driver", "conductor",
               ["He is a driver", "He is a driver, right?", "Yes, he is a driver"]),
     "Exactly! He is a driver."),
    ("he_she_village", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "She is an", "artist", "artista",
               ["She is an artist", "She is an artist, right?", "Yes, she is an artist"],
               extra="Aclara que 'she' e 'it' tambien usan 'is', igual que 'he'."),
     "Right! She is an artist -- 'is', not 'are'."),
    ("he_she_village", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "He is a", "police officer", "policia",
               ["He is a police officer", "He is a police officer, right?", "Yes, he is a police officer"],
               extra="Ademas, para cerrar, pide un repaso de he is/she is con las 5 "
                     "profesiones de este mapa (chef, nurse, driver, artist, police officer)."),
     "Awesome! He is / She is, solid now!"),

    ("subject_be_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Repasa contrastando 'I am a farmer' con "
     "'You are a farmer' (misma profesion, sujeto distinto). Dale a elegir: "
     "'I am a farmer', 'You are a farmer', 'I am a farmer and you are a farmer too'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3.",
     "Great! I am / you are, same profession."),
    ("subject_be_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Repasa contrastando 'He is a doctor' con 'She is a "
     "nurse' (sujetos distintos, ambos con 'is'). Dale a elegir: 'He is a doctor', "
     "'She is a nurse', 'He is a doctor and she is a nurse'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3.",
     "Exactly! He and she both use 'is'."),
    ("subject_be_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Repasa contrastando 'You are a teacher' con 'He is a "
     "teacher' (misma profesion, para notar el cambio de verbo). Dale a elegir: "
     "'You are a teacher', 'He is a teacher', 'You are a teacher and he is a "
     "teacher too'. Completa la tarea cuando el jugador diga correctamente al "
     "menos 3.",
     "Perfect! Are vs is, you got it."),
    ("subject_be_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Repaso libre: pide al jugador que combine cualquier "
     "sujeto (I/you/he/she) con cualquier profesion vista, dandole ejemplos como "
     "'I am a chef', 'You are a nurse', 'She is a driver'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3 frases distintas.",
     "Great! Mixing subjects, well done."),
    ("subject_be_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide al "
     "jugador que diga al menos 3 frases usando I am/You are/He is/She is, cada "
     "una con una profesion distinta de las vistas. Completa la tarea cuando lo haga.",
     "Amazing! I am, you are, he is, she is -- you know them all!"),
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
    ("you_are_village", 1, "Habla con Mochi", "talk_to_npc", ("you_are_village", "Mochi"), None, 0),
    ("you_are_village", 2, "Aprende 'You are a farmer' con Joy", "talk_to_npc", ("you_are_village", "Joy"), None, 0),
    ("you_are_village", 3, "Aprende 'You are a teacher' con Ann", "talk_to_npc", ("you_are_village", "Ann"), None, 0),
    ("you_are_village", 4, "Aprende 'You are a doctor' con Sam", "talk_to_npc", ("you_are_village", "Sam"), None, 0),
    ("you_are_village", 5, "Aprende 'You are a student' con Amy", "talk_to_npc", ("you_are_village", "Amy"), None, 0),

    ("he_she_village", 1, "Aprende 'He is a chef' con Joy", "talk_to_npc", ("he_she_village", "Joy"), None, 0),
    ("he_she_village", 2, "Aprende 'She is a nurse' con Ann", "talk_to_npc", ("he_she_village", "Ann"), None, 0),
    ("he_she_village", 3, "Aprende 'He is a driver' con Sam", "talk_to_npc", ("he_she_village", "Sam"), None, 0),
    ("he_she_village", 4, "Aprende 'She is an artist' con Zoe", "talk_to_npc", ("he_she_village", "Zoe"), None, 0),
    ("he_she_village", 5, "Aprende 'He is a police officer' con Tom", "talk_to_npc", ("he_she_village", "Tom"), None, 0),

    ("subject_be_square", 1, "Repasa I am/You are con Toro", "talk_to_npc", ("subject_be_square", "Toro"), None, 0),
    ("subject_be_square", 2, "Repasa He is/She is con Sam", "talk_to_npc", ("subject_be_square", "Sam"), None, 0),
    ("subject_be_square", 3, "Repasa You are/He is con Joy", "talk_to_npc", ("subject_be_square", "Joy"), None, 0),
    ("subject_be_square", 4, "Repaso libre con Ann", "talk_to_npc", ("subject_be_square", "Ann"), None, 0),
    ("subject_be_square", 5, "Repaso final con Tom", "talk_to_npc", ("subject_be_square", "Tom"), None, 0),

    ("combate_subject_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_subject_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_subject_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_subject_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_subject_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 4 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
