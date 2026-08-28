"""
Mundo 18: Comida y Bebidas -- 20 challenges normales (tag 'food-drinks')
+ 10 de examen (tag 'final_mundo_18'). Foco: vocabulario de comida +
like/don't like (reusa presente simple).

Uso:
    python mundo18_comida_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ bread.", "like", "likes", "liking", 1, "A mi me ___ el pan.", "Con 'I' se usa 'like' sin -s.", "food-drinks"),
    ("I ___ rice.", "like", "likes", "liking", 1, "A mi me ___ el arroz.", "Con 'I' se usa 'like' sin -s.", "food-drinks"),
    ("I ___ like water.", "don't", "doesn't", "not", 1, "A mi no me gusta el agua.", "Con 'I' se usa 'don't'.", "food-drinks"),
    ("I don't ___ juice. (like)", "like", "likes", "liking", 1, "No me gusta el jugo. (like)", "Despues de 'don't', forma base.", "food-drinks"),
    ("This is ___ egg.", "a", "an", "the", 2, "Este es un huevo.", "'An' antes de sonido vocal.", "food-drinks"),
    ("I like chicken, but I ___ like fish.", "don't", "doesn't", "not", 1, "Me gusta el pollo, pero no me gusta el pescado.", "Con 'I' se usa 'don't'.", "food-drinks"),
    ("I like milk, but I don't like ___. (cheese)", "cheese", "chicken", "bread", 1, "Me gusta la leche, pero no me gusta el queso.", "'Cheese' = queso.", "food-drinks"),
    ("I ___ like eggs. (do not)", "don't", "doesn't", "isn't", 1, "No me gustan los huevos.", "'Don't' con 'I'.", "food-drinks"),
    ("I like ___. (bread)", "bread", "rice", "milk", 1, "Me gusta el pan.", "'Bread' = pan.", "food-drinks"),
    ("I like ___. (rice)", "bread", "rice", "milk", 2, "Me gusta el arroz.", "'Rice' = arroz.", "food-drinks"),
    ("I like ___. (chicken)", "chicken", "milk", "water", 1, "Me gusta el pollo.", "'Chicken' = pollo.", "food-drinks"),
    ("I like ___. (milk)", "chicken", "milk", "water", 2, "Me gusta la leche.", "'Milk' = leche.", "food-drinks"),
    ("I don't like ___. (water)", "water", "juice", "cheese", 1, "No me gusta el agua.", "'Water' = agua.", "food-drinks"),
    ("I don't like ___. (juice)", "water", "juice", "cheese", 2, "No me gusta el jugo.", "'Juice' = jugo.", "food-drinks"),
    ("I don't like ___. (cheese)", "water", "juice", "cheese", 3, "No me gusta el queso.", "'Cheese' = queso.", "food-drinks"),
    ("I don't like ___. (eggs)", "eggs", "bread", "rice", 1, "No me gustan los huevos.", "'Eggs' = huevos.", "food-drinks"),
    ("I don't like ___. (fish)", "fish", "milk", "chicken", 1, "No me gusta el pescado.", "'Fish' = pescado.", "food-drinks"),
    ("Does she ___ rice? (like)", "like", "likes", "liking", 1, "A ella le gusta el arroz?", "Despues de 'does', forma base.", "food-drinks"),
    ("Do you like bread? Yes, I ___.", "do", "does", "am", 1, "Te gusta el pan? Si.", "Respuesta corta con 'do'.", "food-drinks"),
    ("Do you like fish? No, I ___.", "don't", "doesn't", "isn't", 1, "Te gusta el pescado? No.", "Respuesta corta negativa con 'don't'.", "food-drinks"),

    ("I like ___, not water. (juice)", "juice", "cheese", "eggs", 1, "Me gusta el jugo, no el agua.", "'Juice' = jugo.", "final_mundo_18"),
    ("I don't like ___, I like chicken. (fish)", "fish", "bread", "milk", 1, "No me gusta el pescado, me gusta el pollo.", "'Fish' = pescado.", "final_mundo_18"),
    ("I ___ like cheese. (do not)", "don't", "doesn't", "isn't", 1, "No me gusta el queso.", "'Don't' con 'I'.", "final_mundo_18"),
    ("She ___ like eggs. (does not)", "don't", "doesn't", "isn't", 2, "A ella no le gustan los huevos.", "'Doesn't' con 'she'.", "final_mundo_18"),
    ("I like ___. (water)", "water", "bread", "chicken", 1, "Me gusta el agua.", "'Water' = agua.", "final_mundo_18"),
    ("I don't like ___. (rice)", "rice", "juice", "cheese", 1, "No me gusta el arroz.", "'Rice' = arroz.", "final_mundo_18"),
    ("Do you like milk? Yes, I ___.", "do", "does", "am", 1, "Te gusta la leche? Si.", "Respuesta corta con 'do'.", "final_mundo_18"),
    ("Does he like eggs? No, he ___.", "don't", "doesn't", "isn't", 2, "A el le gustan los huevos? No.", "Respuesta corta negativa con 'doesn't'.", "final_mundo_18"),
    ("This is ___ egg, not a fish.", "a", "an", "the", 2, "Este es un huevo, no un pescado.", "'An' antes de sonido vocal.", "final_mundo_18"),
    ("I like bread and ___. (milk)", "milk", "fish", "cheese", 1, "Me gusta el pan y la leche.", "'Milk' = leche.", "final_mundo_18"),
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
