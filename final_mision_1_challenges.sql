-- ==========================================
-- Card Ninja — MUNDO 1: Saludos y Presentaciones
-- Pool del EXAMEN FINAL (worlds.exam_tag = 'final_mision_1')
-- ------------------------------------------
-- Estas preguntas SOLO se sacan en el mapa final de mundo_1 (el boss map).
-- No tocan el pool normal del mundo (worlds.challenge_tags) ni ningún otro mundo.
-- Se incluye también 'vocabulary' y el tag temático (greetings / introductions)
-- para que sigan sirviendo como categoría normal en /practice.
--
-- Reglas aplicadas (mismas que el resto del catálogo):
--   * Pregunta corta, formato "completa el espacio" con contexto de una frase.
--   * Opciones cortas y visualmente distintas entre sí.
--   * correct_option variado (no siempre 1) para que la card no sea trivial.
--   * tags = solo temática + ruteo del examen, sin duplicar difficulty.
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Saludos y despedidas (greetings)
-- ==========================================
('vocabulary', 'It''s 7 AM. You say: "_____!" ☀️', 'Good morning', 'Good evening', 'Good night', 1, '"Good morning" se usa por la mañana, hasta el mediodía.', 'Son las 7 AM. Dices: "_____!"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'It''s 3 PM. You say: "_____!" 🌤️', 'Good night', 'Good afternoon', 'Goodbye', 2, '"Good afternoon" se usa desde el mediodía hasta el atardecer.', 'Son las 3 PM. Dices: "_____!"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'It''s 9 PM and you just arrived. You say: "_____!" 🌙', 'Good afternoon', 'Hello', 'Good evening', 3, '"Good evening" se usa al caer la noche, como saludo (no despedida).', 'Son las 9 PM y acabas de llegar. Dices: "_____!"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'Before going to sleep, you say: "_____!" 😴', 'Good night', 'Good morning', 'Hello', 1, '"Good night" se usa para despedirse antes de dormir, no como saludo de llegada.', 'Antes de dormir, dices: "_____!"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'A casual way to say "Hello" is: "_____!" 👋', 'Sorry', 'Hi', 'Please', 2, '"Hi" es una forma informal y muy común de saludar.', 'Una forma informal de decir "Hola" es: "_____!"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'When you leave a place, you say: "_____!" 🚪', 'Goodbye', 'Hello', 'Please', 1, '"Goodbye" se usa para despedirse.', 'Cuando te vas de un lugar, dices: "_____!"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'A short, informal way to say "Goodbye" is: "_____!" 👋', 'Sorry', 'Hi', 'Bye', 3, '"Bye" es la forma corta e informal de despedirse.', 'Una forma corta e informal de decir "Adiós" es: "_____!"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'You will see your friend again very soon. You say: "See you _____!" ⏰', 'yesterday', 'never', 'later', 3, '"See you later" significa "nos vemos pronto/más tarde".', 'Verás a tu amigo de nuevo muy pronto. Dices: "See you _____!"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'You have class again tomorrow. You say: "See you _____!" 📅', 'tomorrow', 'yesterday', 'never', 1, '"See you tomorrow" se usa cuando volverás a ver a alguien al día siguiente.', 'Mañana tienes clase otra vez. Dices: "See you _____!"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'A warm way to say goodbye to someone you care about is: "_____!" 🤗', 'Take off', 'Take away', 'Take care', 3, '"Take care" significa "cuídate", una despedida cariñosa.', 'Una forma cariñosa de despedirse es: "_____!"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'A friendly, informal greeting when you see someone you know is: "_____, how''s it going?" ✋', 'Sorry', 'Hey', 'Please', 2, '"Hey" es un saludo informal y amistoso entre conocidos.', 'Un saludo amistoso al ver a alguien conocido es: "_____, ¿cómo te va?"', '{final_mision_1,vocabulary,greetings}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Presentarse y conocer a alguien (introductions)
-- ==========================================
('vocabulary', '"_____ name is Ana." (telling your own name) 🙋‍♀️', 'My', 'Your', 'His', 1, '"My name is..." se usa para decir tu propio nombre.', '"_____ nombre es Ana." (diciendo tu propio nombre)', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"What is your _____?" 🤔', 'color', 'age', 'name', 3, '"What is your name?" pregunta el nombre de alguien.', '"¿Cuál es tu _____?"', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'Just after meeting someone for the first time, you say: "Nice to _____ you!" 🤝', 'know', 'meet', 'see', 2, '"Nice to meet you" se dice al conocer a alguien por primera vez.', 'Justo después de conocer a alguien por primera vez, dices: "Nice to _____ you!"', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"I _____ from Colombia." 🌎', 'is', 'are', 'am', 3, '"I am" (yo soy/estoy) siempre va con el pronombre "I".', '"Yo _____ de Colombia."', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Where _____ you from?" 🗺️', 'are', 'is', 'am', 1, '"Are" se usa con "you" en preguntas: "Where are you from?"', '"¿De dónde _____ (tú)?"', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"She _____ my sister." 👧', 'am', 'are', 'is', 3, '"Is" se usa con "he / she / it" en presente del verbo "to be".', '"Ella _____ mi hermana."', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"How _____ are you?" (asking about years) 🎂', 'tall', 'old', 'many', 2, '"How old are you?" pregunta la edad de alguien.', '"¿Qué edad tienes?"', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"I am ten years _____." 🎂', 'new', 'young', 'old', 3, '"Years old" se usa para decir la edad: "I am ten years old."', '"Tengo diez años." → "I am ten years _____."', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"_____ you, I am fine." (answering "How are you?") 😊', 'Thank', 'Please', 'Sorry', 1, '"Thank you" se agrega al responder cortésmente cómo estás.', '"_____, estoy bien." (respondiendo "¿Cómo estás?")', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"How are _____?" (asking someone about themselves) 🙂', 'your', 'yours', 'you', 3, '"How are you?" usa el pronombre "you".', '"¿Cómo _____?" (preguntándole a alguien)', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"This is _____ friend, Carlos." (introducing someone) 👬', 'I', 'me', 'my', 3, '"My friend" usa el posesivo "my" (mi).', '"Este es _____ amigo, Carlos."', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'A polite way to ask where someone lives is: "Where do you _____?" 🏠', 'eat', 'play', 'live', 3, '"Where do you live?" pregunta dónde vive alguien.', 'Una forma cortés de preguntar dónde vive alguien es: "Where do you _____?"', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"_____ are you?" → "I''m fine, thanks!" 😄', 'Who', 'How', 'What', 2, '"How are you?" pregunta por el estado de ánimo o salud de alguien.', '"¿_____ estás?" → "¡Estoy bien, gracias!"', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Pleased to meet you _____." (responding to an introduction) 🤝', 'to', 'too', 'two', 2, '"Too" (también) — no confundir con "to" (preposición) ni "two" (número 2).', '"Encantado de conocerte _____." (respondiendo a una presentación)', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"I come _____ Mexico." 🇲🇽', 'of', 'at', 'from', 3, '"Come from" se usa para decir el país o lugar de origen.', '"Yo vengo _____ México."', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"_____ to meet you!" (said when you meet someone new) 😊', 'Nice', 'Good', 'Well', 1, '"Nice to meet you" es la expresión completa para conocer a alguien.', '"¡_____ conocerte!" (se dice al conocer a alguien nuevo)', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"I''m from Peru. _____ are you from?" (asking back) 🔄', 'What', 'Who', 'Where', 3, '"Where are you from?" pregunta el país o lugar de origen.', '"Soy de Perú. ¿_____ eres tú?" (preguntando de vuelta)', '{final_mision_1,vocabulary,introductions}', 'beginner', 'english', NULL, false, NULL);
