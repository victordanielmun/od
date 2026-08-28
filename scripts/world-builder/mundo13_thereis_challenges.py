"""
Mundo 13: There is / There are -- 20 challenges normales (tag
'there-is-are') + 10 de examen (tag 'final_mundo_13'). Foco: elegir
'is'/'are' segun singular/plural, y a/an solo en singular.

Uso:
    python mundo13_thereis_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("There ___ a cat.", "is", "are", "am", 1, "Hay un gato.", "'Is' con singular.", "there-is-are"),
    ("There ___ two cats.", "is", "are", "am", 2, "Hay dos gatos.", "'Are' con plural.", "there-is-are"),
    ("There is ___ book.", "a", "an", "the", 1, "Hay un libro.", "'A' antes de sonido consonante.", "there-is-are"),
    ("There is ___ apple.", "a", "an", "the", 2, "Hay una manzana.", "'An' antes de sonido vocal.", "there-is-are"),
    ("There ___ three books.", "is", "are", "am", 2, "Hay tres libros.", "'Are' con plural.", "there-is-are"),
    ("There ___ a tree.", "is", "are", "am", 1, "Hay un arbol.", "'Is' con singular.", "there-is-are"),
    ("There ___ four trees.", "is", "are", "am", 2, "Hay cuatro arboles.", "'Are' con plural.", "there-is-are"),
    ("There are two apple___.", "s", "es", "ies", 1, "Hay dos manzana___.", "Plural regular: agregar -s.", "there-is-are"),
    ("There are three flower___.", "s", "es", "ies", 1, "Hay tres flor___.", "Plural regular: agregar -s.", "there-is-are"),
    ("There is ___ flower.", "a", "an", "the", 1, "Hay una flor.", "'A' antes de sonido consonante.", "there-is-are"),
    ("There ___ an apple.", "is", "are", "am", 1, "Hay una manzana.", "'Is' con singular.", "there-is-are"),
    ("There ___ two apples.", "is", "are", "am", 2, "Hay dos manzanas.", "'Are' con plural.", "there-is-are"),
    ("There is a cat, ___ are two dogs.", "there", "this", "that", 1, "Hay un gato, hay dos perros.", "'There' se repite para el segundo elemento.", "there-is-are"),
    ("There ___ a book on the table.", "is", "are", "am", 1, "Hay un libro en la mesa.", "'Is' con singular.", "there-is-are"),
    ("There ___ three trees in the garden.", "is", "are", "am", 2, "Hay tres arboles en el jardin.", "'Are' con plural.", "there-is-are"),
    ("There is ___ tree in the garden.", "a", "an", "the", 1, "Hay un arbol en el jardin.", "'A' antes de sonido consonante.", "there-is-are"),
    ("There ___ two books here.", "is", "are", "am", 2, "Hay dos libros aqui.", "'Are' con plural.", "there-is-are"),
    ("There ___ a flower here.", "is", "are", "am", 1, "Hay una flor aqui.", "'Is' con singular.", "there-is-are"),
    ("There are four cat___.", "s", "es", "ies", 1, "Hay cuatro gato___.", "Plural regular: agregar -s.", "there-is-are"),
    ("There ___ an apple on the table.", "is", "are", "am", 1, "Hay una manzana en la mesa.", "'Is' con singular.", "there-is-are"),

    ("There ___ a dog.", "is", "are", "am", 1, "Hay un perro.", "'Is' con singular.", "final_mundo_13"),
    ("There ___ two dogs.", "is", "are", "am", 2, "Hay dos perros.", "'Are' con plural.", "final_mundo_13"),
    ("There is ___ dog.", "a", "an", "the", 1, "Hay un perro.", "'A' antes de sonido consonante.", "final_mundo_13"),
    ("There is ___ egg.", "a", "an", "the", 2, "Hay un huevo.", "'An' antes de sonido vocal.", "final_mundo_13"),
    ("There ___ three eggs.", "is", "are", "am", 2, "Hay tres huevos.", "'Are' con plural.", "final_mundo_13"),
    ("There are two book___.", "s", "es", "ies", 1, "Hay dos libro___.", "Plural regular: agregar -s.", "final_mundo_13"),
    ("There ___ a cat in the garden.", "is", "are", "am", 1, "Hay un gato en el jardin.", "'Is' con singular.", "final_mundo_13"),
    ("There ___ four flowers here.", "is", "are", "am", 2, "Hay cuatro flores aqui.", "'Are' con plural.", "final_mundo_13"),
    ("There ___ an egg on the table.", "is", "are", "am", 1, "Hay un huevo en la mesa.", "'Is' con singular.", "final_mundo_13"),
    ("There is a book, ___ are two trees.", "there", "this", "that", 1, "Hay un libro, hay dos arboles.", "'There' se repite.", "final_mundo_13"),
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
