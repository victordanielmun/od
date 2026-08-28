"""
Mundo 11: Presente Simple (negativo) -- 20 challenges normales (tag
'present-simple-negative') + 10 de examen (tag 'final_mundo_11'). Foco:
elegir 'don't' vs 'doesn't' y la forma base del verbo despues de negar.

Uso:
    python mundo11_presente_negativo_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ play soccer.", "don't", "doesn't", "not", 1, "Yo no ___ futbol.", "Con 'I' se usa 'don't'.", "present-simple-negative"),
    ("He ___ play soccer.", "don't", "doesn't", "not", 2, "El no ___ futbol.", "Con 'he' se usa 'doesn't'.", "present-simple-negative"),
    ("You ___ like pizza.", "don't", "doesn't", "not", 1, "A ti no te ___ la pizza.", "Con 'you' se usa 'don't'.", "present-simple-negative"),
    ("She ___ like pizza.", "don't", "doesn't", "not", 2, "A ella no le ___ la pizza.", "Con 'she' se usa 'doesn't'.", "present-simple-negative"),
    ("We ___ work here.", "don't", "doesn't", "not", 1, "Nosotros no ___ aqui.", "Con 'we' se usa 'don't'.", "present-simple-negative"),
    ("It ___ work well.", "don't", "doesn't", "not", 2, "No funciona bien.", "Con 'it' se usa 'doesn't'.", "present-simple-negative"),
    ("They ___ live nearby.", "don't", "doesn't", "not", 1, "Ellos no ___ cerca.", "Con 'they' se usa 'don't'.", "present-simple-negative"),
    ("He doesn't ___ soccer. (play)", "play", "plays", "playing", 1, "El no juega futbol. (play)", "Despues de 'doesn't', el verbo vuelve a su forma base.", "present-simple-negative"),
    ("She doesn't ___ pizza. (like)", "like", "likes", "liking", 1, "A ella no le gusta la pizza. (like)", "Despues de 'doesn't', forma base.", "present-simple-negative"),
    ("It doesn't ___ well. (work)", "work", "works", "working", 1, "No funciona bien. (work)", "Despues de 'doesn't', forma base.", "present-simple-negative"),
    ("She ___ eat breakfast.", "don't", "doesn't", "not", 2, "Ella no desayuna.", "Con 'she' se usa 'doesn't'.", "present-simple-negative"),
    ("I ___ eat breakfast.", "don't", "doesn't", "not", 1, "Yo no desayuno.", "Con 'I' se usa 'don't'.", "present-simple-negative"),
    ("You ___ play soccer.", "don't", "doesn't", "not", 1, "Tu no juegas futbol.", "Con 'you' se usa 'don't'.", "present-simple-negative"),
    ("He doesn't ___ nearby. (live)", "live", "lives", "living", 1, "El no vive cerca. (live)", "Despues de 'doesn't', forma base.", "present-simple-negative"),
    ("They ___ work here.", "don't", "doesn't", "not", 1, "Ellos no trabajan aqui.", "Con 'they' se usa 'don't'.", "present-simple-negative"),
    ("She ___ work well.", "don't", "doesn't", "not", 2, "Ella no trabaja bien.", "Con 'she' se usa 'doesn't'.", "present-simple-negative"),
    ("We ___ like pizza.", "don't", "doesn't", "not", 1, "A nosotros no nos gusta la pizza.", "Con 'we' se usa 'don't'.", "present-simple-negative"),
    ("He ___ like pizza.", "don't", "doesn't", "not", 2, "A el no le gusta la pizza.", "Con 'he' se usa 'doesn't'.", "present-simple-negative"),
    ("You ___ eat breakfast.", "don't", "doesn't", "not", 1, "Tu no desayunas.", "Con 'you' se usa 'don't'.", "present-simple-negative"),
    ("He ___ eat breakfast.", "don't", "doesn't", "not", 2, "El no desayuna.", "Con 'he' se usa 'doesn't'.", "present-simple-negative"),

    ("We ___ play soccer.", "don't", "doesn't", "not", 1, "Nosotros no jugamos futbol.", "Con 'we' se usa 'don't'.", "final_mundo_11"),
    ("It ___ play well. (the team)", "don't", "doesn't", "not", 2, "El equipo no juega bien.", "Con 'it' se usa 'doesn't'.", "final_mundo_11"),
    ("They ___ like pizza.", "don't", "doesn't", "not", 1, "A ellos no les gusta la pizza.", "Con 'they' se usa 'don't'.", "final_mundo_11"),
    ("He doesn't ___ well. (work)", "work", "works", "working", 1, "El no trabaja bien. (work)", "Despues de 'doesn't', forma base.", "final_mundo_11"),
    ("I ___ work here.", "don't", "doesn't", "not", 1, "Yo no trabajo aqui.", "Con 'I' se usa 'don't'.", "final_mundo_11"),
    ("She ___ live nearby.", "don't", "doesn't", "not", 2, "Ella no vive cerca.", "Con 'she' se usa 'doesn't'.", "final_mundo_11"),
    ("You ___ live nearby.", "don't", "doesn't", "not", 1, "Tu no vives cerca.", "Con 'you' se usa 'don't'.", "final_mundo_11"),
    ("She doesn't ___ nearby. (live)", "live", "lives", "living", 1, "Ella no vive cerca. (live)", "Despues de 'doesn't', forma base.", "final_mundo_11"),
    ("We ___ eat breakfast.", "don't", "doesn't", "not", 1, "Nosotros no desayunamos.", "Con 'we' se usa 'don't'.", "final_mundo_11"),
    ("It ___ eat breakfast. (the cat)", "don't", "doesn't", "not", 2, "El gato no desayuna.", "Con 'it' se usa 'doesn't'.", "final_mundo_11"),
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
