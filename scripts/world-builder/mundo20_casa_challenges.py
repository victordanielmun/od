"""
Mundo 20: La Casa -- 20 challenges normales (tag 'house-prepositions') +
10 de examen (tag 'final_mundo_20'). Foco: habitaciones con 'the' +
preposiciones 'in' (dentro) vs 'on' (encima).

Uso:
    python mundo20_casa_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("This is ___ kitchen.", "a", "an", "the", 3, "Esta es ___ cocina.", "'The' para una habitacion especifica.", "house-prepositions"),
    ("This is ___ bedroom.", "a", "an", "the", 3, "Esta es ___ habitacion.", "'The' para una habitacion especifica.", "house-prepositions"),
    ("This is ___ bathroom.", "a", "an", "the", 3, "Este es ___ baño.", "'The' para una habitacion especifica.", "house-prepositions"),
    ("This is ___ living room.", "a", "an", "the", 3, "Esta es ___ sala.", "'The' para una habitacion especifica.", "house-prepositions"),
    ("The table is ___ the kitchen.", "in", "on", "at", 1, "La mesa esta ___ la cocina.", "'In' = dentro de un lugar.", "house-prepositions"),
    ("The bed is ___ the bedroom.", "in", "on", "at", 1, "La cama esta ___ la habitacion.", "'In' = dentro de un lugar.", "house-prepositions"),
    ("The chair is ___ the living room.", "in", "on", "at", 1, "La silla esta ___ la sala.", "'In' = dentro de un lugar.", "house-prepositions"),
    ("The book is ___ the table.", "in", "on", "at", 2, "El libro esta ___ la mesa.", "'On' = encima de una superficie.", "house-prepositions"),
    ("The lamp is ___ the table.", "in", "on", "at", 2, "La lampara esta ___ la mesa.", "'On' = encima de una superficie.", "house-prepositions"),
    ("The kitchen is a ___. (room)", "room", "table", "book", 1, "La cocina es una ___. (habitacion)", "'Room' = habitacion.", "house-prepositions"),
    ("The book is on the table, not ___ the kitchen.", "in", "on", "at", 1, "El libro esta sobre la mesa, no ___ la cocina.", "'In' = dentro de un lugar.", "house-prepositions"),
    ("The table is in the kitchen, not ___ it.", "in", "on", "at", 2, "La mesa esta en la cocina, no ___ ella.", "'On' = encima de una superficie.", "house-prepositions"),
    ("This is the bedroom, not the ___. (bathroom)", "bathroom", "kitchen", "table", 1, "Esta es la habitacion, no el ___. (baño)", "'Bathroom' = baño.", "house-prepositions"),
    ("This is the living room, not the ___. (kitchen)", "kitchen", "bathroom", "book", 1, "Esta es la sala, no la ___. (cocina)", "'Kitchen' = cocina.", "house-prepositions"),
    ("The chair is ___ the living room, not on it.", "in", "on", "at", 1, "La silla esta ___ la sala, no encima.", "'In' = dentro de un lugar.", "house-prepositions"),
    ("The lamp is ___ the table, not in it.", "in", "on", "at", 2, "La lampara esta ___ la mesa, no dentro.", "'On' = encima de una superficie.", "house-prepositions"),
    ("This is ___ bedroom, not the kitchen.", "a", "an", "the", 3, "Esta es ___ habitacion, no la cocina.", "'The' para una habitacion especifica.", "house-prepositions"),
    ("The bed is in ___. (the bedroom)", "the bedroom", "the table", "the book", 1, "La cama esta en ___. (la habitacion)", "'The bedroom' = la habitacion.", "house-prepositions"),
    ("The book is on ___. (the table)", "the kitchen", "the table", "the bedroom", 2, "El libro esta sobre ___. (la mesa)", "'The table' = la mesa.", "house-prepositions"),
    ("The table is in ___. (the kitchen)", "the kitchen", "the bedroom", "the table", 1, "La mesa esta en ___. (la cocina)", "'The kitchen' = la cocina.", "house-prepositions"),

    ("This is ___ bathroom, not the kitchen.", "a", "an", "the", 3, "Este es ___ baño, no la cocina.", "'The' para una habitacion especifica.", "final_mundo_20"),
    ("The chair is ___ the kitchen. (in)", "in", "on", "at", 1, "La silla esta ___ la cocina.", "'In' = dentro de un lugar.", "final_mundo_20"),
    ("The lamp is ___ the chair. (on)", "in", "on", "at", 2, "La lampara esta ___ la silla.", "'On' = encima de una superficie.", "final_mundo_20"),
    ("This is the kitchen, not the ___. (living room)", "living room", "bedroom", "table", 1, "Esta es la cocina, no la ___. (sala)", "'Living room' = sala.", "final_mundo_20"),
    ("The book is ___ the bed. (on)", "in", "on", "at", 2, "El libro esta ___ la cama.", "'On' = encima de una superficie.", "final_mundo_20"),
    ("The bed is ___ the bedroom, not the bathroom. (in)", "in", "on", "at", 1, "La cama esta ___ la habitacion, no el baño.", "'In' = dentro de un lugar.", "final_mundo_20"),
    ("This is the bathroom, not the ___. (living room)", "living room", "kitchen", "table", 1, "Este es el baño, no la ___. (sala)", "'Living room' = sala.", "final_mundo_20"),
    ("The table is in the ___. (kitchen)", "kitchen", "bedroom", "bathroom", 1, "La mesa esta en la ___. (cocina)", "'Kitchen' = cocina.", "final_mundo_20"),
    ("The chair is in the ___. (living room)", "kitchen", "living room", "bathroom", 2, "La silla esta en la ___. (sala)", "'Living room' = sala.", "final_mundo_20"),
    ("The book and the lamp are ___ the table.", "in", "on", "at", 2, "El libro y la lampara estan ___ la mesa.", "'On' = encima de una superficie.", "final_mundo_20"),
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
