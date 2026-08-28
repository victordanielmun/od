"""
Mundo 6: "No soy / No es..." -- 20 challenges normales
(tag 'to-be-negative') + 10 de examen (tag 'final_mundo_6'). Foco:
am not / isn't / aren't segun el sujeto.

Uso:
    python mundo6_negative_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ a farmer.", "am not", "isn't", "aren't", 1, "Yo no soy granjero.", "'Am not' con 'I' (no existe 'amn't').", "to-be-negative"),
    ("You ___ a teacher.", "am not", "isn't", "aren't", 3, "Tu no eres maestro.", "'Aren't' con 'you'.", "to-be-negative"),
    ("He ___ a doctor.", "am not", "isn't", "aren't", 2, "El no es doctor.", "'Isn't' con 'he'.", "to-be-negative"),
    ("She ___ a nurse.", "am not", "isn't", "aren't", 2, "Ella no es enfermera.", "'Isn't' con 'she'.", "to-be-negative"),
    ("It ___ a big house.", "am not", "isn't", "aren't", 2, "No es una casa grande.", "'Isn't' con 'it'.", "to-be-negative"),
    ("They ___ students.", "am not", "isn't", "aren't", 3, "Ellos no son estudiantes.", "'Aren't' con 'they'.", "to-be-negative"),
    ("We ___ farmers.", "am not", "isn't", "aren't", 3, "Nosotros no somos granjeros.", "'Aren't' con 'we'.", "to-be-negative"),
    ("I'm not a chef, I ___ a nurse.", "am", "is", "are", 1, "No soy cocinero, ___ enfermero.", "'Am' se usa con 'I'.", "to-be-negative"),
    ("He isn't a driver, he ___ an artist.", "am", "is", "are", 2, "El no es conductor, ___ artista.", "'Is' se usa con 'he'.", "to-be-negative"),
    ("You aren't a police officer, you ___ a chef.", "am", "is", "are", 3, "Tu no eres policia, ___ cocinero.", "'Are' se usa con 'you'.", "to-be-negative"),
    ("She ___ a driver, she is an artist.", "am not", "isn't", "aren't", 2, "Ella no es conductora, es artista.", "'Isn't' con 'she'.", "to-be-negative"),
    ("I am a teacher, ___ a doctor.", "I'm not", "you aren't", "he isn't", 1, "Soy maestro, no soy doctor.", "'I'm not' contrasta con 'I am'.", "to-be-negative"),
    ("He is a farmer, ___ a chef.", "I'm not", "he isn't", "you aren't", 2, "El es granjero, no es cocinero.", "'He isn't' contrasta con 'he is'.", "to-be-negative"),
    ("You are a student, ___ a teacher.", "I'm not", "you aren't", "he isn't", 2, "Eres estudiante, no eres maestro.", "'You aren't' contrasta con 'you are'.", "to-be-negative"),
    ("___ you a farmer? No, I'm not.", "Am", "Is", "Are", 3, "___ eres granjero? No, no lo soy.", "'Are' para preguntar con 'you'.", "to-be-negative"),
    ("___ he a nurse? No, he isn't.", "Am", "Is", "Are", 2, "___ el es enfermero? No, no lo es.", "'Is' para preguntar con 'he'.", "to-be-negative"),
    ("My brother ___ a doctor, he is a driver.", "am not", "isn't", "aren't", 2, "Mi hermano no es doctor, es conductor.", "'Isn't' con sujeto singular.", "to-be-negative"),
    ("My friends ___ farmers, they are teachers.", "am not", "isn't", "aren't", 3, "Mis amigos no son granjeros, son maestros.", "'Aren't' con sujeto plural.", "to-be-negative"),
    ("It ___ a small cat, it is a big dog.", "am not", "isn't", "aren't", 2, "No es un gato pequeno, es un perro grande.", "'Isn't' con 'it'.", "to-be-negative"),
    ("We ___ students, we are teachers.", "am not", "isn't", "aren't", 3, "No somos estudiantes, somos maestros.", "'Aren't' con 'we'.", "to-be-negative"),

    ("I ___ a doctor.", "am not", "isn't", "aren't", 1, "Yo no soy doctor.", "'Am not' con 'I'.", "final_mundo_6"),
    ("You ___ a nurse.", "am not", "isn't", "aren't", 3, "Tu no eres enfermero.", "'Aren't' con 'you'.", "final_mundo_6"),
    ("She ___ a chef.", "am not", "isn't", "aren't", 2, "Ella no es cocinera.", "'Isn't' con 'she'.", "final_mundo_6"),
    ("He ___ a farmer, he is a driver.", "am not", "isn't", "aren't", 2, "El no es granjero, es conductor.", "'Isn't' con 'he'.", "final_mundo_6"),
    ("They ___ doctors, they are nurses.", "am not", "isn't", "aren't", 3, "No son doctores, son enfermeros.", "'Aren't' con sujeto plural.", "final_mundo_6"),
    ("I am a student, ___ a teacher.", "I'm not", "you aren't", "he isn't", 1, "Soy estudiante, no soy maestro.", "'I'm not' contrasta con 'I am'.", "final_mundo_6"),
    ("___ she a driver? No, she isn't.", "Am", "Is", "Are", 2, "___ ella es conductora? No.", "'Is' para preguntar con 'she'.", "final_mundo_6"),
    ("It ___ an old car, it is a new car.", "am not", "isn't", "aren't", 2, "No es un carro viejo, es nuevo.", "'Isn't' con 'it'.", "final_mundo_6"),
    ("You are a chef, ___ a nurse.", "I'm not", "you aren't", "he isn't", 2, "Eres cocinero, no eres enfermero.", "'You aren't' contrasta con 'you are'.", "final_mundo_6"),
    ("We ___ artists, we are farmers.", "am not", "isn't", "aren't", 3, "No somos artistas, somos granjeros.", "'Aren't' con 'we'.", "final_mundo_6"),
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
