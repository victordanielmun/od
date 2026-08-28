"""
Mundo 28: Comparativos y Superlativos -- 20 challenges normales (tag
'comparatives-superlatives') + 10 de examen (tag 'final_mundo_28').
Foco: -er/than (comparativo), the -est/most (superlativo), y 'good' ->
better -> best (irregular).

Uso:
    python mundo28_comparativos_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("A car is ___ than a bike. (big)", "bigger", "biggest", "more big", 1, "Un carro es ___ que una bici. (big)", "Comparativo: adjetivo + -er + than.", "comparatives-superlatives"),
    ("A mouse is ___ than a cat. (small)", "smaller", "smallest", "more small", 1, "Un raton es ___ que un gato. (small)", "Comparativo: adjetivo + -er + than.", "comparatives-superlatives"),
    ("A car is ___ than a bike. (fast)", "faster", "fastest", "more fast", 1, "Un carro es ___ que una bici. (fast)", "Comparativo: adjetivo + -er + than.", "comparatives-superlatives"),
    ("This book is ___ than that one. (good)", "better", "gooder", "more good", 1, "Este libro es ___ que ese. (good)", "'Better' es irregular, no 'gooder'.", "comparatives-superlatives"),
    ("The turtle is the ___ animal. (slow)", "slowest", "slower", "more slow", 1, "La tortuga es el animal mas ___. (slow)", "Superlativo: the + adjetivo + -est.", "comparatives-superlatives"),
    ("My grandfather is the ___ person. (old)", "oldest", "older", "more old", 1, "Mi abuelo es la persona mas ___. (old)", "Superlativo: the + adjetivo + -est.", "comparatives-superlatives"),
    ("This is the ___ phone. (new)", "newest", "newer", "more new", 1, "Este es el telefono mas ___. (new)", "Superlativo: the + adjetivo + -est.", "comparatives-superlatives"),
    ("This is the ___ place. (beautiful)", "most beautiful", "beautifulest", "more beautiful", 1, "Este es el lugar mas ___. (beautiful)", "Adjetivos largos usan 'most', no '-est'.", "comparatives-superlatives"),
    ("This is the ___ car. (expensive)", "most expensive", "expensivest", "more expensive", 1, "Este es el carro mas ___. (expensive)", "Adjetivos largos usan 'most'.", "comparatives-superlatives"),
    ("Good, better, ___. (best)", "best", "goodest", "more good", 1, "Good, better, ___. (best)", "'Good-better-best' es irregular.", "comparatives-superlatives"),
    ("A bike is ___ than a car. (slow)", "slower", "slowest", "more slow", 1, "Una bici es ___ que un carro. (slow)", "Comparativo: adjetivo + -er + than.", "comparatives-superlatives"),
    ("This car is ___ than that bike. (new)", "newer", "newest", "more new", 1, "Este carro es ___ que esa bici. (new)", "Comparativo: adjetivo + -er + than.", "comparatives-superlatives"),
    ("A cat is ___ than a mouse. (big)", "bigger", "biggest", "more big", 1, "Un gato es ___ que un raton. (big)", "Comparativo: adjetivo + -er + than.", "comparatives-superlatives"),
    ("This is ___ than that book. (good)", "better", "gooder", "more good", 1, "Este es ___ que ese libro. (good)", "'Better' es irregular.", "comparatives-superlatives"),
    ("The blue whale is the ___ animal. (big)", "biggest", "bigger", "more big", 1, "La ballena azul es el animal mas ___. (big)", "Superlativo: the + adjetivo + -est.", "comparatives-superlatives"),
    ("This is the ___ car in the world. (fast)", "fastest", "faster", "more fast", 1, "Este es el carro mas ___ del mundo. (fast)", "Superlativo: the + adjetivo + -est.", "comparatives-superlatives"),
    ("This is the ___ book I have. (good)", "best", "better", "goodest", 1, "Este es el ___ libro que tengo. (good)", "'Best' es el superlativo irregular.", "comparatives-superlatives"),
    ("A car is ___ than a bike, but a plane is the ___ of all. (fast/fastest)", "faster / fastest", "fastest / faster", "more fast / most fast", 1, "Un carro es mas rapido que una bici, pero un avion es el mas rapido de todos.", "Comparativo vs superlativo.", "comparatives-superlatives"),
    ("This place is ___ than that one. (beautiful)", "more beautiful", "beautifuller", "beautifulest", 1, "Este lugar es ___ que ese. (beautiful)", "Adjetivos largos usan 'more' en comparativo.", "comparatives-superlatives"),
    ("This car is ___ than that one. (expensive)", "more expensive", "expensiver", "expensivest", 1, "Este carro es ___ que ese. (expensive)", "Adjetivos largos usan 'more' en comparativo.", "comparatives-superlatives"),

    ("A bus is ___ than a car. (big)", "bigger", "biggest", "more big", 1, "Un bus es ___ que un carro. (big)", "Comparativo: adjetivo + -er + than.", "final_mundo_28"),
    ("This is the ___ animal in the zoo. (small)", "smallest", "smaller", "more small", 1, "Este es el animal mas ___ del zoologico. (small)", "Superlativo: the + adjetivo + -est.", "final_mundo_28"),
    ("This is ___ than that movie. (good)", "better", "gooder", "more good", 1, "Esta es ___ que esa pelicula. (good)", "'Better' es irregular.", "final_mundo_28"),
    ("This is the ___ movie I have seen. (good)", "best", "better", "goodest", 1, "Esta es la ___ pelicula que he visto. (good)", "'Best' es superlativo irregular.", "final_mundo_28"),
    ("A snail is ___ than a turtle. (slow)", "slower", "slowest", "more slow", 1, "Un caracol es ___ que una tortuga. (slow)", "Comparativo: adjetivo + -er + than.", "final_mundo_28"),
    ("This is the ___ building in the city. (old)", "oldest", "older", "more old", 1, "Este es el edificio mas ___ de la ciudad. (old)", "Superlativo: the + adjetivo + -est.", "final_mundo_28"),
    ("This laptop is ___ than that one. (new)", "newer", "newest", "more new", 1, "Esta laptop es ___ que esa. (new)", "Comparativo: adjetivo + -er + than.", "final_mundo_28"),
    ("This is the ___ song I know. (beautiful)", "most beautiful", "beautifulest", "more beautiful", 1, "Esta es la cancion mas ___ que conozco. (beautiful)", "Adjetivos largos usan 'most'.", "final_mundo_28"),
    ("This ring is ___ than that one. (expensive)", "more expensive", "expensiver", "expensivest", 1, "Este anillo es ___ que ese. (expensive)", "Adjetivos largos usan 'more'.", "final_mundo_28"),
    ("This is the ___ ring in the store. (expensive)", "most expensive", "expensivest", "more expensive", 1, "Este es el anillo mas ___ de la tienda. (expensive)", "Adjetivos largos usan 'most' en superlativo.", "final_mundo_28"),
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
