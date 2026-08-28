"""
Mundo 24: Pasado Simple (afirmativo) -- 20 challenges normales (tag
'past-simple-affirmative') + 10 de examen (tag 'final_mundo_24'). Foco:
formar el pasado con -ed, sin cambios por sujeto.

Uso:
    python mundo24_pasado_afirmativo_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ soccer yesterday. (play)", "played", "plays", "playing", 1, "Yo ___ futbol ayer. (play)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("You ___ yesterday. (work)", "worked", "works", "working", 1, "Tu ___ ayer. (work)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("He ___ to school. (walk)", "walked", "walks", "walking", 1, "El ___ a la escuela. (walk)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("She ___ a movie. (watch)", "watched", "watches", "watching", 1, "Ella ___ una pelicula. (watch)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("We ___ dinner. (cook)", "cooked", "cooks", "cooking", 1, "Nosotros ___ la cena. (cook)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("They ___ all night. (dance)", "danced", "dances", "dancing", 1, "Ellos ___ toda la noche. (dance)", "'Dance' termina en 'e', solo se agrega -d.", "past-simple-affirmative"),
    ("He ___ over the fence. (jump)", "jumped", "jumps", "jumping", 1, "El ___ la cerca. (jump)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("She ___ the mountain. (climb)", "climbed", "climbs", "climbing", 1, "Ella ___ la montaña. (climb)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("I ___ my room. (clean)", "cleaned", "cleans", "cleaning", 1, "Yo ___ mi cuarto. (clean)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("He ___ soccer yesterday. (play, same as I)", "played", "plays", "playing", 1, "El ___ futbol ayer. (play)", "El pasado no cambia con 'he'.", "past-simple-affirmative"),
    ("She ___ yesterday. (work, same as you)", "worked", "works", "working", 1, "Ella ___ ayer. (work)", "El pasado no cambia con 'she'.", "past-simple-affirmative"),
    ("They ___ to school. (walk, same as he)", "walked", "walks", "walking", 1, "Ellos ___ a la escuela. (walk)", "El pasado no cambia con 'they'.", "past-simple-affirmative"),
    ("We ___ a movie. (watch, same as she)", "watched", "watches", "watching", 1, "Nosotros ___ una pelicula. (watch)", "El pasado no cambia con 'we'.", "past-simple-affirmative"),
    ("I ___ dinner. (cook, same as we)", "cooked", "cooks", "cooking", 1, "Yo ___ la cena. (cook)", "El pasado no cambia con 'I'.", "past-simple-affirmative"),
    ("You ___ all night. (dance, same as they)", "danced", "dances", "dancing", 1, "Tu ___ toda la noche. (dance)", "El pasado no cambia con 'you'.", "past-simple-affirmative"),
    ("He ___ over the fence yesterday. (jump)", "jumped", "jumps", "jumping", 1, "El ___ la cerca ayer. (jump)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("She ___ the mountain last year. (climb)", "climbed", "climbs", "climbing", 1, "Ella ___ la montaña el año pasado. (climb)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("We ___ our room yesterday. (clean)", "cleaned", "cleans", "cleaning", 1, "Nosotros ___ nuestro cuarto ayer. (clean)", "Pasado: agregar -ed.", "past-simple-affirmative"),
    ("I played soccer, and you ___ too. (play)", "played", "plays", "playing", 1, "Yo jugue futbol, y tu tambien ___. (play)", "El pasado no cambia con 'you'.", "past-simple-affirmative"),
    ("She worked yesterday, and he ___ too. (work)", "worked", "works", "working", 1, "Ella trabajo ayer, y el tambien ___. (work)", "El pasado no cambia con 'he'.", "past-simple-affirmative"),

    ("They ___ soccer yesterday. (play)", "played", "plays", "playing", 1, "Ellos ___ futbol ayer. (play)", "Pasado: agregar -ed.", "final_mundo_24"),
    ("I ___ yesterday. (work)", "worked", "works", "working", 1, "Yo ___ ayer. (work)", "Pasado: agregar -ed.", "final_mundo_24"),
    ("We ___ to school. (walk)", "walked", "walks", "walking", 1, "Nosotros ___ a la escuela. (walk)", "Pasado: agregar -ed.", "final_mundo_24"),
    ("You ___ a movie. (watch)", "watched", "watches", "watching", 1, "Tu ___ una pelicula. (watch)", "Pasado: agregar -ed.", "final_mundo_24"),
    ("He ___ dinner. (cook)", "cooked", "cooks", "cooking", 1, "El ___ la cena. (cook)", "Pasado: agregar -ed.", "final_mundo_24"),
    ("She ___ all night. (dance)", "danced", "dances", "dancing", 1, "Ella ___ toda la noche. (dance)", "'Dance' + -d.", "final_mundo_24"),
    ("They ___ over the fence. (jump)", "jumped", "jumps", "jumping", 1, "Ellos ___ la cerca. (jump)", "Pasado: agregar -ed.", "final_mundo_24"),
    ("We ___ the mountain. (climb)", "climbed", "climbs", "climbing", 1, "Nosotros ___ la montaña. (climb)", "Pasado: agregar -ed.", "final_mundo_24"),
    ("You ___ your room. (clean)", "cleaned", "cleans", "cleaning", 1, "Tu ___ tu cuarto. (clean)", "Pasado: agregar -ed.", "final_mundo_24"),
    ("He played soccer, and she ___ too. (play)", "played", "plays", "playing", 1, "El jugo futbol, y ella tambien ___. (play)", "El pasado no cambia con 'she'.", "final_mundo_24"),
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
