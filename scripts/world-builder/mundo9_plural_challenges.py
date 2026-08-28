"""
Mundo 9: Plural y Articulos -- 20 challenges normales (tag
'plural-articles') + 10 de examen (tag 'final_mundo_9'). Foco: this/that
vs these/those, a vs an, plural regular -s, y 'the' especifico.

Uso:
    python mundo9_plural_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("___ is a cat. (near)", "This", "That", "These", 1, "___ es un gato. (cerca)", "'This' para singular cerca.", "plural-articles"),
    ("___ is a dog. (far)", "This", "That", "Those", 2, "___ es un perro. (lejos)", "'That' para singular lejos.", "plural-articles"),
    ("___ are cats. (near, plural)", "This", "These", "That", 2, "___ son gatos. (cerca, plural)", "'These' para plural cerca.", "plural-articles"),
    ("___ are dogs. (far, plural)", "That", "Those", "This", 2, "___ son perros. (lejos, plural)", "'Those' para plural lejos.", "plural-articles"),
    ("This is ___ apple.", "a", "an", "the", 2, "Esta es ___ manzana.", "'An' antes de sonido vocal.", "plural-articles"),
    ("This is ___ cat.", "a", "an", "the", 1, "Este es ___ gato.", "'A' antes de sonido consonante.", "plural-articles"),
    ("That is ___ orange.", "a", "an", "the", 2, "Esa es ___ naranja.", "'An' antes de sonido vocal.", "plural-articles"),
    ("That is ___ dog.", "a", "an", "the", 1, "Ese es ___ perro.", "'A' antes de sonido consonante.", "plural-articles"),
    ("These are book___.", "s", "es", "ies", 1, "Estos son libro___.", "Plural regular: agregar -s.", "plural-articles"),
    ("Those are egg___.", "s", "es", "ies", 1, "Esos son huevo___.", "Plural regular: agregar -s.", "plural-articles"),
    ("These are house___.", "s", "es", "ies", 1, "Estas son casa___.", "Plural regular: agregar -s.", "plural-articles"),
    ("Those are umbrella___.", "s", "es", "ies", 1, "Esos son paraguas___.", "Plural regular: agregar -s.", "plural-articles"),
    ("This is ___ egg.", "a", "an", "the", 2, "Este es ___ huevo.", "'An' antes de sonido vocal.", "plural-articles"),
    ("This is ___ book.", "a", "an", "the", 1, "Este es ___ libro.", "'A' antes de sonido consonante.", "plural-articles"),
    ("I have a cat. ___ cat is black.", "A", "An", "The", 3, "Tengo un gato. ___ gato es negro.", "'The' para algo ya mencionado/especifico.", "plural-articles"),
    ("___ are these? They are cats.", "What", "This", "That", 1, "___ son estos? Son gatos.", "Pregunta con 'these', se responde con 'they'.", "plural-articles"),
    ("This is a cat, ___ are cats.", "this", "these", "that", 2, "Este es un gato, ___ son gatos.", "Cambia this->these en plural.", "plural-articles"),
    ("That is a dog, ___ are dogs.", "that", "those", "this", 2, "Ese es un perro, ___ son perros.", "Cambia that->those en plural.", "plural-articles"),
    ("This is an umbrella.", "a", "an", "the", 2, "Este es un paraguas.", "'An' antes de sonido vocal.", "plural-articles"),
    ("That is a house.", "a", "an", "the", 1, "Esa es una casa.", "'A' antes de sonido consonante.", "plural-articles"),

    ("___ is an apple. (near)", "This", "That", "These", 1, "___ es una manzana. (cerca)", "'This' para singular cerca.", "final_mundo_9"),
    ("___ is an orange. (far)", "This", "That", "Those", 2, "___ es una naranja. (lejos)", "'That' para singular lejos.", "final_mundo_9"),
    ("___ are apples. (near, plural)", "This", "These", "That", 2, "___ son manzanas. (cerca, plural)", "'These' para plural cerca.", "final_mundo_9"),
    ("___ are oranges. (far, plural)", "That", "Those", "This", 2, "___ son naranjas. (lejos, plural)", "'Those' para plural lejos.", "final_mundo_9"),
    ("This is ___ house.", "a", "an", "the", 1, "Esta es ___ casa.", "'A' antes de sonido consonante.", "final_mundo_9"),
    ("That is ___ egg.", "a", "an", "the", 2, "Ese es ___ huevo.", "'An' antes de sonido vocal.", "final_mundo_9"),
    ("These are cat___.", "s", "es", "ies", 1, "Estos son gato___.", "Plural regular: agregar -s.", "final_mundo_9"),
    ("Those are dog___.", "s", "es", "ies", 1, "Esos son perro___.", "Plural regular: agregar -s.", "final_mundo_9"),
    ("I have a book. ___ book is mine.", "A", "An", "The", 3, "Tengo un libro. ___ libro es mio.", "'The' para algo ya mencionado/especifico.", "final_mundo_9"),
    ("This is a dog, ___ are dogs.", "this", "these", "that", 2, "Este es un perro, ___ son perros.", "Cambia this->these en plural.", "final_mundo_9"),
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
