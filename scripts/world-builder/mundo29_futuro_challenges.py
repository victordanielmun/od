"""
Mundo 29: Futuro (going to vs will) -- 20 challenges normales (tag
'future-tense') + 10 de examen (tag 'final_mundo_29'). Foco: 'going to'
(plan, usa am/is/are) vs 'will' (espontaneo/prediccion, sin to be).

Uso:
    python mundo29_futuro_challenges.py
"""
from _client import call, login, must

TOKEN = login()

challenges = [
    ("I ___ going to play soccer tomorrow.", "am", "is", "are", 1, "Yo ___ a jugar futbol mañana.", "'Am' con 'I'.", "future-tense"),
    ("You ___ going to work tomorrow.", "am", "is", "are", 3, "Tu ___ a trabajar mañana.", "'Are' con 'you'.", "future-tense"),
    ("He ___ going to travel next week.", "am", "is", "are", 2, "El ___ a viajar la proxima semana.", "'Is' con 'he'.", "future-tense"),
    ("She ___ going to study tonight.", "am", "is", "are", 2, "Ella ___ a estudiar esta noche.", "'Is' con 'she'.", "future-tense"),
    ("I ___ help you.", "will", "am going to", "am", 1, "Yo te ___ (promesa espontanea).", "'Will' para decisiones espontaneas/promesas.", "future-tense"),
    ("It ___ rain tomorrow.", "will", "am", "is going", 1, "___ mañana (prediccion).", "'Will' para predicciones.", "future-tense"),
    ("They ___ win the game.", "will", "am", "is going", 1, "Ellos ___ el juego (prediccion).", "'Will' para predicciones.", "future-tense"),
    ("We ___ visit grandma.", "will", "am", "is going", 1, "Nosotros ___ a la abuela (decision).", "'Will' para decisiones.", "future-tense"),
    ("She ___ call you later.", "will", "am", "is going", 1, "Ella te ___ despues (promesa).", "'Will' para promesas.", "future-tense"),
    ("Going to describes a ___. (plan)", "plan", "surprise", "question", 1, "'Going to' describe un ___. (plan)", "'Going to' = plan ya decidido.", "future-tense"),
    ("Will describes a ___ decision. (spontaneous)", "spontaneous", "planned", "past", 1, "'Will' describe una decision ___. (espontanea)", "'Will' = decision espontanea.", "future-tense"),
    ("I am going to ___ soccer. (play, not played)", "play", "played", "plays", 1, "Voy a jugar futbol. (forma base)", "Despues de 'going to', forma base.", "future-tense"),
    ("She is going to ___ tonight. (study, not studied)", "study", "studied", "studies", 1, "Ella va a estudiar esta noche. (forma base)", "Despues de 'going to', forma base.", "future-tense"),
    ("I will ___ you. (help, not helped)", "help", "helped", "helps", 1, "Te ayudare. (forma base)", "Despues de 'will', forma base.", "future-tense"),
    ("It will ___ tomorrow. (rain, not rains)", "rain", "rains", "rained", 1, "Lloverá mañana. (forma base)", "Despues de 'will', forma base.", "future-tense"),
    ("He ___ going to travel, and she ___ going to study.", "is / is", "am / is", "is / are", 1, "El va a viajar, y ella va a estudiar.", "'Is' con he y she.", "future-tense"),
    ("Will doesn't use ___.", "to be", "will", "the base verb", 1, "'Will' no usa ___.", "'Will' va directo, sin 'to be'.", "future-tense"),
    ("I am going to play soccer, and you ___ going to work.", "am", "is", "are", 3, "Voy a jugar futbol, y tu ___ a trabajar.", "'Are' con 'you'.", "future-tense"),
    ("They will win, and we ___ visit grandma.", "will", "am", "is", 1, "Ellos ganaran, y nosotros ___ a la abuela.", "'Will' es igual para todos los sujetos.", "future-tense"),
    ("He is going to travel, and I ___ going to study.", "am", "is", "are", 1, "El va a viajar, y yo ___ a estudiar.", "'Am' con 'I'.", "future-tense"),

    ("You ___ going to play soccer tomorrow.", "am", "is", "are", 3, "Tu ___ a jugar futbol mañana.", "'Are' con 'you'.", "final_mundo_29"),
    ("She ___ going to work tomorrow.", "am", "is", "are", 2, "Ella ___ a trabajar mañana.", "'Is' con 'she'.", "final_mundo_29"),
    ("We ___ help you.", "will", "am going to", "am", 1, "Nosotros te ___ (promesa).", "'Will' para promesas.", "final_mundo_29"),
    ("He ___ call you later.", "will", "am", "is going", 1, "El te ___ despues (promesa).", "'Will' para promesas.", "final_mundo_29"),
    ("I am going to ___ tomorrow. (work, not worked)", "work", "worked", "works", 1, "Voy a trabajar mañana. (forma base)", "Despues de 'going to', forma base.", "final_mundo_29"),
    ("They will ___ the game. (win, not wins)", "win", "wins", "won", 1, "Ganaran el juego. (forma base)", "Despues de 'will', forma base.", "final_mundo_29"),
    ("He is going to travel, and she is going to ___.", "study", "studies", "studied", 1, "El va a viajar, y ella va a ___. (study)", "Forma base despues de 'going to'.", "final_mundo_29"),
    ("Will is used for ___ decisions.", "spontaneous", "planned", "past", 1, "'Will' se usa para decisiones ___.", "'Will' = espontaneo.", "final_mundo_29"),
    ("Going to is used for a ___ already decided.", "plan", "surprise", "memory", 1, "'Going to' se usa para un ___ ya decidido.", "'Going to' = plan.", "final_mundo_29"),
    ("I ___ going to study, and he ___ going to travel.", "am / is", "is / am", "are / is", 1, "Voy a estudiar, y el va a viajar.", "'Am' con I, 'is' con he.", "final_mundo_29"),
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
