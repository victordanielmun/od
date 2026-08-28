"""
Mundo 10: Presente Simple (afirmativo) -- 20 challenges normales (tag
'present-simple-affirmative') + 10 de examen (tag 'final_mundo_10').
Foco: elegir la forma base vs la forma -s segun el sujeto.

Uso:
    python mundo10_presente_afirmativo_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ soccer. (play)", "play", "plays", "playing", 1, "Yo ___ futbol. (play)", "Con 'I' se usa la forma base, sin -s.", "present-simple-affirmative"),
    ("He ___ soccer. (play)", "play", "plays", "playing", 2, "El ___ futbol. (play)", "Con 'he' se agrega -s.", "present-simple-affirmative"),
    ("You ___ pizza. (like)", "like", "likes", "liking", 1, "A ti te ___ la pizza. (like)", "Con 'you' se usa la forma base.", "present-simple-affirmative"),
    ("She ___ pizza. (like)", "like", "likes", "liking", 2, "A ella le ___ la pizza. (like)", "Con 'she' se agrega -s.", "present-simple-affirmative"),
    ("We ___ here. (work)", "work", "works", "working", 1, "Nosotros ___ aqui. (work)", "Con 'we' se usa la forma base.", "present-simple-affirmative"),
    ("It ___ well. (work)", "work", "works", "working", 2, "Funciona bien. (work)", "Con 'it' se agrega -s.", "present-simple-affirmative"),
    ("They ___ nearby. (live)", "live", "lives", "living", 1, "Ellos ___ cerca. (live)", "Con 'they' se usa la forma base.", "present-simple-affirmative"),
    ("He ___ nearby. (live)", "live", "lives", "living", 2, "El ___ cerca. (live)", "Con 'he' se agrega -s.", "present-simple-affirmative"),
    ("She ___ breakfast. (eat)", "eat", "eats", "eating", 2, "Ella ___ el desayuno. (eat)", "Con 'she' se agrega -s.", "present-simple-affirmative"),
    ("I ___ breakfast. (eat)", "eat", "eats", "eating", 1, "Yo ___ el desayuno. (eat)", "Con 'I' se usa la forma base.", "present-simple-affirmative"),
    ("You ___ soccer. (play)", "play", "plays", "playing", 1, "Tu ___ futbol. (play)", "Con 'you' se usa la forma base.", "present-simple-affirmative"),
    ("She ___ soccer. (play)", "play", "plays", "playing", 2, "Ella ___ futbol. (play)", "Con 'she' se agrega -s.", "present-simple-affirmative"),
    ("We ___ pizza. (like)", "like", "likes", "liking", 1, "A nosotros nos ___ la pizza. (like)", "Con 'we' se usa la forma base.", "present-simple-affirmative"),
    ("He ___ pizza. (like)", "like", "likes", "liking", 2, "A el le ___ la pizza. (like)", "Con 'he' se agrega -s.", "present-simple-affirmative"),
    ("They ___ here. (work)", "work", "works", "working", 1, "Ellos ___ aqui. (work)", "Con 'they' se usa la forma base.", "present-simple-affirmative"),
    ("She ___ well. (work)", "work", "works", "working", 2, "Ella ___ bien. (work)", "Con 'she' se agrega -s.", "present-simple-affirmative"),
    ("I ___ nearby. (live)", "live", "lives", "living", 1, "Yo ___ cerca. (live)", "Con 'I' se usa la forma base.", "present-simple-affirmative"),
    ("It ___ nearby. (live, the shop)", "live", "lives", "living", 2, "Queda cerca. (live)", "Con 'it' se agrega -s.", "present-simple-affirmative"),
    ("You ___ breakfast. (eat)", "eat", "eats", "eating", 1, "Tu ___ el desayuno. (eat)", "Con 'you' se usa la forma base.", "present-simple-affirmative"),
    ("He ___ breakfast. (eat)", "eat", "eats", "eating", 2, "El ___ el desayuno. (eat)", "Con 'he' se agrega -s.", "present-simple-affirmative"),

    ("We ___ soccer. (play)", "play", "plays", "playing", 1, "Nosotros ___ futbol. (play)", "Con 'we' se usa la forma base.", "final_mundo_10"),
    ("It ___ soccer. (play, the team)", "play", "plays", "playing", 2, "El equipo ___ futbol. (play)", "Con 'it' se agrega -s.", "final_mundo_10"),
    ("They ___ pizza. (like)", "like", "likes", "liking", 1, "A ellos les ___ la pizza. (like)", "Con 'they' se usa la forma base.", "final_mundo_10"),
    ("He ___ pizza. (like)", "like", "likes", "liking", 2, "A el le ___ la pizza. (like)", "Con 'he' se agrega -s.", "final_mundo_10"),
    ("I ___ here. (work)", "work", "works", "working", 1, "Yo ___ aqui. (work)", "Con 'I' se usa la forma base.", "final_mundo_10"),
    ("She ___ here. (work)", "work", "works", "working", 2, "Ella ___ aqui. (work)", "Con 'she' se agrega -s.", "final_mundo_10"),
    ("You ___ nearby. (live)", "live", "lives", "living", 1, "Tu ___ cerca. (live)", "Con 'you' se usa la forma base.", "final_mundo_10"),
    ("She ___ nearby. (live)", "live", "lives", "living", 2, "Ella ___ cerca. (live)", "Con 'she' se agrega -s.", "final_mundo_10"),
    ("We ___ breakfast. (eat)", "eat", "eats", "eating", 1, "Nosotros ___ el desayuno. (eat)", "Con 'we' se usa la forma base.", "final_mundo_10"),
    ("It ___ breakfast. (eat, the cat)", "eat", "eats", "eating", 2, "El gato ___ el desayuno. (eat)", "Con 'it' se agrega -s.", "final_mundo_10"),
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
