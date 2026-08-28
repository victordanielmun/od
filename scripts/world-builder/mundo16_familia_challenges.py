"""
Mundo 16: Familia -- 20 challenges normales (tag 'family') + 10 de
examen (tag 'final_mundo_16'). Foco: vocabulario de familia + posesivo
correcto segun de quien es el familiar.

Uso:
    python mundo16_familia_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("This is ___ mother. (I)", "my", "his", "her", 1, "Esta es ___ mama. (Yo)", "'My' con 'I'.", "family"),
    ("This is ___ father. (I)", "my", "his", "her", 1, "Este es ___ papa. (Yo)", "'My' con 'I'.", "family"),
    ("___ is my brother. (he)", "He", "She", "It", 1, "___ es mi hermano. (el)", "'He' para 'brother'.", "family"),
    ("___ is my sister. (she)", "He", "She", "It", 2, "___ es mi hermana. (ella)", "'She' para 'sister'.", "family"),
    ("This is ___ grandmother. (her)", "my", "his", "her", 3, "Esta es ___ abuela. (de ella)", "'Her' indica que es de ella.", "family"),
    ("This is ___ grandfather. (his)", "my", "his", "her", 2, "Este es ___ abuelo. (de el)", "'His' indica que es de el.", "family"),
    ("This is ___ aunt. (we)", "our", "their", "your", 1, "Esta es ___ tia. (nosotros)", "'Our' con 'we'.", "family"),
    ("This is ___ uncle. (they)", "our", "their", "your", 2, "Este es ___ tio. (ellos)", "'Their' con 'they'.", "family"),
    ("This is ___ cousin. (I)", "my", "his", "her", 1, "Este es ___ primo. (Yo)", "'My' con 'I'.", "family"),
    ("Brother is a boy, so we say '___ is my brother'.", "he", "she", "it", 1, "Brother es un chico, decimos '___ is my brother'.", "'He' para hombres.", "family"),
    ("Sister is a girl, so we say '___ is my sister'.", "he", "she", "it", 2, "Sister es una chica, decimos '___ is my sister'.", "'She' para mujeres.", "family"),
    ("Grandmother is a woman, so we say 'this is ___ grandmother'.", "his", "her", "our", 2, "Grandmother es una mujer, decimos 'this is ___ grandmother' (si es de ella).", "'Her' para mujeres.", "family"),
    ("Grandfather is a man, so we say 'this is ___ grandfather'.", "his", "her", "our", 1, "Grandfather es un hombre, decimos 'this is ___ grandfather' (si es de el).", "'His' para hombres.", "family"),
    ("This is my mother's sister: my ___.", "aunt", "uncle", "cousin", 1, "La hermana de mi mama es mi ___.", "'Aunt' = tia.", "family"),
    ("This is my father's brother: my ___.", "aunt", "uncle", "cousin", 2, "El hermano de mi papa es mi ___.", "'Uncle' = tio.", "family"),
    ("This is my mother's mother: my ___.", "grandmother", "grandfather", "cousin", 1, "La mama de mi mama es mi ___.", "'Grandmother' = abuela.", "family"),
    ("This is my father's father: my ___.", "grandmother", "grandfather", "cousin", 2, "El papa de mi papa es mi ___.", "'Grandfather' = abuelo.", "family"),
    ("This is my aunt's child: my ___.", "cousin", "brother", "sister", 1, "El hijo de mi tia es mi ___.", "'Cousin' = primo/prima.", "family"),
    ("This is ___ mother, not yours. (I)", "my", "your", "his", 1, "Esta es ___ mama, no la tuya. (Yo)", "'My' con 'I'.", "family"),
    ("This is ___ father, not mine. (you)", "my", "your", "his", 2, "Este es ___ papa, no el mio. (tu)", "'Your' con 'you'.", "family"),

    ("This is ___ brother. (she, referring to her own)", "my", "his", "her", 3, "Este es ___ hermano. (de ella)", "'Her' indica que es de ella.", "final_mundo_16"),
    ("This is ___ sister. (he, referring to his own)", "my", "his", "her", 2, "Esta es ___ hermana. (de el)", "'His' indica que es de el.", "final_mundo_16"),
    ("___ is my grandmother.", "He", "She", "It", 2, "___ es mi abuela.", "'She' para mujeres.", "final_mundo_16"),
    ("___ is my grandfather.", "He", "She", "It", 1, "___ es mi abuelo.", "'He' para hombres.", "final_mundo_16"),
    ("This is ___ aunt. (they)", "our", "their", "your", 2, "Esta es ___ tia. (ellos)", "'Their' con 'they'.", "final_mundo_16"),
    ("This is ___ uncle. (we)", "our", "their", "your", 1, "Este es ___ tio. (nosotros)", "'Our' con 'we'.", "final_mundo_16"),
    ("This is my sister's son: my ___.", "cousin", "uncle", "aunt", 1, "El hijo de mi hermana es mi ___.", "'Cousin' = primo.", "final_mundo_16"),
    ("This is my mother's father: my ___.", "grandmother", "grandfather", "uncle", 2, "El papa de mi mama es mi ___.", "'Grandfather' = abuelo.", "final_mundo_16"),
    ("This is my father's sister: my ___.", "uncle", "aunt", "cousin", 2, "La hermana de mi papa es mi ___.", "'Aunt' = tia.", "final_mundo_16"),
    ("This is ___ cousin, not his. (my)", "my", "your", "her", 1, "Este es ___ primo, no el de el.", "'My' con 'I'.", "final_mundo_16"),
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
