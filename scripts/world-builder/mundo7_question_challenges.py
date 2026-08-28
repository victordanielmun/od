"""
Mundo 7: "Eres...? / Es...?" -- 20 challenges normales
(tag 'to-be-question') + 10 de examen (tag 'final_mundo_7'). Foco: orden
verbo-sujeto en la pregunta, y respuesta corta (am/is/are + not).

Uso:
    python mundo7_question_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("___ you a farmer?", "Am", "Is", "Are", 3, "___ eres granjero?", "'Are' para preguntar con 'you'.", "to-be-question"),
    ("___ he a teacher?", "Am", "Is", "Are", 2, "___ el es maestro?", "'Is' para preguntar con 'he'.", "to-be-question"),
    ("___ she a doctor?", "Am", "Is", "Are", 2, "___ ella es doctora?", "'Is' para preguntar con 'she'.", "to-be-question"),
    ("Are you a student? Yes, I ___.", "am", "is", "are", 1, "Eres estudiante? Si, lo ___.", "'Am' en la respuesta corta con 'I'.", "to-be-question"),
    ("Is he a chef? Yes, he ___.", "am", "is", "are", 2, "El es cocinero? Si, lo ___.", "'Is' en la respuesta corta con 'he'.", "to-be-question"),
    ("Is she a nurse? No, she ___.", "isn't", "aren't", "am not", 1, "Ella es enfermera? No, no lo ___.", "'Isn't' en la respuesta corta con 'she'.", "to-be-question"),
    ("Are you a driver? No, I ___.", "isn't", "aren't", "'m not", 3, "Eres conductor? No, no lo ___.", "'I'm not' en la respuesta corta.", "to-be-question"),
    ("___ they students?", "Am", "Is", "Are", 3, "___ ellos son estudiantes?", "'Are' con 'they'.", "to-be-question"),
    ("___ it a good dog?", "Am", "Is", "Are", 2, "___ es un buen perro?", "'Is' con 'it'.", "to-be-question"),
    ("Is he a police officer? Yes, he ___.", "am", "is", "are", 2, "El es policia? Si, lo ___.", "'Is' con 'he'.", "to-be-question"),
    ("Are you an artist? Yes, I ___.", "am", "is", "are", 1, "Eres artista? Si, lo ___.", "'Am' con 'I'.", "to-be-question"),
    ("Is she a driver? No, she ___.", "isn't", "aren't", "am not", 1, "Ella es conductora? No.", "'Isn't' con 'she'.", "to-be-question"),
    ("___ your friend a teacher?", "Am", "Is", "Are", 2, "___ tu amigo es maestro?", "'Is' con sujeto singular.", "to-be-question"),
    ("___ your friends farmers?", "Am", "Is", "Are", 3, "___ tus amigos son granjeros?", "'Are' con sujeto plural.", "to-be-question"),
    ("Are you ready? Yes, I ___.", "am", "is", "are", 1, "Estas listo? Si, lo ___.", "'Am' con 'I'.", "to-be-question"),
    ("Is it a big house? Yes, it ___.", "am", "is", "are", 2, "Es una casa grande? Si.", "'Is' con 'it'.", "to-be-question"),
    ("Are they doctors? No, they ___.", "isn't", "aren't", "am not", 2, "Son doctores? No.", "'Aren't' con 'they'.", "to-be-question"),
    ("Is he a farmer? No, he ___.", "isn't", "aren't", "am not", 1, "El es granjero? No.", "'Isn't' con 'he'.", "to-be-question"),
    ("Are we students? Yes, we ___.", "am", "is", "are", 3, "Somos estudiantes? Si.", "'Are' con 'we'.", "to-be-question"),
    ("Is she an artist? Yes, she ___.", "am", "is", "are", 2, "Ella es artista? Si.", "'Is' con 'she'.", "to-be-question"),

    ("___ you a chef?", "Am", "Is", "Are", 3, "___ eres cocinero?", "'Are' con 'you'.", "final_mundo_7"),
    ("___ he a nurse?", "Am", "Is", "Are", 2, "___ el es enfermero?", "'Is' con 'he'.", "final_mundo_7"),
    ("Are you a farmer? Yes, I ___.", "am", "is", "are", 1, "Eres granjero? Si.", "'Am' con 'I'.", "final_mundo_7"),
    ("Is she a doctor? No, she ___.", "isn't", "aren't", "am not", 1, "Ella es doctora? No.", "'Isn't' con 'she'.", "final_mundo_7"),
    ("Is he a driver? Yes, he ___.", "am", "is", "are", 2, "El es conductor? Si.", "'Is' con 'he'.", "final_mundo_7"),
    ("Are you a teacher? No, I ___.", "isn't", "aren't", "'m not", 3, "Eres maestro? No.", "'I'm not' en la respuesta.", "final_mundo_7"),
    ("___ she a police officer?", "Am", "Is", "Are", 2, "___ ella es policia?", "'Is' con 'she'.", "final_mundo_7"),
    ("Is it a small cat? Yes, it ___.", "am", "is", "are", 2, "Es un gato pequeno? Si.", "'Is' con 'it'.", "final_mundo_7"),
    ("Are they teachers? Yes, they ___.", "am", "is", "are", 3, "Son maestros? Si.", "'Are' con 'they'.", "final_mundo_7"),
    ("Is he an artist? No, he ___.", "isn't", "aren't", "am not", 1, "El es artista? No.", "'Isn't' con 'he'.", "final_mundo_7"),
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
