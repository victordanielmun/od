"""
Mundo 14: Colores -- 20 challenges normales (tag 'colors') + 10 de
examen (tag 'final_mundo_14'). Foco: vocabulario de colores + a/an segun
sonido inicial.

Uso:
    python mundo14_colores_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("It is a ___ apple. (red)", "red", "blue", "green", 1, "Es una manzana ___. (rojo)", "'Red' = rojo.", "colors"),
    ("It is a ___ car. (blue)", "red", "blue", "green", 2, "Es un carro ___. (azul)", "'Blue' = azul.", "colors"),
    ("It is a ___ tree. (green)", "red", "blue", "green", 3, "Es un arbol ___. (verde)", "'Green' = verde.", "colors"),
    ("It is a ___ banana. (yellow)", "yellow", "orange", "purple", 1, "Es una banana ___. (amarilla)", "'Yellow' = amarillo.", "colors"),
    ("It is ___ orange umbrella.", "a", "an", "the", 2, "Es un paraguas naranja.", "'An' antes de sonido vocal ('orange').", "colors"),
    ("It is a ___ grape. (purple)", "yellow", "orange", "purple", 3, "Es una uva ___. (morada)", "'Purple' = morado.", "colors"),
    ("It is a ___ cat. (black)", "black", "white", "brown", 1, "Es un gato ___. (negro)", "'Black' = negro.", "colors"),
    ("It is a ___ cloud. (white)", "black", "white", "brown", 2, "Es una nube ___. (blanca)", "'White' = blanco.", "colors"),
    ("It is a ___ dog. (brown)", "black", "white", "brown", 3, "Es un perro ___. (cafe)", "'Brown' = cafe/marron.", "colors"),
    ("It is ___ red apple.", "a", "an", "the", 1, "Es una manzana roja.", "'A' antes de sonido consonante ('red').", "colors"),
    ("It is ___ blue car.", "a", "an", "the", 1, "Es un carro azul.", "'A' antes de sonido consonante ('blue').", "colors"),
    ("It is ___ orange umbrella, not a red one.", "a", "an", "the", 2, "Es un paraguas naranja, no uno rojo.", "'An' antes de 'orange'.", "colors"),
    ("It is a ___ apple, not a green one. (red)", "red", "blue", "yellow", 1, "Es una manzana roja, no una verde.", "'Red' = rojo.", "colors"),
    ("It is a ___ banana, not a purple one. (yellow)", "yellow", "black", "white", 1, "Es una banana amarilla, no una morada.", "'Yellow' = amarillo.", "colors"),
    ("It is a ___ cat, not a white one. (black)", "black", "brown", "blue", 1, "Es un gato negro, no uno blanco.", "'Black' = negro.", "colors"),
    ("It is a ___ cloud, not a black one. (white)", "white", "brown", "green", 1, "Es una nube blanca, no una negra.", "'White' = blanco.", "colors"),
    ("It is a ___ dog, not a black one. (brown)", "brown", "white", "purple", 1, "Es un perro cafe, no uno negro.", "'Brown' = cafe.", "colors"),
    ("It is a ___ grape, not a green one. (purple)", "purple", "orange", "red", 1, "Es una uva morada, no una verde.", "'Purple' = morado.", "colors"),
    ("It is a ___ tree, not a brown one. (green)", "green", "blue", "yellow", 1, "Es un arbol verde, no uno cafe.", "'Green' = verde.", "colors"),
    ("It is ___ tree. (green)", "a", "an", "the", 1, "Es un arbol verde.", "'A' antes de sonido consonante ('green').", "colors"),

    ("It is a ___ apple. (green)", "green", "black", "white", 1, "Es una manzana verde.", "'Green' = verde.", "final_mundo_14"),
    ("It is a ___ car. (red)", "red", "purple", "yellow", 1, "Es un carro rojo.", "'Red' = rojo.", "final_mundo_14"),
    ("It is ___ umbrella. (orange)", "a", "an", "the", 2, "Es un paraguas naranja.", "'An' antes de 'orange'.", "final_mundo_14"),
    ("It is a ___ banana. (yellow)", "yellow", "blue", "black", 1, "Es una banana amarilla.", "'Yellow' = amarillo.", "final_mundo_14"),
    ("It is a ___ cat. (black)", "black", "white", "green", 1, "Es un gato negro.", "'Black' = negro.", "final_mundo_14"),
    ("It is a ___ cloud. (white)", "white", "brown", "purple", 1, "Es una nube blanca.", "'White' = blanco.", "final_mundo_14"),
    ("It is a ___ dog. (brown)", "brown", "red", "blue", 1, "Es un perro cafe.", "'Brown' = cafe.", "final_mundo_14"),
    ("It is a ___ grape. (purple)", "purple", "yellow", "green", 1, "Es una uva morada.", "'Purple' = morado.", "final_mundo_14"),
    ("It is ___ apple. (red)", "a", "an", "the", 1, "Es una manzana roja.", "'A' antes de sonido consonante.", "final_mundo_14"),
    ("It is a ___ tree. (green)", "green", "orange", "black", 1, "Es un arbol verde.", "'Green' = verde.", "final_mundo_14"),
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
