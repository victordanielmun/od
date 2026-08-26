"""
Mundo 2: Pronombres -- ajustes post-publicacion (ver README.md de esta
carpeta, seccion "Lecciones de Mundo 2"):

1. Mochi (pronoun_village Y the_village) no sugeria como responder a
   "Are you ready?" -- un jugador principiante puede quedarse sin saber
   que decir. Se agrega una pista explicita (Sure/OK/Yes/Let's go).

2. pronoun_village_2 y pronoun_square introducian gramatica NUEVA
   (posesivos, presente simple) en vez de REPETIR el tema del mundo
   (pronombres sujeto). Se reescriben sus 5+5 NPCs y las 2 misiones para
   repasar los mismos 7 pronombres en contextos nuevos (granja, plaza).

3. Los challenges de posesivos/presente-simple que ya no corresponden a
   este mundo se re-etiquetan (no se borran) como semilla de mundos
   futuros ("solo posesivos", "solo presente simple"), y se agregan
   preguntas nuevas de solo-pronombres-sujeto para no vaciar el pool.

Idempotente donde es razonable (los PUT son overwrite completo -- se relee
el estado actual antes de mutar solo los campos que cambian).

Uso:
    python mundo2_pronombres_adjust.py
"""
from _client import call, login, must


def get_npc(scene_key, name, def_id, x, y, token):
    status, rows = call("GET", f"/admin/npc-instances?scene_key={scene_key}", token=token)
    if status != 200:
        raise SystemExit(f"FAILED listing npcs for {scene_key}: {status} {rows}")
    for r in rows:
        if r["npc_definition_id"] == def_id and r["position_x"] == x and r["position_y"] == y:
            return r
    raise SystemExit(f"NPC no encontrado: {scene_key}/{name} (def={def_id}, pos=({x},{y}))")


def update_npc(row, patch, token, label):
    body = dict(row)
    body.update(patch)
    must("PUT", f"/admin/npcs/{row['id']}", body, token, label)


def get_mission(scene_key, token):
    status, missions = call("GET", "/admin/missions", token=token)
    for m in missions:
        if m["scene_key"] == scene_key:
            return m
    raise SystemExit(f"Mission no encontrada: {scene_key}")


def update_mission(row, patch, token, label):
    body = dict(row)
    body.update(patch)
    must("PUT", f"/admin/missions/{row['id']}", body, token, label)


def update_task(mission_id, order, patch, token, label):
    status, tasks = call("GET", f"/admin/missions/{mission_id}/tasks", token=token)
    task = next(t for t in tasks if t["order"] == order)
    body = dict(task)
    body.update(patch)
    must("PUT", f"/admin/tasks/{task['id']}", body, token, label)


TOKEN = login()

# ── 1. Mochi: agregar pista de respuesta en los dos mundos ──
mochi_pv = get_npc("pronoun_village", "Mochi", 2, 850, 450, TOKEN)
update_npc(mochi_pv, {
    "instructions": "Eres mochi hablas ingles, dile al usuario que hoy va a aprender los pronombres personales en ingles (I, you, he, she, it, we, they), preguntale 'Are you ready?'. Si el jugador no sabe que responder o pregunta que decir, sugierele frases simples como 'Sure', 'OK', 'Yes' o 'Let's go'. Completa la tarea si responde afirmativamente con cualquiera de esas opciones.",
}, TOKEN, "Mochi (pronoun_village): agregar pista de respuesta")

mochi_tv = get_npc("the_village", "Mochi", 2, 850, 450, TOKEN)
update_npc(mochi_tv, {
    "instructions": "Eres mochi hablas ingles dile al usuario que es el inicio de su viaje, que el debe hablar con los aldeanos, preguntale 'Are you ready?'. Si el jugador no sabe que responder, sugierele frases simples como 'Sure', 'OK', 'Yes' o 'Let's go'. Si contesta afirmativa puedes dar la tarea como completada.",
}, TOKEN, "Mochi (the_village): agregar pista de respuesta")

# ── 2. pronoun_village_2: de "posesivos" a "repaso de pronombres en la granja" ──
mission_pv2 = get_mission("pronoun_village_2", TOKEN)
update_mission(mission_pv2, {
    "title": "Pronombres en la Granja",
    "description_en": "Repasa los mismos pronombres personales, esta vez en la granja",
    "objective_en": "Vuelve a usar I, you, he, she, it, we, they en frases nuevas",
}, TOKEN, "mission pronoun_village_2: retitular a repaso")

pv2_npcs = [
    ("Joy", 9, 650, 1050,
        "Hi! I am so hungry right now.",
        "Eres Joy hablas ingles, repasa 'I' y 'you' (ya vistos en el pueblo) con frases nuevas de granja: pide al jugador 'I am hungry' y 'You are funny', completa la tarea cuando use ambos pronombres bien. No introduzcas gramatica nueva, es repaso.",
        "Great! Still I and you, just like before."),
    ("Ann", 4, 750, 650,
        "Hello! Do you see my brother over there?",
        "Eres Ann hablas ingles, repasa 'he' y 'she' con frases de familia: pide 'He is my brother' y 'She is my sister', completa la tarea cuando el jugador los use bien. Es repaso, no gramatica nueva.",
        "Exactly! He and she, same as always."),
    ("Sam", 1, 250, 650,
        "Hi, look at that chicken!",
        "Eres Sam hablas ingles, repasa 'it' con animales de granja: pide una frase como 'It is a chicken' o 'It is a cow', completa la tarea si el jugador la usa bien. Repaso, sin gramatica nueva.",
        "Right! It, for the animals."),
    ("Zoe", 11, 50, 250,
        "Hi! We work here every day.",
        "Eres Zoe hablas ingles, repasa 'we' con frases de granja: pide 'We are farmers' o 'We are tired', completa la tarea cuando el jugador la use bien. Repaso, sin gramatica nueva.",
        "Yes! We, just like in the village."),
    ("Tom", 6, 650, 150,
        "Hey! They are working in the field.",
        "Eres Tom hablas ingles, repasa 'they' con 'They are working' o 'They are farmers', y para completar la tarea pide un repaso final de los 7 pronombres (I, you, he, she, it, we, they) mencionando cada uno una vez mas.",
        "Awesome! All 7 pronouns again, well done!"),
]
for name, defid, x, y, greeting, instructions, success in pv2_npcs:
    row = get_npc("pronoun_village_2", name, defid, x, y, TOKEN)
    update_npc(row, {"greeting": greeting, "instructions": instructions, "success_message": success},
               TOKEN, f"{name} (pronoun_village_2): repaso en vez de posesivos")

pv2_tasks = [
    (1, "Repasa 'I' y 'you' con Joy"),
    (2, "Repasa 'he' y 'she' con Ann"),
    (3, "Repasa 'it' con Sam"),
    (4, "Repasa 'we' con Zoe"),
    (5, "Repasa 'they' con Tom"),
]
for order, desc in pv2_tasks:
    update_task(mission_pv2["id"], order, {"description_en": desc}, TOKEN, f"task pronoun_village_2#{order}: retitular")

# ── 3. pronoun_square: de "presente simple" a "repaso de pronombres en la plaza" ──
mission_ps = get_mission("pronoun_square", TOKEN)
update_mission(mission_ps, {
    "title": "Pronombres en la Plaza",
    "description_en": "Tercer repaso de los pronombres personales, ahora en la plaza del pueblo",
    "objective_en": "Repasa I, you, he, she, it, we, they por ultima vez antes del examen",
}, TOKEN, "mission pronoun_square: retitular a repaso")

ps_npcs = [
    ("Toro", 3, 550, 650,
        "Hello! I am walking, you are running!",
        "eres toro el perro hablas en ingles, repasa 'I' y 'you' con acciones: pide 'I am walking' y 'You are running', completa la tarea cuando el jugador los use bien. Repaso, no introduzcas gramatica nueva.",
        "Great! I and you, one more time."),
    ("Sam", 1, 850, 450,
        "Hi, he is reading and she is singing!",
        "Eres sam hablas ingles, repasa 'he' y 'she' con acciones: pide 'He is reading' y 'She is singing', completa la tarea cuando el jugador los use bien. Repaso, sin gramatica nueva.",
        "Exactly! He and she, well done."),
    ("Joy", 9, 50, 450,
        "Hello! Look, it is raining!",
        "Eres Joy hablas ingles, repasa 'it' con el clima: pide 'It is raining' o 'It is sunny', completa la tarea cuando el jugador la use bien. Repaso, sin gramatica nueva.",
        "Right! It, for the weather too."),
    ("Ann", 4, 50, 650,
        "Hey there! We are playing and they are dancing.",
        "Eres Ann hablas ingles, repasa 'we' y 'they' con 'We are playing' y 'They are dancing', completa la tarea cuando el jugador los use bien. Repaso, sin gramatica nueva.",
        "Perfect! We and they, got it."),
    ("Tom", 6, 850, 650,
        "What's up! Ready for the final review?",
        "Eres Tom hablas ingles, pide al jugador un repaso final usando los 7 pronombres (I, you, he, she, it, we, they) en una frase corta cada uno, completa la tarea cuando los mencione todos. Este es el cierre antes del examen del mundo.",
        "Amazing! You know all 7 pronouns by heart now!"),
]
for name, defid, x, y, greeting, instructions, success in ps_npcs:
    row = get_npc("pronoun_square", name, defid, x, y, TOKEN)
    update_npc(row, {"greeting": greeting, "instructions": instructions, "success_message": success},
               TOKEN, f"{name} (pronoun_square): repaso en vez de presente simple")

ps_tasks = [
    (1, "Repasa 'I' y 'you' con Toro"),
    (2, "Repasa 'he' y 'she' con Sam"),
    (3, "Repasa 'it' con Joy"),
    (4, "Repasa 'we' y 'they' con Ann"),
    (5, "Repaso final de los 7 pronombres con Tom"),
]
for order, desc in ps_tasks:
    update_task(mission_ps["id"], order, {"description_en": desc}, TOKEN, f"task pronoun_square#{order}: retitular")

# ── 4. Challenges: re-etiquetar lo que no es pronombre-sujeto puro ──
RETAG = {
    # pregunta -> nuevo tag (semilla de mundo futuro), se quita 'pronouns'/'final_mundo_2'
    "This is ___ book.": "possessive-pronouns",
    "Is this ___ pen?": "possessive-pronouns",
    "This is ___ car.": "possessive-pronouns",
    "That is ___ bag.": "possessive-pronouns",
    "The dog wagged ___ tail.": "possessive-pronouns",
    "This is ___ house.": "possessive-pronouns",
    "That is ___ farm.": "possessive-pronouns",
    "She ___ soccer every day.": "present-simple",
    "They ___ soccer every day.": "present-simple",
    "He ___ pizza.": "present-simple",
    "___ you like coffee?": "present-simple",
    "___ she like coffee?": "present-simple",
    "He doesn't ___ Mondays.": "present-simple",
    "This is Ana's book. It is ___ book.": "possessive-pronouns",
    "The birds built ___ nest in the tree.": "possessive-pronouns",
    "My dog loves ___ toy.": "possessive-pronouns",
    "That is not my pen, it is ___.": "possessive-pronouns",
    "___ we go to the beach together?": "present-simple",
    "He never ___ breakfast.": "present-simple",
    "I ___ horror movies.": "present-simple",
    "She ___ horror movies.": "present-simple",
}

status, allChallenges = call("GET", "/admin/challenges", token=TOKEN)
byQuestion = {c["question"]: c for c in allChallenges} if status == 200 else {}

for question, newTag in RETAG.items():
    c = byQuestion.get(question)
    if not c:
        print(f"[warn] challenge no encontrado para re-etiquetar: {question!r}")
        continue
    if c["tags"] == [newTag]:
        print(f"[skip] ya re-etiquetado: {question!r}")
        continue
    body = dict(c)
    body["tags"] = [newTag]
    must("PUT", f"/admin/challenges/{c['id']}", body, TOKEN, f"retag -> {newTag}: {question[:40]}")

# ── 5. Nuevas preguntas puras de pronombre-sujeto (para no vaciar el pool) ──
new_pool = [
    ("___ am hungry right now.", "I", "He", "They", 1, "___ tengo hambre ahora.", "'I' para hablar de uno mismo.", "pronouns"),
    ("___ is my best friend.", "She", "They", "We", 1, "___ es mi mejor amiga.", "'She' para una mujer.", "pronouns"),
    ("___ are from Canada.", "It", "They", "He", 2, "___ son de Canada.", "'They' para varias personas.", "pronouns"),
    ("Look at the sky, ___ is so blue today.", "It", "He", "You", 1, "Mira el cielo, ___ esta muy azul hoy.", "'It' para cosas/fenomenos, no personas.", "pronouns"),
    ("___ are late for class!", "We", "He", "It", 1, "___ llegamos tarde a clase!", "'We' incluye al hablante.", "pronouns"),
    ("___ is reading a book.", "He", "They", "I", 1, "___ esta leyendo un libro.", "'He' para un hombre.", "pronouns"),
    ("Where are ___ from?", "you", "it", "he", 1, "De donde eres ___?", "'You' para hablarle a alguien.", "pronouns"),
    ("___ is a very old city.", "It", "You", "We", 1, "___ es una ciudad muy antigua.", "'It' para lugares/cosas.", "pronouns"),

    ("___ am not ready yet.", "I", "He", "They", 1, "___ no estoy listo todavia.", "'I' para uno mismo.", "final_mundo_2"),
    ("___ is the captain of the team.", "She", "You", "We", 1, "___ es la capitana del equipo.", "'She' para una mujer.", "final_mundo_2"),
    ("___ are best friends since childhood.", "It", "They", "He", 2, "___ son mejores amigos desde la infancia.", "'They' para varias personas.", "final_mundo_2"),
    ("Careful, ___ is very hot!", "it", "you", "we", 1, "Cuidado, ___ esta muy caliente!", "'It' para objetos/cosas.", "final_mundo_2"),
    ("___ are proud of you.", "We", "It", "He", 1, "___ estamos orgullosos de ti.", "'We' incluye al hablante.", "final_mundo_2"),
    ("___ is my neighbor.", "He", "They", "It", 1, "___ es mi vecino.", "'He' para un hombre.", "final_mundo_2"),
    ("Excuse me, where are ___ going?", "you", "it", "he", 1, "Disculpa, a donde vas ___?", "'You' para hablarle a alguien.", "final_mundo_2"),
    ("___ is a beautiful country.", "It", "You", "We", 1, "___ es un pais hermoso.", "'It' para lugares.", "final_mundo_2"),
]

status, existingChallenges = call("GET", "/admin/challenges", token=TOKEN)
existingQuestions = {c["question"] for c in existingChallenges} if status == 200 else set()

added = 0
for q, o1, o2, o3, correct, qES, expES, tag in new_pool:
    if q in existingQuestions:
        print(f"[skip] challenge ya existe: {q!r}")
        continue
    body = {
        "type": "grammar", "question": q, "option_1": o1, "option_2": o2, "option_3": o3,
        "correct_option": correct, "explanation_es": expES, "question_es": qES,
        "tags": [tag], "difficulty": "beginner", "language_learning": "english",
    }
    must("POST", "/admin/challenges", body, TOKEN, f"new challenge {q[:30]}")
    added += 1
print(f"[ok] {added} challenges nuevos de pronombre-sujeto agregados")

# ── 6. World 2: descripcion mas precisa del alcance ──
status, worlds = call("GET", "/admin/worlds", token=TOKEN)
mundo2 = next(w for w in worlds if w["key"] == "mundo_2")
body = dict(mundo2)
body["description_en"] = "A world entirely about personal (subject) pronouns -- I, you, he, she, it, we, they -- reinforced through repetition across three different everyday contexts."
must("PUT", f"/admin/worlds/{mundo2['id']}", body, TOKEN, "mundo_2: descripcion actualizada")

# ── verificacion ──
status, health = call("GET", f"/admin/worlds/{mundo2['id']}/pool-health", token=TOKEN)
print("\nmundo_2 pool-health tras el ajuste:", health)
