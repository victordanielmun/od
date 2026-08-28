"""
Mundo 21: Preposiciones de Lugar -- 20 challenges normales (tag
'prepositions-place') + 10 de examen (tag 'final_mundo_21'). Foco:
under (debajo), next to (al lado), between (entre, dos lugares).

Uso:
    python mundo21_preposiciones_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("The cat is ___ the table. (under)", "under", "next to", "between", 1, "El gato esta ___ la mesa. (debajo)", "'Under' = debajo de.", "prepositions-place"),
    ("The dog is ___ the bed. (under)", "under", "next to", "between", 1, "El perro esta ___ la cama. (debajo)", "'Under' = debajo de.", "prepositions-place"),
    ("The ball is ___ the chair. (under)", "under", "next to", "between", 1, "La pelota esta ___ la silla. (debajo)", "'Under' = debajo de.", "prepositions-place"),
    ("The box is ___ the bed. (under)", "under", "next to", "between", 1, "La caja esta ___ la cama. (debajo)", "'Under' = debajo de.", "prepositions-place"),
    ("The chair is ___ the table. (next to)", "under", "next to", "between", 2, "La silla esta ___ la mesa. (al lado)", "'Next to' = al lado de.", "prepositions-place"),
    ("The lamp is ___ the book. (next to)", "under", "next to", "between", 2, "La lampara esta ___ el libro. (al lado)", "'Next to' = al lado de.", "prepositions-place"),
    ("The cat is ___ the dog. (next to)", "under", "next to", "between", 2, "El gato esta ___ el perro. (al lado)", "'Next to' = al lado de.", "prepositions-place"),
    ("The book is ___ the lamp and the chair. (between)", "under", "next to", "between", 3, "El libro esta ___ la lampara y la silla. (entre)", "'Between' = entre (dos lugares).", "prepositions-place"),
    ("The ball is ___ the table and the bed. (between)", "under", "next to", "between", 3, "La pelota esta ___ la mesa y la cama. (entre)", "'Between' = entre (dos lugares).", "prepositions-place"),
    ("Between needs ___ places.", "one", "two", "three", 2, "'Between' necesita ___ lugares.", "'Between' siempre conecta dos lugares con 'and'.", "prepositions-place"),
    ("The dog is under the ___. (bed)", "bed", "table", "chair", 1, "El perro esta debajo de la ___. (cama)", "'Bed' = cama.", "prepositions-place"),
    ("The cat is under the ___. (table)", "table", "bed", "chair", 1, "El gato esta debajo de la ___. (mesa)", "'Table' = mesa.", "prepositions-place"),
    ("The ball is under the ___. (chair)", "chair", "table", "bed", 1, "La pelota esta debajo de la ___. (silla)", "'Chair' = silla.", "prepositions-place"),
    ("The chair is next to the ___. (table)", "table", "bed", "book", 1, "La silla esta al lado de la ___. (mesa)", "'Table' = mesa.", "prepositions-place"),
    ("The lamp is next to the ___. (book)", "book", "chair", "table", 1, "La lampara esta al lado del ___. (libro)", "'Book' = libro.", "prepositions-place"),
    ("The book is between the lamp and the ___. (chair)", "chair", "table", "bed", 1, "El libro esta entre la lampara y la ___. (silla)", "'Chair' = silla.", "prepositions-place"),
    ("The ball is between the table and the ___. (bed)", "bed", "chair", "lamp", 1, "La pelota esta entre la mesa y la ___. (cama)", "'Bed' = cama.", "prepositions-place"),
    ("The dog is not on the bed, it is ___ it. (under)", "under", "next to", "between", 1, "El perro no esta sobre la cama, esta ___ ella. (debajo)", "'Under' = debajo de.", "prepositions-place"),
    ("The cat is not far from the dog, it is ___ it. (next to)", "under", "next to", "between", 2, "El gato no esta lejos del perro, esta ___ el. (al lado)", "'Next to' = al lado de.", "prepositions-place"),
    ("The book is in the middle, it is ___ the lamp and the chair.", "under", "next to", "between", 3, "El libro esta en el medio, ___ la lampara y la silla.", "'Between' = entre (en el medio de dos cosas).", "prepositions-place"),

    ("The box is ___ the chair. (under)", "under", "next to", "between", 1, "La caja esta ___ la silla. (debajo)", "'Under' = debajo de.", "final_mundo_21"),
    ("The cat is ___ the bed. (under)", "under", "next to", "between", 1, "El gato esta ___ la cama. (debajo)", "'Under' = debajo de.", "final_mundo_21"),
    ("The dog is ___ the cat. (next to)", "under", "next to", "between", 2, "El perro esta ___ el gato. (al lado)", "'Next to' = al lado de.", "final_mundo_21"),
    ("The lamp is ___ the table. (next to)", "under", "next to", "between", 2, "La lampara esta ___ la mesa. (al lado)", "'Next to' = al lado de.", "final_mundo_21"),
    ("The ball is ___ the chair and the bed. (between)", "under", "next to", "between", 3, "La pelota esta ___ la silla y la cama. (entre)", "'Between' = entre (dos lugares).", "final_mundo_21"),
    ("The book is ___ the table and the chair. (between)", "under", "next to", "between", 3, "El libro esta ___ la mesa y la silla. (entre)", "'Between' = entre (dos lugares).", "final_mundo_21"),
    ("The box is under the ___. (table)", "table", "book", "lamp", 1, "La caja esta debajo de la ___. (mesa)", "'Table' = mesa.", "final_mundo_21"),
    ("The dog is next to the ___. (chair)", "chair", "lamp", "book", 1, "El perro esta al lado de la ___. (silla)", "'Chair' = silla.", "final_mundo_21"),
    ("The cat is between the table and the ___. (chair)", "chair", "book", "lamp", 1, "El gato esta entre la mesa y la ___. (silla)", "'Chair' = silla.", "final_mundo_21"),
    ("Under means ___ of. (below)", "below", "beside", "middle", 1, "'Under' significa ___. (debajo)", "'Under' = debajo de (below).", "final_mundo_21"),
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
