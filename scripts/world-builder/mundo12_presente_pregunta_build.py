"""
Mundo 12: Presente Simple (pregunta) -- Etapas 1-4. Tercer y ultimo paso
del bloque "presente simple" (10=afirmativo, 11=negativo, 12=pregunta) --
cierra el bloque igual que Mundo 7 cerro el bloque "to be". Reusa los 5
verbos de mundos 10-11 (play, like, work, live, eat).

Map1 = Do + I/you/we/they...? y respuesta corta (Yes, I do / No, I don't).
Map2 = Does + he/she/it...? y respuesta corta (Yes, he does / No, he
doesn't) -- el verbo vuelve a su forma base.
Map3 = repaso mezclando ambas formas de pregunta + respuesta corta.

Las instructions incluyen el contexto gramatical desde el diseno inicial
(lesson 9 del README).

Terreno: a partir de este mundo los frames del atlas "forest" que nunca
se usaron se agotan (solo quedaban sprite3/4/55 libres, ver README lesson
9.5) -- se usan esos 3 para el mapa de dialogo, y para combate se
reutiliza el piso rocoso de Mundo 6 pero con una decoracion nueva
(tocones/musgo de Mundo 9 en vez de arboles muertos), para que la
COMBINACION siga siendo distinta aunque frames individuales se repitan.

Uso:
    python mundo12_presente_pregunta_build.py
"""
import json
import random

from _client import call, login, must

TOKEN = login()

clones = [
    ("the_village", "doyou_grove"),
    ("the_village_2", "doeshe_grove"),
    ("clock_tower", "doesit_square"),
    ("combate_town_1", "combate_doyou_1"),
    ("combate_town_2", "combate_doyou_2"),
    ("combat_town_boss", "combate_doyou_boss"),
]

SIGNS = {
    "doyou_grove": (450, 250,
        "# ❓ Pregunta con Do: I/you/we/they\n\n"
        "Para preguntar con **I / you / we / they**, usamos **Do** al inicio.\n\n"
        "⚽ **Do you play soccer?** - Yes, I do / No, I don't\n"
        "🍕 **Do you like pizza?** - Yes, I do / No, I don't\n"
        "🔨 **Do we work here?** - Yes, we do / No, we don't\n"
        "🏠 **Do they live nearby?** - Yes, they do / No, they don't\n\n"
        "💡 La respuesta corta repite 'do' o 'don't', no el verbo."),
    "doeshe_grove": (450, 450,
        "# ❔ Pregunta con Does: he/she/it\n\n"
        "Para preguntar con **he / she / it**, usamos **Does** y el verbo vuelve a su forma base.\n\n"
        "⚽ **Does he play soccer?** - Yes, he does / No, he doesn't\n"
        "🍕 **Does she like pizza?** - Yes, she does / No, she doesn't\n"
        "⚙️ **Does it work well?** - Yes, it does / No, it doesn't\n\n"
        "❗ 'Does he plays' esta MAL -- despues de 'does', el verbo pierde la -s."),
    "doesit_square": (450, 250,
        "# 🔁 Repaso: Do / Does + respuesta corta\n\n"
        "Antes del examen, repasa ambas preguntas juntas.\n\n"
        "👉 **Do you/we/they...?** → Yes, I/we/they do\n"
        "👉 **Does he/she/it...?** → Yes, he/she/it does\n\n"
        "💬 La respuesta corta siempre repite 'do' o 'does', nunca el verbo completo."),
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

    if dst in ("doyou_grove", "doeshe_grove", "doesit_square"):
        random.seed(hash(dst) & 0xffff)
        # Tema "arboleda caida": pasto + arboles grandes + troncos caidos.
        FALLEN_DECOR = ["sprite3", "sprite4", "sprite55"]
        keep_out = [(n["x"], n["y"]) for n in wallsData.get("npcZones", [])]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(["sprite1", "sprite2", "sprite3"])
        new_forest = []
        for t in wallsData.get("floors", []):
            x, y = t["x"], t["y"]
            if any((x - kx) ** 2 + (y - ky) ** 2 < 90 ** 2 for kx, ky in keep_out):
                continue
            if random.random() < 0.16:
                new_forest.append({"x": x, "y": y, "frame": random.choice(FALLEN_DECOR)})
        wallsData["forest"] = new_forest

    if dst in ("combate_doyou_1", "combate_doyou_2", "combate_doyou_boss"):
        random.seed(hash(dst) & 0xffff)
        # Tema "campo de rocas": piso rocoso (como Mundo 6) + tocones/musgo
        # (como Mundo 9) -- combinacion nueva aunque los frames se repitan.
        ROCK_FLOOR = ["sprite41", "sprite42", "sprite43", "sprite44", "sprite45", "sprite46", "sprite47", "sprite48"]
        STUMP_DECOR = ["sprite65", "sprite68", "sprite69", "sprite70"]
        for t in wallsData.get("floors", []):
            t["frame"] = random.choice(ROCK_FLOOR)
        old_forest_positions = [(f["x"], f["y"]) for f in wallsData.get("forest", [])]
        new_forest = [{"x": x, "y": y, "frame": random.choice(STUMP_DECOR)} for x, y in old_forest_positions
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
    dict(scene_key="doyou_grove", title="Presente simple: Do you...?",
         description_en="Practica preguntas con Do + I/you/we/they",
         objective_en="Practica Do you/we/they...? + respuesta corta", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="doeshe_grove", title="Presente simple: Does he...?",
         description_en="Practica preguntas con Does + he/she/it",
         objective_en="Practica Does he/she/it...? + respuesta corta", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="doesit_square", title="Repaso: Do / Does + respuesta corta",
         description_en="Repasa el contraste antes del examen",
         objective_en="Repasa Do you...? vs Does he...?", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_doyou_1", title="Los ogros invaden el campo de rocas",
         description_en="Defiende el campo de rocas mientras repasas presente simple",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_doyou_2", title="Los ogros atacan el campo de rocas",
         description_en="Elimina a los ogros del campo de rocas",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=20000, reward_xp=2000),
    dict(scene_key="combate_doyou_boss", title="El examen final: vence al jefe",
         description_en="Demuestra que dominas el presente simple derrotando al jefe",
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
    ("doyou_grove", "Mochi", 2, 850, 450, "Hi there!",
     "Eres mochi, hablas ingles. Diles que hoy van a practicar preguntas en presente "
     "simple con 'Do' (Do you play, do we work...) y su respuesta corta. Pregunta "
     "'Are you ready?'. Si el jugador no sabe que responder, sugierele 'Sure', 'OK', "
     "'Yes' o 'Let's go'. Completa la tarea si responde afirmativamente.",
     "Great! Let's ask some questions."),
    ("doyou_grove", "Joy", 9, 650, 150, "Hello there!",
     npc_instr("Joy", "En afirmativo decimos 'You play soccer'. Para preguntar con "
                       "'you', se usa 'Do' al inicio: 'Do you play soccer?'. La "
                       "respuesta corta es 'Yes, I do' o 'No, I don't'.",
               ["Do you play soccer?", "Yes, I do", "No, I don't"]),
     "Great! Do you...? -- Yes, I do."),
    ("doyou_grove", "Ann", 4, 1250, 350, "Hello!",
     npc_instr("Ann", "En afirmativo decimos 'You like pizza'. En pregunta, 'Do you "
                       "like pizza?'. La respuesta corta es 'Yes, I do' o 'No, I "
                       "don't'.",
               ["Do you like pizza?", "Yes, I do", "No, I don't"]),
     "Perfect! Do you like...? -- same pattern."),
    ("doyou_grove", "Sam", 1, 1150, 150, "Hi there!",
     npc_instr("Sam", "En afirmativo decimos 'We work here'. En pregunta, 'Do we work "
                       "here?'. La respuesta corta es 'Yes, we do' o 'No, we don't'.",
               ["Do we work here?", "Yes, we do", "No, we don't"]),
     "Exactly! Do we...? -- Yes, we do."),
    ("doyou_grove", "Amy", 8, 150, 350, "Hi!",
     npc_instr("Amy", "En afirmativo decimos 'They live nearby'. En pregunta, 'Do "
                       "they live nearby?'. La respuesta corta es 'Yes, they do' o "
                       "'No, they don't'.",
               ["Do they live nearby?", "Yes, they do", "No, they don't"],
               extra="Ademas, para cerrar, pide un repaso de las 4 preguntas de este "
                     "mapa (play, like, work, live) con 'Do'."),
     "Amazing! Do works with I/you/we/they!"),

    ("doeshe_grove", "Joy", 9, 650, 1050, "Hi!",
     npc_instr("Joy", "En afirmativo decimos 'He plays soccer'. Para preguntar con "
                       "'he', se usa 'Does' y el verbo vuelve a su forma base: 'Does "
                       "he play soccer?'. La respuesta corta es 'Yes, he does' o 'No, "
                       "he doesn't'.",
               ["Does he play soccer?", "Yes, he does", "No, he doesn't"]),
     "Great! Does he...? -- and 'play', not 'plays'."),
    ("doeshe_grove", "Ann", 4, 750, 650, "Hello!",
     npc_instr("Ann", "En afirmativo decimos 'She likes pizza'. En pregunta, 'Does "
                       "she like pizza?' (el verbo pierde la -s). La respuesta corta "
                       "es 'Yes, she does' o 'No, she doesn't'.",
               ["Does she like pizza?", "Yes, she does", "No, she doesn't"]),
     "Perfect! Does she like...? -- not likes."),
    ("doeshe_grove", "Sam", 1, 250, 650, "Hi there!",
     npc_instr("Sam", "En afirmativo decimos 'It works well'. En pregunta, 'Does it "
                       "work well?'. La respuesta corta es 'Yes, it does' o 'No, it "
                       "doesn't'.",
               ["Does it work well?", "Yes, it does", "No, it doesn't"]),
     "Exactly! Does it work...? -- not works."),
    ("doeshe_grove", "Zoe", 11, 50, 250, "Hi!",
     npc_instr("Zoe", "En afirmativo decimos 'He lives nearby'. En pregunta, 'Does he "
                       "live nearby?'. La respuesta corta es 'Yes, he does' o 'No, he "
                       "doesn't'.",
               ["Does he live nearby?", "Yes, he does", "No, he doesn't"]),
     "Right! Does he live...? -- not lives."),
    ("doeshe_grove", "Tom", 6, 650, 150, "Hey!",
     npc_instr("Tom", "En afirmativo decimos 'She eats breakfast'. En pregunta, 'Does "
                       "she eat breakfast?'. La respuesta corta es 'Yes, she does' o "
                       "'No, she doesn't'.",
               ["Does she eat breakfast?", "Yes, she does", "No, she doesn't"],
               extra="Ademas, para cerrar, pide un repaso de las preguntas de este "
                     "mapa (play, like, work, live, eat) con 'Does', siempre con el "
                     "verbo en forma base."),
     "Awesome! Does + base form, always!"),

    ("doesit_square", "Toro", 3, 550, 650, "Hello!",
     "eres toro el perro, hablas en ingles. Recuerda: pregunta con I/you/we/they usa "
     "'Do': 'Do you play soccer?' y la respuesta corta es 'Yes, I do' / 'No, I don't'. "
     "Dale a elegir: 'Do you play soccer?', 'Yes, I do', 'No, I don't'. Completa la "
     "tarea cuando el jugador diga correctamente al menos 3. Es repaso, no introduzcas "
     "verbos nuevos.",
     "Great! Do you...? still solid."),
    ("doesit_square", "Sam", 1, 850, 450, "Hi!",
     "Eres sam, hablas ingles. Recuerda: pregunta con he/she/it usa 'Does' y el verbo "
     "vuelve a su forma base: 'Does he play soccer?' y la respuesta corta es 'Yes, he "
     "does' / 'No, he doesn't'. Dale a elegir: 'Does he play soccer?', 'Yes, he does', "
     "'No, he doesn't'. Completa la tarea cuando el jugador diga correctamente al "
     "menos 3. Repaso, sin verbos nuevos.",
     "Exactly! Does he...? well done."),
    ("doesit_square", "Joy", 9, 50, 450, "Hello there!",
     "Eres Joy, hablas ingles. Recuerda: 'Does she like pizza?' (con she) y 'Do we "
     "work here?' (con we) -- Does con she, Do con we. Dale a elegir: 'Does she like "
     "pizza?', 'Do we work here?', 'Yes, she does. Yes, we do'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Perfect! Does with she, Do with we."),
    ("doesit_square", "Ann", 4, 50, 650, "Hey there!",
     "Eres Ann, hablas ingles. Recuerda: 'Do they live nearby?' (con they) y 'Does it "
     "work well?' (con it) -- Do con they, Does con it. Dale a elegir: 'Do they live "
     "nearby?', 'Does it work well?', 'Yes, they do. Yes, it does'. Completa la tarea "
     "cuando el jugador diga correctamente al menos 3. Repaso, sin verbos nuevos.",
     "Great! Do with they, Does with it, got it."),
    ("doesit_square", "Tom", 6, 850, 650, "What's up!",
     "Eres Tom, hablas ingles. Recuerda: 'Do' con I/you/we/they, 'Does' con "
     "he/she/it -- la respuesta corta repite 'do'/'does' con yes/no, nunca el verbo "
     "completo. Este es el repaso final antes del examen. Pide al jugador que haga al "
     "menos 3 preguntas con respuesta corta usando cualquiera de los verbos vistos "
     "(play, like, work, live, eat) y cualquier sujeto. Completa la tarea cuando lo "
     "haga.",
     "Amazing! You've mastered the simple present now!"),
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
    ("doyou_grove", 1, "Habla con Mochi", "talk_to_npc", ("doyou_grove", "Mochi"), None, 0),
    ("doyou_grove", 2, "Aprende 'Do you play' con Joy", "talk_to_npc", ("doyou_grove", "Joy"), None, 0),
    ("doyou_grove", 3, "Aprende 'Do you like' con Ann", "talk_to_npc", ("doyou_grove", "Ann"), None, 0),
    ("doyou_grove", 4, "Aprende 'Do we work' con Sam", "talk_to_npc", ("doyou_grove", "Sam"), None, 0),
    ("doyou_grove", 5, "Aprende 'Do they live' con Amy", "talk_to_npc", ("doyou_grove", "Amy"), None, 0),

    ("doeshe_grove", 1, "Aprende 'Does he play' con Joy", "talk_to_npc", ("doeshe_grove", "Joy"), None, 0),
    ("doeshe_grove", 2, "Aprende 'Does she like' con Ann", "talk_to_npc", ("doeshe_grove", "Ann"), None, 0),
    ("doeshe_grove", 3, "Aprende 'Does it work' con Sam", "talk_to_npc", ("doeshe_grove", "Sam"), None, 0),
    ("doeshe_grove", 4, "Aprende 'Does he live' con Zoe", "talk_to_npc", ("doeshe_grove", "Zoe"), None, 0),
    ("doeshe_grove", 5, "Aprende 'Does she eat' con Tom", "talk_to_npc", ("doeshe_grove", "Tom"), None, 0),

    ("doesit_square", 1, "Repasa Do you con Toro", "talk_to_npc", ("doesit_square", "Toro"), None, 0),
    ("doesit_square", 2, "Repasa Does he con Sam", "talk_to_npc", ("doesit_square", "Sam"), None, 0),
    ("doesit_square", 3, "Repasa Does she/Do we con Joy", "talk_to_npc", ("doesit_square", "Joy"), None, 0),
    ("doesit_square", 4, "Repasa Do they/Does it con Ann", "talk_to_npc", ("doesit_square", "Ann"), None, 0),
    ("doesit_square", 5, "Repaso final con Tom", "talk_to_npc", ("doesit_square", "Tom"), None, 0),

    ("combate_doyou_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_doyou_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_doyou_2", 1, "Elimina a todos los ogros guerreros", "kill_all", None, "Ogre Warrior", 9),
    ("combate_doyou_2", 2, "Elimina a todos los ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_doyou_boss", 1, "Vence al jefe", "kill_boss", None, "Gorgak el Grande", 1),
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

print("\n[ok] Mundo 12 (borrador) construido: 6 mapas, 6 misiones en draft/world_id=NULL, 15 NPCs, 20 tareas.")
