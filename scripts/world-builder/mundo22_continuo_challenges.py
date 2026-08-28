"""
Mundo 22: Presente Continuo -- 20 challenges normales (tag
'present-continuous') + 10 de examen (tag 'final_mundo_22'). Foco:
am/is/are + verbo-ing, y contraste con presente simple.

Uso:
    python mundo22_continuo_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ playing. (am)", "am", "is", "are", 1, "Yo ___ jugando. (am)", "Con 'I' se usa 'am'.", "present-continuous"),
    ("You ___ working. (are)", "am", "is", "are", 3, "Tu ___ trabajando. (are)", "Con 'you' se usa 'are'.", "present-continuous"),
    ("We ___ eating. (are)", "am", "is", "are", 3, "Nosotros ___ comiendo. (are)", "Con 'we' se usa 'are'.", "present-continuous"),
    ("They ___ reading. (are)", "am", "is", "are", 3, "Ellos ___ leyendo. (are)", "Con 'they' se usa 'are'.", "present-continuous"),
    ("He ___ playing. (is)", "am", "is", "are", 2, "El ___ jugando. (is)", "Con 'he' se usa 'is'.", "present-continuous"),
    ("She ___ working. (is)", "am", "is", "are", 2, "Ella ___ trabajando. (is)", "Con 'she' se usa 'is'.", "present-continuous"),
    ("It ___ raining. (is)", "am", "is", "are", 2, "___ lloviendo. (is)", "Con 'it' se usa 'is'.", "present-continuous"),
    ("I am play___. (playing)", "playing", "plays", "played", 1, "Yo estoy jug___. (playing)", "Presente continuo: verbo + -ing.", "present-continuous"),
    ("She is work___. (working)", "working", "works", "worked", 1, "Ella esta trabaj___. (working)", "Presente continuo: verbo + -ing.", "present-continuous"),
    ("He is eat___. (eating)", "eating", "eats", "ate", 1, "El esta com___. (eating)", "Presente continuo: verbo + -ing.", "present-continuous"),
    ("They are read___. (reading)", "reading", "reads", "read", 1, "Ellos estan ley___. (reading)", "Presente continuo: verbo + -ing.", "present-continuous"),
    ("I play soccer every day. (routine, present simple)", "play", "am playing", "plays", 1, "Yo juego futbol todos los dias. (rutina)", "Presente simple para rutinas.", "present-continuous"),
    ("I ___ soccer right now. (am playing)", "play", "am playing", "plays", 2, "Yo ___ futbol ahora mismo. (am playing)", "Presente continuo para AHORA.", "present-continuous"),
    ("He ___ working right now. (is)", "am", "is", "are", 2, "El ___ trabajando ahora mismo.", "Con 'he' se usa 'is'.", "present-continuous"),
    ("We ___ eating right now. (are)", "am", "is", "are", 3, "Nosotros ___ comiendo ahora mismo.", "Con 'we' se usa 'are'.", "present-continuous"),
    ("You ___ reading right now. (are)", "am", "is", "are", 3, "Tu ___ leyendo ahora mismo.", "Con 'you' se usa 'are'.", "present-continuous"),
    ("It is raining, not ___ every day. (it rains)", "it rains", "it raining", "it rain", 1, "Esta lloviendo, no ___ todos los dias.", "Presente simple para rutinas.", "present-continuous"),
    ("She ___ reading right now. (is)", "am", "is", "are", 2, "Ella ___ leyendo ahora mismo.", "Con 'she' se usa 'is'.", "present-continuous"),
    ("They ___ playing right now. (are)", "am", "is", "are", 3, "Ellos ___ jugando ahora mismo.", "Con 'they' se usa 'are'.", "present-continuous"),
    ("I ___ eating right now. (am)", "am", "is", "are", 1, "Yo ___ comiendo ahora mismo.", "Con 'I' se usa 'am'.", "present-continuous"),

    ("You ___ playing right now. (are)", "am", "is", "are", 3, "Tu ___ jugando ahora mismo.", "Con 'you' se usa 'are'.", "final_mundo_22"),
    ("He ___ reading right now. (is)", "am", "is", "are", 2, "El ___ leyendo ahora mismo.", "Con 'he' se usa 'is'.", "final_mundo_22"),
    ("We ___ working right now. (are)", "am", "is", "are", 3, "Nosotros ___ trabajando ahora mismo.", "Con 'we' se usa 'are'.", "final_mundo_22"),
    ("She ___ eating right now. (is)", "am", "is", "are", 2, "Ella ___ comiendo ahora mismo.", "Con 'she' se usa 'is'.", "final_mundo_22"),
    ("They ___ working right now. (are)", "am", "is", "are", 3, "Ellos ___ trabajando ahora mismo.", "Con 'they' se usa 'are'.", "final_mundo_22"),
    ("We are play___. (playing)", "playing", "plays", "played", 1, "Nosotros estamos jug___. (playing)", "Presente continuo: verbo + -ing.", "final_mundo_22"),
    ("I am read___. (reading)", "reading", "reads", "read", 1, "Yo estoy ley___. (reading)", "Presente continuo: verbo + -ing.", "final_mundo_22"),
    ("You are eat___. (eating)", "eating", "eats", "ate", 1, "Tu estas com___. (eating)", "Presente continuo: verbo + -ing.", "final_mundo_22"),
    ("He works every day. (routine, present simple)", "works", "is working", "working", 1, "El trabaja todos los dias. (rutina)", "Presente simple para rutinas.", "final_mundo_22"),
    ("He ___ right now. (is working)", "works", "is working", "working", 2, "El ___ ahora mismo. (is working)", "Presente continuo para AHORA.", "final_mundo_22"),
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
