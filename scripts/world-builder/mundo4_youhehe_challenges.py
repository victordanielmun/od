"""
Mundo 4: "Tu eres / El es / Ella es..." -- 20 challenges normales
(tag 'to-be-you-he-she') + 10 de examen (tag 'final_mundo_4'). Foco: 'are'
con you (singular y plural), 'is' con he/she/it, y contraste con 'am'.

Uso:
    python mundo4_youhehe_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("You ___ a farmer.", "am", "is", "are", 3, "Tu ___ granjero.", "'Are' se usa con 'you'.", "to-be-you-he-she"),
    ("He ___ a teacher.", "am", "is", "are", 2, "El ___ maestro.", "'Is' se usa con 'he'.", "to-be-you-he-she"),
    ("She ___ a doctor.", "am", "is", "are", 2, "Ella ___ doctora.", "'Is' se usa con 'she'.", "to-be-you-he-she"),
    ("You ___ a student.", "am", "is", "are", 3, "Tu ___ estudiante.", "'Are' se usa con 'you'.", "to-be-you-he-she"),
    ("He ___ a chef.", "am", "is", "are", 2, "El ___ cocinero.", "'Is' se usa con 'he'.", "to-be-you-he-she"),
    ("She ___ a nurse.", "am", "is", "are", 2, "Ella ___ enfermera.", "'Is' se usa con 'she'.", "to-be-you-he-she"),
    ("You ___ a driver.", "am", "is", "are", 3, "Tu ___ conductor.", "'Are' se usa con 'you'.", "to-be-you-he-she"),
    ("She ___ an artist.", "am", "is", "are", 2, "Ella ___ artista.", "'Is' se usa con 'she'.", "to-be-you-he-she"),
    ("He ___ a police officer.", "am", "is", "are", 2, "El ___ policia.", "'Is' se usa con 'he'.", "to-be-you-he-she"),
    ("You ___ my friend.", "am", "is", "are", 3, "Tu ___ mi amigo.", "'Are' se usa con 'you'.", "to-be-you-he-she"),
    ("___ you a teacher?", "Am", "Is", "Are", 3, "___ eres maestro?", "'Are' para preguntar con 'you'.", "to-be-you-he-she"),
    ("___ she a nurse?", "Am", "Is", "Are", 2, "___ ella es enfermera?", "'Is' para preguntar con 'she'.", "to-be-you-he-she"),
    ("___ he a farmer?", "Am", "Is", "Are", 2, "___ el es granjero?", "'Is' para preguntar con 'he'.", "to-be-you-he-she"),
    ("I am a doctor. ___ a doctor too.", "You are", "He is", "She is", 1, "Soy doctor. ___ tambien.", "'You are' si le hablas a 'tu'.", "to-be-you-he-she"),
    ("My brother is a chef. ___ a good cook.", "You are", "He is", "She is", 2, "Mi hermano es cocinero. ___ bueno.", "'He is' para referirse a el.", "to-be-you-he-she"),
    ("My sister is a nurse. ___ very kind.", "You are", "He is", "She is", 3, "Mi hermana es enfermera. ___ muy amable.", "'She is' para referirse a ella.", "to-be-you-he-she"),
    ("You and your friend ___ students.", "am", "is", "are", 3, "Tu y tu amigo ___ estudiantes.", "'Are' con 'you' (tambien plural).", "to-be-you-he-she"),
    ("He is not a driver, he ___ an artist.", "am", "is", "are", 2, "El no es conductor, ___ artista.", "'Is' se usa con 'he'.", "to-be-you-he-she"),
    ("She is not a chef, she ___ a doctor.", "am", "is", "are", 2, "Ella no es cocinera, ___ doctora.", "'Is' se usa con 'she'.", "to-be-you-he-she"),
    ("You are not a farmer, you ___ a teacher.", "am", "is", "are", 3, "Tu no eres granjero, ___ maestro.", "'Are' se usa con 'you'.", "to-be-you-he-she"),

    ("You ___ a doctor.", "am", "is", "are", 3, "Tu ___ doctor.", "'Are' con 'you'.", "final_mundo_4"),
    ("He ___ a farmer.", "am", "is", "are", 2, "El ___ granjero.", "'Is' con 'he'.", "final_mundo_4"),
    ("She ___ a teacher.", "am", "is", "are", 2, "Ella ___ maestra.", "'Is' con 'she'.", "final_mundo_4"),
    ("___ you a chef?", "Am", "Is", "Are", 3, "___ eres cocinero?", "'Are' para preguntar con 'you'.", "final_mundo_4"),
    ("___ he a nurse?", "Am", "Is", "Are", 2, "___ el es enfermero?", "'Is' para preguntar con 'he'.", "final_mundo_4"),
    ("My mom is a doctor. ___ very smart.", "You are", "He is", "She is", 3, "Mi mama es doctora. ___ muy inteligente.", "'She is' para referirse a ella.", "final_mundo_4"),
    ("My dad is a driver. ___ careful.", "You are", "He is", "She is", 2, "Mi papa es conductor. ___ cuidadoso.", "'He is' para referirse a el.", "final_mundo_4"),
    ("You are my friend, ___ a good student.", "you are", "he is", "she is", 1, "Eres mi amigo, ___ buen estudiante.", "'You are' se mantiene con 'tu'.", "final_mundo_4"),
    ("She is not an artist, she ___ a nurse.", "am", "is", "are", 2, "Ella no es artista, ___ enfermera.", "'Is' con 'she'.", "final_mundo_4"),
    ("He is not a police officer, he ___ a chef.", "am", "is", "are", 2, "El no es policia, ___ cocinero.", "'Is' con 'he'.", "final_mundo_4"),
]

status, existingChallenges = call("GET", "/admin/challenges", token=TOKEN)
existingQuestions = set()
if status == 200 and isinstance(existingChallenges, list):
    existingQuestions = {(c["question"], tuple(c.get("tags", []))) for c in existingChallenges}

added = 0
for q, o1, o2, o3, correct, qES, expES, tag in challenges:
    if (q, (tag,)) in existingQuestions:
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
