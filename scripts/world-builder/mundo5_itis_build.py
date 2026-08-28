"""
Mundo 5: "Eso es un/a... (bueno/grande)" (It is a/an [adjetivo] ___) --
Etapas 1-4. Primer contacto con adjetivos, sobre 'it is' que Mundo 2 ya
dejo sentado. Un adjetivo nuevo por NPC, con un sustantivo simple.

Map1 = 4 adjetivos (good/big/small/old). Map2 = 5 adjetivos (new/hot/
cold/fast/slow). Map3 = repaso de los 9.

Mismo patron de NPC: saludo limpio + AL MENOS 3 repeticiones resueltas.

Uso:
    python mundo5_itis_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "itis_village_1"),
    ("the_village_2", "itis_village_2"),
    ("clock_tower", "itis_square"),
    ("combate_town_1", "combate_itis_1"),
    ("combate_town_2", "combate_itis_2"),
    ("combat_town_boss", "combate_itis_boss"),
]

SIGNS = {
    "itis_village_1": (450, 250,
        "# 🐾 Eso es... It is a/an [adjetivo]\n\n"
        "Ahora describimos cosas con 'it is' + un adjetivo.\n\n"
        "🐶 **It is a good dog** - es un buen perro\n"
        "🏠 **It is a big house** - es una casa grande\n"
        "🐱 **It is a small cat** - es un gato pequeno\n"
        "🚗 **It is an old car** - es un carro viejo\n\n"
        "💡 El adjetivo va SIEMPRE antes del sustantivo en ingles."),
    "itis_village_2": (450, 450,
        "# ✨ Mas adjetivos\n\n"
        "Seguimos describiendo cosas con 'it is a/an ___'.\n\n"
        "📖 **It is a new book** - es un libro nuevo\n"
        "☀️ **It is a hot day** - es un dia caluroso\n"
        "🧊 **It is a cold drink** - es una bebida fria\n"
        "🏎️ **It is a fast car** - es un carro rapido\n"
        "🐢 **It is a slow turtle** - es una tortuga lenta\n\n"
        "❗ El adjetivo no cambia nunca, sin importar el sustantivo."),
    "itis_square": (450, 250,
        "# 🔁 Repaso: 9 adjetivos con It is\n\n"
        "Antes del examen, repasa todos.\n\n"
        "👉 good, big, small, old\n"
        "👉 new, hot, cold, fast, slow\n\n"
        "💬 Practica: 'It is a/an ___' con cualquier sustantivo y adjetivo."),
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

    if dst in ("itis_village_1", "itis_village_2", "itis_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "pradera de flores silvestres": distinto del huerto (Mundo 3)
        # y la cantera (Mundo 4).
        FLOWERS = ["sprite32", "sprite33", "sprite34", "sprite35", "sprite41", "sprite42"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(["sprite1", "sprite2", "sprite3"])
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.20:
                new_forest.append({"x": x, "y": y, "frame": random.choice(FLOWERS)})
        wallsData["forest"] = new_forest

    if dst in ("combate_itis_1", "combate_itis_2", "combate_itis_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "pantano": tierra oscura + arbustos escasos.
        DIRT = ["sprite25", "sprite26", "sprite27", "sprite28", "sprite29"]
        SWAMP_DECOR = ["sprite54", "sprite56", "sprite61"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(DIRT)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(SWAMP_DECOR)} for x, y in old_forest_positions
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
    dict(scene_key="itis_village_1", title="Eso es... (It is, parte 1)",
         description_en="Practica 'it is a/an + adjetivo'",
         objective_en="Practica It is a good/big/small/old", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="itis_village_2", title="Eso es... (It is, parte 2)",
         description_en="Mas adjetivos con it is",
         objective_en="Practica It is a new/hot/cold/fast/slow", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="itis_square", title="Repaso: It is + adjetivos",
         description_en="Repasa los 9 adjetivos antes del examen",
         objective_en="Repasa It is a/an con los 9 adjetivos", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_itis_1", title="Los ogros invaden el pantano",
         description_en="Defiende el pantano mientras repasas adjetivos",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_itis_2", title="Los ogros atacan a Ben",
         description_en="Salva a Ben, elimina a los ogros",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_itis_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas it is + adjetivos derrotando al jefe",
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
def npc_instr(name, adjective_en, adjective_es, noun_en, noun_es, article, examples, extra=""):
    ex = "', '".join(examples)
    return (f"Eres {name}, hablas ingles. Ensena 'It is {article} {adjective_en} {noun_en}' "
            f"(es {adjective_es}). Dale al jugador estas frases para repetir: '{ex}'. "
            f"Completa la tarea cuando el jugador diga correctamente AL MENOS 3 de "
            f"estas frases (repetir la misma frase varias veces tambien cuenta). {extra}")

npcs = [
    ("itis_village_1", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a describir cosas con 'it is a/an "
     "___'. Pregunta 'Are you ready?'. Si el jugador no sabe que responder, sugierele "
     "'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea si responde afirmativamente.",
     "Great! Let's describe things."),
    ("itis_village_1", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "good", "bueno", "dog", "perro", "a",
               ["It is a good dog", "It is a good dog, right?", "Yes, it is a good dog"]),
     "Great! It is a good dog."),
    ("itis_village_1", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "big", "grande", "house", "casa", "a",
               ["It is a big house", "It is a big house, right?", "Yes, it is a big house"]),
     "Perfect! It is a big house."),
    ("itis_village_1", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "small", "pequeno", "cat", "gato", "a",
               ["It is a small cat", "It is a small cat, right?", "Yes, it is a small cat"]),
     "Exactly! It is a small cat."),
    ("itis_village_1", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "old", "viejo", "car", "carro", "an",
               ["It is an old car", "It is an old car, right?", "Yes, it is an old car"],
               extra="Aclara que se dice 'an old car' (con 'an') porque 'old' empieza "
                     "con vocal. Ademas, para cerrar, pide un repaso de los 4 adjetivos "
                     "(good, big, small, old) con 'it is a/an ___'."),
     "Amazing! You know 4 adjectives now!"),

    ("itis_village_2", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "new", "nuevo", "book", "libro", "a",
               ["It is a new book", "It is a new book, right?", "Yes, it is a new book"]),
     "Great! It is a new book."),
    ("itis_village_2", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "hot", "caluroso", "day", "dia", "a",
               ["It is a hot day", "It is a hot day, right?", "Yes, it is a hot day"]),
     "Perfect! It is a hot day."),
    ("itis_village_2", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "cold", "fria", "drink", "bebida", "a",
               ["It is a cold drink", "It is a cold drink, right?", "Yes, it is a cold drink"]),
     "Exactly! It is a cold drink."),
    ("itis_village_2", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "fast", "rapido", "car", "carro", "a",
               ["It is a fast car", "It is a fast car, right?", "Yes, it is a fast car"]),
     "Right! It is a fast car."),
    ("itis_village_2", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "slow", "lenta", "turtle", "tortuga", "a",
               ["It is a slow turtle", "It is a slow turtle, right?", "Yes, it is a slow turtle"],
               extra="Ademas, para cerrar, pide un repaso de los 5 adjetivos de este mapa "
                     "(new, hot, cold, fast, slow) con 'it is a/an ___'."),
     "Awesome! 5 more adjectives, well done!"),

    ("itis_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Repasa 'good' y 'big' (ya vistos). Dale a "
     "elegir: 'It is a good dog', 'It is a big house', 'It is a good and big dog'. "
     "Completa la tarea cuando el jugador diga correctamente al menos 3. Es repaso, "
     "no introduzcas adjetivos nuevos.",
     "Great! Good and big, still solid."),
    ("itis_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Repasa 'small' y 'old'. Dale a elegir: 'It is a small "
     "cat', 'It is an old car', 'It is a small and old cat'. Completa la tarea cuando "
     "el jugador diga correctamente al menos 3. Repaso, sin adjetivos nuevos.",
     "Exactly! Small and old, well done."),
    ("itis_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Repasa 'new' y 'hot'. Dale a elegir: 'It is a new "
     "book', 'It is a hot day', 'It is a new and hot day'. Completa la tarea cuando "
     "el jugador diga correctamente al menos 3. Repaso, sin adjetivos nuevos.",
     "Perfect! New and hot, solid."),
    ("itis_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Repasa 'cold', 'fast' y 'slow'. Dale a elegir: 'It is "
     "a cold drink', 'It is a fast car', 'It is a slow turtle'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin adjetivos nuevos.",
     "Great! Cold, fast, slow -- all good."),
    ("itis_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide al "
     "jugador que diga 'It is a/an ___' con al menos 3 de los 9 adjetivos vistos "
     "(good, big, small, old, new, hot, cold, fast, slow), combinados con cualquier "
     "sustantivo. Completa la tarea cuando lo haga.",
     "Amazing! You know all 9 adjectives now!"),
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
    ("itis_village_1", 1, "Habla con Mochi", "talk_to_npc", ("itis_village_1", "Mochi"), None, 0),
    ("itis_village_1", 2, "Aprende 'good' con Joy", "talk_to_npc", ("itis_village_1", "Joy"), None, 0),
    ("itis_village_1", 3, "Aprende 'big' con Ann", "talk_to_npc", ("itis_village_1", "Ann"), None, 0),
    ("itis_village_1", 4, "Aprende 'small' con Sam", "talk_to_npc", ("itis_village_1", "Sam"), None, 0),
    ("itis_village_1", 5, "Aprende 'old' con Amy", "talk_to_npc", ("itis_village_1", "Amy"), None, 0),

    ("itis_village_2", 1, "Aprende 'new' con Joy", "talk_to_npc", ("itis_village_2", "Joy"), None, 0),
    ("itis_village_2", 2, "Aprende 'hot' con Ann", "talk_to_npc", ("itis_village_2", "Ann"), None, 0),
    ("itis_village_2", 3, "Aprende 'cold' con Sam", "talk_to_npc", ("itis_village_2", "Sam"), None, 0),
    ("itis_village_2", 4, "Aprende 'fast' con Zoe", "talk_to_npc", ("itis_village_2", "Zoe"), None, 0),
    ("itis_village_2", 5, "Aprende 'slow' con Tom", "talk_to_npc", ("itis_village_2", "Tom"), None, 0),

    ("itis_square", 1, "Repasa 'good'/'big' con Toro", "talk_to_npc", ("itis_square", "Toro"), None, 0),
    ("itis_square", 2, "Repasa 'small'/'old' con Sam", "talk_to_npc", ("itis_square", "Sam"), None, 0),
    ("itis_square", 3, "Repasa 'new'/'hot' con Joy", "talk_to_npc", ("itis_square", "Joy"), None, 0),
    ("itis_square", 4, "Repasa 'cold'/'fast'/'slow' con Ann", "talk_to_npc", ("itis_square", "Ann"), None, 0),
    ("itis_square", 5, "Repaso final con Tom", "talk_to_npc", ("itis_square", "Tom"), None, 0),

    ("combate_itis_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_itis_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_itis_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_itis_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_itis_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 5 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
