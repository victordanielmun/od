"""
Mundo 23: Can / Can't -- 20 challenges normales (tag 'can-cant') + 10
de examen (tag 'final_mundo_23'). Foco: can/can't nunca cambian de
forma, ni con he/she/it.

Uso:
    python mundo23_can_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ swim. (can)", "can", "cans", "canning", 1, "Yo ___ nadar. (se)", "'Can' nunca cambia.", "can-cant"),
    ("He ___ sing. (can)", "can", "cans", "canning", 1, "El ___ cantar. (sabe)", "'Can' nunca agrega -s, ni con he.", "can-cant"),
    ("She ___ dance. (can)", "can", "cans", "canning", 1, "Ella ___ bailar. (sabe)", "'Can' nunca cambia con she.", "can-cant"),
    ("You ___ run. (can)", "can", "cans", "canning", 1, "Tu ___ correr. (sabes)", "'Can' nunca cambia.", "can-cant"),
    ("I ___ fly. (can't)", "can't", "don't", "isn't", 1, "Yo ___ volar. (no puedo)", "'Can't' expresa que no se puede.", "can-cant"),
    ("He ___ cook. (can't)", "can't", "doesn't", "isn't", 1, "El ___ cocinar. (no sabe)", "'Can't' nunca agrega -s, ni con he.", "can-cant"),
    ("She ___ drive. (can't)", "can't", "doesn't", "isn't", 1, "Ella ___ manejar. (no sabe)", "'Can't' nunca cambia con she.", "can-cant"),
    ("It ___ jump. (can't)", "can't", "doesn't", "isn't", 1, "___ saltar. (no puede)", "'Can't' nunca cambia con it.", "can-cant"),
    ("He can ___. (sing, not sings)", "sing", "sings", "singing", 1, "El sabe cantar. (forma base)", "Despues de 'can', siempre forma base.", "can-cant"),
    ("She can't ___. (drive, not drives)", "drive", "drives", "driving", 1, "Ella no sabe manejar. (forma base)", "Despues de 'can't', siempre forma base.", "can-cant"),
    ("I can swim, but I ___ fly. (can't)", "can't", "don't", "doesn't", 1, "Yo se nadar, pero no puedo volar.", "'Can't' para lo que no se puede.", "can-cant"),
    ("You can run, but you ___ climb. (can't)", "can't", "don't", "doesn't", 1, "Tu sabes correr, pero no sabes escalar.", "'Can't' para lo que no se puede.", "can-cant"),
    ("He can sing, but he ___ cook. (can't)", "can't", "doesn't", "isn't", 1, "El sabe cantar, pero no sabe cocinar.", "'Can't' para lo que no se puede.", "can-cant"),
    ("She can dance, but she ___ drive. (can't)", "can't", "doesn't", "isn't", 1, "Ella sabe bailar, pero no sabe manejar.", "'Can't' para lo que no se puede.", "can-cant"),
    ("Can he sing? Yes, he ___.", "can", "cans", "does", 1, "El sabe cantar? Si.", "Respuesta corta con 'can'.", "can-cant"),
    ("Can she drive? No, she ___.", "can't", "doesn't", "isn't", 1, "Ella sabe manejar? No.", "Respuesta corta negativa con 'can't'.", "can-cant"),
    ("Can you swim? Yes, I ___.", "can", "cans", "do", 1, "Tu sabes nadar? Si.", "Respuesta corta con 'can'.", "can-cant"),
    ("Can it jump? No, it ___.", "can't", "doesn't", "isn't", 1, "Puede saltar? No.", "Respuesta corta negativa con 'can't'.", "can-cant"),
    ("We ___ swim. (can)", "can", "cans", "canning", 1, "Nosotros ___ nadar. (sabemos)", "'Can' nunca cambia.", "can-cant"),
    ("They ___ fly. (can't)", "can't", "don't", "aren't", 1, "Ellos ___ volar. (no pueden)", "'Can't' expresa que no se puede.", "can-cant"),

    ("You ___ dance. (can)", "can", "cans", "canning", 1, "Tu ___ bailar. (sabes)", "'Can' nunca cambia.", "final_mundo_23"),
    ("She ___ sing. (can)", "can", "cans", "canning", 1, "Ella ___ cantar. (sabe)", "'Can' nunca cambia con she.", "final_mundo_23"),
    ("He ___ climb. (can't)", "can't", "doesn't", "isn't", 1, "El ___ escalar. (no sabe)", "'Can't' nunca cambia con he.", "final_mundo_23"),
    ("They ___ cook. (can't)", "can't", "don't", "aren't", 1, "Ellos ___ cocinar. (no saben)", "'Can't' expresa que no se puede.", "final_mundo_23"),
    ("She can ___. (dance, not dances)", "dance", "dances", "dancing", 1, "Ella sabe bailar. (forma base)", "Despues de 'can', siempre forma base.", "final_mundo_23"),
    ("He can't ___. (cook, not cooks)", "cook", "cooks", "cooking", 1, "El no sabe cocinar. (forma base)", "Despues de 'can't', siempre forma base.", "final_mundo_23"),
    ("Can you run? Yes, I ___.", "can", "cans", "do", 1, "Tu sabes correr? Si.", "Respuesta corta con 'can'.", "final_mundo_23"),
    ("Can he fly? No, he ___.", "can't", "doesn't", "isn't", 1, "El puede volar? No.", "Respuesta corta negativa con 'can't'.", "final_mundo_23"),
    ("I can sing, but I ___ dance. (can't)", "can't", "don't", "doesn't", 1, "Yo se cantar, pero no se bailar.", "'Can't' para lo que no se puede.", "final_mundo_23"),
    ("We ___ climb. (can't)", "can't", "don't", "aren't", 1, "Nosotros ___ escalar. (no podemos)", "'Can't' expresa que no se puede.", "final_mundo_23"),
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
