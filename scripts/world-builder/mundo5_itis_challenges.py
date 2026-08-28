"""
Mundo 5: "Eso es... (bueno/grande)" -- 20 challenges normales
(tag 'to-be-it-is-adj') + 10 de examen (tag 'final_mundo_5'). Foco: orden
adjetivo+sustantivo, y a/an segun el adjetivo (old/an vs good/a).

Uso:
    python mundo5_itis_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("It is a ___ dog.", "good", "goods", "gooding", 1, "Es un ___ perro.", "'Good' no cambia de forma.", "to-be-it-is-adj"),
    ("It is a big ___.", "house", "houses", "housing", 1, "Es una casa grande.", "Sustantivo singular con 'a'.", "to-be-it-is-adj"),
    ("It is ___ old car.", "a", "an", "the", 2, "Es un carro viejo.", "'An' antes de vocal (old).", "to-be-it-is-adj"),
    ("It is a small ___.", "cat", "cats", "catty", 1, "Es un gato pequeno.", "Sustantivo singular.", "to-be-it-is-adj"),
    ("It is a ___ book.", "new", "news", "newly", 1, "Es un libro nuevo.", "'New' no cambia de forma.", "to-be-it-is-adj"),
    ("It is a hot ___.", "day", "days", "daily", 1, "Es un dia caluroso.", "Sustantivo singular.", "to-be-it-is-adj"),
    ("It is a ___ drink.", "cold", "colds", "colding", 1, "Es una bebida fria.", "'Cold' no cambia de forma.", "to-be-it-is-adj"),
    ("It is a fast ___.", "car", "cars", "carring", 1, "Es un carro rapido.", "Sustantivo singular.", "to-be-it-is-adj"),
    ("It is a ___ turtle.", "slow", "slowly", "slows", 1, "Es una tortuga lenta.", "'Slow' (adjetivo), no 'slowly' (adverbio).", "to-be-it-is-adj"),
    ("It ___ a good dog.", "am", "is", "are", 2, "___ un buen perro.", "'Is' se usa con 'it'.", "to-be-it-is-adj"),
    ("It ___ a big house.", "am", "is", "are", 2, "___ una casa grande.", "'Is' se usa con 'it'.", "to-be-it-is-adj"),
    ("They ___ good dogs.", "am", "is", "are", 3, "___ buenos perros.", "'Are' con sujeto plural.", "to-be-it-is-adj"),
    ("It is ___ small cat.", "a", "an", "the", 1, "Es un gato pequeno.", "'A' antes de consonante (small).", "to-be-it-is-adj"),
    ("It is ___ new book.", "a", "an", "the", 1, "Es un libro nuevo.", "'A' antes de consonante (new).", "to-be-it-is-adj"),
    ("It is not a small cat, it is a ___ cat.", "big", "bigly", "bigness", 1, "No es un gato pequeno, es un gato grande.", "'Big' es el adjetivo correcto.", "to-be-it-is-adj"),
    ("It is not an old car, it is a ___ car.", "new", "newly", "news", 1, "No es un carro viejo, es un carro nuevo.", "'New' es el adjetivo correcto.", "to-be-it-is-adj"),
    ("It is not a fast turtle, it is a ___ turtle.", "slow", "slower", "slowly", 1, "No es una tortuga rapida, es lenta.", "'Slow' es el adjetivo correcto.", "to-be-it-is-adj"),
    ("It is not a cold drink, it is a ___ drink.", "hot", "hotter", "hotly", 1, "No es una bebida fria, es caliente.", "'Hot' es el adjetivo correcto.", "to-be-it-is-adj"),
    ("This dog is very good. ___ a good dog.", "It is", "They are", "You are", 1, "Este perro es muy bueno. ___.", "'It is' se refiere a un animal/objeto.", "to-be-it-is-adj"),
    ("This house is very big. ___ a big house.", "It is", "They are", "You are", 1, "Esta casa es muy grande. ___.", "'It is' se refiere a un objeto.", "to-be-it-is-adj"),

    ("It is a ___ house.", "big", "bigs", "bigging", 1, "Es una casa grande.", "'Big' no cambia de forma.", "final_mundo_5"),
    ("It is ___ old car.", "a", "an", "the", 2, "Es un carro viejo.", "'An' antes de vocal.", "final_mundo_5"),
    ("It is a ___ cat.", "small", "smalls", "smallness", 1, "Es un gato pequeno.", "'Small' no cambia de forma.", "final_mundo_5"),
    ("It ___ a hot day.", "am", "is", "are", 2, "___ un dia caluroso.", "'Is' se usa con 'it'.", "final_mundo_5"),
    ("It is a ___ drink.", "cold", "colds", "coldly", 1, "Es una bebida fria.", "'Cold' no cambia de forma.", "final_mundo_5"),
    ("It is not a slow car, it is a ___ car.", "fast", "faster", "fastly", 1, "No es un carro lento, es rapido.", "'Fast' es el adjetivo correcto.", "final_mundo_5"),
    ("It is ___ new book.", "a", "an", "the", 1, "Es un libro nuevo.", "'A' antes de consonante.", "final_mundo_5"),
    ("This turtle is very slow. ___ a slow turtle.", "It is", "They are", "You are", 1, "Esta tortuga es muy lenta. ___.", "'It is' se refiere a un animal.", "final_mundo_5"),
    ("They ___ new books.", "am", "is", "are", 3, "___ libros nuevos.", "'Are' con sujeto plural.", "final_mundo_5"),
    ("It is not a good dog, it is a ___ dog.", "bad", "badly", "badness", 1, "No es un buen perro, es un mal perro.", "'Bad' es el contrario de 'good'.", "final_mundo_5"),
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
