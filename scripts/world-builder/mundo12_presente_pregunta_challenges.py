"""
Mundo 12: Presente Simple (pregunta) -- 20 challenges normales (tag
'present-simple-question') + 10 de examen (tag 'final_mundo_12'). Foco:
elegir Do/Does y la respuesta corta correcta.

Uso:
    python mundo12_presente_pregunta_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("___ you play soccer?", "Do", "Does", "Are", 1, "___ juegas futbol?", "'Do' con 'you'.", "present-simple-question"),
    ("___ he play soccer?", "Do", "Does", "Are", 2, "___ el juega futbol?", "'Does' con 'he'.", "present-simple-question"),
    ("___ she like pizza?", "Do", "Does", "Are", 2, "___ a ella le gusta la pizza?", "'Does' con 'she'.", "present-simple-question"),
    ("___ we work here?", "Do", "Does", "Are", 1, "___ trabajamos aqui?", "'Do' con 'we'.", "present-simple-question"),
    ("___ it work well?", "Do", "Does", "Are", 2, "___ funciona bien?", "'Does' con 'it'.", "present-simple-question"),
    ("___ they live nearby?", "Do", "Does", "Are", 1, "___ viven cerca?", "'Do' con 'they'.", "present-simple-question"),
    ("Do you play soccer? Yes, I ___.", "do", "does", "am", 1, "Juegas futbol? Si.", "Respuesta corta con 'do'.", "present-simple-question"),
    ("Does he play soccer? Yes, he ___.", "do", "does", "is", 2, "El juega futbol? Si.", "Respuesta corta con 'does'.", "present-simple-question"),
    ("Does she like pizza? No, she ___.", "don't", "doesn't", "isn't", 2, "A ella le gusta la pizza? No.", "Respuesta corta negativa con 'doesn't'.", "present-simple-question"),
    ("Do we work here? No, we ___.", "don't", "doesn't", "aren't", 1, "Trabajamos aqui? No.", "Respuesta corta negativa con 'don't'.", "present-simple-question"),
    ("Does he play ___? (soccer, base form)", "play", "plays", "playing", 1, "El juega futbol? (forma base)", "Despues de 'does', el verbo vuelve a la forma base.", "present-simple-question"),
    ("___ you like pizza?", "Do", "Does", "Are", 1, "___ te gusta la pizza?", "'Do' con 'you'.", "present-simple-question"),
    ("___ she eat breakfast?", "Do", "Does", "Are", 2, "___ ella desayuna?", "'Does' con 'she'.", "present-simple-question"),
    ("Do they live nearby? Yes, they ___.", "do", "does", "are", 1, "Viven cerca? Si.", "Respuesta corta con 'do'.", "present-simple-question"),
    ("Does it work well? No, it ___.", "don't", "doesn't", "isn't", 2, "Funciona bien? No.", "Respuesta corta negativa con 'doesn't'.", "present-simple-question"),
    ("___ he live nearby?", "Do", "Does", "Are", 2, "___ el vive cerca?", "'Does' con 'he'.", "present-simple-question"),
    ("Do you work here? Yes, I ___.", "do", "does", "am", 1, "Trabajas aqui? Si.", "Respuesta corta con 'do'.", "present-simple-question"),
    ("Does she eat breakfast? Yes, she ___.", "do", "does", "is", 2, "Ella desayuna? Si.", "Respuesta corta con 'does'.", "present-simple-question"),
    ("___ we like pizza?", "Do", "Does", "Are", 1, "___ nos gusta la pizza?", "'Do' con 'we'.", "present-simple-question"),
    ("Does he live ___? (nearby, base form)", "live", "lives", "living", 1, "El vive cerca? (forma base)", "Despues de 'does', forma base.", "present-simple-question"),

    ("___ you eat breakfast?", "Do", "Does", "Are", 1, "___ desayunas?", "'Do' con 'you'.", "final_mundo_12"),
    ("___ she play soccer?", "Do", "Does", "Are", 2, "___ ella juega futbol?", "'Does' con 'she'.", "final_mundo_12"),
    ("Do they work here? Yes, they ___.", "do", "does", "are", 1, "Trabajan aqui? Si.", "Respuesta corta con 'do'.", "final_mundo_12"),
    ("Does he like pizza? No, he ___.", "don't", "doesn't", "isn't", 2, "A el le gusta la pizza? No.", "Respuesta corta negativa con 'doesn't'.", "final_mundo_12"),
    ("___ it live nearby? (the cat)", "Do", "Does", "Are", 2, "El gato vive cerca?", "'Does' con 'it'.", "final_mundo_12"),
    ("Do we live nearby? Yes, we ___.", "do", "does", "are", 1, "Vivimos cerca? Si.", "Respuesta corta con 'do'.", "final_mundo_12"),
    ("___ they eat breakfast?", "Do", "Does", "Are", 1, "___ desayunan?", "'Do' con 'they'.", "final_mundo_12"),
    ("Does she work well? Yes, she ___.", "do", "does", "is", 2, "Ella trabaja bien? Si.", "Respuesta corta con 'does'.", "final_mundo_12"),
    ("Does he play ___? (base form)", "play", "plays", "playing", 1, "El juega? (forma base)", "Despues de 'does', forma base.", "final_mundo_12"),
    ("Do you like pizza? No, I ___.", "don't", "doesn't", "am not", 1, "Te gusta la pizza? No.", "Respuesta corta negativa con 'don't'.", "final_mundo_12"),
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
