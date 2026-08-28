"""
Mundo 3: "Yo soy..." (I am a/an ___) -- Etapas 1-4, patron granular:
UN patron gramatical por mundo (no "to be" completo), repetido con
vocabulario de profesiones. Ver PLAN_CURRICULUM_MUNDOS.md, mundo 3.

Patron por NPC (mas estricto que Mundo 2): saludo limpio sin contenido +
al menos 3 repeticiones resueltas por el jugador (antes eran "2 de 4" en
Mundo 2 -- ver README.md punto 3, ahora el minimo sube a 3).

6 mapas: 3 dialogo (career_village_1/2 con 9 profesiones nuevas repartidas
+ career_square de repaso) + 2 combate + 1 jefe (clonados de World 1, tema
visual distinto al de Mundo 1 y Mundo 2).

Uso:
    python mundo3_iam_build.py
"""
import json

from _client import call, login, must

TOKEN = login()

# ── ETAPA 1: clonar 6 mapas ──
clones = [
    ("the_village", "career_village_1"),
    ("the_village_2", "career_village_2"),
    ("clock_tower", "career_square"),
    ("combate_town_1", "combate_career_1"),
    ("combate_town_2", "combate_career_2"),
    ("combat_town_boss", "combate_career_boss"),
]

# Letreros: mismo sprite correcto que Mundo 2 (furniture/sprite63, poste de
# madera -- ver README.md punto 2.5), contenido nuevo para este tema.
SIGNS = {
    "career_village_1": (450, 250,
        "# 👷 Profesiones: I am a/an ___\n\n"
        "Vas a aprender a decir tu profesion en ingles con 'I am a' o "
        "'I am an' (antes de vocal).\n\n"
        "👨‍🌾 **I am a farmer** - soy granjero\n"
        "👩‍🏫 **I am a teacher** - soy maestro/a\n"
        "👨‍⚕️ **I am a doctor** - soy doctor\n"
        "🎓 **I am a student** - soy estudiante\n\n"
        "💡 Habla con cada aldeano y repite su frase varias veces."),
    "career_village_2": (450, 450,
        "# 👷 Mas profesiones\n\n"
        "Seguimos con 'I am a/an ___', profesiones nuevas.\n\n"
        "👨‍🍳 **I am a chef** - soy cocinero\n"
        "👩‍⚕️ **I am a nurse** - soy enfermera\n"
        "🚗 **I am a driver** - soy conductor\n"
        "🎨 **I am an artist** - soy artista (usa 'an', no 'a')\n"
        "👮 **I am a police officer** - soy policia\n\n"
        "❗ 'An' se usa antes de sonido de vocal: an artist, an apple."),
    "career_square": (450, 250,
        "# 🔁 Repaso de profesiones\n\n"
        "Antes del examen, repasa las 9 profesiones que aprendiste.\n\n"
        "👉 farmer, teacher, doctor, student\n"
        "👉 chef, nurse, driver, artist, police officer\n\n"
        "💬 Practica: 'I am a ___' con cada una, una vez mas."),
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

    wallsJson = srcCfg["walls_json"]
    wallsData = json.loads(wallsJson)

    # Retema visual: paleta de huerto (manzanos + flores + arbustos), distinta
    # de Mundo 1 (setos/flores originales) y Mundo 2 (pinos/hongos/plaza).
    if dst in ("career_village_1", "career_village_2", "career_square"):
        import random
        random.seed(hash(dst) & 0xffff)
        ORCHARD = ["sprite17", "sprite18", "sprite32", "sprite33", "sprite37", "sprite38"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(["sprite1", "sprite2", "sprite3"])
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.22:
                new_forest.append({"x": x, "y": y, "frame": random.choice(ORCHARD)})
        wallsData["forest"] = new_forest

    if dst in SIGNS:
        x, y, text = SIGNS[dst]
        wallsData.setdefault("furniture", []).append({
            "x": x, "y": y, "frame": "sprite63",
            "minigameType": "read", "minigameId": "", "readText": text,
        })

    wallsJson = json.dumps(wallsData)
    body = {
        "scene_key": dst,
        "walls_json": wallsJson,
        "map_data": srcCfg["map_data"],
        "is_public": srcCfg.get("is_public", True),
        "max_users": srcCfg.get("max_users", 50),
    }
    must("POST", "/admin/maps", body, TOKEN, f"map {dst} <- {src}")

# ── ETAPA 2: 6 misiones (draft, world_id=null) ──
HEALTH_POTION = "bfd1359a-b574-45a1-9b55-adc7330a788f"
MANA_POTION = "bfd1359a-b574-45a1-9b55-adc7330a7890"

mission_specs = [
    dict(scene_key="career_village_1", title="Yo soy... (profesiones 1)",
         description_en="Aprende a decir tu profesion con I am a/an",
         objective_en="Practica I am a farmer/teacher/doctor/student", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="career_village_2", title="Yo soy... (profesiones 2)",
         description_en="Mas profesiones con I am a/an",
         objective_en="Practica I am a chef/nurse/driver/an artist/police officer", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="career_square", title="Repaso: Yo soy...",
         description_en="Repasa las 9 profesiones antes del examen",
         objective_en="Repasa I am a/an con las 9 profesiones", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_career_1", title="Los ogros invaden el mercado",
         description_en="Defiende el mercado de los ogros mientras repasas profesiones",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_career_2", title="Los ogros atacan a Ben",
         description_en="Salva a Ben, elimina a los ogros",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_career_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas I am a/an derrotando al jefe",
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

# ── ETAPA 3: 15 NPCs -- saludo limpio + AL MENOS 3 repeticiones resueltas ──
def npc_instr(profession_en, profession_es, examples, extra=""):
    ex = "', '".join(examples)
    return (f"Eres {{name}}, hablas ingles. Ensena la profesion '{profession_en}' "
            f"({profession_es}) con el patron 'I am a/an {profession_en}'. Dale al "
            f"jugador estas frases para repetir: '{ex}'. Completa la tarea cuando el "
            f"jugador diga correctamente AL MENOS 3 de estas frases (repetir la misma "
            f"frase varias veces tambien cuenta como repeticion valida). {extra}")

npcs = [
    # career_village_1
    ("career_village_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a aprender profesiones con "
     "'I am a/an ___'. Pregunta 'Are you ready?'. Si el jugador no sabe que "
     "responder, sugierele 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea "
     "si responde afirmativamente.",
     "Great! Let's learn some jobs."),
    ("career_village_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("farmer", "granjero", ["I am a farmer", "I am a farmer, nice to meet you", "Yes, I am a farmer"]).format(name="Joy"),
     "Great! You are a farmer now."),
    ("career_village_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("teacher", "maestro/a", ["I am a teacher", "I am a teacher, and you?", "Yes, I am a teacher"]).format(name="Ann"),
     "Perfect! Teacher, got it."),
    ("career_village_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("doctor", "doctor", ["I am a doctor", "I am a doctor, nice to meet you", "Yes, I am a doctor"]).format(name="Sam"),
     "Exactly! Doctor, well done."),
    ("career_village_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("student", "estudiante", ["I am a student", "I am a student here", "Yes, I am a student"],
               extra="Ademas, para cerrar, pidele que repase las 4 profesiones de este mapa "
                     "(farmer, teacher, doctor, student) diciendo 'I am a ___' con cada una.").format(name="Amy"),
     "Amazing! You know 4 jobs now!"),

    # career_village_2
    ("career_village_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("chef", "cocinero/a", ["I am a chef", "I am a chef, I cook food", "Yes, I am a chef"]).format(name="Joy"),
     "Great! Chef, nice one."),
    ("career_village_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("nurse", "enfermero/a", ["I am a nurse", "I am a nurse, I help people", "Yes, I am a nurse"]).format(name="Ann"),
     "Perfect! Nurse, well done."),
    ("career_village_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("driver", "conductor/a", ["I am a driver", "I am a driver, I drive a bus", "Yes, I am a driver"]).format(name="Sam"),
     "Exactly! Driver, got it."),
    ("career_village_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("artist", "artista", ["I am an artist", "I am an artist, I paint", "Yes, I am an artist"],
               extra="Aclara que se dice 'an artist' (con 'an', no 'a') porque 'artist' empieza con vocal.").format(name="Zoe"),
     "Right! An artist -- 'an' before a vowel sound."),
    ("career_village_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("police officer", "policia", ["I am a police officer", "I am a police officer, I help people", "Yes, I am a police officer"],
               extra="Ademas, para cerrar, pide un repaso final de las 5 profesiones de este mapa "
                     "(chef, nurse, driver, artist, police officer) diciendo 'I am a/an ___' con cada una.").format(name="Tom"),
     "Awesome! 5 more jobs, well done!"),

    # career_square (repaso)
    ("career_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Repasa 'farmer' y 'chef' (ya vistos). "
     "Dale a elegir estas frases para repetir: 'I am a farmer', 'I am a chef', "
     "'I am a farmer, not a chef'. Completa la tarea cuando el jugador diga "
     "correctamente al menos 3. Es repaso, no introduzcas profesiones nuevas.",
     "Great! Farmer and chef, still solid."),
    ("career_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Repasa 'teacher' y 'nurse'. Dale a elegir: "
     "'I am a teacher', 'I am a nurse', 'I am a teacher, and she is a nurse'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Repaso, "
     "sin profesiones nuevas.",
     "Exactly! Teacher and nurse, well done."),
    ("career_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Repasa 'doctor' y 'driver'. Dale a elegir: "
     "'I am a doctor', 'I am a driver', 'I am a doctor, not a driver'. Completa "
     "la tarea cuando el jugador diga correctamente al menos 3. Repaso, sin "
     "profesiones nuevas.",
     "Perfect! Doctor and driver, solid."),
    ("career_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Repasa 'student' y 'artist'. Dale a elegir: "
     "'I am a student', 'I am an artist', 'I am a student and an artist'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. "
     "Repaso, sin profesiones nuevas.",
     "Great! Student and artist, got it."),
    ("career_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide "
     "al jugador que diga 'I am a/an ___' con al menos 3 profesiones distintas "
     "de las 9 vistas (farmer, teacher, doctor, student, chef, nurse, driver, "
     "artist, police officer), a su eleccion. Completa la tarea cuando lo haga.",
     "Amazing! You know all the jobs now!"),
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
    ("career_village_1", 1, "Habla con Mochi", "talk_to_npc", ("career_village_1", "Mochi"), None, 0),
    ("career_village_1", 2, "Aprende 'farmer' con Joy", "talk_to_npc", ("career_village_1", "Joy"), None, 0),
    ("career_village_1", 3, "Aprende 'teacher' con Ann", "talk_to_npc", ("career_village_1", "Ann"), None, 0),
    ("career_village_1", 4, "Aprende 'doctor' con Sam", "talk_to_npc", ("career_village_1", "Sam"), None, 0),
    ("career_village_1", 5, "Aprende 'student' con Amy", "talk_to_npc", ("career_village_1", "Amy"), None, 0),

    ("career_village_2", 1, "Aprende 'chef' con Joy", "talk_to_npc", ("career_village_2", "Joy"), None, 0),
    ("career_village_2", 2, "Aprende 'nurse' con Ann", "talk_to_npc", ("career_village_2", "Ann"), None, 0),
    ("career_village_2", 3, "Aprende 'driver' con Sam", "talk_to_npc", ("career_village_2", "Sam"), None, 0),
    ("career_village_2", 4, "Aprende 'an artist' con Zoe", "talk_to_npc", ("career_village_2", "Zoe"), None, 0),
    ("career_village_2", 5, "Aprende 'police officer' con Tom", "talk_to_npc", ("career_village_2", "Tom"), None, 0),

    ("career_square", 1, "Repasa 'farmer'/'chef' con Toro", "talk_to_npc", ("career_square", "Toro"), None, 0),
    ("career_square", 2, "Repasa 'teacher'/'nurse' con Sam", "talk_to_npc", ("career_square", "Sam"), None, 0),
    ("career_square", 3, "Repasa 'doctor'/'driver' con Joy", "talk_to_npc", ("career_square", "Joy"), None, 0),
    ("career_square", 4, "Repasa 'student'/'artist' con Ann", "talk_to_npc", ("career_square", "Ann"), None, 0),
    ("career_square", 5, "Repaso final de las 9 profesiones con Tom", "talk_to_npc", ("career_square", "Tom"), None, 0),

    ("combate_career_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_career_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_career_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_career_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_career_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 3 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
print("PENDIENTE a proposito: challenges (tag 'to-be-i-am'/'final_mundo_3') y Fase final (mundo3_iam_publish.py).")
