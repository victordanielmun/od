"""
Mundo 17: Numeros y Cantidades -- 20 challenges normales (tag
'numbers-quantities') + 10 de examen (tag 'final_mundo_17'). Foco:
numeros 13-20 con 'There are' + pregunta 'How many...are there?'.

Uso:
    python mundo17_numeros_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("There are ___ apples. (13)", "thirteen", "thirty", "third", 1, "Hay ___ manzanas. (13)", "'Thirteen' = 13.", "numbers-quantities"),
    ("There are ___ books. (14)", "fourteen", "forty", "fourth", 1, "Hay ___ libros. (14)", "'Fourteen' = 14.", "numbers-quantities"),
    ("There are ___ cats. (15)", "fifteen", "fifty", "fifth", 1, "Hay ___ gatos. (15)", "'Fifteen' = 15.", "numbers-quantities"),
    ("There are ___ trees. (16)", "sixteen", "sixty", "sixth", 1, "Hay ___ arboles. (16)", "'Sixteen' = 16.", "numbers-quantities"),
    ("There are ___ flowers. (17)", "seventeen", "seventy", "seventh", 1, "Hay ___ flores. (17)", "'Seventeen' = 17.", "numbers-quantities"),
    ("There are ___ dogs. (18)", "eighteen", "eighty", "eighth", 1, "Hay ___ perros. (18)", "'Eighteen' = 18.", "numbers-quantities"),
    ("There are ___ birds. (19)", "nineteen", "ninety", "ninth", 1, "Hay ___ pajaros. (19)", "'Nineteen' = 19.", "numbers-quantities"),
    ("There are ___ stars. (20)", "twenty", "twelve", "ten", 1, "Hay ___ estrellas. (20)", "'Twenty' = 20.", "numbers-quantities"),
    ("How many apples ___ there?", "is", "are", "am", 2, "___ manzanas hay?", "'Are' porque 'apples' es plural.", "numbers-quantities"),
    ("How ___ apples are there?", "much", "many", "more", 2, "___ manzanas hay?", "'Many' para sustantivos contables en plural.", "numbers-quantities"),
    ("How many apples are there? There ___ thirteen apples.", "is", "are", "am", 2, "Cuantas manzanas hay? Hay trece.", "'Are' con plural.", "numbers-quantities"),
    ("There are thirteen apple___.", "s", "es", "ies", 1, "Hay trece manzana___.", "Plural regular: agregar -s.", "numbers-quantities"),
    ("There are fourteen book___.", "s", "es", "ies", 1, "Hay catorce libro___.", "Plural regular: agregar -s.", "numbers-quantities"),
    ("How many books are there? There are ___ books. (14)", "fourteen", "forty", "four", 1, "Cuantos libros hay? Hay catorce.", "'Fourteen' = 14.", "numbers-quantities"),
    ("How many cats are there? There are ___ cats. (15)", "fifteen", "fifty", "five", 1, "Cuantos gatos hay? Hay quince.", "'Fifteen' = 15.", "numbers-quantities"),
    ("How many trees are there? There are ___ trees. (16)", "sixteen", "sixty", "six", 1, "Cuantos arboles hay? Hay dieciseis.", "'Sixteen' = 16.", "numbers-quantities"),
    ("How many flowers are there? There are ___ flowers. (17)", "seventeen", "seventy", "seven", 1, "Cuantas flores hay? Hay diecisiete.", "'Seventeen' = 17.", "numbers-quantities"),
    ("How many dogs are there? There are ___ dogs. (18)", "eighteen", "eighty", "eight", 1, "Cuantos perros hay? Hay dieciocho.", "'Eighteen' = 18.", "numbers-quantities"),
    ("How many birds are there? There are ___ birds. (19)", "nineteen", "ninety", "nine", 1, "Cuantos pajaros hay? Hay diecinueve.", "'Nineteen' = 19.", "numbers-quantities"),
    ("How many stars are there? There are ___ stars. (20)", "twenty", "twelve", "two", 1, "Cuantas estrellas hay? Hay veinte.", "'Twenty' = 20.", "numbers-quantities"),

    ("There are ___ apples, not fourteen. (13)", "thirteen", "thirty", "third", 1, "Hay ___ manzanas, no catorce. (13)", "'Thirteen' = 13.", "final_mundo_17"),
    ("There are ___ books, not fifteen. (14)", "fourteen", "forty", "fourth", 1, "Hay ___ libros, no quince. (14)", "'Fourteen' = 14.", "final_mundo_17"),
    ("There are ___ dogs, not nineteen. (18)", "eighteen", "eighty", "eighth", 1, "Hay ___ perros, no diecinueve. (18)", "'Eighteen' = 18.", "final_mundo_17"),
    ("There are ___ stars, not eighteen. (20)", "twenty", "twelve", "ten", 1, "Hay ___ estrellas, no dieciocho. (20)", "'Twenty' = 20.", "final_mundo_17"),
    ("How many trees are there? There are ___ trees, not fifteen. (16)", "sixteen", "sixty", "six", 1, "Cuantos arboles hay? Hay dieciseis, no quince.", "'Sixteen' = 16.", "final_mundo_17"),
    ("How many birds are there? There are ___ birds, not seventeen. (19)", "nineteen", "ninety", "nine", 1, "Cuantos pajaros hay? Hay diecinueve, no diecisiete.", "'Nineteen' = 19.", "final_mundo_17"),
    ("How ___ flowers are there?", "much", "many", "more", 2, "___ flores hay?", "'Many' para sustantivos contables en plural.", "final_mundo_17"),
    ("How many cats ___ there?", "is", "are", "am", 2, "___ gatos hay?", "'Are' porque 'cats' es plural.", "final_mundo_17"),
    ("There are fifteen cat___.", "s", "es", "ies", 1, "Hay quince gato___.", "Plural regular: agregar -s.", "final_mundo_17"),
    ("There are twenty star___.", "s", "es", "ies", 1, "Hay veinte estrella___.", "Plural regular: agregar -s.", "final_mundo_17"),
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
