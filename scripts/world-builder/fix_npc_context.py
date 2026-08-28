"""
Ajuste transversal: las instrucciones de los NPC (mundos 2-9) enseñan la
frase pero no explican CUANDO/POR QUE se usa -- el jugador repite sin
entender el porque. Se inserta una frase de contexto (la regla gramatical
en terminos simples) justo despues de "hablas ingles." y antes de
"Dale .../Pide al jugador ...", sin tocar los ejemplos ni el criterio de
finalizacion.

No toca a los NPC "puerta" (Mochi) -- ya tienen su propio patron
correcto (lesson 2 del README).

Uso:
    python fix_npc_context.py            # aplica los cambios
    python fix_npc_context.py --dry-run  # solo muestra el resultado
"""
import json
import re
import sys

from _client import call, login, must

TOKEN = login()
DRY_RUN = "--dry-run" in sys.argv

# scene -> npc_name -> frase de contexto (la regla, en espanol, explicando
# CUANDO se usa la forma que ese NPC enseña/repasa).
CONTEXT = {
    # ── Mundo 2: Pronombres ──
    "pronoun_village": {
        "Joy": "'I' se usa para hablar de ti mismo, y 'you' para hablar de la persona con la que hablas.",
        "Ann": "'He' se usa para hablar de un hombre y 'she' para hablar de una mujer, en vez de repetir su nombre.",
        "Sam": "'It' se usa para hablar de un objeto o un animal, nunca de una persona.",
        "Amy": "'We' es tu y otras personas juntas (te incluye); 'they' es un grupo de otras personas sin incluirte a ti.",
    },
    "pronoun_village_2": {
        "Joy": "Recuerda: 'I' eres tu mismo, 'you' es la persona con la que hablas.",
        "Ann": "Recuerda: 'he' es para un hombre, 'she' es para una mujer.",
        "Tom": "Recuerda: 'they' es un grupo de personas sin incluirte a ti.",
        "Sam": "Recuerda: 'it' es para animales y objetos, no personas.",
        "Zoe": "Recuerda: 'we' es tu y otras personas juntas, siempre te incluye.",
    },
    "pronoun_square": {
        "Toro": "Recuerda: 'I' eres tu mismo, 'you' es la otra persona.",
        "Sam": "Recuerda: 'he' es un hombre, 'she' es una mujer.",
        "Joy": "Recuerda: 'it' tambien se usa para el clima, aunque no haya un objeto real, como en 'It is raining'.",
        "Ann": "Recuerda: 'we' te incluye a ti, 'they' no te incluye.",
        "Tom": "Recuerda los 7 pronombres: I, you, he, she, it, we, they -- cada uno segun de quien hables.",
    },
    # ── Mundo 3: I am a/an (profesiones) ──
    "career_village_1": {
        "Joy": "'I am a farmer' se usa para decir cual es tu profesion. Se dice 'a farmer' porque 'farmer' empieza con sonido consonante.",
        "Ann": "'I am a teacher' se usa para decir cual es tu profesion. Se dice 'a teacher' porque 'teacher' empieza con sonido consonante.",
        "Sam": "'I am a doctor' se usa para decir cual es tu profesion. Se dice 'a doctor' porque 'doctor' empieza con sonido consonante.",
        "Amy": "'I am a student' se usa para decir cual es tu profesion. Se dice 'a student' porque 'student' empieza con sonido consonante.",
    },
    "career_village_2": {
        "Joy": "'I am a chef' se usa para decir cual es tu profesion. Se dice 'a chef' porque 'chef' empieza con sonido consonante.",
        "Ann": "'I am a nurse' se usa para decir cual es tu profesion. Se dice 'a nurse' porque 'nurse' empieza con sonido consonante.",
        "Sam": "'I am a driver' se usa para decir cual es tu profesion. Se dice 'a driver' porque 'driver' empieza con sonido consonante.",
        "Zoe": "'I am an artist' se usa para decir cual es tu profesion. Se dice 'an artist' (con 'an', no 'a') porque 'artist' empieza con sonido vocal.",
        "Tom": "'I am a police officer' se usa para decir cual es tu profesion. Se dice 'a police officer' porque empieza con sonido consonante.",
    },
    "career_square": {
        "Toro": "Recuerda: se dice 'a farmer' y 'a chef' -- ambas empiezan con sonido consonante, por eso usan 'a'.",
        "Sam": "Recuerda: se dice 'a teacher' y 'a nurse' -- ambas usan 'a' porque empiezan con sonido consonante.",
        "Joy": "Recuerda: se dice 'a doctor' y 'a driver' -- ambas usan 'a' porque empiezan con sonido consonante.",
        "Ann": "Recuerda: se dice 'a student' pero 'an artist' -- 'an' va antes de sonido vocal.",
        "Tom": "Recuerda: 'I am a/an' + profesion dice quien eres. 'A' antes de consonante, 'an' antes de vocal.",
    },
    # ── Mundo 4: You are / He is / She is (mismas profesiones) ──
    "you_are_village": {
        "Joy": "'You are a farmer' es igual que 'I am a farmer' pero cambiando el sujeto: con 'you' se usa 'are', no 'am'.",
        "Ann": "'You are a teacher' es igual que 'I am a teacher' pero con 'you' se usa 'are', no 'am'.",
        "Sam": "'You are a doctor' es igual que 'I am a doctor' pero con 'you' se usa 'are', no 'am'.",
        "Amy": "'You are a student' es igual que 'I am a student' pero con 'you' se usa 'are', no 'am'.",
    },
    "he_she_village": {
        "Joy": "'He is a chef' se usa para hablar de otra persona (un hombre). Con 'he' y 'she' se usa 'is', igual que con 'it'.",
        "Ann": "'She is a nurse' se usa para hablar de otra persona (una mujer). Con 'he' y 'she' se usa 'is'.",
        "Sam": "'He is a driver' se usa para hablar de otra persona (un hombre). Con 'he' se usa 'is'.",
        "Zoe": "'She is an artist' se usa para hablar de otra persona (una mujer). Con 'she' se usa 'is', y 'an' porque 'artist' empieza con vocal.",
        "Tom": "'He is a police officer' se usa para hablar de otra persona (un hombre). Con 'he' se usa 'is'.",
    },
    "subject_be_square": {
        "Toro": "Recuerda: con 'I' se usa 'am' y con 'you' se usa 'are' -- el verbo 'to be' cambia segun el sujeto, aunque la profesion sea la misma.",
        "Sam": "Recuerda: tanto 'he' como 'she' usan 'is' -- lo que cambia es de quien hablas (hombre o mujer), no el verbo.",
        "Joy": "Recuerda: la profesion es la misma, pero el verbo cambia de 'are' (you) a 'is' (he), segun el sujeto.",
        "Ann": "Recuerda: I am, you are, he/she is -- el verbo 'to be' siempre depende del sujeto.",
        "Tom": "Recuerda: I am / you are / he is / she is -- mismo verbo 'to be', forma distinta segun quien hable.",
    },
    # ── Mundo 5: It is a/an [adjetivo] ___ ──
    "itis_village_1": {
        "Joy": "'It is a good dog' describe algo con un adjetivo. El adjetivo ('good') va DESPUES del articulo y ANTES del sustantivo ('dog').",
        "Ann": "'It is a big house' describe algo con un adjetivo. El adjetivo ('big') va DESPUES del articulo y ANTES del sustantivo ('house').",
        "Sam": "'It is a small cat' describe algo con un adjetivo. El adjetivo ('small') va DESPUES del articulo y ANTES del sustantivo ('cat').",
        "Amy": "'It is an old car' describe algo con un adjetivo. Se usa 'an' porque 'old' empieza con sonido vocal.",
    },
    "itis_village_2": {
        "Joy": "'It is a new book' describe algo con un adjetivo. El adjetivo ('new') va DESPUES del articulo y ANTES del sustantivo.",
        "Ann": "'It is a hot day' describe algo con un adjetivo. El adjetivo ('hot') va DESPUES del articulo y ANTES del sustantivo.",
        "Sam": "'It is a cold drink' describe algo con un adjetivo. El adjetivo ('cold') va DESPUES del articulo y ANTES del sustantivo.",
        "Zoe": "'It is a fast car' describe algo con un adjetivo. El adjetivo ('fast') va DESPUES del articulo y ANTES del sustantivo.",
        "Tom": "'It is a slow turtle' describe algo con un adjetivo. El adjetivo ('slow') va DESPUES del articulo y ANTES del sustantivo.",
    },
    "itis_square": {
        "Toro": "Recuerda: el adjetivo va entre el articulo y el sustantivo -- 'a good dog', 'a big house'.",
        "Sam": "Recuerda: 'a small cat' y 'an old car' -- 'an' porque 'old' empieza con vocal.",
        "Joy": "Recuerda: 'a new book' y 'a hot day' -- el adjetivo siempre va antes del sustantivo.",
        "Ann": "Recuerda: 'a cold drink', 'a fast car', 'a slow turtle' -- mismo patron, distinto adjetivo.",
        "Tom": "Recuerda: 'It is a/an' + adjetivo + sustantivo describe cualquier cosa.",
    },
    # ── Mundo 6: Negativo ──
    "notme_village": {
        "Joy": "Para negar 'I am a farmer', se agrega 'not': 'I'm not a farmer'. En afirmativo es 'I am a farmer'; en negativo, 'I'm not a farmer'.",
        "Ann": "Para negar 'I am a teacher', se agrega 'not': 'I'm not a teacher'. En afirmativo es 'I am a teacher'; en negativo, 'I'm not a teacher'.",
        "Sam": "Para negar 'I am a doctor', se agrega 'not': 'I'm not a doctor'. En afirmativo es 'I am a doctor'; en negativo, 'I'm not a doctor'.",
        "Amy": "Para negar 'I am a student', se agrega 'not': 'I'm not a student'. En afirmativo es 'I am a student'; en negativo, 'I'm not a student'.",
    },
    "notyou_village": {
        "Joy": "En afirmativo decimos 'You are a chef'; en negativo, 'You aren't a chef' (you are not).",
        "Ann": "En afirmativo decimos 'He is a nurse'; en negativo, 'He isn't a nurse' (he is not).",
        "Sam": "En afirmativo decimos 'She is a driver'; en negativo, 'She isn't a driver' (she is not).",
        "Zoe": "En afirmativo decimos 'He is an artist'; en negativo, 'He isn't an artist' (he is not).",
        "Tom": "En afirmativo decimos 'You are a police officer'; en negativo, 'You aren't a police officer' (you are not).",
    },
    "negative_square": {
        "Toro": "Recuerda el contraste: afirmativo 'I am a farmer', negativo 'I'm not a farmer'.",
        "Sam": "Recuerda el contraste: afirmativo 'He is a doctor' / negativo 'He isn't a doctor'; afirmativo 'She is a nurse' / negativo 'She isn't a nurse'.",
        "Joy": "Recuerda el contraste: afirmativo 'You are a teacher', negativo 'You aren't a teacher'.",
        "Ann": "Recuerda: cualquier profesion se niega agregando 'not' -- I'm not / you aren't / he isn't / she isn't.",
        "Tom": "Recuerda: afirmativo sin 'not', negativo con 'not' -- I'm not, you aren't, he/she isn't.",
    },
    # ── Mundo 7: Pregunta + respuesta corta ──
    "areyou_village": {
        "Joy": "En afirmativo decimos 'I am a farmer'. Para preguntar, el verbo va antes del sujeto: 'Are you a farmer?'. La respuesta corta es 'Yes, I am' o 'No, I'm not'.",
        "Ann": "En afirmativo decimos 'I am a teacher'. En pregunta, 'Are you a teacher?'. La respuesta corta es 'Yes, I am' o 'No, I'm not'.",
        "Sam": "En afirmativo decimos 'I am a doctor'. En pregunta, 'Are you a doctor?'. La respuesta corta es 'Yes, I am' o 'No, I'm not'.",
        "Amy": "En afirmativo decimos 'I am a student'. En pregunta, 'Are you a student?'. La respuesta corta es 'Yes, I am' o 'No, I'm not'.",
    },
    "ishe_village": {
        "Joy": "En afirmativo decimos 'He is a chef'. En pregunta, 'Is he a chef?'. La respuesta corta es 'Yes, he is' o 'No, he isn't'.",
        "Ann": "En afirmativo decimos 'She is a nurse'. En pregunta, 'Is she a nurse?'. La respuesta corta es 'Yes, she is' o 'No, she isn't'.",
        "Sam": "En afirmativo decimos 'He is a driver'. En pregunta, 'Is he a driver?'. La respuesta corta es 'Yes, he is' o 'No, he isn't'.",
        "Zoe": "En afirmativo decimos 'She is an artist'. En pregunta, 'Is she an artist?'. La respuesta corta es 'Yes, she is' o 'No, she isn't'.",
        "Tom": "En afirmativo decimos 'He is a police officer'. En pregunta, 'Is he a police officer?'. La respuesta corta es 'Yes, he is' o 'No, he isn't'.",
    },
    "question_square": {
        "Toro": "Recuerda: afirmativo 'I am a farmer', pregunta 'Are you a farmer?', respuesta corta 'Yes, I am' / 'No, I'm not'.",
        "Sam": "Recuerda: afirmativo 'He is a doctor', pregunta 'Is he a doctor?', respuesta corta 'Yes, he is' / 'No, he isn't'.",
        "Joy": "Recuerda: afirmativo 'She is a teacher', pregunta 'Is she a teacher?', respuesta corta 'Yes, she is' / 'No, she isn't'.",
        "Ann": "Recuerda: para preguntar con 'to be', el verbo va antes del sujeto; la respuesta corta repite ese mismo verbo con 'yes/no'.",
        "Tom": "Recuerda: afirmativo sin invertir el verbo, pregunta con el verbo antes del sujeto, respuesta corta repitiendo el verbo.",
    },
    # ── Mundo 8: Posesivos ──
    "possessive_village_1": {
        "Joy": "'My' se usa para decir que algo es tuyo (de quien habla). Por ejemplo, si el libro es tuyo, dices 'This is my book'.",
        "Ann": "'Your' se usa para decir que algo es de la persona con la que hablas. Por ejemplo, si el boligrafo es de tu amigo, le dices 'This is your pen'.",
        "Sam": "'His' se usa para decir que algo es de el (un hombre). Por ejemplo, si el carro es de un chico, dices 'This is his car'.",
        "Amy": "'Her' se usa para decir que algo es de ella (una mujer). Por ejemplo, si la casa es de una chica, dices 'This is her house'.",
    },
    "possessive_village_2": {
        "Joy": "'Its' se usa para animales u objetos, nunca para personas. Por ejemplo, la cola del perro: 'The dog wags its tail' -- y nunca lleva apostrofe.",
        "Ann": "'Our' se usa para decir que algo es de ti y de otras personas juntas (nosotros). Por ejemplo, 'This is our bag' si la mochila es de tu grupo.",
        "Sam": "'Their' se usa para decir que algo es de un grupo de personas (ellos/ellas). Por ejemplo, 'This is their toy' si el juguete es de ellos.",
        "Zoe": "'Our' se usa para decir que algo es de ti y de otras personas juntas. Por ejemplo, 'This is our house' si la casa es de tu grupo.",
        "Tom": "'Their' se usa para decir que algo es de un grupo de personas. Por ejemplo, 'This is their car' si el carro es de ellos.",
    },
    "possessive_square": {
        "Toro": "Recuerda: 'my' es tuyo (de quien habla), 'your' es de con quien hablas.",
        "Sam": "Recuerda: 'his' es de el, 'her' es de ella.",
        "Joy": "Recuerda: 'its' es para animales y objetos, y nunca lleva apostrofe.",
        "Ann": "Recuerda: 'our' te incluye a ti y a otros, 'their' es de un grupo sin incluirte.",
        "Tom": "Recuerda los 7: my, your, his, her, its, our, their -- cada uno dice de quien es algo.",
    },
    # ── Mundo 9: Plural y articulos ──
    "twofold_market_1": {
        "Joy": "'This' senala algo cerca. Usamos 'a' antes de sonido consonante ('a cat') y 'an' antes de sonido vocal ('an apple').",
        "Ann": "'That' senala algo lejos. Igual que con 'this', usamos 'a' antes de consonante ('a dog') y 'an' antes de vocal ('an orange').",
        "Sam": "'This' senala algo cerca -- recuerda 'a' antes de consonante ('a book') y 'an' antes de vocal ('an egg').",
        "Amy": "'That' senala algo lejos -- 'a' antes de consonante ('a house') y 'an' antes de vocal ('an umbrella').",
    },
    "twofold_market_2": {
        "Joy": "'These' es el plural de 'this' (cerca). En plural no se usa 'a/an', solo se agrega '-s': 'these are cats'.",
        "Ann": "'Those' es el plural de 'that' (lejos). En plural no se usa 'a/an': 'those are dogs'.",
        "Sam": "'These' es el plural de 'this'. Se agrega '-s' y no se usa 'a/an': 'these are books'.",
        "Zoe": "'Those' es el plural de 'that'. Se agrega '-s' y no se usa 'a/an': 'those are houses'.",
        "Tom": "Recuerda: this->these (cerca) y that->those (lejos) al pasar a plural, y se quita el 'a/an'.",
    },
    "twofold_square": {
        "Toro": "Recuerda: singular cerca es 'this is a ___', plural cerca es 'these are ___s'.",
        "Sam": "Recuerda: singular lejos es 'that is a ___', plural lejos es 'those are ___s'.",
        "Joy": "Recuerda: 'a' antes de sonido consonante, 'an' antes de sonido vocal.",
        "Ann": "'The' se usa para algo especifico ya mencionado, a diferencia de 'a/an' que es para algo general. Por ejemplo: 'I have a cat. The cat is black.'",
        "Tom": "Recuerda: this/that para singular, these/those para plural, a/an para algo general, the para algo especifico.",
    },
}

SPLIT_RE = re.compile(r"^(.*?hablas (?:en )?ingl[eé]s\.)\s*")

results = []
for scene, names in CONTEXT.items():
    status, npcs = call("GET", f"/admin/npc-instances?scene_key={scene}", token=TOKEN)
    if status != 200:
        print(f"FAILED fetching npcs for {scene}: {status} {npcs}")
        raise SystemExit(1)
    byName = {n["npc_definition"]["name"]: n for n in npcs}
    for name, context in names.items():
        row = byName.get(name)
        if not row:
            print(f"[WARN] no encontre a {name} en {scene}")
            continue
        instr = row["instructions"]
        m1 = SPLIT_RE.match(instr)
        if not m1:
            print(f"[WARN] no pude parsear instructions de {scene}/{name}: {instr[:80]!r}")
            continue
        prefix = m1.group(1)
        rest = instr[m1.end():]
        new_instr = f"{prefix} {context} {rest}"
        results.append((scene, name, row, new_instr))

print(f"\n{len(results)} NPCs a actualizar\n")

if DRY_RUN:
    for scene, name, row, new_instr in results:
        print(f"=== {scene}/{name} (id={row['id']}) ===")
        print(new_instr)
        print()
else:
    for scene, name, row, new_instr in results:
        body = {
            "scene_key": row["scene_key"],
            "npc_definition_id": row["npc_definition_id"],
            "position_x": row["position_x"],
            "position_y": row["position_y"],
            "facing_direction": row["facing_direction"],
            "default_state": row["default_state"],
            "interaction_radius": row["interaction_radius"],
            "movement_type": row["movement_type"],
            "movement_range": row["movement_range"],
            "movement_speed": row["movement_speed"],
            "waypoints": row["waypoints"] or [],
            "auto_dialogue": row["auto_dialogue"],
            "auto_close_dialogue": row["auto_close_dialogue"],
            "instructions": new_instr,
            "success_message": row["success_message"],
            "greeting": row["greeting"],
        }
        must("PUT", f"/admin/npcs/{row['id']}", body, TOKEN, f"npc {scene}/{name} (id={row['id']})")

    print(f"\n[ok] {len(results)} NPCs actualizados con contexto.")
