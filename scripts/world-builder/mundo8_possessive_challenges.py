"""
Mundo 8: Posesivos -- 20 challenges normales (tag 'possessive-pronouns',
reusa la etiqueta existente de la limpieza anterior) + 10 de examen
(tag 'final_mundo_8'). Foco: elegir el posesivo correcto para
my/your/his/her/its/our/their.

Uso:
    python mundo8_possessive_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("This is ___ book. (I)", "my", "your", "his", 1, "Este es ___ libro. (Yo)", "'My' es el posesivo de 'I'.", "possessive-pronouns"),
    ("Is this ___ pen? (you)", "my", "your", "her", 2, "Es este ___ boligrafo? (tu)", "'Your' es el posesivo de 'you'.", "possessive-pronouns"),
    ("This is ___ car. (he)", "her", "his", "its", 2, "Este es ___ carro. (el)", "'His' es el posesivo de 'he'.", "possessive-pronouns"),
    ("This is ___ house. (she)", "his", "her", "its", 2, "Esta es ___ casa. (ella)", "'Her' es el posesivo de 'she'.", "possessive-pronouns"),
    ("The dog wags ___ tail. (it)", "his", "her", "its", 3, "El perro mueve ___ cola. (eso)", "'Its' para animales/objetos, sin apostrofe.", "possessive-pronouns"),
    ("This is ___ bag. (we)", "our", "their", "your", 1, "Esta es ___ mochila. (nosotros)", "'Our' es el posesivo de 'we'.", "possessive-pronouns"),
    ("This is ___ toy. (they)", "our", "their", "its", 2, "Este es ___ juguete. (ellos)", "'Their' es el posesivo de 'they'.", "possessive-pronouns"),
    ("It's ___, not it's. (correct spelling)", "its", "it's", "its'", 1, "Es 'its', no 'it's'. (ortografia correcta)", "'Its' posesivo nunca lleva apostrofe.", "possessive-pronouns"),
    ("This is ___ book, not yours. (I)", "my", "your", "his", 1, "Este es ___ libro, no el tuyo. (Yo)", "'My' con 'I'.", "possessive-pronouns"),
    ("Is this ___ car? (you)", "my", "your", "our", 2, "Es este ___ carro? (tu)", "'Your' con 'you'.", "possessive-pronouns"),
    ("This is ___ house. (he)", "his", "her", "our", 1, "Esta es ___ casa. (el)", "'His' con 'he'.", "possessive-pronouns"),
    ("This is ___ pen. (she)", "his", "her", "its", 2, "Este es ___ boligrafo. (ella)", "'Her' con 'she'.", "possessive-pronouns"),
    ("The cat likes ___ toy. (it)", "its", "it's", "his", 1, "Al gato le gusta ___ juguete. (eso)", "'Its' para animales.", "possessive-pronouns"),
    ("This is ___ bag. (we)", "your", "our", "their", 2, "Esta es ___ mochila. (nosotros)", "'Our' con 'we'.", "possessive-pronouns"),
    ("This is ___ toy. (they)", "our", "their", "her", 2, "Este es ___ juguete. (ellos)", "'Their' con 'they'.", "possessive-pronouns"),
    ("This is ___ book. (I)", "your", "my", "our", 2, "Este es ___ libro. (Yo)", "'My' con 'I'.", "possessive-pronouns"),
    ("This is ___ car, right? (he)", "his", "her", "its", 1, "Este es ___ carro, cierto? (el)", "'His' con 'he'.", "possessive-pronouns"),
    ("This is ___ house, right? (she)", "his", "her", "its", 2, "Esta es ___ casa, cierto? (ella)", "'Her' con 'she'.", "possessive-pronouns"),
    ("This is ___ bag, right? (we)", "our", "their", "your", 1, "Esta es ___ mochila, cierto? (nosotros)", "'Our' con 'we'.", "possessive-pronouns"),
    ("This is ___ toy, right? (they)", "our", "their", "its", 2, "Este es ___ juguete, cierto? (ellos)", "'Their' con 'they'.", "possessive-pronouns"),

    ("This is ___ book. (I)", "my", "your", "her", 1, "Este es ___ libro. (Yo)", "'My' con 'I'.", "final_mundo_8"),
    ("Is this ___ pen? (you)", "my", "your", "his", 2, "Es este ___ boligrafo? (tu)", "'Your' con 'you'.", "final_mundo_8"),
    ("This is ___ car. (he)", "her", "his", "our", 2, "Este es ___ carro. (el)", "'His' con 'he'.", "final_mundo_8"),
    ("This is ___ house. (she)", "his", "her", "their", 2, "Esta es ___ casa. (ella)", "'Her' con 'she'.", "final_mundo_8"),
    ("The dog wags ___ tail. (it)", "his", "her", "its", 3, "El perro mueve ___ cola. (eso)", "'Its' sin apostrofe.", "final_mundo_8"),
    ("This is ___ bag. (we)", "our", "your", "their", 1, "Esta es ___ mochila. (nosotros)", "'Our' con 'we'.", "final_mundo_8"),
    ("This is ___ toy. (they)", "your", "their", "our", 2, "Este es ___ juguete. (ellos)", "'Their' con 'they'.", "final_mundo_8"),
    ("This is ___ house, not theirs. (we)", "our", "their", "its", 1, "Esta es ___ casa, no la de ellos. (nosotros)", "'Our' con 'we'.", "final_mundo_8"),
    ("This is ___ pen, not mine. (you)", "my", "your", "her", 2, "Este es ___ boligrafo, no el mio. (tu)", "'Your' con 'you'.", "final_mundo_8"),
    ("This is ___ car, not hers. (he)", "his", "her", "its", 1, "Este es ___ carro, no el de ella. (el)", "'His' con 'he'.", "final_mundo_8"),
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
