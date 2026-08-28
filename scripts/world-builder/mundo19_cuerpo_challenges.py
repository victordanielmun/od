"""
Mundo 19: El Cuerpo -- 20 challenges normales (tag 'body-parts') + 10 de
examen (tag 'final_mundo_19'). Foco: vocabulario del cuerpo + have (I/
you/we/they) vs has (he/she/it, excepcion irregular).

Uso:
    python mundo19_cuerpo_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("This is my ___. (head)", "head", "nose", "mouth", 1, "Esta es mi ___. (cabeza)", "'Head' = cabeza.", "body-parts"),
    ("This is my ___. (nose)", "head", "nose", "mouth", 2, "Esta es mi ___. (nariz)", "'Nose' = nariz.", "body-parts"),
    ("This is my ___. (mouth)", "head", "nose", "mouth", 3, "Esta es mi ___. (boca)", "'Mouth' = boca.", "body-parts"),
    ("This is my ___. (stomach)", "stomach", "arm", "leg", 1, "Este es mi ___. (estomago)", "'Stomach' = estomago.", "body-parts"),
    ("I ___ two eyes. (have)", "have", "has", "having", 1, "Yo ___ dos ojos. (tener)", "Con 'I' se usa 'have'.", "body-parts"),
    ("You ___ two hands. (have)", "have", "has", "having", 1, "Tu ___ dos manos. (tener)", "Con 'you' se usa 'have'.", "body-parts"),
    ("We ___ two legs. (have)", "have", "has", "having", 1, "Nosotros ___ dos piernas. (tener)", "Con 'we' se usa 'have'.", "body-parts"),
    ("They ___ two arms. (have)", "have", "has", "having", 1, "Ellos ___ dos brazos. (tener)", "Con 'they' se usa 'have'.", "body-parts"),
    ("He ___ two ears. (have)", "have", "has", "haves", 2, "El ___ dos orejas. (tener)", "Con 'he' se usa 'has', NUNCA 'haves'.", "body-parts"),
    ("She ___ two ears. (have)", "have", "has", "haves", 2, "Ella ___ dos orejas. (tener)", "Con 'she' se usa 'has', NUNCA 'haves'.", "body-parts"),
    ("I have two ___. (eyes)", "eyes", "hands", "legs", 1, "Yo tengo dos ___. (ojos)", "'Eyes' = ojos.", "body-parts"),
    ("You have two ___. (hands)", "eyes", "hands", "legs", 2, "Tu tienes dos ___. (manos)", "'Hands' = manos.", "body-parts"),
    ("We have two ___. (legs)", "eyes", "hands", "legs", 3, "Nosotros tenemos dos ___. (piernas)", "'Legs' = piernas.", "body-parts"),
    ("They have two ___. (arms)", "arms", "ears", "eyes", 1, "Ellos tienen dos ___. (brazos)", "'Arms' = brazos.", "body-parts"),
    ("He has two ___. (ears)", "arms", "ears", "eyes", 2, "El tiene dos ___. (orejas)", "'Ears' = orejas.", "body-parts"),
    ("This is my head, not my ___. (nose)", "nose", "mouth", "stomach", 1, "Esta es mi cabeza, no mi ___. (nariz)", "'Nose' = nariz.", "body-parts"),
    ("This is my mouth, not my ___. (stomach)", "nose", "mouth", "stomach", 3, "Esta es mi boca, no mi ___. (estomago)", "'Stomach' = estomago.", "body-parts"),
    ("She ___ two hands. (have)", "have", "has", "haves", 2, "Ella ___ dos manos. (tener)", "Con 'she' se usa 'has'.", "body-parts"),
    ("He ___ two eyes. (have)", "have", "has", "haves", 2, "El ___ dos ojos. (tener)", "Con 'he' se usa 'has'.", "body-parts"),
    ("I ___ two legs. (have)", "have", "has", "haves", 1, "Yo ___ dos piernas. (tener)", "Con 'I' se usa 'have'.", "body-parts"),

    ("This is my ___, not my head. (stomach)", "stomach", "nose", "mouth", 1, "Este es mi estomago, no mi cabeza.", "'Stomach' = estomago.", "final_mundo_19"),
    ("You ___ two arms. (have)", "have", "has", "haves", 1, "Tu ___ dos brazos. (tener)", "Con 'you' se usa 'have'.", "final_mundo_19"),
    ("We ___ two ears. (have)", "have", "has", "haves", 1, "Nosotros ___ dos orejas. (tener)", "Con 'we' se usa 'have'.", "final_mundo_19"),
    ("They ___ two eyes. (have)", "have", "has", "haves", 1, "Ellos ___ dos ojos. (tener)", "Con 'they' se usa 'have'.", "final_mundo_19"),
    ("She ___ two legs. (have)", "have", "has", "haves", 2, "Ella ___ dos piernas. (tener)", "Con 'she' se usa 'has'.", "final_mundo_19"),
    ("He ___ two hands. (have)", "have", "has", "haves", 2, "El ___ dos manos. (tener)", "Con 'he' se usa 'has'.", "final_mundo_19"),
    ("I have two ___. (ears)", "ears", "legs", "hands", 1, "Yo tengo dos ___. (orejas)", "'Ears' = orejas.", "final_mundo_19"),
    ("You have two ___. (arms)", "eyes", "arms", "legs", 2, "Tu tienes dos ___. (brazos)", "'Arms' = brazos.", "final_mundo_19"),
    ("This is my ___. (mouth, not stomach)", "mouth", "stomach", "nose", 1, "Esta es mi boca.", "'Mouth' = boca.", "final_mundo_19"),
    ("She has two ___. (eyes)", "eyes", "arms", "legs", 1, "Ella tiene dos ___. (ojos)", "'Eyes' = ojos.", "final_mundo_19"),
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
