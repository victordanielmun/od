"""
Mundo 15: Animales -- 20 challenges normales (tag 'animals') + 10 de
examen (tag 'final_mundo_15'). Foco: vocabulario de animales + a/an +
donde viven (reusa presente simple).

Nota: 'jungle' y 'farm' son habitat compartido por varios animales
(lion/elephant/monkey y dog/horse respectivamente) -- para evitar
preguntas con el mismo enunciado pero distinta respuesta correcta, esas
preguntas siempre nombran el animal en el enunciado y dejan en blanco el
habitat o el verbo, nunca el animal.

Uso:
    python mundo15_animales_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("This is a ___. It lives in a house. (cat)", "dog", "cat", "bird", 2, "Este es un ___. Vive en una casa.", "'Cat' vive en la casa.", "animals"),
    ("This is a ___. It lives in a tree. (bird)", "dog", "cat", "bird", 3, "Este es un ___. Vive en un arbol.", "'Bird' vive en un arbol.", "animals"),
    ("This is a ___. It lives in the water. (fish)", "cat", "fish", "bird", 2, "Este es un ___. Vive en el agua.", "'Fish' vive en el agua.", "animals"),
    ("This is a ___. It lives in the forest. (rabbit)", "horse", "rabbit", "monkey", 2, "Este es un ___. Vive en el bosque.", "'Rabbit' vive en el bosque.", "animals"),
    ("This is a dog. It lives on a ___. (farm)", "farm", "tree", "water", 1, "Este es un perro. Vive en una granja.", "Los perros viven en la granja.", "animals"),
    ("This is a horse. It lives on a ___. (farm)", "jungle", "farm", "water", 2, "Este es un caballo. Vive en una granja.", "Los caballos viven en la granja.", "animals"),
    ("This is a lion. It lives in the ___. (jungle)", "jungle", "forest", "house", 1, "Este es un leon. Vive en la selva.", "Los leones viven en la selva.", "animals"),
    ("This is an elephant. It lives in the ___. (jungle)", "jungle", "farm", "water", 1, "Este es un elefante. Vive en la selva.", "Los elefantes viven en la selva.", "animals"),
    ("This is a monkey. It lives in the ___. (jungle)", "house", "jungle", "water", 2, "Este es un mono. Vive en la selva.", "Los monos viven en la selva.", "animals"),
    ("This is ___ elephant.", "a", "an", "the", 2, "Este es un elefante.", "'An' antes de sonido vocal.", "animals"),
    ("This is ___ dog.", "a", "an", "the", 1, "Este es un perro.", "'A' antes de sonido consonante.", "animals"),
    ("This is a dog. It ___ on a farm. (live)", "live", "lives", "living", 2, "Este es un perro. Vive en una granja.", "Con 'it', el verbo agrega -s.", "animals"),
    ("This is a cat. It ___ in a house. (live)", "live", "lives", "living", 2, "Este es un gato. Vive en una casa.", "Con 'it', el verbo agrega -s.", "animals"),
    ("This is a lion. It ___ in the jungle. (live)", "live", "lives", "living", 2, "Este es un leon. Vive en la selva.", "Con 'it', el verbo agrega -s.", "animals"),
    ("This is a horse. It ___ on a farm. (live)", "live", "lives", "living", 2, "Este es un caballo. Vive en una granja.", "Con 'it', el verbo agrega -s.", "animals"),
    ("This is a bird. It ___ in a tree. (live)", "live", "lives", "living", 2, "Este es un pajaro. Vive en un arbol.", "Con 'it', el verbo agrega -s.", "animals"),
    ("This is a fish. It ___ in the water. (live)", "live", "lives", "living", 2, "Este es un pez. Vive en el agua.", "Con 'it', el verbo agrega -s.", "animals"),
    ("This is a rabbit. It ___ in the forest. (live)", "live", "lives", "living", 2, "Este es un conejo. Vive en el bosque.", "Con 'it', el verbo agrega -s.", "animals"),
    ("This is a monkey. It ___ in the jungle. (live)", "live", "lives", "living", 2, "Este es un mono. Vive en la selva.", "Con 'it', el verbo agrega -s.", "animals"),
    ("This is an elephant. It ___ in the jungle. (live)", "live", "lives", "living", 2, "Este es un elefante. Vive en la selva.", "Con 'it', el verbo agrega -s.", "animals"),

    ("The ___ lives in a house. (cat)", "dog", "cat", "bird", 2, "El ___ vive en una casa.", "'Cat' vive en la casa.", "final_mundo_15"),
    ("The ___ lives in a tree. (bird)", "dog", "cat", "bird", 3, "El ___ vive en un arbol.", "'Bird' vive en un arbol.", "final_mundo_15"),
    ("The ___ lives in the water. (fish)", "cat", "fish", "dog", 2, "El ___ vive en el agua.", "'Fish' vive en el agua.", "final_mundo_15"),
    ("The ___ lives in the forest. (rabbit)", "horse", "rabbit", "lion", 2, "El ___ vive en el bosque.", "'Rabbit' vive en el bosque.", "final_mundo_15"),
    ("The dog lives on a ___. (farm)", "farm", "tree", "water", 1, "El perro vive en una granja.", "Los perros viven en la granja.", "final_mundo_15"),
    ("The horse lives on a ___. (farm)", "jungle", "farm", "water", 2, "El caballo vive en una granja.", "Los caballos viven en la granja.", "final_mundo_15"),
    ("The lion lives in the ___. (jungle)", "jungle", "house", "water", 1, "El leon vive en la selva.", "Los leones viven en la selva.", "final_mundo_15"),
    ("The elephant lives in the ___. (jungle)", "jungle", "farm", "tree", 1, "El elefante vive en la selva.", "Los elefantes viven en la selva.", "final_mundo_15"),
    ("The monkey lives in the ___. (jungle)", "house", "jungle", "farm", 2, "El mono vive en la selva.", "Los monos viven en la selva.", "final_mundo_15"),
    ("This is ___ elephant, not a dog.", "a", "an", "the", 2, "Este es un elefante, no un perro.", "'An' antes de sonido vocal.", "final_mundo_15"),
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
