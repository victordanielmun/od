"""
Mundo 3: "Yo soy..." -- learning_challenges: 20 normales (tag 'to-be-i-am')
+ 10 de examen (tag 'final_mundo_3'). Foco: am/is/are segun el sujeto, y
a/an segun si la profesion empieza con sonido de vocal.

Uso:
    python mundo3_iam_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ a farmer.", "am", "is", "are", 1, "Yo ___ granjero.", "'Am' se usa con 'I'.", "to-be-i-am"),
    ("You ___ a teacher.", "am", "is", "are", 3, "Tu ___ maestro.", "'Are' se usa con 'you'.", "to-be-i-am"),
    ("He ___ a doctor.", "am", "is", "are", 2, "El ___ doctor.", "'Is' se usa con 'he'.", "to-be-i-am"),
    ("She ___ a nurse.", "am", "is", "are", 2, "Ella ___ enfermera.", "'Is' se usa con 'she'.", "to-be-i-am"),
    ("It ___ a good dog.", "am", "is", "are", 2, "___ un buen perro.", "'Is' se usa con 'it'.", "to-be-i-am"),
    ("We ___ students.", "am", "is", "are", 3, "Nosotros ___ estudiantes.", "'Are' se usa con 'we'.", "to-be-i-am"),
    ("They ___ farmers.", "am", "is", "are", 3, "Ellos ___ granjeros.", "'Are' se usa con 'they'.", "to-be-i-am"),
    ("I am ___ artist.", "a", "an", "the", 2, "Soy ___ artista.", "'An' antes de sonido de vocal (artist).", "to-be-i-am"),
    ("I am ___ doctor.", "a", "an", "the", 1, "Soy ___ doctor.", "'A' antes de sonido de consonante (doctor).", "to-be-i-am"),
    ("She is ___ nurse.", "a", "an", "the", 1, "Ella es ___ enfermera.", "'A' antes de consonante (nurse).", "to-be-i-am"),
    ("He is ___ artist.", "a", "an", "the", 2, "El es ___ artista.", "'An' antes de vocal (artist).", "to-be-i-am"),
    ("I am ___ engineer.", "a", "an", "the", 2, "Soy ___ ingeniero.", "'An' antes de vocal (engineer).", "to-be-i-am"),
    ("I am ___ chef.", "a", "an", "the", 1, "Soy ___ cocinero.", "'A' antes de consonante (chef).", "to-be-i-am"),
    ("___ you a student?", "Am", "Are", "Is", 2, "___ eres estudiante?", "'Are' para preguntar con 'you'.", "to-be-i-am"),
    ("___ he a driver?", "Am", "Is", "Are", 2, "___ el es conductor?", "'Is' para preguntar con 'he'.", "to-be-i-am"),
    ("My father ___ a police officer.", "am", "is", "are", 2, "Mi papa ___ policia.", "'Is' con sujeto singular (my father).", "to-be-i-am"),
    ("My friends ___ students.", "am", "is", "are", 3, "Mis amigos ___ estudiantes.", "'Are' con sujeto plural.", "to-be-i-am"),
    ("I am not a doctor, I ___ a teacher.", "am", "is", "are", 1, "No soy doctor, ___ maestro.", "'Am' se usa con 'I'.", "to-be-i-am"),
    ("She is not a nurse, she ___ a chef.", "am", "is", "are", 2, "Ella no es enfermera, ___ cocinera.", "'Is' se usa con 'she'.", "to-be-i-am"),
    ("I am ___ actor.", "a", "an", "the", 2, "Soy ___ actor.", "'An' antes de vocal (actor).", "to-be-i-am"),

    ("I ___ a teacher.", "am", "is", "are", 1, "Yo ___ maestro.", "'Am' se usa con 'I'.", "final_mundo_3"),
    ("He ___ a farmer.", "am", "is", "are", 2, "El ___ granjero.", "'Is' se usa con 'he'.", "final_mundo_3"),
    ("They ___ doctors.", "am", "is", "are", 3, "Ellos ___ doctores.", "'Are' se usa con 'they'.", "final_mundo_3"),
    ("I am ___ artist.", "a", "an", "the", 2, "Soy ___ artista.", "'An' antes de vocal.", "final_mundo_3"),
    ("She is ___ nurse.", "a", "an", "the", 1, "Ella es ___ enfermera.", "'A' antes de consonante.", "final_mundo_3"),
    ("___ they students?", "Am", "Are", "Is", 2, "___ ellos son estudiantes?", "'Are' con 'they'.", "final_mundo_3"),
    ("My mom ___ a chef.", "am", "is", "are", 2, "Mi mama ___ cocinera.", "'Is' con sujeto singular.", "final_mundo_3"),
    ("We ___ drivers.", "am", "is", "are", 3, "Nosotros ___ conductores.", "'Are' se usa con 'we'.", "final_mundo_3"),
    ("I am ___ engineer.", "a", "an", "the", 2, "Soy ___ ingeniero.", "'An' antes de vocal.", "final_mundo_3"),
    ("He is not a driver, he ___ a police officer.", "am", "is", "are", 2, "El no es conductor, ___ policia.", "'Is' se usa con 'he'.", "final_mundo_3"),
]

status, existingChallenges = call("GET", "/admin/challenges", token=TOKEN)
existingQuestions = set()
if status == 200 and isinstance(existingChallenges, list):
    existingQuestions = {c["question"] for c in existingChallenges}

added = 0
for q, o1, o2, o3, correct, qES, expES, tag in challenges:
    if q in existingQuestions and tag in [t for c in existingChallenges if c["question"] == q for t in c.get("tags", [])]:
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
