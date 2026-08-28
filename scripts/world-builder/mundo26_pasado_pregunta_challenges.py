"""
Mundo 26: Pasado Simple (pregunta) -- 20 challenges normales (tag
'past-simple-question') + 10 de examen (tag 'final_mundo_26'). Foco:
'Did' + verbo base (igual para todos los sujetos) + respuesta corta.

Uso:
    python mundo26_pasado_pregunta_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("___ you play soccer yesterday?", "Do", "Does", "Did", 3, "___ jugaste futbol ayer?", "'Did' para preguntar en pasado.", "past-simple-question"),
    ("___ he cook dinner?", "Do", "Does", "Did", 3, "___ el cocino la cena?", "'Did' es igual para cualquier sujeto.", "past-simple-question"),
    ("___ she dance all night?", "Do", "Does", "Did", 3, "___ ella bailo toda la noche?", "'Did' es igual para cualquier sujeto.", "past-simple-question"),
    ("___ we work yesterday?", "Do", "Does", "Did", 3, "___ trabajamos ayer?", "'Did' para preguntar en pasado.", "past-simple-question"),
    ("Did you play soccer? Yes, I ___.", "do", "does", "did", 3, "Jugaste futbol? Si.", "Respuesta corta con 'did'.", "past-simple-question"),
    ("Did he cook dinner? Yes, he ___.", "do", "does", "did", 3, "El cocino la cena? Si.", "Respuesta corta con 'did'.", "past-simple-question"),
    ("Did she dance? No, she ___.", "don't", "doesn't", "didn't", 3, "Ella bailo? No.", "Respuesta corta negativa con 'didn't'.", "past-simple-question"),
    ("Did they walk to school? No, they ___.", "don't", "doesn't", "didn't", 3, "Caminaron a la escuela? No.", "Respuesta corta negativa con 'didn't'.", "past-simple-question"),
    ("Did he ___? (jump, not jumped)", "jump", "jumped", "jumps", 1, "El salto? (forma base)", "Despues de 'did', forma base.", "past-simple-question"),
    ("Did she ___? (climb, not climbed)", "climb", "climbed", "climbs", 1, "Ella escalo? (forma base)", "Despues de 'did', forma base.", "past-simple-question"),
    ("___ you watch a movie?", "Do", "Does", "Did", 3, "___ viste una pelicula?", "'Did' para preguntar en pasado.", "past-simple-question"),
    ("___ they clean their room?", "Do", "Does", "Did", 3, "___ limpiaron su cuarto?", "'Did' para preguntar en pasado.", "past-simple-question"),
    ("Did you clean your room? Yes, I ___.", "do", "does", "did", 3, "Limpiaste tu cuarto? Si.", "Respuesta corta con 'did'.", "past-simple-question"),
    ("Did we cook dinner? Yes, we ___.", "do", "does", "did", 3, "Cocinamos la cena? Si.", "Respuesta corta con 'did'.", "past-simple-question"),
    ("Did he jump over the fence? No, he ___.", "don't", "doesn't", "didn't", 3, "El salto la cerca? No.", "Respuesta corta negativa con 'didn't'.", "past-simple-question"),
    ("Did she climb the mountain? Yes, she ___.", "do", "does", "did", 3, "Ella escalo la montaña? Si.", "Respuesta corta con 'did'.", "past-simple-question"),
    ("___ it rain yesterday?", "Do", "Does", "Did", 3, "___ llovio ayer?", "'Did' es igual para 'it' tambien.", "past-simple-question"),
    ("Did it rain? No, it ___.", "don't", "doesn't", "didn't", 3, "Llovio? No.", "Respuesta corta negativa con 'didn't'.", "past-simple-question"),
    ("Did we walk to school? Yes, we ___.", "do", "does", "did", 3, "Caminamos a la escuela? Si.", "Respuesta corta con 'did'.", "past-simple-question"),
    ("___ you dance all night?", "Do", "Does", "Did", 3, "___ bailaste toda la noche?", "'Did' para preguntar en pasado.", "past-simple-question"),

    ("___ he play soccer yesterday?", "Do", "Does", "Did", 3, "___ el jugo futbol ayer?", "'Did' para preguntar en pasado.", "final_mundo_26"),
    ("___ she work yesterday?", "Do", "Does", "Did", 3, "___ ella trabajo ayer?", "'Did' para preguntar en pasado.", "final_mundo_26"),
    ("Did you cook dinner? Yes, I ___.", "do", "does", "did", 3, "Cocinaste la cena? Si.", "Respuesta corta con 'did'.", "final_mundo_26"),
    ("Did they dance all night? No, they ___.", "don't", "doesn't", "didn't", 3, "Bailaron toda la noche? No.", "Respuesta corta negativa con 'didn't'.", "final_mundo_26"),
    ("Did he ___? (walk, not walked)", "walk", "walked", "walks", 1, "El camino? (forma base)", "Despues de 'did', forma base.", "final_mundo_26"),
    ("Did she ___? (watch, not watched)", "watch", "watched", "watches", 1, "Ella vio? (forma base)", "Despues de 'did', forma base.", "final_mundo_26"),
    ("___ we clean the room?", "Do", "Does", "Did", 3, "___ limpiamos el cuarto?", "'Did' para preguntar en pasado.", "final_mundo_26"),
    ("Did he climb the mountain? Yes, he ___.", "do", "does", "did", 3, "El escalo la montaña? Si.", "Respuesta corta con 'did'.", "final_mundo_26"),
    ("Did you jump over the fence? No, I ___.", "don't", "doesn't", "didn't", 3, "Saltaste la cerca? No.", "Respuesta corta negativa con 'didn't'.", "final_mundo_26"),
    ("___ they watch a movie?", "Do", "Does", "Did", 3, "___ vieron una pelicula?", "'Did' para preguntar en pasado.", "final_mundo_26"),
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
