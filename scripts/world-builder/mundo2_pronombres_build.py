"""
Mundo 2: Pronombres -- Etapas 1-4 (mapa, mision, NPCs, tareas) + challenges,
mas la reparacion de World 1 (ver PLAN_CLONACION_MAPAS_MISION.md).

Idempotente: cada paso primero consulta si ya existe antes de crear, asi que
es seguro volver a correrlo si se corta a mitad de camino. Todo queda en
status='draft' / world_id=NULL -- invisible para jugadores hasta que se
corra mundo2_pronombres_publish.py (Fase final, deliberadamente separada).

Uso:
    python mundo2_pronombres_build.py
"""
import json

from _client import call, login, must

TOKEN = login()

# ── ETAPA 1: clonar 5 mapas ──
clones = [
    ("the_village", "pronoun_village"),
    ("the_village_2", "pronoun_village_2"),
    ("clock_tower", "pronoun_square"),
    ("combate_town_1", "combate_pronoun_1"),
    ("combat_town_boss", "combate_pronoun_boss"),
]

# Letreros nuevos (sintaxis segura para InfoMarkdown: solo #/##/###, **negrita**,
# *cursiva* y parrafos sueltos -- sin listas, tablas ni citas; ver
# ANALISIS_LETRERO_CLOCK_TOWER.md sobre por que esas construcciones no sirven
# aqui). Posicion elegida lejos de todos los NPCs del mapa fuente. Tipo
# 'furniture' (atlas store-furniture) frame 'sprite63' -- un letrero de
# madera con poste, el mismo que ya usa un letrero real en clock_tower en
# produccion. NO usar 'furniture3' (atlas furniture/spritesheet.png) --
# sus frames son objetos de interior/mazmorra (ver README.md, punto 2.5).
SIGNS = {
    "pronoun_village": (450, 250,
        "# Pronombres personales\n\n"
        "En este pueblo vas a aprender a decir *yo, tu, el, ella, eso, "
        "nosotros y ellos* en ingles.\n\n"
        "**I** - yo\n"
        "**You** - tu\n"
        "**He** - el\n"
        "**She** - ella\n"
        "**It** - eso (para objetos y animales)\n"
        "**We** - nosotros\n"
        "**They** - ellos/ellas\n\n"
        "Habla con cada aldeano para practicar uno por uno."),
    "pronoun_village_2": (450, 450,
        "# De quien es esto?\n\n"
        "Estos pronombres indican **posesion** - de quien es algo.\n\n"
        "**My** - mi (de mi)\n"
        "**Your** - tu (de ti)\n"
        "**His** - su (de el)\n"
        "**Her** - su (de ella)\n"
        "**Its** - su (de eso, sin apostrofe)\n"
        "**Our** - nuestro\n"
        "**Their** - su (de ellos)\n\n"
        "Ejemplo: *This is my book. Is this your pen?*"),
    "pronoun_square": (450, 250,
        "# Presente simple: cuando agregar la 's'\n\n"
        "Con **I, you, we, they** el verbo NO lleva 's':\n"
        "*I play. You play. We play. They play.*\n\n"
        "Con **he, she, it** el verbo SI lleva 's':\n"
        "*He plays. She plays. It works.*\n\n"
        "Para preguntar: **Do** (con I/you/we/they), **Does** (con he/she/it).\n"
        "Para negar: **don't** / **doesn't**."),
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
    if dst in SIGNS:
        x, y, text = SIGNS[dst]
        wallsData = json.loads(wallsJson)
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

# ── ETAPA 2: 5 misiones (draft, world_id=null) ──
HEALTH_POTION = "bfd1359a-b574-45a1-9b55-adc7330a788f"
MANA_POTION = "bfd1359a-b574-45a1-9b55-adc7330a7890"

mission_specs = [
    dict(scene_key="pronoun_village", title="Aprende los Pronombres",
         description_en="Practica los pronombres personales con los aldeanos",
         objective_en="Aprende I, you, he, she, it, we, they", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="pronoun_village_2", title="Aprende los Pronombres 2",
         description_en="Practica los pronombres posesivos con los aldeanos",
         objective_en="Aprende my, your, his, her, its, our, their", type="talk_to_npc",
         reward_item_id=MANA_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="pronoun_square", title="Presente Simple y Pronombres",
         description_en="Aprende a conjugar el presente simple segun el pronombre",
         objective_en="Domina I/you/we/they vs he/she/it en presente simple", type="talk_to_npc",
         reward_item_id=HEALTH_POTION, reward_quantity=1, reward_gold=25000, reward_xp=2000),
    dict(scene_key="combate_pronoun_1", title="Los ogros invaden la plaza",
         description_en="Defiende el pueblo de los ogros mientras repasas pronombres",
         objective_en="Elimina a los ogros", type="kill_all",
         reward_item_id=HEALTH_POTION, reward_quantity=4, reward_gold=10000, reward_xp=10000),
    dict(scene_key="combate_pronoun_boss", title="El examen final: vence a Gorgak",
         description_en="Demuestra que dominas los pronombres derrotando al jefe",
         objective_en="Vence a Gorgak el Grande", type="kill_boss",
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

# ── ETAPA 3: 15 NPCs (contenido de pronombres) ──
npcs = [
    # pronoun_village (subject pronouns)
    dict(scene_key="pronoun_village", name="Mochi", npc_definition_id=2, position_x=850, position_y=450,
         facing_direction="right", default_state="walking", movement_type="wander", interaction_radius=64,
         greeting="Hi there, traveler! Ready for a new lesson?",
         instructions="Eres mochi hablas ingles, dile al usuario que hoy va a aprender los pronombres personales en ingles (I, you, he, she, it, we, they), preguntale 'Are you ready?', si contesta afirmativa completa la tarea",
         success_message="Great! Let's meet the villagers."),
    dict(scene_key="pronoun_village", name="Joy", npc_definition_id=9, position_x=650, position_y=150,
         facing_direction="right", default_state="idle", movement_type="static", interaction_radius=64,
         greeting="Hello there! Do you know how to say 'yo' and 'tu' in English?",
         instructions="Eres Joy hablas ingles, ensena los pronombres 'I' (yo) y 'you' (tu), pide al jugador que complete las frases 'I am a student' y 'You are my friend' usando I/you correctamente, completa la tarea cuando use ambos bien",
         success_message="Perfect! I and you, easy right?"),
    dict(scene_key="pronoun_village", name="Ann", npc_definition_id=4, position_x=1250, position_y=350,
         facing_direction="left", default_state="talking", movement_type="static", interaction_radius=64,
         greeting="Hello! Let's talk about him and her.",
         instructions="Eres Ann hablas ingles, ensena 'he' (el) y 'she' (ella), pide al jugador que arme las frases 'He is tall' y 'She is smart' usando he/she correctamente, completa la tarea cuando lo logre",
         success_message="Exactly! He for boys, she for girls."),
    dict(scene_key="pronoun_village", name="Sam", npc_definition_id=1, position_x=1150, position_y=150,
         facing_direction="left", default_state="happy", movement_type="static", interaction_radius=64,
         greeting="Hi, I am Sam. Do you know 'it'?",
         instructions="Eres Sam hablas ingles, ensena 'it' (para objetos y animales), pide al jugador que use 'it' en una frase como 'It is a cat' o 'It is my book', completa la tarea si lo usa bien",
         success_message="Great! 'It' is for things and animals."),
    dict(scene_key="pronoun_village", name="Amy", npc_definition_id=8, position_x=150, position_y=350,
         facing_direction="right", default_state="happy", movement_type="static", interaction_radius=64,
         greeting="Hi! Let's finish with 'we' and 'they'.",
         instructions="Eres Amy hablas ingles, ensena 'we' (nosotros) y 'they' (ellos/ellas), pide una frase con cada uno ('We are friends', 'They are villagers'), y para completar la tarea pidele que repase rapido los 7 pronombres (I, you, he, she, it, we, they) diciendo uno de cada uno",
         success_message="Amazing! You know all the pronouns now!"),

    # pronoun_village_2 (possessive pronouns/adjectives)
    dict(scene_key="pronoun_village_2", name="Joy", npc_definition_id=9, position_x=650, position_y=1050,
         facing_direction="left", default_state="walking", movement_type="wander", interaction_radius=64,
         greeting="Hi! Is this your book or my book?",
         instructions="Eres Joy hablas ingles, ensena 'my' (mi) y 'your' (tu), pide al jugador que diga 'This is my bag' y 'Is this your pen?' correctamente, completa la tarea cuando lo logre",
         success_message="Great! My and your, got it!"),
    dict(scene_key="pronoun_village_2", name="Ann", npc_definition_id=4, position_x=750, position_y=650,
         facing_direction="left", default_state="talking", movement_type="static", interaction_radius=64,
         greeting="Hello! Whose backpack is this?",
         instructions="Eres Ann hablas ingles, ensena 'his' (de el) y 'her' (de ella), pide frases como 'This is his hat' y 'That is her jacket', completa la tarea cuando el jugador use ambos bien",
         success_message="Perfect! His for him, her for her."),
    dict(scene_key="pronoun_village_2", name="Sam", npc_definition_id=1, position_x=250, position_y=650,
         facing_direction="right", default_state="talking", movement_type="wander", interaction_radius=64,
         greeting="Hi, look at that dog and its tail!",
         instructions="Eres Sam hablas ingles, ensena 'its' (de eso, para animales/objetos), aclara que NO lleva apostrofe, pide una frase como 'The dog wags its tail', completa la tarea si el jugador la arma bien",
         success_message="Correct! Its - no apostrophe, remember!"),
    dict(scene_key="pronoun_village_2", name="Zoe", npc_definition_id=11, position_x=50, position_y=250,
         facing_direction="right", default_state="idle", movement_type="static", interaction_radius=64,
         greeting="Hi! This is our village.",
         instructions="Eres Zoe hablas ingles, ensena 'our' (nuestro/a), pide una frase como 'This is our house' o 'Our team is great', completa la tarea cuando el jugador la use bien",
         success_message="Yes! Our village, our home."),
    dict(scene_key="pronoun_village_2", name="Tom", npc_definition_id=6, position_x=650, position_y=150,
         facing_direction="left", default_state="idle", movement_type="static", interaction_radius=64,
         greeting="Hey! Do you see their farm over there?",
         instructions="Eres Tom hablas ingles, ensena 'their' (de ellos/ellas), pide una frase como 'Their farm is big', y para completar la tarea pide un repaso rapido de los pronombres posesivos (my, your, his, her, its, our, their) mencionando cada uno",
         success_message="Awesome! You know every possessive now!"),

    # pronoun_square (present simple + pronoun agreement)
    dict(scene_key="pronoun_square", name="Toro", npc_definition_id=3, position_x=550, position_y=650,
         facing_direction="left", default_state="idle", movement_type="wander", interaction_radius=64,
         greeting="Hello! I play, you play, we play!",
         instructions="eres toro el perro hablas en ingles, ensena que con I/you/we/they el verbo NO lleva 's' en presente simple, pide una frase como 'I play soccer' o 'They live here', completa la tarea si el jugador la arma correctamente",
         success_message="Great! No 's' with I, you, we, they."),
    dict(scene_key="pronoun_square", name="Sam", npc_definition_id=1, position_x=850, position_y=450,
         facing_direction="left", default_state="talking", movement_type="static", interaction_radius=64,
         greeting="Hi, watch this: he plays, she plays!",
         instructions="Eres sam hablas ingles, ensena que con he/she/it el verbo SI lleva 's' en presente simple, pide una frase como 'She plays soccer' o 'It works well', completa la tarea si el jugador la usa bien",
         success_message="Exactly! He, she, it - always add 's'."),
    dict(scene_key="pronoun_square", name="Joy", npc_definition_id=9, position_x=50, position_y=450,
         facing_direction="right", default_state="idle", movement_type="static", interaction_radius=64,
         greeting="Hello! Can you spot the mistake?",
         instructions="Eres Joy hablas ingles, dile al jugador una frase incorrecta como 'He play soccer' y pidele que la corrija a 'He plays soccer', completa la tarea cuando la corrija bien",
         success_message="You caught it! Well done."),
    dict(scene_key="pronoun_square", name="Ann", npc_definition_id=4, position_x=50, position_y=650,
         facing_direction="right", default_state="idle", movement_type="static", interaction_radius=64,
         greeting="Hey there! Do you like English?",
         instructions="Eres Ann hablas ingles, ensena 'do' (con I/you/we/they) y 'does' (con he/she/it) para preguntas, pide que el jugador arme 'Do you like pizza?' y 'Does she like pizza?', completa la tarea cuando lo logre",
         success_message="Perfect! Do or does, you got it."),
    dict(scene_key="pronoun_square", name="Tom", npc_definition_id=6, position_x=850, position_y=650,
         facing_direction="left", default_state="idle", movement_type="static", interaction_radius=64,
         greeting="What's up! I don't like Mondays, do you?",
         instructions="Eres Tom hablas ingles, ensena la forma negativa 'don't' (con I/you/we/they) y 'doesn't' (con he/she/it), pide 'I don't like coffee' y 'He doesn't like coffee', y para completar la tarea pide un repaso final: una frase afirmativa, una negativa y una pregunta usando cualquier pronombre",
         success_message="Amazing! You mastered present simple with pronouns!"),
]

npc_ids = {}
for n in npcs:
    sk, nm = n["scene_key"], n["name"]
    status, list_resp = call("GET", f"/admin/npc-instances?scene_key={sk}", token=TOKEN)
    found = None
    if status == 200 and isinstance(list_resp, list):
        for row in list_resp:
            if row.get("npc_definition_id") == n["npc_definition_id"] and row.get("position_x") == n["position_x"] and row.get("position_y") == n["position_y"]:
                found = row
                break
    if found:
        npc_ids.setdefault(sk, {})[nm] = found["id"]
        print(f"[skip] npc {sk}/{nm} ya existe (id={found['id']})")
        continue
    body = dict(n)
    del body["name"]
    created = must("POST", "/admin/npcs", body, TOKEN, f"npc {sk}/{nm}")
    npc_ids.setdefault(sk, {})[nm] = created["id"]

print("npc_ids:", npc_ids)

# ── ETAPA 4: 18 mission_tasks ──
tasks = [
    ("pronoun_village", 1, "Habla con Mochi", "talk_to_npc", ("pronoun_village", "Mochi"), None, 0),
    ("pronoun_village", 2, "Aprende 'I' y 'you' con Joy", "talk_to_npc", ("pronoun_village", "Joy"), None, 0),
    ("pronoun_village", 3, "Aprende 'he' y 'she' con Ann", "talk_to_npc", ("pronoun_village", "Ann"), None, 0),
    ("pronoun_village", 4, "Aprende 'it' con Sam", "talk_to_npc", ("pronoun_village", "Sam"), None, 0),
    ("pronoun_village", 5, "Aprende 'we' y 'they' con Amy", "talk_to_npc", ("pronoun_village", "Amy"), None, 0),

    ("pronoun_village_2", 1, "Aprende 'my' y 'your' con Joy", "talk_to_npc", ("pronoun_village_2", "Joy"), None, 0),
    ("pronoun_village_2", 2, "Aprende 'his' y 'her' con Ann", "talk_to_npc", ("pronoun_village_2", "Ann"), None, 0),
    ("pronoun_village_2", 3, "Aprende 'its' con Sam", "talk_to_npc", ("pronoun_village_2", "Sam"), None, 0),
    ("pronoun_village_2", 4, "Aprende 'our' con Zoe", "talk_to_npc", ("pronoun_village_2", "Zoe"), None, 0),
    ("pronoun_village_2", 5, "Aprende 'their' con Tom", "talk_to_npc", ("pronoun_village_2", "Tom"), None, 0),

    ("pronoun_square", 1, "Presente simple con I/you/we/they con Toro", "talk_to_npc", ("pronoun_square", "Toro"), None, 0),
    ("pronoun_square", 2, "Presente simple con he/she/it con Sam", "talk_to_npc", ("pronoun_square", "Sam"), None, 0),
    ("pronoun_square", 3, "Corrige el error con Joy", "talk_to_npc", ("pronoun_square", "Joy"), None, 0),
    ("pronoun_square", 4, "Aprende Do/Does con Ann", "talk_to_npc", ("pronoun_square", "Ann"), None, 0),
    ("pronoun_square", 5, "Aprende la forma negativa con Tom", "talk_to_npc", ("pronoun_square", "Tom"), None, 0),

    ("combate_pronoun_1", 1, "Elimina 5 ogros guerreros", "kill_all", None, "Ogre Warrior", 5),
    ("combate_pronoun_1", 2, "Elimina 4 ogros lanzadores", "kill_all", None, "Ogre", 4),

    ("combate_pronoun_boss", 1, "Vence a Gorgak el Grande", "kill_boss", None, "Gorgak el Grande", 1),
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

# ── learning_challenges: 20 'pronouns' + 10 'final_mundo_2' ──
challenges = [
    ("___ am a teacher.", "I", "He", "They", 1, "___ soy profesor.", "Se usa 'I' para hablar de uno mismo.", "pronouns"),
    ("___ is my brother.", "She", "He", "They", 2, "___ es mi hermano.", "'He' se usa para un hombre (el).", "pronouns"),
    ("___ is my sister.", "He", "She", "It", 2, "___ es mi hermana.", "'She' se usa para una mujer (ella).", "pronouns"),
    ("Look at the cat. ___ is sleeping.", "He", "She", "It", 3, "Mira el gato. ___ esta durmiendo.", "'It' se usa para animales y objetos.", "pronouns"),
    ("___ are my friends.", "He", "They", "It", 2, "___ son mis amigos.", "'They' se usa para varias personas.", "pronouns"),
    ("___ are going to the park.", "We", "It", "He", 1, "___ vamos al parque.", "'We' incluye al hablante.", "pronouns"),
    ("Can ___ help me?", "you", "it", "he", 1, "Puedes ___ ayudarme?", "'You' se usa para hablarle a alguien.", "pronouns"),
    ("This is ___ book.", "your", "my", "his", 2, "Este es ___ libro.", "'My' indica que algo es de uno mismo.", "pronouns"),
    ("Is this ___ pen?", "her", "your", "its", 2, "Es este ___ boligrafo?", "'Your' indica que algo es tuyo.", "pronouns"),
    ("This is ___ car.", "his", "her", "its", 1, "Este es ___ auto.", "'His' indica que algo es de el.", "pronouns"),
    ("That is ___ bag.", "his", "her", "their", 2, "Esa es ___ mochila.", "'Her' indica que algo es de ella.", "pronouns"),
    ("The dog wagged ___ tail.", "it's", "its", "their", 2, "El perro movio ___ cola.", "'Its' (sin apostrofe) indica posesion de un animal/objeto.", "pronouns"),
    ("This is ___ house.", "our", "your", "their", 1, "Esta es ___ casa.", "'Our' indica que algo es de nosotros.", "pronouns"),
    ("That is ___ farm.", "our", "its", "their", 3, "Esa es ___ granja.", "'Their' indica que algo es de ellos.", "pronouns"),
    ("She ___ soccer every day.", "play", "plays", "playing", 2, "Ella ___ futbol todos los dias.", "Con he/she/it se agrega 's' en presente simple.", "pronouns"),
    ("They ___ soccer every day.", "play", "plays", "playing", 1, "Ellos ___ futbol todos los dias.", "Con I/you/we/they el verbo NO lleva 's'.", "pronouns"),
    ("He ___ pizza.", "like", "likes", "liking", 2, "A el le ___ la pizza.", "Con he/she/it se agrega 's' en presente simple.", "pronouns"),
    ("___ you like coffee?", "Do", "Does", "Is", 1, "___ te gusta el cafe?", "'Do' se usa con I/you/we/they para preguntas.", "pronouns"),
    ("___ she like coffee?", "Do", "Does", "Is", 2, "___ le gusta el cafe a ella?", "'Does' se usa con he/she/it para preguntas.", "pronouns"),
    ("He doesn't ___ Mondays.", "like", "likes", "liking", 1, "A el no le gustan los lunes.", "Despues de doesn't/don't el verbo va en forma base.", "pronouns"),

    ("My mom and I are cooking. ___ are making dinner.", "We", "They", "You", 1, "Mi mama y yo cocinamos. ___ preparamos la cena.", "'We' incluye al hablante.", "final_mundo_2"),
    ("This is Ana's book. It is ___ book.", "his", "her", "their", 2, "Este es el libro de Ana. Es ___ libro.", "'Her' se usa para posesion femenina.", "final_mundo_2"),
    ("The birds built ___ nest in the tree.", "their", "theirs", "it's", 1, "Los pajaros construyeron ___ nido en el arbol.", "'Their' indica posesion de varios.", "final_mundo_2"),
    ("My dog loves ___ toy.", "its", "it's", "their", 1, "Mi perro ama ___ juguete.", "'Its' (sin apostrofe) es el posesivo de 'it'.", "final_mundo_2"),
    ("___ we go to the beach together?", "Do", "Does", "Is", 1, "___ vamos juntos a la playa?", "'Do' se usa con 'we' para preguntas.", "final_mundo_2"),
    ("He never ___ breakfast.", "eat", "eats", "eating", 2, "El nunca desayuna.", "Con 'he' el verbo agrega 's' en presente simple.", "final_mundo_2"),
    ("I ___ horror movies.", "don't like", "doesn't like", "not like", 1, "A mi no me gustan las peliculas de terror.", "'Don't' se usa con I/you/we/they.", "final_mundo_2"),
    ("She ___ horror movies.", "don't like", "doesn't like", "not likes", 2, "A ella no le gustan las peliculas de terror.", "'Doesn't' se usa con he/she/it.", "final_mundo_2"),
    ("Sam and Tom are farmers. ___ work every morning.", "They", "He", "It", 1, "Sam y Tom son granjeros. ___ trabajan cada manana.", "'They' se usa para varias personas.", "final_mundo_2"),
    ("That is not my pen, it is ___.", "your", "yours", "you", 2, "Ese no es mi boligrafo, es ___.", "'Yours' es el pronombre posesivo (sin sustantivo despues).", "final_mundo_2"),
]

status, existingChallenges = call("GET", "/admin/challenges", token=TOKEN)
existingQuestions = set()
if status == 200 and isinstance(existingChallenges, list):
    existingQuestions = {c["question"] for c in existingChallenges}
else:
    print(f"WARNING: could not list existing challenges (status={status}), proceeding without dedup")

created_count = 0
for q, o1, o2, o3, correct, qES, expES, tag in challenges:
    if q in existingQuestions:
        print(f"[skip] challenge ya existe: {q!r}")
        continue
    body = {
        "type": "grammar", "question": q, "option_1": o1, "option_2": o2, "option_3": o3,
        "correct_option": correct, "explanation_es": expES, "question_es": qES,
        "tags": [tag], "difficulty": "beginner", "language_learning": "english",
    }
    must("POST", "/admin/challenges", body, TOKEN, f"challenge {q[:30]}")
    created_count += 1

print(f"[ok] {created_count} learning_challenges creados")

# ── Fix World 1: enlazar piezas huerfanas + corregir pool de tags roto ──
status, missionsList = call("GET", "/admin/missions", token=TOKEN)
missionsByScene = {m["scene_key"]: m for m in missionsList} if status == 200 else {}

ct2 = missionsByScene.get("combate_town_2")
if ct2 and ct2.get("world_id") == 1 and ct2.get("order_in_world") == 4:
    print("[skip] combate_town_2 ya enlazada")
else:
    body = dict(ct2)
    body["world_id"] = 1
    body["order_in_world"] = 4
    must("PUT", f"/admin/missions/{ct2['id']}", body, TOKEN, "fix combate_town_2 -> world_id=1")

boss = missionsByScene.get("combat_town_boss")
if boss and boss.get("world_id") == 1 and boss.get("is_final") is True:
    print("[skip] combat_town_boss ya enlazado/is_final")
else:
    body = dict(boss)
    body["world_id"] = 1
    body["is_final"] = True
    body["order_in_world"] = 5
    must("PUT", f"/admin/missions/{boss['id']}", body, TOKEN, "fix combat_town_boss -> world_id=1, is_final=true")

status, worldsList = call("GET", "/admin/worlds", token=TOKEN)
mundo1 = next((w for w in worldsList if w.get("key") == "mundo_1"), None) if status == 200 else None
if mundo1:
    if mundo1.get("challenge_tags") == ["greetings", "introductions", "numbers"]:
        print("[skip] mundo_1 challenge_tags ya corregidos")
    else:
        body = dict(mundo1)
        body["challenge_tags"] = ["greetings", "introductions", "numbers"]
        must("PUT", f"/admin/worlds/{mundo1['id']}", body, TOKEN, "fix mundo_1 challenge_tags -> ingles")
else:
    print("WARNING: no se encontro world 'mundo_1' via /admin/worlds")

if mundo1:
    status, health = call("GET", f"/admin/worlds/{mundo1['id']}/pool-health", token=TOKEN)
    print("mundo_1 pool-health:", status, health)

print("\n=== RESUMEN ===")
print("mission_ids:", mission_ids)
print("npc_ids:", npc_ids)
print("Todo en status=draft / world_id=NULL -- sigue invisible para jugadores.")
print("World 1 reparado: combate_town_2 y combat_town_boss enlazados, challenge_tags corregidos.")
print("PENDIENTE a proposito: correr mundo2_pronombres_publish.py (Fase final).")
