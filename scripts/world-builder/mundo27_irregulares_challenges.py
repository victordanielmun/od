"""
Mundo 27: Pasado Simple (verbos irregulares) -- 20 challenges normales
(tag 'past-simple-irregular') + 10 de examen (tag 'final_mundo_27').
Foco: memorizar las formas irregulares, y que vuelven a forma base en
negativo/pregunta.

Uso:
    python mundo27_irregulares_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ to the park. (go)", "went", "goed", "going", 1, "Yo ___ al parque. (go)", "'Went' es irregular, no 'goed'.", "past-simple-irregular"),
    ("You ___ a good day. (have)", "had", "haved", "having", 1, "Tu ___ un buen dia. (have)", "'Had' es irregular, no 'haved'.", "past-simple-irregular"),
    ("He ___ a movie. (see)", "saw", "seed", "seeing", 1, "El ___ una pelicula. (see)", "'Saw' es irregular, no 'seed'.", "past-simple-irregular"),
    ("She ___ her homework. (do)", "did", "doed", "doing", 1, "Ella ___ su tarea. (do)", "'Did' es irregular, no 'doed'.", "past-simple-irregular"),
    ("We ___ breakfast. (eat)", "ate", "eated", "eating", 1, "Nosotros ___ el desayuno. (eat)", "'Ate' es irregular, no 'eated'.", "past-simple-irregular"),
    ("They ___ a cake. (make)", "made", "maked", "making", 1, "Ellos ___ un pastel. (make)", "'Made' es irregular, no 'maked'.", "past-simple-irregular"),
    ("He ___ a photo. (take)", "took", "taked", "taking", 1, "El ___ una foto. (take)", "'Took' es irregular, no 'taked'.", "past-simple-irregular"),
    ("She ___ home late. (come)", "came", "comed", "coming", 1, "Ella ___ tarde a casa. (come)", "'Came' es irregular, no 'comed'.", "past-simple-irregular"),
    ("I ___ a present. (get)", "got", "getted", "getting", 1, "Yo ___ un regalo. (get)", "'Got' es irregular, no 'getted'.", "past-simple-irregular"),
    ("I didn't ___ to the park. (go, not went)", "go", "went", "going", 1, "No fui al parque. (forma base)", "En negativo, vuelve a forma base.", "past-simple-irregular"),
    ("Did you ___ a movie? (see, not saw)", "see", "saw", "seeing", 1, "Viste una pelicula? (forma base)", "En pregunta, vuelve a forma base.", "past-simple-irregular"),
    ("He didn't ___ his homework. (do, not did)", "do", "did", "doing", 1, "El no hizo su tarea. (forma base)", "En negativo, vuelve a forma base.", "past-simple-irregular"),
    ("Did she ___ a cake? (make, not made)", "make", "made", "making", 1, "Ella hizo un pastel? (forma base)", "En pregunta, vuelve a forma base.", "past-simple-irregular"),
    ("You ___ a good day, and I ___ one too. (had)", "had", "haved", "having", 1, "Tuviste un buen dia, y yo tambien ___. (had)", "'Had' es irregular.", "past-simple-irregular"),
    ("He ___ a photo, and she ___ one too. (took)", "took", "taked", "taking", 1, "El tomo una foto, y ella tambien ___. (took)", "'Took' es irregular.", "past-simple-irregular"),
    ("I ___ to the park yesterday. (go)", "went", "goed", "going", 1, "Yo ___ al parque ayer. (go)", "'Went' es irregular.", "past-simple-irregular"),
    ("We ___ breakfast this morning. (eat)", "ate", "eated", "eating", 1, "Nosotros ___ el desayuno esta mañana. (eat)", "'Ate' es irregular.", "past-simple-irregular"),
    ("They ___ a cake yesterday. (make)", "made", "maked", "making", 1, "Ellos ___ un pastel ayer. (make)", "'Made' es irregular.", "past-simple-irregular"),
    ("She ___ home late yesterday. (come)", "came", "comed", "coming", 1, "Ella ___ tarde a casa ayer. (come)", "'Came' es irregular.", "past-simple-irregular"),
    ("I ___ a present yesterday. (get)", "got", "getted", "getting", 1, "Yo ___ un regalo ayer. (get)", "'Got' es irregular.", "past-simple-irregular"),

    ("You ___ to the park. (go)", "went", "goed", "going", 1, "Tu ___ al parque. (go)", "'Went' es irregular.", "final_mundo_27"),
    ("He ___ a good day. (have)", "had", "haved", "having", 1, "El ___ un buen dia. (have)", "'Had' es irregular.", "final_mundo_27"),
    ("She ___ a movie. (see)", "saw", "seed", "seeing", 1, "Ella ___ una pelicula. (see)", "'Saw' es irregular.", "final_mundo_27"),
    ("I ___ my homework. (do)", "did", "doed", "doing", 1, "Yo ___ mi tarea. (do)", "'Did' es irregular.", "final_mundo_27"),
    ("We ___ a cake. (make)", "made", "maked", "making", 1, "Nosotros ___ un pastel. (make)", "'Made' es irregular.", "final_mundo_27"),
    ("They ___ a photo. (take)", "took", "taked", "taking", 1, "Ellos ___ una foto. (take)", "'Took' es irregular.", "final_mundo_27"),
    ("He ___ home late. (come)", "came", "comed", "coming", 1, "El ___ tarde a casa. (come)", "'Came' es irregular.", "final_mundo_27"),
    ("Did he ___ to the park? (go, not went)", "go", "went", "going", 1, "El fue al parque? (forma base)", "En pregunta, vuelve a forma base.", "final_mundo_27"),
    ("She didn't ___ a present. (get, not got)", "get", "got", "getting", 1, "Ella no recibio un regalo. (forma base)", "En negativo, vuelve a forma base.", "final_mundo_27"),
    ("We ___ breakfast, and they ___ too. (ate)", "ate", "eated", "eating", 1, "Desayunamos, y ellos tambien ___. (ate)", "'Ate' es irregular.", "final_mundo_27"),
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
