"""
Mundo 25: Pasado Simple (negativo) -- 20 challenges normales (tag
'past-simple-negative') + 10 de examen (tag 'final_mundo_25'). Foco:
'didn't' + verbo base (nunca 'didn't played').

Uso:
    python mundo25_pasado_negativo_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ play soccer yesterday.", "didn't", "doesn't", "wasn't", 1, "Yo no ___ futbol ayer.", "'Didn't' para negar en pasado.", "past-simple-negative"),
    ("You ___ work yesterday.", "didn't", "doesn't", "wasn't", 1, "Tu no ___ ayer.", "'Didn't' para negar en pasado.", "past-simple-negative"),
    ("He ___ walk to school.", "didn't", "doesn't", "wasn't", 1, "El no ___ a la escuela.", "'Didn't' no cambia con 'he'.", "past-simple-negative"),
    ("She ___ watch a movie.", "didn't", "doesn't", "wasn't", 1, "Ella no ___ una pelicula.", "'Didn't' no cambia con 'she'.", "past-simple-negative"),
    ("I didn't ___ soccer. (play, not played)", "play", "played", "plays", 1, "Yo no jugue futbol. (forma base)", "Despues de 'didn't', forma base.", "past-simple-negative"),
    ("She didn't ___ a movie. (watch, not watched)", "watch", "watched", "watches", 1, "Ella no vio una pelicula. (forma base)", "Despues de 'didn't', forma base.", "past-simple-negative"),
    ("They didn't ___ all night. (dance, not danced)", "dance", "danced", "dances", 1, "Ellos no bailaron toda la noche. (forma base)", "Despues de 'didn't', forma base.", "past-simple-negative"),
    ("We ___ cook dinner.", "didn't", "doesn't", "wasn't", 1, "Nosotros no ___ la cena.", "'Didn't' para negar en pasado.", "past-simple-negative"),
    ("He ___ jump over the fence.", "didn't", "doesn't", "wasn't", 1, "El no ___ la cerca.", "'Didn't' no cambia con 'he'.", "past-simple-negative"),
    ("She ___ climb the mountain.", "didn't", "doesn't", "wasn't", 1, "Ella no ___ la montaña.", "'Didn't' no cambia con 'she'.", "past-simple-negative"),
    ("I ___ clean my room.", "didn't", "doesn't", "wasn't", 1, "Yo no ___ mi cuarto.", "'Didn't' para negar en pasado.", "past-simple-negative"),
    ("He didn't ___ over the fence. (jump, not jumped)", "jump", "jumped", "jumps", 1, "El no salto la cerca. (forma base)", "Despues de 'didn't', forma base.", "past-simple-negative"),
    ("She didn't ___ the mountain. (climb, not climbed)", "climb", "climbed", "climbs", 1, "Ella no escalo la montaña. (forma base)", "Despues de 'didn't', forma base.", "past-simple-negative"),
    ("I played soccer, but I ___ play tennis.", "didn't", "wasn't", "isn't", 1, "Jugue futbol, pero no ___ tenis.", "'Didn't' para contrastar.", "past-simple-negative"),
    ("He worked yesterday, but he ___ cook dinner.", "didn't", "wasn't", "isn't", 1, "El trabajo ayer, pero no ___ la cena.", "'Didn't' para contrastar.", "past-simple-negative"),
    ("Did you play soccer? No, I ___.", "didn't", "wasn't", "don't", 1, "Jugaste futbol? No.", "Respuesta corta negativa con 'didn't'.", "past-simple-negative"),
    ("Did he cook dinner? No, he ___.", "didn't", "wasn't", "doesn't", 1, "El cocino la cena? No.", "Respuesta corta negativa con 'didn't'.", "past-simple-negative"),
    ("We ___ dance all night.", "didn't", "doesn't", "wasn't", 1, "Nosotros no ___ toda la noche.", "'Didn't' para negar en pasado.", "past-simple-negative"),
    ("They ___ clean their room.", "didn't", "doesn't", "wasn't", 1, "Ellos no ___ su cuarto.", "'Didn't' para negar en pasado.", "past-simple-negative"),
    ("We didn't ___ dinner. (cook, not cooked)", "cook", "cooked", "cooks", 1, "No cocinamos la cena. (forma base)", "Despues de 'didn't', forma base.", "past-simple-negative"),

    ("You ___ walk to school.", "didn't", "doesn't", "wasn't", 1, "Tu no ___ a la escuela.", "'Didn't' para negar en pasado.", "final_mundo_25"),
    ("They ___ watch a movie.", "didn't", "doesn't", "wasn't", 1, "Ellos no ___ una pelicula.", "'Didn't' para negar en pasado.", "final_mundo_25"),
    ("He didn't ___ soccer. (play, not played)", "play", "played", "plays", 1, "El no jugo futbol. (forma base)", "Despues de 'didn't', forma base.", "final_mundo_25"),
    ("She ___ dance all night.", "didn't", "doesn't", "wasn't", 1, "Ella no ___ toda la noche.", "'Didn't' no cambia con 'she'.", "final_mundo_25"),
    ("We ___ climb the mountain.", "didn't", "doesn't", "wasn't", 1, "Nosotros no ___ la montaña.", "'Didn't' para negar en pasado.", "final_mundo_25"),
    ("You didn't ___ your room. (clean, not cleaned)", "clean", "cleaned", "cleans", 1, "No limpiaste tu cuarto. (forma base)", "Despues de 'didn't', forma base.", "final_mundo_25"),
    ("Did she work yesterday? No, she ___.", "didn't", "wasn't", "doesn't", 1, "Ella trabajo ayer? No.", "Respuesta corta negativa con 'didn't'.", "final_mundo_25"),
    ("Did they dance all night? No, they ___.", "didn't", "wasn't", "don't", 1, "Bailaron toda la noche? No.", "Respuesta corta negativa con 'didn't'.", "final_mundo_25"),
    ("She climbed the mountain, but she ___ jump.", "didn't", "wasn't", "isn't", 1, "Ella escalo la montaña, pero no ___.", "'Didn't' para contrastar.", "final_mundo_25"),
    ("It ___ jump over the fence. (the dog)", "didn't", "doesn't", "wasn't", 1, "El perro no ___ la cerca.", "'Didn't' para negar en pasado.", "final_mundo_25"),
]

status, existingChallenges = call("GET", "/admin/challenges", token=TOKEN)
existingByQT = set()
if status == 200 and isinstance(existingChallenges, list):
    existingByQT = {(c["question"], tuple(c.get("tags", []))) for c in existingChallenges}

added = 0
for q, o1, o2, o3, correct, qES, expES, tag in challenges:
    if (q, (tag,)) in existingByQT:
        print(f"[skip] challenge ya existe: {q!r} ({tag})")
        continue
    body = {
        "type": "grammar", "question": q, "option_1": o1, "option_2": o2, "option_3": o3,
        "correct_option": correct, "explanation_es": expES, "question_es": qES,
        "tags": [tag], "difficulty": "beginner", "language_learning": "english",
    }
    must("POST", "/admin/challenges", body, TOKEN, f"challenge [{tag}] {q[:30]}")
    added += 1

print(f"\n[ok] {added} challenges nuevos agregados")
