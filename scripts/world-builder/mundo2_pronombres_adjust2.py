"""
Mundo 2: Pronombres -- ajuste #2, patron de saludo/instrucciones de NPC.

Problema detectado: el 'greeting' (primera linea, se muestra ANTES de que
el LLM tome el control de la conversacion) mezclaba el saludo casual con
la frase de ejemplo a repetir -- ej. "Hey! They are working in the field."
Confunde: no queda claro si es un saludo al que responder casualmente o
la frase que hay que decir.

Fix:
  - 'greeting' vuelve a ser un saludo simple (Hey!/Hi!/Hello!/Hey there!),
    sin contenido de la leccion.
  - 'instructions' pasa a un patron explicito de 2+2: dos frases de
    ejemplo con invitacion clara a repetirlas, luego dos frases mas para
    reforzar. Se completa la tarea con al menos 2 de las 4.

No toca Mochi (su 'greeting' es el gate si/no en si mismo, no contenido de
leccion) ni el Tom de pronoun_square mas alla de limpiar su saludo (es el
repaso final, estructura distinta).

Uso:
    python mundo2_pronombres_adjust2.py
"""
from _client import call, login, must


def get_npc(scene_key, def_id, x, y, token):
    status, rows = call("GET", f"/admin/npc-instances?scene_key={scene_key}", token=token)
    if status != 200:
        raise SystemExit(f"FAILED listing npcs for {scene_key}: {status} {rows}")
    for r in rows:
        if r["npc_definition_id"] == def_id and r["position_x"] == x and r["position_y"] == y:
            return r
    raise SystemExit(f"NPC no encontrado: {scene_key} (def={def_id}, pos=({x},{y}))")


def update_npc(row, patch, token, label):
    body = dict(row)
    body.update(patch)
    must("PUT", f"/admin/npcs/{row['id']}", body, token, label)


TOKEN = login()

FIXES = [
    # (scene_key, name, def_id, x, y, greeting, instructions)

    # pronoun_village
    ("pronoun_village", "Joy", 9, 650, 150,
        "Hello there!",
        "Eres Joy, hablas ingles. Explica que van a practicar 'I' (yo) y 'you' (tu). "
        "Dale al jugador dos frases de ejemplo y dile explicitamente que las puede repetir tal cual: "
        "'I am a student' y 'You are my friend'. Despues dale dos frases mas para reforzar: "
        "'I am happy' y 'You are kind'. Completa la tarea cuando el jugador haya dicho al menos "
        "dos de estas cuatro frases (o muy similares) usando I/you correctamente."),
    ("pronoun_village", "Ann", 4, 1250, 350,
        "Hello!",
        "Eres Ann, hablas ingles. Explica que van a practicar 'he' (el) y 'she' (ella). "
        "Dale dos frases de ejemplo y dile que las puede repetir: 'He is tall' y 'She is smart'. "
        "Luego dale dos mas: 'He is my friend' y 'She is nice'. Completa la tarea cuando el "
        "jugador diga al menos dos de estas frases (o similares) usando he/she correctamente."),
    ("pronoun_village", "Sam", 1, 1150, 150,
        "Hi there!",
        "Eres Sam, hablas ingles. Explica que van a practicar 'it' (para objetos y animales). "
        "Dale dos frases de ejemplo para repetir: 'It is a cat' y 'It is my book'. Luego dale "
        "dos mas: 'It is red' y 'It is here'. Completa la tarea cuando el jugador diga al menos "
        "dos de estas frases (o similares) usando 'it' correctamente."),
    ("pronoun_village", "Amy", 8, 150, 350,
        "Hi!",
        "Eres Amy, hablas ingles. Explica que van a practicar 'we' (nosotros) y 'they' "
        "(ellos/ellas). Dale dos frases para repetir: 'We are friends' y 'They are villagers'. "
        "Luego dale dos mas: 'We are happy' y 'They are here'. Completa la tarea cuando el "
        "jugador diga al menos dos de estas frases. Ademas, para cerrar, pidele que repase "
        "rapido los 7 pronombres (I, you, he, she, it, we, they) diciendo uno de cada uno."),

    # pronoun_village_2 (repaso en granja)
    ("pronoun_village_2", "Joy", 9, 650, 1050,
        "Hi!",
        "Eres Joy, hablas ingles. Van a repasar 'I' y 'you' (ya vistos en el pueblo), esta vez "
        "en la granja. Dale dos frases para repetir: 'I am hungry' y 'You are funny'. Luego "
        "dale dos mas: 'I am tired' y 'You are strong'. Completa la tarea cuando el jugador "
        "diga al menos dos de estas frases. Es repaso, no introduzcas gramatica nueva."),
    ("pronoun_village_2", "Ann", 4, 750, 650,
        "Hello!",
        "Eres Ann, hablas ingles. Van a repasar 'he' y 'she' con frases de familia. Dale dos "
        "frases para repetir: 'He is my brother' y 'She is my sister'. Luego dale dos mas: "
        "'He is kind' y 'She is funny'. Completa la tarea cuando el jugador diga al menos dos. "
        "Es repaso, no gramatica nueva."),
    ("pronoun_village_2", "Sam", 1, 250, 650,
        "Hi there!",
        "Eres Sam, hablas ingles. Van a repasar 'it' con animales de granja. Dale dos frases "
        "para repetir: 'It is a chicken' y 'It is a cow'. Luego dale dos mas: 'It is small' y "
        "'It is loud'. Completa la tarea cuando el jugador diga al menos dos. Repaso, sin "
        "gramatica nueva."),
    ("pronoun_village_2", "Zoe", 11, 50, 250,
        "Hi!",
        "Eres Zoe, hablas ingles. Van a repasar 'we' con frases de granja. Dale dos frases "
        "para repetir: 'We are farmers' y 'We are tired'. Luego dale dos mas: 'We are happy' "
        "y 'We are here'. Completa la tarea cuando el jugador diga al menos dos. Repaso, sin "
        "gramatica nueva."),
    ("pronoun_village_2", "Tom", 6, 650, 150,
        "Hey!",
        "Eres Tom, hablas ingles. Van a repasar 'they' con frases de granja. Dale dos frases "
        "para repetir: 'They are working' y 'They are farmers'. Luego dale dos mas: "
        "'They are happy' y 'They are here'. Completa la tarea cuando el jugador diga al menos "
        "dos. Ademas, para cerrar, pide un repaso final de los 7 pronombres (I, you, he, she, "
        "it, we, they) mencionando cada uno una vez mas."),

    # pronoun_square (repaso en plaza)
    ("pronoun_square", "Toro", 3, 550, 650,
        "Hello!",
        "eres toro el perro, hablas en ingles. Van a repasar 'I' y 'you' con acciones. Dale "
        "dos frases para repetir: 'I am walking' y 'You are running'. Luego dale dos mas: "
        "'I am jumping' y 'You are dancing'. Completa la tarea cuando el jugador diga al menos "
        "dos. Repaso, no introduzcas gramatica nueva."),
    ("pronoun_square", "Sam", 1, 850, 450,
        "Hi!",
        "Eres sam, hablas ingles. Van a repasar 'he' y 'she' con acciones. Dale dos frases "
        "para repetir: 'He is reading' y 'She is singing'. Luego dale dos mas: 'He is playing' "
        "y 'She is walking'. Completa la tarea cuando el jugador diga al menos dos. Repaso, "
        "sin gramatica nueva."),
    ("pronoun_square", "Joy", 9, 50, 450,
        "Hello there!",
        "Eres Joy, hablas ingles. Van a repasar 'it' con el clima. Dale dos frases para "
        "repetir: 'It is raining' y 'It is sunny'. Luego dale dos mas: 'It is cold' y "
        "'It is windy'. Completa la tarea cuando el jugador diga al menos dos. Repaso, sin "
        "gramatica nueva."),
    ("pronoun_square", "Ann", 4, 50, 650,
        "Hey there!",
        "Eres Ann, hablas ingles. Van a repasar 'we' y 'they'. Dale dos frases para repetir: "
        "'We are playing' y 'They are dancing'. Luego dale dos mas: 'We are happy' y "
        "'They are here'. Completa la tarea cuando el jugador diga al menos dos. Repaso, sin "
        "gramatica nueva."),
    ("pronoun_square", "Tom", 6, 850, 650,
        "What's up!",
        "Eres Tom, hablas ingles. Este es el repaso final antes del examen. Pide al jugador "
        "una frase corta con cada uno de los 7 pronombres (I, you, he, she, it, we, they). Si "
        "no sabe que decir, sugierele que puede repetir frases simples como 'I am happy', "
        "'You are nice', 'He is here', 'She is here', 'It is fun', 'We are ready', "
        "'They are ready'. Completa la tarea cuando mencione los 7."),
]

for scene_key, name, def_id, x, y, greeting, instructions in FIXES:
    row = get_npc(scene_key, def_id, x, y, TOKEN)
    update_npc(row, {"greeting": greeting, "instructions": instructions}, TOKEN,
               f"{name} ({scene_key}): saludo limpio + patron 2+2")

print(f"\n[ok] {len(FIXES)} NPCs actualizados (Mochi de pronoun_village no se toca -- su greeting es el gate si/no en si mismo).")
