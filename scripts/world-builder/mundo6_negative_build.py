"""
Mundo 6: "No soy / No es..." (I'm not / You aren't / He/She isn't a/an ___)
-- Etapas 1-4. Forma negativa de to be, sobre profesiones ya conocidas
(Mundo 3/4). Map1 = "I'm not". Map2 = "You aren't / He isn't / She isn't".
Map3 = repaso contrastando afirmativo vs negativo.

Mismo patron de NPC: saludo limpio + AL MENOS 3 repeticiones resueltas.

Uso:
    python mundo6_negative_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "notme_village"),
    ("the_village_2", "notyou_village"),
    ("clock_tower", "negative_square"),
    ("combate_town_1", "combate_negative_1"),
    ("combate_town_2", "combate_negative_2"),
    ("combat_town_boss", "combate_negative_boss"),
]

SIGNS = {
    "notme_village": (450, 250,
        "# 🚫 No soy... I'm not a/an ___\n\n"
        "Para negar 'to be' se agrega 'not'.\n\n"
        "👨‍🌾 **I'm not a farmer** - no soy granjero\n"
        "👩‍🏫 **I'm not a teacher** - no soy maestro/a\n"
        "👨‍⚕️ **I'm not a doctor** - no soy doctor\n"
        "🎓 **I'm not a student** - no soy estudiante\n\n"
        "💡 'I'm not' = 'I am not', abreviado."),
    "notyou_village": (450, 450,
        "# 🚫 No eres / No es...\n\n"
        "'Are' y 'is' tambien se niegan con 'not'.\n\n"
        "🫵 **You aren't a chef** - tu no eres cocinero\n"
        "👦 **He isn't a nurse** - el no es enfermero\n"
        "👧 **She isn't a driver** - ella no es conductora\n"
        "👦 **He isn't an artist** - el no es artista\n"
        "🫵 **You aren't a police officer** - tu no eres policia\n\n"
        "❗ Aren't = are not. Isn't = is not."),
    "negative_square": (450, 250,
        "# 🔁 Repaso: afirmativo vs negativo\n\n"
        "Antes del examen, contrasta las dos formas.\n\n"
        "✅ **I am a teacher** ↔ ❌ **I'm not a teacher**\n"
        "✅ **He is a farmer** ↔ ❌ **He isn't a farmer**\n\n"
        "💬 Practica: una frase afirmativa y su negativo, con la misma profesion."),
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

    if dst in ("notme_village", "notyou_village", "negative_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "muelle/puerto": piso de tablones de madera + palmeras.
        WOOD_FLOOR = ["sprite49", "sprite50", "sprite51", "sprite52", "sprite53", "sprite54"]
        DOCK_TREES = ["sprite5", "sprite1", "sprite2", "sprite13"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(WOOD_FLOOR)
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.16:
                new_forest.append({"x": x, "y": y, "frame": random.choice(DOCK_TREES)})
        wallsData["forest"] = new_forest

    if dst in ("combate_negative_1", "combate_negative_2", "combate_negative_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "yermo rocoso": piso de roca + arboles secos.
        ROCK_FLOOR = ["sprite41", "sprite42", "sprite43", "sprite44", "sprite45", "sprite46", "sprite47", "sprite48"]
        DEAD_TREES = ["sprite6", "sprite15", "sprite19", "sprite20"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(ROCK_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(DEAD_TREES)} for x, y in old_forest_positions
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
    dict(scene_key="notme_village", title="No soy... (I'm not)",
         description_en="Practica 'I'm not a/an' con profesiones",
         objective_en="Practica I'm not a farmer/teacher/doctor/student", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="notyou_village", title="No eres / No es (aren't / isn't)",
         description_en="Practica 'you aren't' y 'he/she isn't'",
         objective_en="Practica You aren't / He isn't / She isn't", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="negative_square", title="Repaso: afirmativo vs negativo",
         description_en="Contrasta afirmativo y negativo antes del examen",
         objective_en="Repasa am/is/are vs am not/isn't/aren't", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_negative_1", title="Los ogros invaden el yermo",
         description_en="Defiende el yermo mientras repasas la forma negativa",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_negative_2", title="Los ogros atacan a Ben",
         description_en="Salva a Ben, elimina a los ogros",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_negative_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas la forma negativa derrotando al jefe",
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
def npc_instr(name, pattern, profession_en, profession_es, examples, extra=""):
    ex = "', '".join(examples)
    return (f"Eres {name}, hablas ingles. Ensena '{pattern} {profession_en}' "
            f"(no {profession_es}). Dale al jugador estas frases para repetir: '{ex}'. "
            f"Completa la tarea cuando el jugador diga correctamente AL MENOS 3 de "
            f"estas frases (repetir la misma frase varias veces tambien cuenta). {extra}")

npcs = [
    ("notme_village", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a practicar la forma negativa "
     "'I'm not a/an ___'. Pregunta 'Are you ready?'. Si el jugador no sabe que "
     "responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea si "
     "responde afirmativamente.",
     "Great! Let's practice saying no."),
    ("notme_village", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "I'm not a", "farmer", "granjero",
               ["I'm not a farmer", "No, I'm not a farmer", "I'm not a farmer, I'm a teacher"]),
     "Great! I'm not a farmer."),
    ("notme_village", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "I'm not a", "teacher", "maestro/a",
               ["I'm not a teacher", "No, I'm not a teacher", "I'm not a teacher, I'm a doctor"]),
     "Perfect! I'm not a teacher."),
    ("notme_village", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "I'm not a", "doctor", "doctor",
               ["I'm not a doctor", "No, I'm not a doctor", "I'm not a doctor, I'm a student"]),
     "Exactly! I'm not a doctor."),
    ("notme_village", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "I'm not a", "student", "estudiante",
               ["I'm not a student", "No, I'm not a student", "I'm not a student, I'm a farmer"],
               extra="Ademas, para cerrar, pide un repaso de 'I'm not a ___' con las 4 "
                     "profesiones de este mapa (farmer, teacher, doctor, student)."),
     "Amazing! You can say no now!"),

    ("notyou_village", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "You aren't a", "chef", "cocinero",
               ["You aren't a chef", "No, you aren't a chef", "You aren't a chef, you are a nurse"]),
     "Great! You aren't a chef."),
    ("notyou_village", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "He isn't a", "nurse", "enfermero",
               ["He isn't a nurse", "No, he isn't a nurse", "He isn't a nurse, he is a driver"]),
     "Perfect! He isn't a nurse."),
    ("notyou_village", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "She isn't a", "driver", "conductora",
               ["She isn't a driver", "No, she isn't a driver", "She isn't a driver, she is an artist"]),
     "Exactly! She isn't a driver."),
    ("notyou_village", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "He isn't an", "artist", "artista",
               ["He isn't an artist", "No, he isn't an artist", "He isn't an artist, he is a police officer"]),
     "Right! He isn't an artist."),
    ("notyou_village", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "You aren't a", "police officer", "policia",
               ["You aren't a police officer", "No, you aren't a police officer", "You aren't a police officer, you are a chef"],
               extra="Ademas, para cerrar, pide un repaso de aren't/isn't con las 5 "
                     "profesiones de este mapa (chef, nurse, driver, artist, police officer)."),
     "Awesome! Aren't and isn't, solid now!"),

    ("negative_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Contrasta afirmativo y negativo con "
     "'farmer': dale a elegir 'I am a farmer', 'I'm not a farmer', 'I am a farmer, "
     "not a teacher'. Completa la tarea cuando el jugador diga correctamente al "
     "menos 3. Es repaso, no introduzcas profesiones nuevas.",
     "Great! Affirmative and negative, both work."),
    ("negative_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Contrasta con 'doctor': dale a elegir 'He is a "
     "doctor', 'He isn't a doctor', 'She is a doctor, not a nurse'. Completa la "
     "tarea cuando el jugador diga correctamente al menos 3.",
     "Exactly! Is and isn't, you got it."),
    ("negative_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Contrasta con 'teacher': dale a elegir 'You are a "
     "teacher', 'You aren't a teacher', 'I am a teacher, you aren't'. Completa la "
     "tarea cuando el jugador diga correctamente al menos 3.",
     "Perfect! Are and aren't, solid."),
    ("negative_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Repaso libre: pide al jugador que combine cualquier "
     "profesion vista en forma afirmativa y negativa, con ejemplos como 'I am a "
     "chef', 'I'm not a nurse'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3 frases distintas.",
     "Great! Mixing affirmative and negative, well done."),
    ("negative_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide al "
     "jugador que diga al menos 3 frases combinando afirmativo y negativo (I am/ "
     "I'm not, you are/aren't, he is/isn't, she is/isn't) con cualquier profesion "
     "vista. Completa la tarea cuando lo haga.",
     "Amazing! Affirmative and negative, you know them all!"),
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
    ("notme_village", 1, "Habla con Mochi", "talk_to_npc", ("notme_village", "Mochi"), None, 0),
    ("notme_village", 2, "Aprende 'I'm not a farmer' con Joy", "talk_to_npc", ("notme_village", "Joy"), None, 0),
    ("notme_village", 3, "Aprende 'I'm not a teacher' con Ann", "talk_to_npc", ("notme_village", "Ann"), None, 0),
    ("notme_village", 4, "Aprende 'I'm not a doctor' con Sam", "talk_to_npc", ("notme_village", "Sam"), None, 0),
    ("notme_village", 5, "Aprende 'I'm not a student' con Amy", "talk_to_npc", ("notme_village", "Amy"), None, 0),

    ("notyou_village", 1, "Aprende 'You aren't a chef' con Joy", "talk_to_npc", ("notyou_village", "Joy"), None, 0),
    ("notyou_village", 2, "Aprende 'He isn't a nurse' con Ann", "talk_to_npc", ("notyou_village", "Ann"), None, 0),
    ("notyou_village", 3, "Aprende 'She isn't a driver' con Sam", "talk_to_npc", ("notyou_village", "Sam"), None, 0),
    ("notyou_village", 4, "Aprende 'He isn't an artist' con Zoe", "talk_to_npc", ("notyou_village", "Zoe"), None, 0),
    ("notyou_village", 5, "Aprende 'You aren't a police officer' con Tom", "talk_to_npc", ("notyou_village", "Tom"), None, 0),

    ("negative_square", 1, "Repasa afirmativo/negativo con Toro", "talk_to_npc", ("negative_square", "Toro"), None, 0),
    ("negative_square", 2, "Repasa is/isn't con Sam", "talk_to_npc", ("negative_square", "Sam"), None, 0),
    ("negative_square", 3, "Repasa are/aren't con Joy", "talk_to_npc", ("negative_square", "Joy"), None, 0),
    ("negative_square", 4, "Repaso libre con Ann", "talk_to_npc", ("negative_square", "Ann"), None, 0),
    ("negative_square", 5, "Repaso final con Tom", "talk_to_npc", ("negative_square", "Tom"), None, 0),

    ("combate_negative_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_negative_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_negative_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_negative_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_negative_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 6 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
