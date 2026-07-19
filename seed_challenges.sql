-- ==========================================
-- Card Ninja — VOCABULARY / Beginner
-- Modo: Combate arcade (pregunta rápida = ataque)
-- Reglas aplicadas:
--   * Pregunta corta (idealmente con emoji de apoyo visual)
--   * Opciones de UNA sola palabra (nada de frases largas)
--   * Distractores visualmente distintos entre sí
--     (evitar misma letra inicial o mismo largo entre las 3 opciones)
--   * tags = solo temática, sin duplicar difficulty
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Animales
-- ==========================================
('vocabulary', 'What is this? 🐶', 'dog', 'fish', 'ant', 1, '"Dog" significa perro.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🐱', 'cat', 'owl', 'bee', 1, '"Cat" significa gato.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🐦', 'bird', 'cow', 'pig', 1, '"Bird" significa pájaro.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🐴', 'horse', 'frog', 'duck', 1, '"Horse" significa caballo.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Comida
-- ==========================================
('vocabulary', 'What is this? 🍎', 'apple', 'egg', 'milk', 1, '"Apple" significa manzana.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍞', 'bread', 'ice', 'nut', 1, '"Bread" significa pan.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🥛', 'milk', 'salt', 'meat', 1, '"Milk" significa leche.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍌', 'banana', 'onion', 'grape', 1, '"Banana" significa plátano.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Colores
-- ==========================================
('vocabulary', 'What color is this? 🔴', 'red', 'blue', 'pink', 1, '"Red" es el color rojo.', '¿Qué color es este?', '{vocabulary,colors}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What color is this? 🟢', 'green', 'grey', 'white', 1, '"Green" es el color verde.', '¿Qué color es este?', '{vocabulary,colors}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What color is this? 🟡', 'yellow', 'black', 'brown', 1, '"Yellow" es el color amarillo.', '¿Qué color es este?', '{vocabulary,colors}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What color is this? 🟣', 'purple', 'orange', 'silver', 1, '"Purple" es el color morado.', '¿Qué color es este?', '{vocabulary,colors}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Números
-- ==========================================
('vocabulary', 'How many? 🍎🍎', 'two', 'six', 'nine', 1, '"Two" significa dos.', '¿Cuántos hay?', '{vocabulary,numbers}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'How many? 🍎🍎🍎🍎🍎', 'five', 'one', 'eight', 1, '"Five" significa cinco.', '¿Cuántos hay?', '{vocabulary,numbers}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'How many? 🍎', 'one', 'ten', 'four', 1, '"One" significa uno.', '¿Cuántos hay?', '{vocabulary,numbers}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Objetos cotidianos
-- ==========================================
('vocabulary', 'What is this? 🪑', 'chair', 'lamp', 'door', 1, '"Chair" significa silla.', '¿Qué es esto?', '{vocabulary,objects}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 📱', 'phone', 'clock', 'shoe', 1, '"Phone" significa teléfono.', '¿Qué es esto?', '{vocabulary,objects}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 📚', 'book', 'ring', 'cup', 1, '"Book" significa libro.', '¿Qué es esto?', '{vocabulary,objects}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🔑', 'key', 'bag', 'hat', 1, '"Key" significa llave.', '¿Qué es esto?', '{vocabulary,objects}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Cuerpo / Familia (traducción directa ES → EN, corta)
-- ==========================================
('vocabulary', '"Mamá" en inglés es:', 'mother', 'father', 'sister', 1, '"Mother" significa mamá.', 'Traduce la palabra', '{vocabulary,family}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Papá" en inglés es:', 'father', 'mother', 'brother', 1, '"Father" significa papá.', 'Traduce la palabra', '{vocabulary,family}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Ojo" en inglés es:', 'eye', 'ear', 'arm', 1, '"Eye" significa ojo.', 'Traduce la palabra', '{vocabulary,body}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Mano" en inglés es:', 'hand', 'foot', 'head', 1, '"Hand" significa mano.', 'Traduce la palabra', '{vocabulary,body}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Acciones (verbo único, sin phrasal verbs — eso queda para intermediate)
-- ==========================================
('vocabulary', '"Correr" en inglés es:', 'run', 'jump', 'swim', 1, '"Run" significa correr.', 'Traduce la palabra', '{vocabulary,actions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Comer" en inglés es:', 'eat', 'drink', 'sleep', 1, '"Eat" significa comer.', 'Traduce la palabra', '{vocabulary,actions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Dormir" en inglés es:', 'sleep', 'walk', 'read', 1, '"Sleep" significa dormir.', 'Traduce la palabra', '{vocabulary,actions}', 'beginner', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Beginner (Set 2)
-- Modo: Combate arcade — mismas reglas que el set 1
--   * Pregunta corta con emoji de apoyo
--   * Opciones de UNA sola palabra
--   * Distractores visualmente distintos (largo/letra inicial diferente)
--   * tags = solo temática, sin duplicar difficulty
-- Vocabulario nuevo, sin solapar con el set anterior (animals, food,
-- colors, numbers, objects, family, body, actions ya usados ahí).
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Más animales
-- ==========================================
('vocabulary', 'What is this? 🐻', 'bear', 'ant', 'fox', 1, '"Bear" significa oso.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🐘', 'elephant', 'mouse', 'bee', 1, '"Elephant" significa elefante.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🐍', 'snake', 'sheep', 'wolf', 1, '"Snake" significa serpiente.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🐭', 'mouse', 'lion', 'goat', 1, '"Mouse" significa ratón.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Más comida
-- ==========================================
('vocabulary', 'What is this? 🧀', 'cheese', 'soup', 'salt', 1, '"Cheese" significa queso.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍚', 'rice', 'egg', 'nut', 1, '"Rice" significa arroz.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍰', 'cake', 'meat', 'juice', 1, '"Cake" significa pastel.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍗', 'chicken', 'bread', 'butter', 1, '"Chicken" significa pollo.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Más colores
-- ==========================================
('vocabulary', 'What color is this? ⚫', 'black', 'white', 'green', 1, '"Black" es el color negro.', '¿Qué color es este?', '{vocabulary,colors}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What color is this? ⚪', 'white', 'black', 'red', 1, '"White" es el color blanco.', '¿Qué color es este?', '{vocabulary,colors}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What color is this? 🟤', 'brown', 'pink', 'blue', 1, '"Brown" es el color café.', '¿Qué color es este?', '{vocabulary,colors}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What color is this? 💗', 'pink', 'yellow', 'grey', 1, '"Pink" es el color rosado.', '¿Qué color es este?', '{vocabulary,colors}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Números (6-10)
-- ==========================================
('vocabulary', 'How many? 🍎🍎🍎🍎🍎🍎', 'six', 'two', 'nine', 1, '"Six" significa seis.', '¿Cuántos hay?', '{vocabulary,numbers}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'How many? 🍎🍎🍎🍎🍎🍎🍎🍎', 'eight', 'three', 'ten', 1, '"Eight" significa ocho.', '¿Cuántos hay?', '{vocabulary,numbers}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'How many? 🍎🍎🍎🍎🍎🍎🍎🍎🍎🍎', 'ten', 'four', 'seven', 1, '"Ten" significa diez.', '¿Cuántos hay?', '{vocabulary,numbers}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Ropa
-- ==========================================
('vocabulary', 'What is this? 👕', 'shirt', 'shoe', 'hat', 1, '"Shirt" significa camisa.', '¿Qué es esto?', '{vocabulary,clothing}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 👟', 'shoe', 'sock', 'coat', 1, '"Shoe" significa zapato.', '¿Qué es esto?', '{vocabulary,clothing}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🧢', 'hat', 'bag', 'belt', 1, '"Hat" significa gorra.', '¿Qué es esto?', '{vocabulary,clothing}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Clima
-- ==========================================
('vocabulary', 'What is this? ☀️', 'sun', 'rain', 'snow', 1, '"Sun" significa sol.', '¿Qué es esto?', '{vocabulary,weather}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🌧️', 'rain', 'wind', 'sun', 1, '"Rain" significa lluvia.', '¿Qué es esto?', '{vocabulary,weather}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? ❄️', 'snow', 'cloud', 'storm', 1, '"Snow" significa nieve.', '¿Qué es esto?', '{vocabulary,weather}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Transporte
-- ==========================================
('vocabulary', 'What is this? 🚌', 'bus', 'bike', 'boat', 1, '"Bus" significa autobús.', '¿Qué es esto?', '{vocabulary,transport}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🚂', 'train', 'plane', 'car', 1, '"Train" significa tren.', '¿Qué es esto?', '{vocabulary,transport}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? ✈️', 'plane', 'train', 'ship', 1, '"Plane" significa avión.', '¿Qué es esto?', '{vocabulary,transport}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Naturaleza
-- ==========================================
('vocabulary', 'What is this? 🌳', 'tree', 'flower', 'rock', 1, '"Tree" significa árbol.', '¿Qué es esto?', '{vocabulary,nature}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🌸', 'flower', 'leaf', 'grass', 1, '"Flower" significa flor.', '¿Qué es esto?', '{vocabulary,nature}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? ⛰️', 'mountain', 'river', 'beach', 1, '"Mountain" significa montaña.', '¿Qué es esto?', '{vocabulary,nature}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Más cuerpo / familia
-- ==========================================
('vocabulary', '"Pie" en inglés es:', 'foot', 'leg', 'arm', 1, '"Foot" significa pie.', 'Traduce la palabra', '{vocabulary,body}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Hermana" en inglés es:', 'sister', 'brother', 'cousin', 1, '"Sister" significa hermana.', 'Traduce la palabra', '{vocabulary,family}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Hermano" en inglés es:', 'brother', 'sister', 'friend', 1, '"Brother" significa hermano.', 'Traduce la palabra', '{vocabulary,family}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Más acciones
-- ==========================================
('vocabulary', '"Escribir" en inglés es:', 'write', 'read', 'draw', 1, '"Write" significa escribir.', 'Traduce la palabra', '{vocabulary,actions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Leer" en inglés es:', 'read', 'write', 'sing', 1, '"Read" significa leer.', 'Traduce la palabra', '{vocabulary,actions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Nadar" en inglés es:', 'swim', 'jump', 'walk', 1, '"Swim" significa nadar.', 'Traduce la palabra', '{vocabulary,actions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Jugar" en inglés es:', 'play', 'work', 'rest', 1, '"Play" significa jugar.', 'Traduce la palabra', '{vocabulary,actions}', 'beginner', 'english', NULL, false, NULL);

-- ==========================================
-- Card Ninja — VOCABULARY / Beginner (Set 3)
-- Enfoque: objetos y acciones de uso diario / vida cotidiana
-- Modo: Combate arcade — mismas reglas que sets anteriores
--   * Pregunta corta con emoji de apoyo
--   * Opciones de UNA sola palabra
--   * Distractores visualmente distintos (largo/letra inicial diferente)
--   * tags = solo temática, sin duplicar difficulty
-- Vocabulario nuevo, sin solapar con sets 1 y 2.
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Objetos de casa
-- ==========================================
('vocabulary', 'What is this? 🛏️', 'bed', 'door', 'rug', 1, '"Bed" significa cama.', '¿Qué es esto?', '{vocabulary,objects,home}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🚪', 'door', 'wall', 'roof', 1, '"Door" significa puerta.', '¿Qué es esto?', '{vocabulary,objects,home}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🪟', 'window', 'mirror', 'shelf', 1, '"Window" significa ventana.', '¿Qué es esto?', '{vocabulary,objects,home}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? ⏰', 'clock', 'lamp', 'fan', 1, '"Clock" significa reloj.', '¿Qué es esto?', '{vocabulary,objects,home}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 💡', 'lamp', 'clock', 'towel', 1, '"Lamp" significa lámpara.', '¿Qué es esto?', '{vocabulary,objects,home}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🪞', 'mirror', 'window', 'soap', 1, '"Mirror" significa espejo.', '¿Qué es esto?', '{vocabulary,objects,home}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Objetos de cocina/comedor
-- ==========================================
('vocabulary', 'What is this? 🥄', 'spoon', 'fork', 'plate', 1, '"Spoon" significa cuchara.', '¿Qué es esto?', '{vocabulary,objects,kitchen}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍴', 'fork', 'spoon', 'knife', 1, '"Fork" significa tenedor.', '¿Qué es esto?', '{vocabulary,objects,kitchen}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🔪', 'knife', 'plate', 'cup', 1, '"Knife" significa cuchillo.', '¿Qué es esto?', '{vocabulary,objects,kitchen}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍽️', 'plate', 'bowl', 'pot', 1, '"Plate" significa plato.', '¿Qué es esto?', '{vocabulary,objects,kitchen}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? ☕', 'cup', 'glass', 'jar', 1, '"Cup" significa taza.', '¿Qué es esto?', '{vocabulary,objects,kitchen}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Objetos personales / tecnología
-- ==========================================
('vocabulary', 'What is this? 👛', 'wallet', 'watch', 'bag', 1, '"Wallet" significa billetera.', '¿Qué es esto?', '{vocabulary,objects,personal}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? ⌚', 'watch', 'ring', 'wallet', 1, '"Watch" significa reloj de pulsera.', '¿Qué es esto?', '{vocabulary,objects,personal}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 👓', 'glasses', 'gloves', 'boots', 1, '"Glasses" significa lentes.', '¿Qué es esto?', '{vocabulary,objects,personal}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? ☂️', 'umbrella', 'towel', 'blanket', 1, '"Umbrella" significa paraguas.', '¿Qué es esto?', '{vocabulary,objects,personal}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 💻', 'computer', 'phone', 'radio', 1, '"Computer" significa computadora.', '¿Qué es esto?', '{vocabulary,objects,tech}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 📺', 'television', 'computer', 'camera', 1, '"Television" significa televisión.', '¿Qué es esto?', '{vocabulary,objects,tech}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Acciones cotidianas (traducción ES → EN)
-- ==========================================
('vocabulary', '"Abrir" en inglés es:', 'open', 'close', 'lock', 1, '"Open" significa abrir.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Cerrar" en inglés es:', 'close', 'open', 'push', 1, '"Close" significa cerrar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Comprar" en inglés es:', 'buy', 'sell', 'pay', 1, '"Buy" significa comprar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Vender" en inglés es:', 'sell', 'buy', 'give', 1, '"Sell" significa vender.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Cocinar" en inglés es:', 'cook', 'clean', 'wash', 1, '"Cook" significa cocinar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Limpiar" en inglés es:', 'clean', 'cook', 'break', 1, '"Clean" significa limpiar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Lavar" en inglés es:', 'wash', 'dry', 'cut', 1, '"Wash" significa lavar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Manejar" en inglés es:', 'drive', 'ride', 'fly', 1, '"Drive" significa manejar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Escuchar" en inglés es:', 'listen', 'hear', 'speak', 1, '"Listen" significa escuchar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Hablar" en inglés es:', 'talk', 'listen', 'shout', 1, '"Talk" significa hablar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Ayudar" en inglés es:', 'help', 'hurt', 'hide', 1, '"Help" significa ayudar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Esperar" en inglés es:', 'wait', 'walk', 'want', 1, '"Wait" significa esperar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Pagar" en inglés es:', 'pay', 'buy', 'save', 1, '"Pay" significa pagar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Dar" en inglés es:', 'give', 'take', 'send', 1, '"Give" significa dar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Tomar / agarrar" en inglés es:', 'take', 'give', 'drop', 1, '"Take" significa tomar o agarrar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Llamar" en inglés es:', 'call', 'ask', 'tell', 1, '"Call" significa llamar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Preguntar" en inglés es:', 'ask', 'answer', 'call', 1, '"Ask" significa preguntar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Trabajar" en inglés es:', 'work', 'rest', 'study', 1, '"Work" significa trabajar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Descansar" en inglés es:', 'rest', 'work', 'run', 1, '"Rest" significa descansar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Usar / llevar puesto" en inglés es:', 'wear', 'wash', 'want', 1, '"Wear" significa usar o llevar puesta una prenda.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL);

-- ==========================================
-- Card Ninja — VOCABULARY / Beginner (Set 4)
-- Enfoque: días de la semana y meses del año
-- Modo: Combate arcade — mismas reglas que sets anteriores
--   * Pregunta corta, sin emoji de apoyo (no hay emoji fiel para días/meses,
--     se usa contexto de secuencia en su lugar)
--   * Opciones de UNA sola palabra
--   * Distractores del mismo campo semántico pero visualmente distintos
--   * tags = solo temática, sin duplicar difficulty
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Días de la semana (traducción directa)
-- ==========================================
('vocabulary', '"Lunes" en inglés es:', 'Monday', 'Sunday', 'Friday', 1, '"Monday" es el primer día de la semana laboral.', 'Traduce la palabra', '{vocabulary,days}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Martes" en inglés es:', 'Tuesday', 'Thursday', 'Saturday', 1, '"Tuesday" es el segundo día de la semana.', 'Traduce la palabra', '{vocabulary,days}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Miércoles" en inglés es:', 'Wednesday', 'Monday', 'Sunday', 1, '"Wednesday" es el día de en medio de la semana.', 'Traduce la palabra', '{vocabulary,days}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Jueves" en inglés es:', 'Thursday', 'Tuesday', 'Friday', 1, '"Thursday" es el cuarto día de la semana.', 'Traduce la palabra', '{vocabulary,days}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Viernes" en inglés es:', 'Friday', 'Monday', 'Wednesday', 1, '"Friday" es el último día laboral de la semana.', 'Traduce la palabra', '{vocabulary,days}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Sábado" en inglés es:', 'Saturday', 'Sunday', 'Tuesday', 1, '"Saturday" es parte del fin de semana.', 'Traduce la palabra', '{vocabulary,days}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Domingo" en inglés es:', 'Sunday', 'Saturday', 'Thursday', 1, '"Sunday" es el último día de la semana.', 'Traduce la palabra', '{vocabulary,days}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Días — reconocimiento en contexto (secuencia)
-- ==========================================
('vocabulary', 'What day comes after Monday?', 'Tuesday', 'Sunday', 'Friday', 1, 'Después de "Monday" viene "Tuesday".', '¿Qué día viene después del lunes?', '{vocabulary,days}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What day comes before Friday?', 'Thursday', 'Saturday', 'Monday', 1, 'Antes de "Friday" viene "Thursday".', '¿Qué día viene antes del viernes?', '{vocabulary,days}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'Which day is part of the weekend?', 'Saturday', 'Wednesday', 'Tuesday', 1, '"Saturday" es parte del fin de semana ("weekend").', '¿Qué día es parte del fin de semana?', '{vocabulary,days}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Meses (primer semestre)
-- ==========================================
('vocabulary', '"Enero" en inglés es:', 'January', 'June', 'July', 1, '"January" es el primer mes del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Febrero" en inglés es:', 'February', 'April', 'August', 1, '"February" es el mes más corto del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Marzo" en inglés es:', 'March', 'May', 'September', 1, '"March" es el tercer mes del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Abril" en inglés es:', 'April', 'August', 'January', 1, '"April" es el cuarto mes del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Mayo" en inglés es:', 'May', 'March', 'June', 1, '"May" es el quinto mes del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Junio" en inglés es:', 'June', 'July', 'January', 1, '"June" es el sexto mes del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Meses (segundo semestre)
-- ==========================================
('vocabulary', '"Julio" en inglés es:', 'July', 'June', 'April', 1, '"July" es el séptimo mes del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Agosto" en inglés es:', 'August', 'April', 'October', 1, '"August" es el octavo mes del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Septiembre" en inglés es:', 'September', 'November', 'February', 1, '"September" es el noveno mes del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Octubre" en inglés es:', 'October', 'August', 'March', 1, '"October" es el décimo mes del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Noviembre" en inglés es:', 'November', 'September', 'December', 1, '"November" es el mes número once.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Diciembre" en inglés es:', 'December', 'November', 'January', 1, '"December" es el último mes del año.', 'Traduce la palabra', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Meses — reconocimiento en contexto (secuencia y estaciones)
-- ==========================================
('vocabulary', 'Which month comes after March?', 'April', 'February', 'June', 1, 'Después de "March" viene "April".', '¿Qué mes viene después de marzo?', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'Which month is the first of the year?', 'January', 'December', 'March', 1, '"January" es el primer mes del año.', '¿Cuál es el primer mes del año?', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'Which month is the last of the year?', 'December', 'October', 'February', 1, '"December" es el último mes del año.', '¿Cuál es el último mes del año?', '{vocabulary,months}', 'beginner', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Beginner (Set 5)
-- Enfoque: direcciones / posiciones espaciales + más acciones cotidianas
-- Modo: Combate arcade — mismas reglas que sets anteriores
--   * Pregunta corta con emoji/flecha de apoyo cuando aplica
--   * Opciones de UNA sola palabra
--   * Distractores visualmente distintos
--   * tags = solo temática, sin duplicar difficulty
-- Vocabulario nuevo, sin solapar con sets 1-4.
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Direcciones / posiciones básicas
-- ==========================================
('vocabulary', 'Which way is this? ⬆️', 'up', 'down', 'left', 1, '"Up" significa arriba.', '¿Hacia dónde apunta esto?', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'Which way is this? ⬇️', 'down', 'up', 'right', 1, '"Down" significa abajo.', '¿Hacia dónde apunta esto?', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'Which way is this? ⬅️', 'left', 'right', 'up', 1, '"Left" significa izquierda.', '¿Hacia dónde apunta esto?', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'Which way is this? ➡️', 'right', 'left', 'down', 1, '"Right" significa derecha.', '¿Hacia dónde apunta esto?', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Posiciones relativas (traducción directa)
-- ==========================================
('vocabulary', '"Adentro" en inglés es:', 'inside', 'outside', 'behind', 1, '"Inside" significa adentro.', 'Traduce la palabra', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Afuera" en inglés es:', 'outside', 'inside', 'under', 1, '"Outside" significa afuera.', 'Traduce la palabra', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Encima de" en inglés es:', 'above', 'below', 'beside', 1, '"Above" significa encima de.', 'Traduce la palabra', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Debajo de" en inglés es:', 'below', 'above', 'behind', 1, '"Below" significa debajo de.', 'Traduce la palabra', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Enfrente de" en inglés es:', 'front', 'back', 'near', 1, '"Front" significa enfrente / al frente de.', 'Traduce la palabra', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Detrás de" en inglés es:', 'behind', 'front', 'far', 1, '"Behind" significa detrás de.', 'Traduce la palabra', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Cerca" en inglés es:', 'near', 'far', 'behind', 1, '"Near" significa cerca.', 'Traduce la palabra', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Lejos" en inglés es:', 'far', 'near', 'inside', 1, '"Far" significa lejos.', 'Traduce la palabra', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Al lado de" en inglés es:', 'beside', 'above', 'below', 1, '"Beside" significa al lado de.', 'Traduce la palabra', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Entre" en inglés es:', 'between', 'beside', 'inside', 1, '"Between" significa entre dos cosas.', 'Traduce la palabra', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Direcciones — reconocimiento en contexto
-- ==========================================
('vocabulary', 'The cat is _____ the box. 📦🐱', 'inside', 'outside', 'far', 1, '"Inside" significa que el gato está dentro de la caja.', 'El gato está _____ de la caja.', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'The lamp is _____ the table. 💡🪑', 'above', 'below', 'behind', 1, '"Above" significa que la lámpara está por encima de la mesa.', 'La lámpara está _____ de la mesa.', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'Turn _____ at the corner. 🚶', 'left', 'up', 'far', 1, '"Turn left" significa dar vuelta a la izquierda.', 'Da vuelta a la _____ en la esquina.', '{vocabulary,directions}', 'beginner', 'english', NULL, false, NULL),

-- ==========================================
-- Más acciones cotidianas
-- ==========================================
('vocabulary', '"Empujar" en inglés es:', 'push', 'pull', 'lift', 1, '"Push" significa empujar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Jalar" en inglés es:', 'pull', 'push', 'drop', 1, '"Pull" significa jalar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Lanzar" en inglés es:', 'throw', 'catch', 'kick', 1, '"Throw" significa lanzar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Atrapar" en inglés es:', 'catch', 'throw', 'drop', 1, '"Catch" significa atrapar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Cargar / llevar" en inglés es:', 'carry', 'drag', 'lift', 1, '"Carry" significa cargar o llevar algo.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Levantar" en inglés es:', 'lift', 'carry', 'drop', 1, '"Lift" significa levantar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Soltar / dejar caer" en inglés es:', 'drop', 'lift', 'push', 1, '"Drop" significa soltar o dejar caer algo.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Cortar" en inglés es:', 'cut', 'break', 'tear', 1, '"Cut" significa cortar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Romper" en inglés es:', 'break', 'cut', 'fix', 1, '"Break" significa romper.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Arreglar" en inglés es:', 'fix', 'break', 'build', 1, '"Fix" significa arreglar o reparar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Construir" en inglés es:', 'build', 'fix', 'destroy', 1, '"Build" significa construir.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Enviar" en inglés es:', 'send', 'bring', 'receive', 1, '"Send" significa enviar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Traer" en inglés es:', 'bring', 'send', 'leave', 1, '"Bring" significa traer.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Recibir" en inglés es:', 'receive', 'send', 'lose', 1, '"Receive" significa recibir.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Enseñar" en inglés es:', 'teach', 'learn', 'study', 1, '"Teach" significa enseñar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Aprender" en inglés es:', 'learn', 'teach', 'forget', 1, '"Learn" significa aprender.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Empezar" en inglés es:', 'start', 'stop', 'finish', 1, '"Start" significa empezar.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Parar / detener" en inglés es:', 'stop', 'start', 'move', 1, '"Stop" significa parar o detener.', 'Traduce la palabra', '{vocabulary,actions,daily}', 'beginner', 'english', NULL, false, NULL);

-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 1)
-- Enfoque: Phrasal verbs — grupo "UP"
-- Modo: Combate arcade
-- Reglas:
--   * Oración corta (máx. 8 palabras), un solo blank
--   * Opciones de 2 palabras (phrasal verb completo)
--   * Distractores del MISMO grupo semántico (todos "up") para
--     que el reto sea distinguir el matiz, no adivinar por descarte
--   * tags = solo temática, sin duplicar difficulty
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', 'I need to _____ my room. 🧹', 'clean up', 'wake up', 'give up', 1, '"Clean up" = ordenar / limpiar un lugar.', 'Necesito _____ mi cuarto.', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Don''t _____ — try again! 💪', 'give up', 'clean up', 'show up', 1, '"Give up" = rendirse.', 'No te _____ — ¡inténtalo de nuevo!', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'She always _____ late. ⏰', 'shows up', 'wakes up', 'grows up', 1, '"Show up" = aparecer / llegar a un lugar.', 'Ella siempre _____ tarde.', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I _____ at 6 AM every day. 🌅', 'wake up', 'grow up', 'pick up', 1, '"Wake up" = despertarse.', 'Yo _____ a las 6 AM todos los días.', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Kids _____ so fast! 📏', 'grow up', 'wake up', 'dress up', 1, '"Grow up" = crecer / hacerse mayor.', 'Los niños _____ muy rápido.', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Can you _____ that book? 📚', 'pick up', 'give up', 'mess up', 1, '"Pick up" = recoger algo del suelo.', '¿Puedes _____ ese libro?', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'We _____ for the party. 👗', 'dressed up', 'showed up', 'cleaned up', 1, '"Dress up" = vestirse elegante / disfrazarse.', 'Nosotros _____ para la fiesta.', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Sorry, I _____ everything! 😬', 'messed up', 'picked up', 'warmed up', 1, '"Mess up" = arruinar / equivocarse.', 'Perdón, ¡_____ todo!', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '_____! The bus is leaving! 🚌', 'hurry up', 'grow up', 'clean up', 1, '"Hurry up" = apurarse / darse prisa.', '¡_____! ¡El bus se va!', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Let''s _____ before the game. 🏃', 'warm up', 'break up', 'hurry up', 1, '"Warm up" = calentar / hacer calentamiento.', 'Vamos a _____ antes del juego.', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'They _____ after two years. 💔', 'broke up', 'grew up', 'showed up', 1, '"Break up" = terminar una relación.', 'Ellos _____ después de dos años.', '{phrasal-verb,up}', 'intermediate', 'english', NULL, false, NULL);



-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 2)
-- Enfoque: Phrasal verbs — grupo "DOWN"
-- Modo: Combate arcade
-- Reglas: mismas que set 1 (oración corta, opciones de 2 palabras,
--   distractores del mismo grupo semántico "down")
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', 'Please _____, everything is fine. 😌', 'calm down', 'sit down', 'break down', 1, '"Calm down" = calmarse / tranquilizarse.', 'Por favor _____, todo está bien.', '{phrasal-verb,down}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '_____ the new words in your notebook. 📓', 'write down', 'calm down', 'lie down', 1, '"Write down" = anotar / escribir.', '_____ las palabras nuevas en tu cuaderno.', '{phrasal-verb,down}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'You''re talking too fast — _____! 🐢', 'slow down', 'sit down', 'write down', 1, '"Slow down" = ir más despacio.', 'Hablas muy rápido — ¡_____!', '{phrasal-verb,down}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Please _____, the movie is starting. 🎬', 'sit down', 'slow down', 'lie down', 1, '"Sit down" = sentarse.', 'Por favor _____, la película va a empezar.', '{phrasal-verb,down}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'The car _____ on the highway. 🚗', 'broke down', 'sat down', 'calmed down', 1, '"Break down" = descomponerse / dejar de funcionar.', 'El carro _____ en la autopista.', '{phrasal-verb,down}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I need to _____ for a minute. 🛌', 'lie down', 'break down', 'turn down', 1, '"Lie down" = acostarse / recostarse.', 'Necesito _____ un minuto.', '{phrasal-verb,down}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'He decided to _____ the offer. ❌', 'turn down', 'write down', 'lie down', 1, '"Turn down" = rechazar (una oferta o invitación).', 'Él decidió _____ la oferta.', '{phrasal-verb,down}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I''m trying to _____ on sugar. 🍬', 'cut down', 'break down', 'turn down', 1, '"Cut down (on)" = reducir el consumo de algo.', 'Estoy tratando de _____ el azúcar.', '{phrasal-verb,down}', 'intermediate', 'english', NULL, false, NULL);



-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 3)
-- Enfoque: Phrasal verbs — grupo "OUT"
-- Modo: Combate arcade
-- Reglas: mismas que sets anteriores (oración corta, opciones de 2-3
--   palabras, distractores del mismo grupo semántico "out")
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', 'I just _____ the truth. 😲', 'found out', 'ran out', 'worked out', 1, '"Find out" = descubrir / enterarse.', 'Acabo de _____ la verdad.', '{phrasal-verb,out}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'We _____ of milk. 🥛', 'ran out', 'found out', 'figured out', 1, '"Run out (of)" = quedarse sin algo.', 'Se nos _____ la leche.', '{phrasal-verb,out}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I finally _____ the answer. 💡', 'figured out', 'ran out', 'checked out', 1, '"Figure out" = descifrar / entender algo.', 'Finalmente _____ la respuesta.', '{phrasal-verb,out}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Don''t _____, it''s just a game! 😱', 'freak out', 'find out', 'work out', 1, '"Freak out" = alterarse / perder la calma.', 'No te _____, ¡es solo un juego!', '{phrasal-verb,out}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I _____ at the gym every morning. 🏋️', 'work out', 'freak out', 'run out', 1, '"Work out" = ejercitarse / hacer ejercicio.', 'Yo _____ en el gimnasio cada mañana.', '{phrasal-verb,out}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Please _____ this form. 📝', 'fill out', 'check out', 'figure out', 1, '"Fill out" = llenar (un formulario).', 'Por favor _____ este formulario.', '{phrasal-verb,out}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Let''s _____ that new restaurant. 🍜', 'check out', 'fill out', 'find out', 1, '"Check out" = ir a ver / probar algo nuevo.', 'Vamos a _____ ese restaurante nuevo.', '{phrasal-verb,out}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'She wants to _____ with friends. 🎉', 'hang out', 'work out', 'run out', 1, '"Hang out" = pasar el rato / salir con amigos.', 'Ella quiere _____ con amigos.', '{phrasal-verb,out}', 'intermediate', 'english', NULL, false, NULL);



-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 4)
-- Enfoque: Phrasal verbs — grupos "ON" / "OFF" / "INTO"
-- Modo: Combate arcade
-- Reglas: mismas que sets anteriores (oración corta, opciones de 2
--   palabras, distractores del mismo grupo semántico)
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Grupo "ON"
-- ==========================================
('vocabulary', '_____ a second, I''m not ready! ✋', 'hold on', 'go on', 'move on', 1, '"Hold on" = espera un momento.', '_____ un segundo, ¡no estoy listo!', '{phrasal-verb,on}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'That''s interesting — _____! 🎙️', 'go on', 'hold on', 'try on', 1, '"Go on" = continúa / sigue hablando.', 'Qué interesante — ¡_____!', '{phrasal-verb,on}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'It''s over. Just _____. 🌅', 'move on', 'hold on', 'put on', 1, '"Move on" = seguir adelante / pasar página.', 'Se acabó. Solo _____.', '{phrasal-verb,on}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Can you _____ this shirt? 👕', 'try on', 'put on', 'go on', 1, '"Try on" = probarse una prenda.', '¿Puedes _____ esta camisa?', '{phrasal-verb,on}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'It''s cold — _____ your jacket. 🧥', 'put on', 'try on', 'move on', 1, '"Put on" = ponerse una prenda.', 'Hace frío — _____ tu chaqueta.', '{phrasal-verb,on}', 'intermediate', 'english', NULL, false, NULL),

-- ==========================================
-- Grupo "OFF"
-- ==========================================
('vocabulary', 'Please _____ your phone. 📴', 'turn off', 'take off', 'get off', 1, '"Turn off" = apagar.', 'Por favor _____ tu teléfono.', '{phrasal-verb,off}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'The plane is about to _____. ✈️', 'take off', 'turn off', 'get off', 1, '"Take off" = despegar.', 'El avión está por _____.', '{phrasal-verb,off}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'This is my stop — I need to _____. 🚌', 'get off', 'take off', 'turn off', 1, '"Get off" = bajarse (de un transporte).', 'Esta es mi parada — necesito _____.', '{phrasal-verb,off}', 'intermediate', 'english', NULL, false, NULL),

-- ==========================================
-- Grupo "INTO"
-- ==========================================
('vocabulary', 'I''ll _____ it and let you know. 🔎', 'look into', 'run into', 'turn into', 1, '"Look into" = investigar algo.', 'Lo voy a _____ y te aviso.', '{phrasal-verb,into}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I _____ my old friend today! 👋', 'ran into', 'looked into', 'turned into', 1, '"Run into" = encontrarse con alguien por casualidad.', 'Hoy _____ a mi viejo amigo.', '{phrasal-verb,into}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Practice will _____ you a confident speaker. ⭐', 'turn into', 'run into', 'look into', 1, '"Turn into" = convertirse en / transformarse.', 'La práctica te va a _____ en alguien seguro al hablar.', '{phrasal-verb,into}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 5)
-- Enfoque: Falsos amigos (false friends)
-- Modo: Combate arcade
-- Reglas:
--   * Pregunta corta: se da la palabra en inglés, se pide el significado real
--   * option1 = significado correcto (real), option2 = la trampa (falso amigo
--     en español), option3 = distractor de campo semántico distinto
--   * tags = solo temática
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', '"Embarrassed" significa:', 'avergonzado', 'embarazada', 'abrazado', 1, '"Embarrassed" = avergonzado. "Embarazada" en inglés es "pregnant".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Actually" significa:', 'en realidad', 'actualmente', 'realmente rápido', 1, '"Actually" = en realidad. "Actualmente" en inglés es "currently".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Library" significa:', 'biblioteca', 'librería', 'libro grande', 1, '"Library" = biblioteca. "Librería" en inglés es "bookstore".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Sensible" significa:', 'sensato', 'sensible', 'delicado', 1, '"Sensible" = sensato / con sentido común. "Sensible" en español es "sensitive".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Realize" significa:', 'darse cuenta', 'realizar', 'hacer realidad', 1, '"Realize" = darse cuenta de algo. "Realizar" en inglés es "carry out".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Success" significa:', 'éxito', 'suceso', 'sucesión', 1, '"Success" = éxito. "Suceso" en inglés es "event".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Attend" significa:', 'asistir', 'atender', 'esperar', 1, '"Attend" = asistir a algo (una clase, evento). "Atender" en inglés es "assist" o "serve".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Introduce" significa:', 'presentar (a alguien)', 'introducir (meter)', 'invitar', 1, '"Introduce" = presentar a una persona. "Introducir" (meter algo) en inglés es "insert".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Exit" significa:', 'salida', 'éxito', 'entrada', 1, '"Exit" = salida. "Éxito" en inglés es "success".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Large" significa:', 'grande', 'largo', 'lento', 1, '"Large" = grande (tamaño). "Largo" en inglés es "long".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Fabric" significa:', 'tela', 'fábrica', 'material duro', 1, '"Fabric" = tela / tejido. "Fábrica" en inglés es "factory".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Rope" significa:', 'cuerda', 'ropa', 'tela fina', 1, '"Rope" = cuerda. "Ropa" en inglés es "clothes".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 6)
-- Enfoque: Sinónimos y antónimos
-- Modo: Combate arcade
-- Reglas:
--   * Pregunta corta: se da una palabra y se pide sinónimo o antónimo
--   * Opciones de una sola palabra, distractores del mismo campo
--     semántico (adjetivos) para que el reto sea real
--   * tags = solo temática
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Antónimos
-- ==========================================
('vocabulary', 'Antonym of "difficult":', 'easy', 'hard', 'strange', 1, '"Easy" es el antónimo de "difficult" (difícil).', 'Antónimo de "difícil"', '{vocabulary,antonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Antonym of "expensive":', 'cheap', 'costly', 'rich', 1, '"Cheap" es el antónimo de "expensive" (caro).', 'Antónimo de "caro"', '{vocabulary,antonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Antonym of "fast":', 'slow', 'quick', 'late', 1, '"Slow" es el antónimo de "fast" (rápido).', 'Antónimo de "rápido"', '{vocabulary,antonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Antonym of "strong":', 'weak', 'tough', 'brave', 1, '"Weak" es el antónimo de "strong" (fuerte).', 'Antónimo de "fuerte"', '{vocabulary,antonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Antonym of "clean":', 'dirty', 'fresh', 'new', 1, '"Dirty" es el antónimo de "clean" (limpio).', 'Antónimo de "limpio"', '{vocabulary,antonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Antonym of "early":', 'late', 'soon', 'quick', 1, '"Late" es el antónimo de "early" (temprano).', 'Antónimo de "temprano"', '{vocabulary,antonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Antonym of "full":', 'empty', 'heavy', 'closed', 1, '"Empty" es el antónimo de "full" (lleno).', 'Antónimo de "lleno"', '{vocabulary,antonyms}', 'intermediate', 'english', NULL, false, NULL),

-- ==========================================
-- Sinónimos
-- ==========================================
('vocabulary', 'Synonym of "big":', 'huge', 'tiny', 'short', 1, '"Huge" es sinónimo de "big" (grande).', 'Sinónimo de "grande"', '{vocabulary,synonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Synonym of "happy":', 'glad', 'angry', 'tired', 1, '"Glad" es sinónimo de "happy" (feliz).', 'Sinónimo de "feliz"', '{vocabulary,synonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Synonym of "smart":', 'clever', 'lazy', 'shy', 1, '"Clever" es sinónimo de "smart" (inteligente).', 'Sinónimo de "inteligente"', '{vocabulary,synonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Synonym of "scared":', 'afraid', 'excited', 'proud', 1, '"Afraid" es sinónimo de "scared" (asustado).', 'Sinónimo de "asustado"', '{vocabulary,synonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Synonym of "beautiful":', 'pretty', 'ugly', 'plain', 1, '"Pretty" es sinónimo de "beautiful" (hermoso).', 'Sinónimo de "hermoso"', '{vocabulary,synonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Synonym of "start":', 'begin', 'finish', 'stop', 1, '"Begin" es sinónimo de "start" (empezar).', 'Sinónimo de "empezar"', '{vocabulary,synonyms}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Synonym of "buy":', 'purchase', 'sell', 'save', 1, '"Purchase" es sinónimo de "buy" (comprar).', 'Sinónimo de "comprar"', '{vocabulary,synonyms}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 7)
-- Enfoque: Adjetivos de personalidad y emociones
-- Modo: Combate arcade
-- Reglas:
--   * Traducción directa ES → EN, opción de una sola palabra
--   * Distractores del mismo campo semántico (todos adjetivos de
--     personalidad/emoción) para que el reto sea real
--   * tags = solo temática
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', '"Nervioso" en inglés es:', 'nervous', 'curious', 'jealous', 1, '"Nervous" significa nervioso.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Confiado / seguro de sí mismo" en inglés es:', 'confident', 'careful', 'curious', 1, '"Confident" significa confiado o seguro de sí mismo.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Curioso" en inglés es:', 'curious', 'nervous', 'generous', 1, '"Curious" significa curioso.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Aburrido" en inglés es:', 'bored', 'tired', 'annoyed', 1, '"Bored" significa aburrido.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Molesto / fastidiado" en inglés es:', 'annoyed', 'bored', 'shy', 1, '"Annoyed" significa molesto o fastidiado.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Tímido" en inglés es:', 'shy', 'lazy', 'strict', 1, '"Shy" significa tímido.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Perezoso" en inglés es:', 'lazy', 'shy', 'jealous', 1, '"Lazy" significa perezoso.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Generoso" en inglés es:', 'generous', 'strict', 'confident', 1, '"Generous" significa generoso.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Estricto" en inglés es:', 'strict', 'generous', 'annoyed', 1, '"Strict" significa estricto.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Celoso" en inglés es:', 'jealous', 'curious', 'confident', 1, '"Jealous" significa celoso.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Cuidadoso" en inglés es:', 'careful', 'careless', 'strict', 1, '"Careful" significa cuidadoso.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Descuidado" en inglés es:', 'careless', 'careful', 'lazy', 1, '"Careless" significa descuidado.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Orgulloso" en inglés es:', 'proud', 'ashamed', 'confused', 1, '"Proud" significa orgulloso.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Confundido" en inglés es:', 'confused', 'proud', 'annoyed', 1, '"Confused" significa confundido.', 'Traduce la palabra', '{vocabulary,personality}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 8)
-- Enfoque: Vocabulario de trabajo y estudio
-- Modo: Combate arcade
-- Reglas:
--   * Traducción directa ES → EN, opción de una o dos palabras
--   * Distractores del mismo campo semántico (trabajo/estudio)
--   * tags = solo temática
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', '"Reunión" en inglés es:', 'meeting', 'schedule', 'report', 1, '"Meeting" significa reunión.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Fecha límite" en inglés es:', 'deadline', 'schedule', 'meeting', 1, '"Deadline" significa fecha límite.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Horario" en inglés es:', 'schedule', 'deadline', 'salary', 1, '"Schedule" significa horario.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Informe" en inglés es:', 'report', 'meeting', 'task', 1, '"Report" significa informe.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Tarea" en inglés es:', 'task', 'report', 'goal', 1, '"Task" significa tarea.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Meta / objetivo" en inglés es:', 'goal', 'task', 'skill', 1, '"Goal" significa meta u objetivo.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Sueldo" en inglés es:', 'salary', 'goal', 'boss', 1, '"Salary" significa sueldo.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Jefe" en inglés es:', 'boss', 'coworker', 'client', 1, '"Boss" significa jefe.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Compañero de trabajo" en inglés es:', 'coworker', 'boss', 'employee', 1, '"Coworker" significa compañero de trabajo.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Cliente" en inglés es:', 'client', 'coworker', 'manager', 1, '"Client" significa cliente.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Habilidad" en inglés es:', 'skill', 'goal', 'salary', 1, '"Skill" significa habilidad.', 'Traduce la palabra', '{vocabulary,work}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Examen" en inglés es:', 'exam', 'homework', 'grade', 1, '"Exam" significa examen.', 'Traduce la palabra', '{vocabulary,study}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Tarea escolar" en inglés es:', 'homework', 'exam', 'lesson', 1, '"Homework" significa tarea escolar.', 'Traduce la palabra', '{vocabulary,study}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Calificación" en inglés es:', 'grade', 'homework', 'subject', 1, '"Grade" significa calificación.', 'Traduce la palabra', '{vocabulary,study}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Materia / asignatura" en inglés es:', 'subject', 'lesson', 'grade', 1, '"Subject" significa materia o asignatura.', 'Traduce la palabra', '{vocabulary,study}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Lección" en inglés es:', 'lesson', 'subject', 'exam', 1, '"Lesson" significa lección.', 'Traduce la palabra', '{vocabulary,study}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Advanced (Set 1)
-- Enfoque: Modismos / Idioms
-- Modo: Combate arcade
-- Reglas:
--   * Se da la expresión completa, se pide el significado (no literal)
--   * option1 = significado real, option2 = interpretación literal
--     equivocada (la trampa), option3 = distractor de otro campo
--   * tags = solo temática
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', '"Break the ice" significa:', 'romper la tensión inicial', 'romper hielo literal', 'enfriar una bebida', 1, '"Break the ice" = hacer algo para relajar un ambiente incómodo, no romper hielo de verdad.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Under the weather" significa:', 'sentirse mal / enfermo', 'estar bajo la lluvia', 'tener mucho calor', 1, '"Under the weather" = sentirse enfermo o de mal ánimo.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Hit the books" significa:', 'ponerse a estudiar', 'golpear un libro', 'comprar libros', 1, '"Hit the books" = ponerse a estudiar con dedicación.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Piece of cake" significa:', 'algo muy fácil', 'un pedazo de pastel real', 'una tarea deliciosa', 1, '"Piece of cake" = algo muy fácil de hacer.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Cost an arm and a leg" significa:', 'ser muy caro', 'perder una extremidad', 'ser gratis', 1, '"Cost an arm and a leg" = costar muchísimo dinero.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Once in a blue moon" significa:', 'muy rara vez', 'todas las noches', 'una vez al mes', 1, '"Once in a blue moon" = algo que sucede muy pocas veces.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Spill the beans" significa:', 'revelar un secreto', 'derramar comida', 'cocinar frijoles', 1, '"Spill the beans" = revelar información secreta.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Hit the sack" significa:', 'irse a dormir', 'golpear una bolsa', 'salir de viaje', 1, '"Hit the sack" = irse a la cama a dormir.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"On the same page" significa:', 'estar de acuerdo', 'leer el mismo libro', 'estar en la misma clase', 1, '"On the same page" = estar de acuerdo o entender lo mismo que otra persona.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Pull someone''s leg" significa:', 'bromear con alguien', 'jalar la pierna de alguien', 'ayudar a caminar', 1, '"Pull someone''s leg" = bromear o engañar a alguien en broma.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Let the cat out of the bag" significa:', 'revelar un secreto sin querer', 'soltar un gato real', 'perder una mascota', 1, '"Let the cat out of the bag" = revelar accidentalmente algo secreto.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Better late than never" significa:', 'mejor tarde que nunca hacerlo', 'siempre hay que llegar tarde', 'nunca llegar es mejor', 1, '"Better late than never" = es mejor hacer algo tarde que no hacerlo nunca.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Advanced (Set 2)
-- Enfoque: Phrasal verbs de 3 palabras
-- Modo: Combate arcade
-- Reglas:
--   * Oración corta, opciones de 3 palabras (phrasal verb completo)
--   * Distractores del mismo grupo o estructura para exigir matiz real
--   * tags = solo temática
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', 'I _____ seeing you soon. 😊', 'look forward to', 'get away with', 'put up with', 1, '"Look forward to" = esperar algo con ilusión.', 'Yo _____ verte pronto.', '{phrasal-verb,three-word}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'He always _____ being late. 😒', 'gets away with', 'looks forward to', 'runs out of', 1, '"Get away with" = salirse con la suya sin consecuencias.', 'Él siempre _____ llegar tarde (sin consecuencias).', '{phrasal-verb,three-word}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'I can''t _____ the noise anymore. 🔊', 'put up with', 'look forward to', 'catch up with', 1, '"Put up with" = tolerar / aguantar algo molesto.', 'Ya no puedo _____ el ruido.', '{phrasal-verb,three-word}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'Let''s _____ tomorrow at the café. ☕', 'catch up with', 'put up with', 'get away with', 1, '"Catch up with" = ponerse al día con alguien / reencontrarse.', 'Vamos a _____ mañana en el café.', '{phrasal-verb,three-word}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'I need to _____ my homework. 📚', 'get on with', 'look down on', 'come up with', 1, '"Get on with" = continuar / seguir haciendo algo.', 'Necesito _____ mi tarea.', '{phrasal-verb,three-word}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'She always _____ great ideas. 💡', 'comes up with', 'gets on with', 'looks down on', 1, '"Come up with" = idear / proponer algo nuevo.', 'Ella siempre _____ buenas ideas.', '{phrasal-verb,three-word}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'He tends to _____ others. 😕', 'look down on', 'come up with', 'put up with', 1, '"Look down on" = menospreciar a alguien.', 'Él tiende a _____ a los demás.', '{phrasal-verb,three-word}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'I''m trying to _____ smoking. 🚬', 'cut down on', 'look up to', 'come up with', 1, '"Cut down on" = reducir el consumo de algo.', 'Estoy tratando de _____ fumar.', '{phrasal-verb,three-word}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'I really _____ my grandmother. 👵', 'look up to', 'look down on', 'cut down on', 1, '"Look up to" = admirar a alguien.', 'Yo realmente _____ a mi abuela.', '{phrasal-verb,three-word}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'We need to _____ the plan. 📋', 'go through with', 'get on with', 'look up to', 1, '"Go through with" = llevar a cabo algo planeado, sin desistir.', 'Necesitamos _____ el plan.', '{phrasal-verb,three-word}', 'advanced', 'english', NULL, false, NULL);



-- ==========================================
-- Card Ninja — VOCABULARY / Advanced (Set 3)
-- Enfoque: Vocabulario académico / formal
-- Modo: Combate arcade
-- Reglas:
--   * Traducción directa ES → EN, opción de una sola palabra
--   * Distractores del mismo campo semántico (todos términos formales)
--   * tags = solo temática
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', '"Analizar" en inglés es:', 'analyze', 'evaluate', 'summarize', 1, '"Analyze" significa analizar.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Evaluar" en inglés es:', 'evaluate', 'analyze', 'assume', 1, '"Evaluate" significa evaluar.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Crucial" en inglés es:', 'crucial', 'optional', 'minor', 1, '"Crucial" significa crucial / de gran importancia.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Significativo" en inglés es:', 'significant', 'minor', 'irrelevant', 1, '"Significant" significa significativo / importante.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Esencial" en inglés es:', 'essential', 'optional', 'excessive', 1, '"Essential" significa esencial / indispensable.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Suponer / asumir" en inglés es:', 'assume', 'assess', 'achieve', 1, '"Assume" significa suponer o asumir algo sin confirmarlo.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Evaluar (valorar)" en inglés es:', 'assess', 'assume', 'acquire', 1, '"Assess" significa evaluar o valorar algo.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Lograr / alcanzar" en inglés es:', 'achieve', 'assess', 'assume', 1, '"Achieve" significa lograr o alcanzar una meta.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Adquirir" en inglés es:', 'acquire', 'achieve', 'assume', 1, '"Acquire" significa adquirir.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Contribuir" en inglés es:', 'contribute', 'consist', 'consult', 1, '"Contribute" significa contribuir.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Consistir en" en inglés es:', 'consist', 'contribute', 'consult', 1, '"Consist (of)" significa consistir en / estar compuesto de.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Consultar" en inglés es:', 'consult', 'consist', 'contribute', 1, '"Consult" significa consultar.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Justificar" en inglés es:', 'justify', 'clarify', 'identify', 1, '"Justify" significa justificar.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Aclarar" en inglés es:', 'clarify', 'justify', 'notify', 1, '"Clarify" significa aclarar.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Identificar" en inglés es:', 'identify', 'clarify', 'justify', 1, '"Identify" significa identificar.', 'Traduce la palabra', '{vocabulary,academic}', 'advanced', 'english', NULL, false, NULL);



-- ==========================================
-- Card Ninja — VOCABULARY / Advanced (Set 4)
-- Enfoque: Conectores de discurso
-- Modo: Combate arcade
-- Reglas:
--   * Oración corta con blank donde va el conector correcto
--   * Distractores = otros conectores (exige entender la relación
--     lógica entre las ideas, no solo vocabulario suelto)
--   * tags = solo temática
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', 'It was raining. _____, we went out. 🌧️', 'However', 'Because', 'Therefore', 1, '"However" introduce un contraste con la idea anterior.', 'Llovía. _____, salimos.', '{vocabulary,connectors}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'She was tired, _____ she kept working. 😴', 'although', 'because', 'so', 1, '"Although" introduce una idea contraria dentro de la misma oración.', 'Estaba cansada, _____ siguió trabajando.', '{vocabulary,connectors}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '_____ the rain, we went out. 🌂', 'Despite', 'Although', 'Since', 1, '"Despite" va seguido de un sustantivo, no de una oración completa.', '_____ la lluvia, salimos.', '{vocabulary,connectors}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'I studied hard. _____, I passed the exam. ✅', 'Therefore', 'However', 'Although', 1, '"Therefore" introduce una consecuencia lógica.', 'Estudié mucho. _____, aprobé el examen.', '{vocabulary,connectors}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'He was sick. _____, he came to work. 🤒', 'Nevertheless', 'Therefore', 'Since', 1, '"Nevertheless" = a pesar de eso / aun así.', 'Estaba enfermo. _____, vino a trabajar.', '{vocabulary,connectors}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'I stayed home _____ I was sick. 🤧', 'because', 'although', 'however', 1, '"Because" introduce la razón o causa directa.', 'Me quedé en casa _____ estaba enferma.', '{vocabulary,connectors}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '_____ it was late, we kept talking. ⏰', 'Even though', 'Because', 'Despite', 1, '"Even though" introduce una idea contraria, seguida de una oración completa.', '_____ era tarde, seguimos hablando.', '{vocabulary,connectors}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'She likes tea. _____, he prefers coffee. ☕', 'On the other hand', 'Therefore', 'Because', 1, '"On the other hand" se usa para presentar un contraste entre dos ideas.', 'A ella le gusta el té. _____, a él le gusta el café.', '{vocabulary,connectors}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'I was late. _____, I missed the bus. 🚌', 'As a result', 'Although', 'Despite', 1, '"As a result" introduce una consecuencia.', 'Llegué tarde. _____, perdí el bus.', '{vocabulary,connectors}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '_____ working hard, she didn''t get the job. 😞', 'In spite of', 'Because of', 'As a result of', 1, '"In spite of" = a pesar de, va seguido de sustantivo o gerundio.', '_____ trabajar duro, no consiguió el trabajo.', '{vocabulary,connectors}', 'advanced', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Beginner (Set 1)
-- Modo: Práctica con calma (NO combate — sin presión de tiempo)
-- Reglas:
--   * type = pronunciation, una sola palabra/frase por carta
--   * option1 = la palabra/frase correcta, option2 y option3 = NULL
--     (no es opción múltiple, el usuario repite/escucha y compara)
--   * correct_option = 1 siempre
--   * phonetic SIEMPRE lleno, requires_audio = true
--   * Prioriza sonidos difíciles para hispanohablantes: "th", vocales
--     cortas/largas, letras mudas
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Sonido "th" (no existe en español, común mal pronunciar como "d" o "z")
-- ==========================================
('pronunciation', 'Think', 'Think', '', '', 1, 'Pensar. La "th" se pronuncia poniendo la lengua entre los dientes, no como "d".', '', '{"pronunciation","th-sound"}', 'beginner', 'english', '/θɪŋk/', true, NULL),
('pronunciation', 'This', 'This', '', '', 1, 'Esto/esta. La "th" aquí suena más suave, casi como una "d" vibrada.', '', '{"pronunciation","th-sound"}', 'beginner', 'english', '/ðɪs/', true, NULL),
('pronunciation', 'Three', 'Three', '', '', 1, 'Tres. Cuidado con decir "tree" (árbol) por error.', '', '{"pronunciation","th-sound"}', 'beginner', 'english', '/θriː/', true, NULL),
('pronunciation', 'Mother', 'Mother', '', '', 1, 'Madre. La "th" en medio de la palabra también lleva el sonido vibrado.', '', '{"pronunciation","th-sound"}', 'beginner', 'english', '/ˈmʌðər/', true, NULL),

-- ==========================================
-- Vocales cortas vs largas (confusión común: i corta vs ee larga)
-- ==========================================
('pronunciation', 'Ship', 'Ship', '', '', 1, 'Barco. La "i" es corta y rápida, distinta de "sheep" (oveja).', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/ʃɪp/', true, NULL),
('pronunciation', 'Sheep', 'Sheep', '', '', 1, 'Oveja. La "ee" es larga, se alarga más que en "ship".', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/ʃiːp/', true, NULL),
('pronunciation', 'Live', 'Live', '', '', 1, 'Vivir. Vocal corta, distinto de "leave" (irse).', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/lɪv/', true, NULL),
('pronunciation', 'Leave', 'Leave', '', '', 1, 'Irse / dejar. Vocal larga, distinto de "live" (vivir).', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/liːv/', true, NULL),

-- ==========================================
-- Letras mudas (silent letters) — clásico reto para principiantes
-- ==========================================
('pronunciation', 'Know', 'Know', '', '', 1, 'Saber / conocer. La "k" es muda, no se pronuncia.', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/noʊ/', true, NULL),
('pronunciation', 'Hour', 'Hour', '', '', 1, 'Hora. La "h" es muda, suena como si empezara con vocal.', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/aʊər/', true, NULL),
('pronunciation', 'Comb', 'Comb', '', '', 1, 'Peine. La "b" al final es muda.', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/koʊm/', true, NULL),

-- ==========================================
-- Palabras cotidianas de uso frecuente
-- ==========================================
('pronunciation', 'Water', 'Water', '', '', 1, 'Agua. La "t" en medio suena suave, casi como una "d" rápida.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈwɔːtər/', true, NULL),
('pronunciation', 'Family', 'Family', '', '', 1, 'Familia. Tres sílabas: FA-mi-ly, el acento va en la primera.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈfæməli/', true, NULL),
('pronunciation', 'Beautiful', 'Beautiful', '', '', 1, 'Hermoso. El acento va en la primera sílaba: BEAU-ti-ful.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈbjuːtɪfəl/', true, NULL),
('pronunciation', 'Vegetable', 'Vegetable', '', '', 1, 'Vegetal. Se pronuncia con solo 3 sílabas: VEJ-ta-bul, no 4.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈvedʒtəbəl/', true, NULL),

-- ==========================================
-- Frases de uso cotidiano
-- ==========================================
('pronunciation', 'Good morning', 'Good morning', '', '', 1, 'Buenos días.', '', '{"pronunciation","phrases","greetings"}', 'beginner', 'english', '/ɡʊd ˈmɔːrnɪŋ/', true, NULL),
('pronunciation', 'Thank you very much', 'Thank you very much', '', '', 1, 'Muchas gracias.', '', '{"pronunciation","phrases","greetings"}', 'beginner', 'english', '/θæŋk juː ˈveri mʌtʃ/', true, NULL),
('pronunciation', 'Nice to meet you', 'Nice to meet you', '', '', 1, 'Encantado de conocerte.', '', '{"pronunciation","phrases","greetings"}', 'beginner', 'english', '/naɪs tə miːt juː/', true, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Beginner (Set 2)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Formato corregido: option1/option2/option3 (sin guión bajo),
-- '' en vez de NULL para campos de texto no aplicables.
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Sonido "v" vs "b" (confusión común, en español suenan casi igual)
-- ==========================================
('pronunciation', 'Very', 'Very', '', '', 1, 'Muy. La "v" se pronuncia con los dientes sobre el labio inferior, no como una "b".', '', '{"pronunciation","v-sound"}', 'beginner', 'english', '/ˈveri/', true, NULL),
('pronunciation', 'Vote', 'Vote', '', '', 1, 'Votar. Cuidado con decir "boat" (bote) por error.', '', '{"pronunciation","v-sound"}', 'beginner', 'english', '/voʊt/', true, NULL),
('pronunciation', 'Voice', 'Voice', '', '', 1, 'Voz. El sonido "v" inicial debe vibrar, no ser una "b" suave.', '', '{"pronunciation","v-sound"}', 'beginner', 'english', '/vɔɪs/', true, NULL),

-- ==========================================
-- Sonido "r" (muy distinto al español, no se vibra igual)
-- ==========================================
('pronunciation', 'Red', 'Red', '', '', 1, 'Rojo. La "r" en inglés no se vibra como en español, la lengua no toca el paladar.', '', '{"pronunciation","r-sound"}', 'beginner', 'english', '/red/', true, NULL),
('pronunciation', 'Right', 'Right', '', '', 1, 'Correcto / derecha. La "r" inicial es suave, casi como decir "w" al empezar.', '', '{"pronunciation","r-sound"}', 'beginner', 'english', '/raɪt/', true, NULL),
('pronunciation', 'World', 'World', '', '', 1, 'Mundo. Combina la "r" suave con una "l" al final, palabra clásica difícil.', '', '{"pronunciation","r-sound"}', 'beginner', 'english', '/wɜːrld/', true, NULL),

-- ==========================================
-- Terminación "-ed" (se pronuncia distinto según la letra anterior)
-- ==========================================
('pronunciation', 'Walked', 'Walked', '', '', 1, 'Caminó. La "-ed" aquí suena como "t", no como "ed".', '', '{"pronunciation","ed-ending"}', 'beginner', 'english', '/wɔːkt/', true, NULL),
('pronunciation', 'Played', 'Played', '', '', 1, 'Jugó. La "-ed" aquí suena como "d".', '', '{"pronunciation","ed-ending"}', 'beginner', 'english', '/pleɪd/', true, NULL),
('pronunciation', 'Wanted', 'Wanted', '', '', 1, 'Quiso / quería. La "-ed" aquí sí se pronuncia como sílaba extra "id".', '', '{"pronunciation","ed-ending"}', 'beginner', 'english', '/ˈwɑːntɪd/', true, NULL),

-- ==========================================
-- Palabras cotidianas frecuentes
-- ==========================================
('pronunciation', 'Restaurant', 'Restaurant', '', '', 1, 'Restaurante. Se pronuncia con 3 sílabas, no 4 como en español.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈrestrɑːnt/', true, NULL),
('pronunciation', 'Comfortable', 'Comfortable', '', '', 1, 'Cómodo. Se pronuncia con solo 3 sílabas: COMF-ta-bul.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈkʌmftərbəl/', true, NULL),
('pronunciation', 'Interesting', 'Interesting', '', '', 1, 'Interesante. El acento va en la primera sílaba: IN-tres-ting.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈɪntrəstɪŋ/', true, NULL),

-- ==========================================
-- Frases cotidianas
-- ==========================================
('pronunciation', 'How much is it?', 'How much is it?', '', '', 1, '¿Cuánto cuesta?', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/haʊ mʌtʃ ɪz ɪt/', true, NULL),
('pronunciation', 'Where is the bathroom?', 'Where is the bathroom?', '', '', 1, '¿Dónde está el baño?', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/wer ɪz ðə ˈbæθruːm/', true, NULL),
('pronunciation', 'I don''t understand', 'I don''t understand', '', '', 1, 'No entiendo.', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/aɪ doʊnt ˌʌndərˈstænd/', true, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Beginner (Set 3)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Formato: option1/option2/option3, '' en vez de NULL
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Números con trampa de pronunciación (13-19 vs 30-90)
-- ==========================================
('pronunciation', 'Thirteen', 'Thirteen', '', '', 1, 'Trece. El acento va al FINAL, distinto de "thirty" (treinta).', '', '{"pronunciation","numbers"}', 'beginner', 'english', '/θɜːrˈtiːn/', true, NULL),
('pronunciation', 'Thirty', 'Thirty', '', '', 1, 'Treinta. El acento va al PRINCIPIO, distinto de "thirteen" (trece).', '', '{"pronunciation","numbers"}', 'beginner', 'english', '/ˈθɜːrti/', true, NULL),
('pronunciation', 'Fourteen', 'Fourteen', '', '', 1, 'Catorce. Acento al final, distinto de "forty" (cuarenta).', '', '{"pronunciation","numbers"}', 'beginner', 'english', '/ˌfɔːrˈtiːn/', true, NULL),
('pronunciation', 'Forty', 'Forty', '', '', 1, 'Cuarenta. Acento al principio, distinto de "fourteen" (catorce).', '', '{"pronunciation","numbers"}', 'beginner', 'english', '/ˈfɔːrti/', true, NULL),

-- ==========================================
-- Colores con retos de pronunciación
-- ==========================================
('pronunciation', 'Orange', 'Orange', '', '', 1, 'Naranja. Se pronuncia con 2 sílabas: OR-anj, no 3.', '', '{"pronunciation","colors"}', 'beginner', 'english', '/ˈɔːrɪndʒ/', true, NULL),
('pronunciation', 'Purple', 'Purple', '', '', 1, 'Morado. La "r" es suave y la "le" final casi no suena como vocal.', '', '{"pronunciation","colors"}', 'beginner', 'english', '/ˈpɜːrpəl/', true, NULL),
('pronunciation', 'Yellow', 'Yellow', '', '', 1, 'Amarillo. La doble "l" se pronuncia como una sola "l" suave.', '', '{"pronunciation","colors"}', 'beginner', 'english', '/ˈjeloʊ/', true, NULL),

-- ==========================================
-- Palabras con acentuación poco intuitiva
-- ==========================================
('pronunciation', 'Chocolate', 'Chocolate', '', '', 1, 'Chocolate. Se pronuncia con solo 2 sílabas: CHOC-lit, no 3.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈtʃɔːklət/', true, NULL),
('pronunciation', 'Different', 'Different', '', '', 1, 'Diferente. Se pronuncia con 2 sílabas: DIF-rent, no 3.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈdɪfrənt/', true, NULL),
('pronunciation', 'Every', 'Every', '', '', 1, 'Cada. Se pronuncia con 2 sílabas: EV-ry, no 3.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈevri/', true, NULL),
('pronunciation', 'Camera', 'Camera', '', '', 1, 'Cámara. Se pronuncia con 2 sílabas: CAM-ra, no 3.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈkæmrə/', true, NULL),

-- ==========================================
-- Más frases cotidianas
-- ==========================================
('pronunciation', 'Can you help me?', 'Can you help me?', '', '', 1, '¿Puedes ayudarme?', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/kæn juː help miː/', true, NULL),
('pronunciation', 'What time is it?', 'What time is it?', '', '', 1, '¿Qué hora es?', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/wʌt taɪm ɪz ɪt/', true, NULL),
('pronunciation', 'I would like a coffee', 'I would like a coffee', '', '', 1, 'Me gustaría un café.', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/aɪ wʊd laɪk ə ˈkɔːfi/', true, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Beginner (Set 1)
-- Modo: Práctica con calma (NO combate — sin presión de tiempo)
-- Reglas:
--   * type = pronunciation, una sola palabra/frase por carta
--   * option1 = la palabra/frase correcta, option2 y option3 = NULL
--     (no es opción múltiple, el usuario repite/escucha y compara)
--   * correct_option = 1 siempre
--   * phonetic SIEMPRE lleno, requires_audio = true
--   * Prioriza sonidos difíciles para hispanohablantes: "th", vocales
--     cortas/largas, letras mudas
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Sonido "th" (no existe en español, común mal pronunciar como "d" o "z")
-- ==========================================
('pronunciation', 'Think', 'Think', '', '', 1, 'Pensar. La "th" se pronuncia poniendo la lengua entre los dientes, no como "d".', '', '{"pronunciation","th-sound"}', 'beginner', 'english', '/θɪŋk/', true, NULL),
('pronunciation', 'This', 'This', '', '', 1, 'Esto/esta. La "th" aquí suena más suave, casi como una "d" vibrada.', '', '{"pronunciation","th-sound"}', 'beginner', 'english', '/ðɪs/', true, NULL),
('pronunciation', 'Three', 'Three', '', '', 1, 'Tres. Cuidado con decir "tree" (árbol) por error.', '', '{"pronunciation","th-sound"}', 'beginner', 'english', '/θriː/', true, NULL),
('pronunciation', 'Mother', 'Mother', '', '', 1, 'Madre. La "th" en medio de la palabra también lleva el sonido vibrado.', '', '{"pronunciation","th-sound"}', 'beginner', 'english', '/ˈmʌðər/', true, NULL),

-- ==========================================
-- Vocales cortas vs largas (confusión común: i corta vs ee larga)
-- ==========================================
('pronunciation', 'Ship', 'Ship', '', '', 1, 'Barco. La "i" es corta y rápida, distinta de "sheep" (oveja).', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/ʃɪp/', true, NULL),
('pronunciation', 'Sheep', 'Sheep', '', '', 1, 'Oveja. La "ee" es larga, se alarga más que en "ship".', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/ʃiːp/', true, NULL),
('pronunciation', 'Live', 'Live', '', '', 1, 'Vivir. Vocal corta, distinto de "leave" (irse).', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/lɪv/', true, NULL),
('pronunciation', 'Leave', 'Leave', '', '', 1, 'Irse / dejar. Vocal larga, distinto de "live" (vivir).', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/liːv/', true, NULL),

-- ==========================================
-- Letras mudas (silent letters) — clásico reto para principiantes
-- ==========================================
('pronunciation', 'Know', 'Know', '', '', 1, 'Saber / conocer. La "k" es muda, no se pronuncia.', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/noʊ/', true, NULL),
('pronunciation', 'Hour', 'Hour', '', '', 1, 'Hora. La "h" es muda, suena como si empezara con vocal.', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/aʊər/', true, NULL),
('pronunciation', 'Comb', 'Comb', '', '', 1, 'Peine. La "b" al final es muda.', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/koʊm/', true, NULL),

-- ==========================================
-- Palabras cotidianas de uso frecuente
-- ==========================================
('pronunciation', 'Water', 'Water', '', '', 1, 'Agua. La "t" en medio suena suave, casi como una "d" rápida.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈwɔːtər/', true, NULL),
('pronunciation', 'Family', 'Family', '', '', 1, 'Familia. Tres sílabas: FA-mi-ly, el acento va en la primera.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈfæməli/', true, NULL),
('pronunciation', 'Beautiful', 'Beautiful', '', '', 1, 'Hermoso. El acento va en la primera sílaba: BEAU-ti-ful.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈbjuːtɪfəl/', true, NULL),
('pronunciation', 'Vegetable', 'Vegetable', '', '', 1, 'Vegetal. Se pronuncia con solo 3 sílabas: VEJ-ta-bul, no 4.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈvedʒtəbəl/', true, NULL),

-- ==========================================
-- Frases de uso cotidiano
-- ==========================================
('pronunciation', 'Good morning', 'Good morning', '', '', 1, 'Buenos días.', '', '{"pronunciation","phrases","greetings"}', 'beginner', 'english', '/ɡʊd ˈmɔːrnɪŋ/', true, NULL),
('pronunciation', 'Thank you very much', 'Thank you very much', '', '', 1, 'Muchas gracias.', '', '{"pronunciation","phrases","greetings"}', 'beginner', 'english', '/θæŋk juː ˈveri mʌtʃ/', true, NULL),
('pronunciation', 'Nice to meet you', 'Nice to meet you', '', '', 1, 'Encantado de conocerte.', '', '{"pronunciation","phrases","greetings"}', 'beginner', 'english', '/naɪs tə miːt juː/', true, NULL);



-- ==========================================
-- Card Ninja — PRONUNCIATION / Beginner (Set 4)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Formato: option1/option2/option3, '' en vez de NULL
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Terminación plural "-s" (suena distinto según la letra anterior: /s/, /z/, /ɪz/)
-- ==========================================
('pronunciation', 'Cats', 'Cats', '', '', 1, 'Gatos. La "-s" aquí suena como "s" fuerte.', '', '{"pronunciation","plural-s"}', 'beginner', 'english', '/kæts/', true, NULL),
('pronunciation', 'Dogs', 'Dogs', '', '', 1, 'Perros. La "-s" aquí suena como "z".', '', '{"pronunciation","plural-s"}', 'beginner', 'english', '/dɔːɡz/', true, NULL),
('pronunciation', 'Houses', 'Houses', '', '', 1, 'Casas. La "-es" aquí agrega una sílaba extra: HOU-siz.', '', '{"pronunciation","plural-s"}', 'beginner', 'english', '/ˈhaʊzɪz/', true, NULL),

-- ==========================================
-- Grupos consonánticos difíciles al inicio de palabra
-- ==========================================
('pronunciation', 'Street', 'Street', '', '', 1, 'Calle. El grupo "str" se pronuncia sin agregar una vocal antes, distinto del español.', '', '{"pronunciation","consonant-clusters"}', 'beginner', 'english', '/striːt/', true, NULL),
('pronunciation', 'School', 'School', '', '', 1, 'Escuela. El grupo "sch" empieza directo con "s", sin "e" antes.', '', '{"pronunciation","consonant-clusters"}', 'beginner', 'english', '/skuːl/', true, NULL),
('pronunciation', 'Spring', 'Spring', '', '', 1, 'Primavera. Cuatro consonantes seguidas: "spr" + "ng", sin vocales de más.', '', '{"pronunciation","consonant-clusters"}', 'beginner', 'english', '/sprɪŋ/', true, NULL),
('pronunciation', 'Splash', 'Splash', '', '', 1, 'Salpicar. El grupo "spl" se pronuncia todo junto, sin pausa.', '', '{"pronunciation","consonant-clusters"}', 'beginner', 'english', '/splæʃ/', true, NULL),

-- ==========================================
-- Pares de palabras que se confunden fácilmente
-- ==========================================
('pronunciation', 'Bear', 'Bear', '', '', 1, 'Oso. No confundir con "beer" (cerveza) — la vocal es distinta.', '', '{"pronunciation","confusing-pairs"}', 'beginner', 'english', '/ber/', true, NULL),
('pronunciation', 'Beer', 'Beer', '', '', 1, 'Cerveza. No confundir con "bear" (oso) — la vocal es distinta.', '', '{"pronunciation","confusing-pairs"}', 'beginner', 'english', '/bɪr/', true, NULL),
('pronunciation', 'Hair', 'Hair', '', '', 1, 'Cabello. No confundir con "hear" (oír) — se escriben distinto y suenan distinto.', '', '{"pronunciation","confusing-pairs"}', 'beginner', 'english', '/her/', true, NULL),
('pronunciation', 'Hear', 'Hear', '', '', 1, 'Oír. No confundir con "hair" (cabello).', '', '{"pronunciation","confusing-pairs"}', 'beginner', 'english', '/hɪr/', true, NULL),

-- ==========================================
-- Verbos comunes con pronunciación irregular
-- ==========================================
('pronunciation', 'Says', 'Says', '', '', 1, 'Dice. Se pronuncia "sez", no "seiz" como parece por su escritura.', '', '{"pronunciation","irregular"}', 'beginner', 'english', '/sez/', true, NULL),
('pronunciation', 'Said', 'Said', '', '', 1, 'Dijo. Se pronuncia "sed", no "seid" como parece.', '', '{"pronunciation","irregular"}', 'beginner', 'english', '/sed/', true, NULL),
('pronunciation', 'Does', 'Does', '', '', 1, 'Hace. Se pronuncia "duz", no "dous" como parece.', '', '{"pronunciation","irregular"}', 'beginner', 'english', '/dʌz/', true, NULL),

-- ==========================================
-- Más frases cotidianas
-- ==========================================
('pronunciation', 'See you tomorrow', 'See you tomorrow', '', '', 1, 'Nos vemos mañana.', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/siː juː təˈmɔːroʊ/', true, NULL),
('pronunciation', 'Have a nice day', 'Have a nice day', '', '', 1, 'Que tengas un buen día.', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/hæv ə naɪs deɪ/', true, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Beginner (Set 5)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Formato: option1/option2/option3, '' en vez de NULL
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Diptongos (dos sonidos vocálicos en una sílaba, no existen igual en español)
-- ==========================================
('pronunciation', 'Time', 'Time', '', '', 1, 'Tiempo. El diptongo suena como "ai": TAIM.', '', '{"pronunciation","diphthongs"}', 'beginner', 'english', '/taɪm/', true, NULL),
('pronunciation', 'House', 'House', '', '', 1, 'Casa. El diptongo suena como "au": HAUS.', '', '{"pronunciation","diphthongs"}', 'beginner', 'english', '/haʊs/', true, NULL),
('pronunciation', 'Boy', 'Boy', '', '', 1, 'Niño. El diptongo suena como "oi": BOI.', '', '{"pronunciation","diphthongs"}', 'beginner', 'english', '/bɔɪ/', true, NULL),
('pronunciation', 'Phone', 'Phone', '', '', 1, 'Teléfono. La "o" es un diptongo suave: FOUN.', '', '{"pronunciation","diphthongs"}', 'beginner', 'english', '/foʊn/', true, NULL),

-- ==========================================
-- Terminación "-ing" (gerundio, muy frecuente)
-- ==========================================
('pronunciation', 'Running', 'Running', '', '', 1, 'Corriendo. La "-ing" final se pronuncia con la "g" nasal, no como "in".', '', '{"pronunciation","ing-ending"}', 'beginner', 'english', '/ˈrʌnɪŋ/', true, NULL),
('pronunciation', 'Reading', 'Reading', '', '', 1, 'Leyendo. Mismo sonido nasal al final: "-ing".', '', '{"pronunciation","ing-ending"}', 'beginner', 'english', '/ˈriːdɪŋ/', true, NULL),
('pronunciation', 'Cooking', 'Cooking', '', '', 1, 'Cocinando. La "-ing" nunca se pronuncia como "in" solamente.', '', '{"pronunciation","ing-ending"}', 'beginner', 'english', '/ˈkʊkɪŋ/', true, NULL),

-- ==========================================
-- Palabras con acentuación poco intuitiva (últimas del nivel beginner)
-- ==========================================
('pronunciation', 'Important', 'Important', '', '', 1, 'Importante. El acento va en la segunda sílaba: im-POR-tant.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ɪmˈpɔːrtənt/', true, NULL),
('pronunciation', 'Possible', 'Possible', '', '', 1, 'Posible. El acento va en la primera sílaba: POS-i-bul.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈpɑːsəbəl/', true, NULL),
('pronunciation', 'Favorite', 'Favorite', '', '', 1, 'Favorito. Se pronuncia con solo 2 sílabas: FEIV-rit, no 3.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/ˈfeɪvərɪt/', true, NULL),
('pronunciation', 'Because', 'Because', '', '', 1, 'Porque. El acento va en la segunda sílaba: bi-CUZ.', '', '{"pronunciation","daily"}', 'beginner', 'english', '/bɪˈkɔːz/', true, NULL),

-- ==========================================
-- Últimas frases cotidianas del nivel beginner
-- ==========================================
('pronunciation', 'What is your name?', 'What is your name?', '', '', 1, '¿Cómo te llamas?', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/wʌt ɪz jʊr neɪm/', true, NULL),
('pronunciation', 'I am learning English', 'I am learning English', '', '', 1, 'Estoy aprendiendo inglés.', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/aɪ æm ˈlɜːrnɪŋ ˈɪŋɡlɪʃ/', true, NULL),
('pronunciation', 'Can you repeat that?', 'Can you repeat that?', '', '', 1, '¿Puedes repetir eso?', '', '{"pronunciation","phrases","daily"}', 'beginner', 'english', '/kæn juː rɪˈpiːt ðæt/', true, NULL);



-- ==========================================
-- Card Ninja — PRONUNCIATION / Intermediate (Set 1)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Enfoque: palabras largas (4+ sílabas) y contracciones habladas
-- Formato: option1/option2/option3, '' en vez de NULL
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Palabras de 4+ sílabas (acentuación más compleja)
-- ==========================================
('pronunciation', 'Opportunity', 'Opportunity', '', '', 1, 'Oportunidad. El acento va en la cuarta sílaba: op-por-TU-ni-ty.', '', '{"pronunciation","multisyllable"}', 'intermediate', 'english', '/ˌɑːpərˈtuːnəti/', true, NULL),
('pronunciation', 'University', 'University', '', '', 1, 'Universidad. El acento va en la tercera sílaba: u-ni-VER-si-ty.', '', '{"pronunciation","multisyllable"}', 'intermediate', 'english', '/ˌjuːnɪˈvɜːrsəti/', true, NULL),
('pronunciation', 'Information', 'Information', '', '', 1, 'Información. El acento va en la tercera sílaba: in-for-MA-tion.', '', '{"pronunciation","multisyllable"}', 'intermediate', 'english', '/ˌɪnfərˈmeɪʃən/', true, NULL),
('pronunciation', 'Necessary', 'Necessary', '', '', 1, 'Necesario. El acento va en la primera sílaba: NE-ce-sa-ry.', '', '{"pronunciation","multisyllable"}', 'intermediate', 'english', '/ˈnesəseri/', true, NULL),
('pronunciation', 'Communication', 'Communication', '', '', 1, 'Comunicación. El acento va en la quinta sílaba: com-mu-ni-CA-tion.', '', '{"pronunciation","multisyllable"}', 'intermediate', 'english', '/kəˌmjuːnɪˈkeɪʃən/', true, NULL),

-- ==========================================
-- Contracciones habladas (muy usadas en habla natural)
-- ==========================================
('pronunciation', 'I''d have gone', 'I''d have gone', '', '', 1, 'Yo hubiera ido. "I''d" suena como "I would" o "I had" reducido, casi como "aid".', '', '{"pronunciation","contractions"}', 'intermediate', 'english', '/aɪd hæv ɡɔːn/', true, NULL),
('pronunciation', 'I wouldn''t know', 'I wouldn''t know', '', '', 1, 'Yo no sabría. "Wouldn''t" se pronuncia rápido, la "t" casi no se escucha.', '', '{"pronunciation","contractions"}', 'intermediate', 'english', '/aɪ ˈwʊdənt noʊ/', true, NULL),
('pronunciation', 'She couldn''t have known', 'She couldn''t have known', '', '', 1, 'Ella no podría haber sabido. "Couldn''t have" suena como "couldn''ta" en habla rápida.', '', '{"pronunciation","contractions"}', 'intermediate', 'english', '/ʃiː ˈkʊdənt hæv noʊn/', true, NULL),
('pronunciation', 'They''re not coming', 'They''re not coming', '', '', 1, 'Ellos no vienen. "They''re" suena igual que "there" y "their".', '', '{"pronunciation","contractions"}', 'intermediate', 'english', '/ðer nɑːt ˈkʌmɪŋ/', true, NULL),

-- ==========================================
-- Frases de nivel intermedio
-- ==========================================
('pronunciation', 'I''ve been thinking about it', 'I''ve been thinking about it', '', '', 1, 'He estado pensando en eso.', '', '{"pronunciation","phrases","intermediate"}', 'intermediate', 'english', '/aɪv bɪn ˈθɪŋkɪŋ əˈbaʊt ɪt/', true, NULL),
('pronunciation', 'It depends on the situation', 'It depends on the situation', '', '', 1, 'Depende de la situación.', '', '{"pronunciation","phrases","intermediate"}', 'intermediate', 'english', '/ɪt dɪˈpendz ɑːn ðə ˌsɪtʃuˈeɪʃən/', true, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Intermediate (Set 2)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Enfoque: entonación de preguntas (yes/no vs wh-) y linking entre palabras
-- Formato: option1/option2/option3, '' en vez de NULL
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Entonación de preguntas Yes/No (sube al final)
-- ==========================================
('pronunciation', 'Are you coming tonight?', 'Are you coming tonight?', '', '', 1, '¿Vienes esta noche? Las preguntas de sí/no suben de tono al final.', '', '{"pronunciation","intonation"}', 'intermediate', 'english', '/ɑːr juː ˈkʌmɪŋ təˈnaɪt/', true, NULL),
('pronunciation', 'Did you finish the report?', 'Did you finish the report?', '', '', 1, '¿Terminaste el informe? El tono sube al final de la pregunta.', '', '{"pronunciation","intonation"}', 'intermediate', 'english', '/dɪd juː ˈfɪnɪʃ ðə rɪˈpɔːrt/', true, NULL),
('pronunciation', 'Can I help you with that?', 'Can I help you with that?', '', '', 1, '¿Puedo ayudarte con eso? Tono ascendente al final.', '', '{"pronunciation","intonation"}', 'intermediate', 'english', '/kæn aɪ help juː wɪð ðæt/', true, NULL),

-- ==========================================
-- Entonación de preguntas Wh- (baja al final)
-- ==========================================
('pronunciation', 'Where did you put my keys?', 'Where did you put my keys?', '', '', 1, '¿Dónde pusiste mis llaves? Las preguntas con wh- bajan de tono al final.', '', '{"pronunciation","intonation"}', 'intermediate', 'english', '/wer dɪd juː pʊt maɪ kiːz/', true, NULL),
('pronunciation', 'Why are you so upset?', 'Why are you so upset?', '', '', 1, '¿Por qué estás tan molesto? Tono descendente al final.', '', '{"pronunciation","intonation"}', 'intermediate', 'english', '/waɪ ɑːr juː soʊ ʌpˈset/', true, NULL),
('pronunciation', 'How does this work?', 'How does this work?', '', '', 1, '¿Cómo funciona esto? Tono descendente, no ascendente como en yes/no.', '', '{"pronunciation","intonation"}', 'intermediate', 'english', '/haʊ dʌz ðɪs wɜːrk/', true, NULL),

-- ==========================================
-- Linking (enlace entre palabras — clave para sonar natural)
-- ==========================================
('pronunciation', 'An apple a day', 'An apple a day', '', '', 1, '"An apple" se enlaza y suena como "a-napple", sin pausa entre palabras.', '', '{"pronunciation","linking"}', 'intermediate', 'english', '/ən ˈæpəl ə deɪ/', true, NULL),
('pronunciation', 'Turn it off', 'Turn it off', '', '', 1, '"Turn it" se enlaza sonando como "tur-nit", la consonante final salta a la siguiente palabra.', '', '{"pronunciation","linking"}', 'intermediate', 'english', '/tɜːrn ɪt ɔːf/', true, NULL),
('pronunciation', 'Not at all', 'Not at all', '', '', 1, 'Las tres palabras se enlazan casi como una sola: "no-ta-tall".', '', '{"pronunciation","linking"}', 'intermediate', 'english', '/nɑːt æt ɔːl/', true, NULL),
('pronunciation', 'Wake up early', 'Wake up early', '', '', 1, '"Wake up" se enlaza sonando como "wei-kup", sin pausa.', '', '{"pronunciation","linking"}', 'intermediate', 'english', '/weɪk ʌp ˈɜːrli/', true, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Intermediate (Set 3)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Enfoque: pares mínimos sutiles + palabras cuyo acento cambia
--   el significado (sustantivo vs verbo)
-- Formato: option1/option2/option3, '' en vez de NULL
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Pares mínimos sutiles (vocal corta vs larga, más difíciles que ship/sheep)
-- ==========================================
('pronunciation', 'Full', 'Full', '', '', 1, 'Lleno. Vocal corta y relajada, distinta de "fool" (tonto).', '', '{"pronunciation","minimal-pairs"}', 'intermediate', 'english', '/fʊl/', true, NULL),
('pronunciation', 'Fool', 'Fool', '', '', 1, 'Tonto. Vocal larga y tensa, distinta de "full" (lleno).', '', '{"pronunciation","minimal-pairs"}', 'intermediate', 'english', '/fuːl/', true, NULL),
('pronunciation', 'Pull', 'Pull', '', '', 1, 'Jalar. Vocal corta, distinta de "pool" (piscina).', '', '{"pronunciation","minimal-pairs"}', 'intermediate', 'english', '/pʊl/', true, NULL),
('pronunciation', 'Pool', 'Pool', '', '', 1, 'Piscina. Vocal larga, distinta de "pull" (jalar).', '', '{"pronunciation","minimal-pairs"}', 'intermediate', 'english', '/puːl/', true, NULL),
('pronunciation', 'Bit', 'Bit', '', '', 1, 'Un poco / pedacito. Vocal corta, distinta de "beat" (golpear / ritmo).', '', '{"pronunciation","minimal-pairs"}', 'intermediate', 'english', '/bɪt/', true, NULL),
('pronunciation', 'Beat', 'Beat', '', '', 1, 'Golpear / ritmo. Vocal larga, distinta de "bit" (un poco).', '', '{"pronunciation","minimal-pairs"}', 'intermediate', 'english', '/biːt/', true, NULL),

-- ==========================================
-- Palabras donde el acento cambia el significado (sustantivo vs verbo)
-- ==========================================
('pronunciation', 'RECord (noun)', 'RECord', '', '', 1, 'Récord / disco (sustantivo). El acento va en la primera sílaba.', '', '{"pronunciation","stress-shift"}', 'intermediate', 'english', '/ˈrekərd/', true, NULL),
('pronunciation', 'reCORD (verb)', 'reCORD', '', '', 1, 'Grabar (verbo). El acento va en la segunda sílaba.', '', '{"pronunciation","stress-shift"}', 'intermediate', 'english', '/rɪˈkɔːrd/', true, NULL),
('pronunciation', 'PREsent (noun)', 'PREsent', '', '', 1, 'Regalo / presente (sustantivo). El acento va en la primera sílaba.', '', '{"pronunciation","stress-shift"}', 'intermediate', 'english', '/ˈprezənt/', true, NULL),
('pronunciation', 'preSENT (verb)', 'preSENT', '', '', 1, 'Presentar (verbo). El acento va en la segunda sílaba.', '', '{"pronunciation","stress-shift"}', 'intermediate', 'english', '/prɪˈzent/', true, NULL),

-- ==========================================
-- Más frases de nivel intermedio
-- ==========================================
('pronunciation', 'I''m not sure what to do', 'I''m not sure what to do', '', '', 1, 'No estoy segura de qué hacer.', '', '{"pronunciation","phrases","intermediate"}', 'intermediate', 'english', '/aɪm nɑːt ʃʊr wʌt tə duː/', true, NULL),
('pronunciation', 'Let me get back to you', 'Let me get back to you', '', '', 1, 'Déjame responderte después.', '', '{"pronunciation","phrases","intermediate"}', 'intermediate', 'english', '/let miː ɡet bæk tə juː/', true, NULL);



-- ==========================================
-- Card Ninja — PRONUNCIATION / Intermediate (Set 4)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Enfoque: formas reducidas del habla natural (gonna, wanna...) y
--   palabras función con sonido schwa (to, for, of, and)
-- Formato: option1/option2/option3, '' en vez de NULL
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Formas reducidas del habla natural (muy comunes, casi nunca enseñadas)
-- ==========================================
('pronunciation', 'I''m gonna go now', 'I''m gonna go now', '', '', 1, 'Me voy a ir ahora. "Gonna" es la forma hablada relajada de "going to".', '', '{"pronunciation","reduced-forms"}', 'intermediate', 'english', '/aɪm ˈɡɔːnə ɡoʊ naʊ/', true, NULL),
('pronunciation', 'I wanna try that', 'I wanna try that', '', '', 1, 'Quiero probar eso. "Wanna" es la forma hablada relajada de "want to".', '', '{"pronunciation","reduced-forms"}', 'intermediate', 'english', '/aɪ ˈwɑːnə traɪ ðæt/', true, NULL),
('pronunciation', 'I gotta go', 'I gotta go', '', '', 1, 'Tengo que irme. "Gotta" es la forma hablada relajada de "got to" / "have to".', '', '{"pronunciation","reduced-forms"}', 'intermediate', 'english', '/aɪ ˈɡɑːtə ɡoʊ/', true, NULL),
('pronunciation', 'What are you gonna do?', 'What are you gonna do?', '', '', 1, '¿Qué vas a hacer? Nota cómo "gonna" reemplaza "going to" en habla casual.', '', '{"pronunciation","reduced-forms"}', 'intermediate', 'english', '/wʌt ɑːr juː ˈɡɔːnə duː/', true, NULL),

-- ==========================================
-- Palabras función con sonido schwa (se pronuncian débiles, no como se escriben)
-- ==========================================
('pronunciation', 'Bread and butter', 'Bread and butter', '', '', 1, '"And" aquí suena débil, casi como "n", no como "and" completo.', '', '{"pronunciation","weak-forms"}', 'intermediate', 'english', '/bred ən ˈbʌtər/', true, NULL),
('pronunciation', 'A cup of tea', 'A cup of tea', '', '', 1, '"Of" suena débil, casi como "uh", no como "ov" marcado.', '', '{"pronunciation","weak-forms"}', 'intermediate', 'english', '/ə kʌp əv tiː/', true, NULL),
('pronunciation', 'I want to go', 'I want to go', '', '', 1, '"To" suena débil, casi como "tuh", en habla natural rápida.', '', '{"pronunciation","weak-forms"}', 'intermediate', 'english', '/aɪ wɑːnt tə ɡoʊ/', true, NULL),
('pronunciation', 'Waiting for the bus', 'Waiting for the bus', '', '', 1, '"For" suena débil, casi como "fer", no como "for" marcado.', '', '{"pronunciation","weak-forms"}', 'intermediate', 'english', '/ˈweɪtɪŋ fər ðə bʌs/', true, NULL),

-- ==========================================
-- Homófonos (misma pronunciación, distinto significado y escritura)
-- ==========================================
('pronunciation', 'Their', 'Their', '', '', 1, 'De ellos. Suena exactamente igual que "there" y "they''re".', '', '{"pronunciation","homophones"}', 'intermediate', 'english', '/ðer/', true, NULL),
('pronunciation', 'Write', 'Write', '', '', 1, 'Escribir. Suena exactamente igual que "right" (correcto/derecha).', '', '{"pronunciation","homophones"}', 'intermediate', 'english', '/raɪt/', true, NULL),

-- ==========================================
-- Más frases de nivel intermedio
-- ==========================================
('pronunciation', 'I should''ve called you', 'I should''ve called you', '', '', 1, 'Debí haberte llamado. "Should''ve" suena como "shoulda".', '', '{"pronunciation","phrases","intermediate"}', 'intermediate', 'english', '/aɪ ˈʃʊdəv kɔːld juː/', true, NULL),
('pronunciation', 'It''s up to you', 'It''s up to you', '', '', 1, 'Depende de ti / tú decides.', '', '{"pronunciation","phrases","intermediate"}', 'intermediate', 'english', '/ɪts ʌp tə juː/', true, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Intermediate (Set 5)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Enfoque: familia "-ough" (misma letra, sonidos totalmente distintos)
--   y acentuación de sustantivos compuestos
-- Formato: option1/option2/option3, '' en vez de NULL
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Familia "-ough" (una de las irregularidades más famosas del inglés)
-- ==========================================
('pronunciation', 'Though', 'Though', '', '', 1, 'Aunque. Suena como "thou" — la "gh" es muda.', '', '{"pronunciation","ough-family"}', 'intermediate', 'english', '/ðoʊ/', true, NULL),
('pronunciation', 'Through', 'Through', '', '', 1, 'A través de. Suena como "throo" — totalmente distinto de "though".', '', '{"pronunciation","ough-family"}', 'intermediate', 'english', '/θruː/', true, NULL),
('pronunciation', 'Tough', 'Tough', '', '', 1, 'Difícil / duro. Aquí la "gh" suena como "f": TUF.', '', '{"pronunciation","ough-family"}', 'intermediate', 'english', '/tʌf/', true, NULL),
('pronunciation', 'Thought', 'Thought', '', '', 1, 'Pensamiento. Suena como "thawt" — la "gh" es muda otra vez.', '', '{"pronunciation","ough-family"}', 'intermediate', 'english', '/θɔːt/', true, NULL),
('pronunciation', 'Bought', 'Bought', '', '', 1, 'Compró. Rima con "thought", suena como "bawt".', '', '{"pronunciation","ough-family"}', 'intermediate', 'english', '/bɔːt/', true, NULL),
('pronunciation', 'Enough', 'Enough', '', '', 1, 'Suficiente. Aquí la "gh" también suena como "f": eNUFF.', '', '{"pronunciation","ough-family"}', 'intermediate', 'english', '/ɪˈnʌf/', true, NULL),

-- ==========================================
-- Acentuación de sustantivos compuestos (el acento va en la primera palabra)
-- ==========================================
('pronunciation', 'Blackbird', 'Blackbird', '', '', 1, 'Mirlo (ave). Como sustantivo compuesto, el acento va en "BLACK".', '', '{"pronunciation","compound-nouns"}', 'intermediate', 'english', '/ˈblækbɜːrd/', true, NULL),
('pronunciation', 'Greenhouse', 'Greenhouse', '', '', 1, 'Invernadero. El acento va en "GREEN", distinto de decir "a green house" (una casa verde).', '', '{"pronunciation","compound-nouns"}', 'intermediate', 'english', '/ˈɡriːnhaʊs/', true, NULL),
('pronunciation', 'Bookstore', 'Bookstore', '', '', 1, 'Librería. El acento va en "BOOK".', '', '{"pronunciation","compound-nouns"}', 'intermediate', 'english', '/ˈbʊkstɔːr/', true, NULL),

-- ==========================================
-- Acentuación de frase (qué palabra se enfatiza en una oración)
-- ==========================================
('pronunciation', 'I didn''t say SHE stole it', 'I didn''t say SHE stole it', '', '', 1, 'Yo no dije que ELLA lo robó (implica que fue otra persona). El énfasis cambia el significado.', '', '{"pronunciation","sentence-stress"}', 'intermediate', 'english', '/aɪ ˈdɪdənt seɪ ʃiː stoʊl ɪt/', true, NULL),
('pronunciation', 'I didn''t SAY she stole it', 'I didn''t SAY she stole it', '', '', 1, 'Yo no DIJE que ella lo robó (implica que lo insinué de otra forma). El énfasis cambia el significado.', '', '{"pronunciation","sentence-stress"}', 'intermediate', 'english', '/aɪ ˈdɪdənt seɪ ʃiː stoʊl ɪt/', true, NULL),

-- ==========================================
-- Más frases de nivel intermedio
-- ==========================================
('pronunciation', 'I''ll think it through', 'I''ll think it through', '', '', 1, 'Lo voy a pensar bien.', '', '{"pronunciation","phrases","intermediate"}', 'intermediate', 'english', '/aɪl θɪŋk ɪt θruː/', true, NULL);



-- ==========================================
-- Card Ninja — PRONUNCIATION / Advanced (Set 1)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Enfoque: reducción extrema del habla rápida/casual nativa
-- Formato: option1/option2/option3, '' en vez de NULL
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('pronunciation', 'Whatcha doing?', 'Whatcha doing?', '', '', 1, '¿Qué estás haciendo? "Whatcha" es la reducción hablada de "what are you".', '', '{"pronunciation","extreme-reduction"}', 'advanced', 'english', '/ˈwʌtʃə ˈduːɪŋ/', true, NULL),
('pronunciation', 'I dunno', 'I dunno', '', '', 1, 'No sé. "Dunno" es la reducción hablada de "don''t know".', '', '{"pronunciation","extreme-reduction"}', 'advanced', 'english', '/aɪ dəˈnoʊ/', true, NULL),
('pronunciation', 'Lemme see that', 'Lemme see that', '', '', 1, 'Déjame ver eso. "Lemme" es la reducción hablada de "let me".', '', '{"pronunciation","extreme-reduction"}', 'advanced', 'english', '/ˈlemi siː ðæt/', true, NULL),
('pronunciation', 'It''s kinda weird', 'It''s kinda weird', '', '', 1, 'Es medio raro. "Kinda" es la reducción hablada de "kind of".', '', '{"pronunciation","extreme-reduction"}', 'advanced', 'english', '/ɪts ˈkaɪndə wɪrd/', true, NULL),
('pronunciation', 'Gimme a second', 'Gimme a second', '', '', 1, 'Dame un segundo. "Gimme" es la reducción hablada de "give me".', '', '{"pronunciation","extreme-reduction"}', 'advanced', 'english', '/ˈɡɪmi ə ˈsekənd/', true, NULL),
('pronunciation', 'I''m sorta busy', 'I''m sorta busy', '', '', 1, 'Estoy medio ocupado. "Sorta" es la reducción hablada de "sort of".', '', '{"pronunciation","extreme-reduction"}', 'advanced', 'english', '/aɪm ˈsɔːrtə ˈbɪzi/', true, NULL),

-- ==========================================
-- Ritmo del inglés (stress-timed): la misma cantidad de tiempo entre
-- acentos, sin importar cuántas sílabas átonas haya en medio
-- ==========================================
('pronunciation', 'The CAT sat on the MAT', 'The CAT sat on the MAT', '', '', 1, 'El gato se sentó en el tapete. Solo "CAT" y "MAT" llevan fuerza; el resto se comprime rápido entre ellas.', '', '{"pronunciation","rhythm"}', 'advanced', 'english', '/ðə kæt sæt ɑːn ðə mæt/', true, NULL),
('pronunciation', 'She CAN''T beLIEVE it', 'She CAN''T beLIEVE it', '', '', 1, 'Ella no puede creerlo. El ritmo cae en "CAN''T" y "LIEVE", el resto se acelera.', '', '{"pronunciation","rhythm"}', 'advanced', 'english', '/ʃiː kænt bɪˈliːv ɪt/', true, NULL),

-- ==========================================
-- Frases de nivel avanzado (habla natural fluida)
-- ==========================================
('pronunciation', 'I could''ve sworn I locked it', 'I could''ve sworn I locked it', '', '', 1, 'Podría haber jurado que lo cerré con llave.', '', '{"pronunciation","phrases","advanced"}', 'advanced', 'english', '/aɪ ˈkʊdəv swɔːrn aɪ lɑːkt ɪt/', true, NULL),
('pronunciation', 'That''s not what I meant at all', 'That''s not what I meant at all', '', '', 1, 'Eso no es para nada lo que quise decir.', '', '{"pronunciation","phrases","advanced"}', 'advanced', 'english', '/ðæts nɑːt wʌt aɪ ment æt ɔːl/', true, NULL);




-- ==========================================
-- Card Ninja — PRONUNCIATION / Advanced (Set 2)
-- Modo: Práctica con calma (sin presión de tiempo)
-- Enfoque: entonación emocional/actitudinal — el MISMO texto cambia
--   de significado según el tono con que se dice
-- Formato: option1/option2/option3, '' en vez de NULL
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- ==========================================
-- Sarcasmo (tono plano o exagerado invierte el significado literal)
-- ==========================================
('pronunciation', 'Oh, great...', 'Oh, great...', '', '', 1, 'Ay, qué bien... Dicho con tono plano y alargado, significa lo contrario: fastidio, no alegría.', '', '{"pronunciation","attitude","sarcasm"}', 'advanced', 'english', '/oʊ ɡreɪt/', true, NULL),
('pronunciation', 'Yeah, right', 'Yeah, right', '', '', 1, 'Sí, claro. Dicho con tono descendente marcado, expresa incredulidad, no acuerdo.', '', '{"pronunciation","attitude","sarcasm"}', 'advanced', 'english', '/jeə raɪt/', true, NULL),
('pronunciation', 'Nice job', 'Nice job', '', '', 1, 'Buen trabajo. Dicho con tono plano tras un error, es sarcasmo, no un cumplido real.', '', '{"pronunciation","attitude","sarcasm"}', 'advanced', 'english', '/naɪs dʒɑːb/', true, NULL),

-- ==========================================
-- Sorpresa (tono ascendente marcado y más agudo de lo normal)
-- ==========================================
('pronunciation', 'You did WHAT?', 'You did WHAT?', '', '', 1, '¿Hiciste QUÉ? El tono sube mucho en "WHAT" para expresar sorpresa o shock.', '', '{"pronunciation","attitude","surprise"}', 'advanced', 'english', '/juː dɪd wʌt/', true, NULL),
('pronunciation', 'No way!', 'No way!', '', '', 1, '¡No puede ser! Tono ascendente marcado, expresa incredulidad sorprendida.', '', '{"pronunciation","attitude","surprise"}', 'advanced', 'english', '/noʊ weɪ/', true, NULL),
('pronunciation', 'Are you serious?', 'Are you serious?', '', '', 1, '¿Hablas en serio? El tono sube fuerte al final, distinto de una pregunta neutral.', '', '{"pronunciation","attitude","surprise"}', 'advanced', 'english', '/ɑːr juː ˈsɪriəs/', true, NULL),

-- ==========================================
-- Duda / incertidumbre (tono vacilante, a veces con pausa media)
-- ==========================================
('pronunciation', 'I guess so...', 'I guess so...', '', '', 1, 'Supongo que sí... Tono descendente débil y alargado, muestra poca convicción.', '', '{"pronunciation","attitude","doubt"}', 'advanced', 'english', '/aɪ ɡes soʊ/', true, NULL),
('pronunciation', 'Maybe? I''m not sure', 'Maybe? I''m not sure', '', '', 1, '¿Tal vez? No estoy seguro. "Maybe" sube de tono como pregunta, mostrando duda real.', '', '{"pronunciation","attitude","doubt"}', 'advanced', 'english', '/ˈmeɪbi aɪm nɑːt ʃʊr/', true, NULL),

-- ==========================================
-- Frases finales con carga actitudinal
-- ==========================================
('pronunciation', 'Whatever you say', 'Whatever you say', '', '', 1, 'Lo que tú digas. Con tono plano y desinteresado, expresa resignación o desacuerdo pasivo.', '', '{"pronunciation","phrases","advanced"}', 'advanced', 'english', '/wʌtˈevər juː seɪ/', true, NULL),
('pronunciation', 'If you say so', 'If you say so', '', '', 1, 'Si tú lo dices. Con tono descendente escéptico, implica que no estás muy de acuerdo.', '', '{"pronunciation","phrases","advanced"}', 'advanced', 'english', '/ɪf juː seɪ soʊ/', true, NULL);






-- ============================================================
-- AMPLIACIÓN DEL CATÁLOGO (2026-07-18) — sets adicionales
-- Mismas reglas de los sets originales. Convención de autoría:
-- option1 = respuesta correcta; el UPDATE final de este archivo
-- baraja la posición real en todas las filas de vocabulary.
-- ============================================================

-- ==========================================
-- Card Ninja — VOCABULARY / Beginner (Set 6)
-- Enfoque: profesiones, lugares, frutas, cuerpo 2, casa,
-- útiles escolares, adjetivos, estaciones, bebidas,
-- animales 2 y números faltantes (3, 4, 7, 9)
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- Profesiones
('vocabulary', '"Maestro / profesor" en inglés es:', 'teacher', 'driver', 'cook', 1, '"Teacher" significa maestro o profesor.', 'Traduce la palabra', '{vocabulary,jobs}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Médico" en inglés es:', 'doctor', 'farmer', 'nurse', 1, '"Doctor" significa médico.', 'Traduce la palabra', '{vocabulary,jobs}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Enfermera / enfermero" en inglés es:', 'nurse', 'teacher', 'pilot', 1, '"Nurse" significa enfermera o enfermero.', 'Traduce la palabra', '{vocabulary,jobs}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Cocinero" en inglés es:', 'cook', 'doctor', 'singer', 1, '"Cook" significa cocinero.', 'Traduce la palabra', '{vocabulary,jobs}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Conductor / chofer" en inglés es:', 'driver', 'nurse', 'farmer', 1, '"Driver" significa conductor o chofer.', 'Traduce la palabra', '{vocabulary,jobs}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Granjero" en inglés es:', 'farmer', 'cook', 'teacher', 1, '"Farmer" significa granjero.', 'Traduce la palabra', '{vocabulary,jobs}', 'beginner', 'english', NULL, false, NULL),

-- Lugares
('vocabulary', 'What is this? 🏫', 'school', 'beach', 'farm', 1, '"School" significa escuela.', '¿Qué es esto?', '{vocabulary,places}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🏥', 'hospital', 'store', 'park', 1, '"Hospital" significa hospital.', '¿Qué es esto?', '{vocabulary,places}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🏞️', 'park', 'church', 'school', 1, '"Park" significa parque.', '¿Qué es esto?', '{vocabulary,places}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🏖️', 'beach', 'farm', 'hospital', 1, '"Beach" significa playa.', '¿Qué es esto?', '{vocabulary,places}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🏪', 'store', 'park', 'church', 1, '"Store" significa tienda.', '¿Qué es esto?', '{vocabulary,places}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? ⛪', 'church', 'school', 'beach', 1, '"Church" significa iglesia.', '¿Qué es esto?', '{vocabulary,places}', 'beginner', 'english', NULL, false, NULL),

-- Frutas
('vocabulary', 'What is this? 🍊', 'orange', 'plum', 'fig', 1, '"Orange" significa naranja.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍇', 'grape', 'melon', 'kiwi', 1, '"Grape" significa uva.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍓', 'strawberry', 'melon', 'fig', 1, '"Strawberry" significa fresa.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍉', 'watermelon', 'kiwi', 'plum', 1, '"Watermelon" significa sandía.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍋', 'lemon', 'grape', 'peach', 1, '"Lemon" significa limón.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍐', 'pear', 'orange', 'cherry', 1, '"Pear" significa pera.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),

-- Cuerpo 2
('vocabulary', '"Cabeza" en inglés es:', 'head', 'foot', 'arm', 1, '"Head" significa cabeza.', 'Traduce la palabra', '{vocabulary,body}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Nariz" en inglés es:', 'nose', 'ear', 'leg', 1, '"Nose" significa nariz.', 'Traduce la palabra', '{vocabulary,body}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Boca" en inglés es:', 'mouth', 'eye', 'hand', 1, '"Mouth" significa boca.', 'Traduce la palabra', '{vocabulary,body}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Oreja" en inglés es:', 'ear', 'nose', 'head', 1, '"Ear" significa oreja.', 'Traduce la palabra', '{vocabulary,body}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Pierna" en inglés es:', 'leg', 'mouth', 'foot', 1, '"Leg" significa pierna.', 'Traduce la palabra', '{vocabulary,body}', 'beginner', 'english', NULL, false, NULL),

-- Casa / habitaciones
('vocabulary', '"Cocina" en inglés es:', 'kitchen', 'garden', 'bedroom', 1, '"Kitchen" significa cocina (la habitación).', 'Traduce la palabra', '{vocabulary,home}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Baño" en inglés es:', 'bathroom', 'kitchen', 'garden', 1, '"Bathroom" significa baño.', 'Traduce la palabra', '{vocabulary,home}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Dormitorio" en inglés es:', 'bedroom', 'bathroom', 'yard', 1, '"Bedroom" significa dormitorio o cuarto.', 'Traduce la palabra', '{vocabulary,home}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Jardín" en inglés es:', 'garden', 'bedroom', 'kitchen', 1, '"Garden" significa jardín.', 'Traduce la palabra', '{vocabulary,home}', 'beginner', 'english', NULL, false, NULL),

-- Útiles escolares
('vocabulary', 'What is this? ✏️', 'pencil', 'ruler', 'glue', 1, '"Pencil" significa lápiz.', '¿Qué es esto?', '{vocabulary,school}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🖊️', 'pen', 'map', 'box', 1, '"Pen" significa bolígrafo o lapicero.', '¿Qué es esto?', '{vocabulary,school}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 📏', 'ruler', 'pencil', 'bag', 1, '"Ruler" significa regla.', '¿Qué es esto?', '{vocabulary,school}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? ✂️', 'scissors', 'pen', 'tape', 1, '"Scissors" significa tijeras.', '¿Qué es esto?', '{vocabulary,school}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🎒', 'backpack', 'ruler', 'desk', 1, '"Backpack" significa mochila.', '¿Qué es esto?', '{vocabulary,school}', 'beginner', 'english', NULL, false, NULL),

-- Adjetivos básicos
('vocabulary', '"Grande" en inglés es:', 'big', 'thin', 'round', 1, '"Big" significa grande.', 'Traduce la palabra', '{vocabulary,adjectives}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Pequeño" en inglés es:', 'small', 'tall', 'wide', 1, '"Small" significa pequeño.', 'Traduce la palabra', '{vocabulary,adjectives}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Caliente" en inglés es:', 'hot', 'wet', 'dark', 1, '"Hot" significa caliente.', 'Traduce la palabra', '{vocabulary,adjectives}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Frío" en inglés es:', 'cold', 'soft', 'dry', 1, '"Cold" significa frío.', 'Traduce la palabra', '{vocabulary,adjectives}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Feliz" en inglés es:', 'happy', 'angry', 'tired', 1, '"Happy" significa feliz.', 'Traduce la palabra', '{vocabulary,adjectives}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Triste" en inglés es:', 'sad', 'glad', 'calm', 1, '"Sad" significa triste.', 'Traduce la palabra', '{vocabulary,adjectives}', 'beginner', 'english', NULL, false, NULL),

-- Estaciones
('vocabulary', '"Verano" en inglés es:', 'summer', 'winter', 'fall', 1, '"Summer" significa verano.', 'Traduce la palabra', '{vocabulary,seasons}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Invierno" en inglés es:', 'winter', 'spring', 'summer', 1, '"Winter" significa invierno.', 'Traduce la palabra', '{vocabulary,seasons}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Primavera" en inglés es:', 'spring', 'fall', 'winter', 1, '"Spring" significa primavera.', 'Traduce la palabra', '{vocabulary,seasons}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', '"Otoño" en inglés es:', 'fall', 'summer', 'spring', 1, '"Fall" significa otoño (en británico también se dice "autumn").', 'Traduce la palabra', '{vocabulary,seasons}', 'beginner', 'english', NULL, false, NULL),

-- Bebidas
('vocabulary', '"Café (la bebida)" en inglés es:', 'coffee', 'tea', 'milk', 1, '"Coffee" significa café. (El emoji ☕ ya se usa en la carta de "cup".)', 'Traduce la palabra', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🍵', 'tea', 'juice', 'soup', 1, '"Tea" significa té.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🧃', 'juice', 'coffee', 'water', 1, '"Juice" significa jugo.', '¿Qué es esto?', '{vocabulary,food}', 'beginner', 'english', NULL, false, NULL),

-- Animales 2
('vocabulary', 'What is this? 🐟', 'fish', 'crab', 'seal', 1, '"Fish" significa pez o pescado.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🦁', 'lion', 'deer', 'goat', 1, '"Lion" significa león.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🐵', 'monkey', 'wolf', 'crab', 1, '"Monkey" significa mono.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'What is this? 🐰', 'rabbit', 'seal', 'deer', 1, '"Rabbit" significa conejo.', '¿Qué es esto?', '{vocabulary,animals}', 'beginner', 'english', NULL, false, NULL),

-- Números faltantes
('vocabulary', 'How many? 🍎🍎🍎', 'three', 'eight', 'one', 1, '"Three" significa tres.', '¿Cuántos hay?', '{vocabulary,numbers}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'How many? 🍎🍎🍎🍎', 'four', 'ten', 'eight', 1, '"Four" significa cuatro.', '¿Cuántos hay?', '{vocabulary,numbers}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'How many? 🍎🍎🍎🍎🍎🍎🍎', 'seven', 'two', 'six', 1, '"Seven" significa siete.', '¿Cuántos hay?', '{vocabulary,numbers}', 'beginner', 'english', NULL, false, NULL),
('vocabulary', 'How many? 🍎🍎🍎🍎🍎🍎🍎🍎🍎', 'nine', 'one', 'five', 1, '"Nine" significa nueve.', '¿Cuántos hay?', '{vocabulary,numbers}', 'beginner', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 9)
-- Enfoque: Phrasal verbs — grupos "AWAY" / "BACK" / "OVER"
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', 'The dog _____ from home. 🐕', 'ran away', 'gave away', 'put away', 1, '"Run away" = escaparse / huir.', 'El perro _____ de casa.', '{phrasal-verb,away}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Please _____ your toys. 🧸', 'put away', 'throw away', 'run away', 1, '"Put away" = guardar algo en su lugar.', 'Por favor _____ tus juguetes.', '{phrasal-verb,away}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I _____ my old clothes to charity. 👕', 'gave away', 'put away', 'took away', 1, '"Give away" = regalar / donar.', '_____ mi ropa vieja a la caridad.', '{phrasal-verb,away}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Don''t _____ the receipt. 🧾', 'throw away', 'give away', 'run away', 1, '"Throw away" = botar / tirar a la basura.', 'No _____ el recibo.', '{phrasal-verb,away}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'She''ll _____ from her trip next week. ✈️', 'come back', 'give back', 'pay back', 1, '"Come back" = regresar / volver.', 'Ella _____ de su viaje la próxima semana.', '{phrasal-verb,back}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Please _____ my pen. 🖊️', 'give back', 'come back', 'call back', 1, '"Give back" = devolver algo.', 'Por favor _____ mi bolígrafo.', '{phrasal-verb,back}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I''m busy — I''ll _____ later. 📞', 'call back', 'come back', 'give back', 1, '"Call back" = devolver la llamada.', 'Estoy ocupado — _____ más tarde.', '{phrasal-verb,back}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'You must _____ the money you owe. 💰', 'pay back', 'call back', 'give back', 1, '"Pay back" = pagar una deuda / devolver dinero.', 'Debes _____ el dinero que debes.', '{phrasal-verb,back}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'It took me weeks to _____ the flu. 🤒', 'get over', 'take over', 'hand over', 1, '"Get over" = superar / recuperarse de algo.', 'Me tomó semanas _____ la gripe.', '{phrasal-verb,over}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Robots might _____ some jobs. 🤖', 'take over', 'get over', 'hand over', 1, '"Take over" = tomar el control / apoderarse.', 'Los robots podrían _____ algunos trabajos.', '{phrasal-verb,over}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 10)
-- Enfoque: Colocaciones MAKE vs DO (error clásico hispanohablante)
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', 'I need to _____ a decision. 🤔', 'make', 'do', 'take', 1, 'Se dice "make a decision", nunca "do a decision".', 'Necesito _____ una decisión.', '{collocations,make-do}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Did you _____ your homework? 📚', 'do', 'make', 'give', 1, 'Se dice "do homework", nunca "make homework".', '¿Hiciste tu tarea?', '{collocations,make-do}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I always _____ mistakes when I rush. 😅', 'make', 'do', 'have', 1, 'Se dice "make a mistake" (cometer un error).', 'Siempre _____ errores cuando me apuro.', '{collocations,make-do}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Let me _____ a phone call. 📞', 'make', 'do', 'give', 1, 'Se dice "make a phone call" (hacer una llamada).', 'Déjame _____ una llamada.', '{collocations,make-do}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I have to _____ the dishes. 🍽️', 'do', 'make', 'set', 1, 'Se dice "do the dishes" (lavar los platos).', 'Tengo que _____ los platos.', '{collocations,make-do}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'Don''t _____ so much noise! 🔊', 'make', 'do', 'put', 1, 'Se dice "make noise" (hacer ruido).', '¡No _____ tanto ruido!', '{collocations,make-do}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', 'I want to _____ new friends. 👋', 'make', 'do', 'get', 1, 'Se dice "make friends" (hacer amigos).', 'Quiero _____ nuevos amigos.', '{collocations,make-do}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 11)
-- Enfoque: Vocabulario de viajes
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', '"Equipaje" en inglés es:', 'luggage', 'ticket', 'passport', 1, '"Luggage" significa equipaje (también "baggage").', 'Traduce la palabra', '{vocabulary,travel}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Vuelo" en inglés es:', 'flight', 'journey', 'cruise', 1, '"Flight" significa vuelo.', 'Traduce la palabra', '{vocabulary,travel}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Pasaporte" en inglés es:', 'passport', 'luggage', 'ticket', 1, '"Passport" significa pasaporte.', 'Traduce la palabra', '{vocabulary,travel}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Aduana" en inglés es:', 'customs', 'costumes', 'tickets', 1, '"Customs" significa aduana. ¡Ojo!: "costumes" son disfraces.', 'Traduce la palabra', '{vocabulary,travel}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Puerta de embarque" en inglés es:', 'gate', 'door', 'port', 1, 'En el aeropuerto, la puerta de embarque es "gate", no "door".', 'Traduce la palabra', '{vocabulary,travel}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Destino" en inglés es:', 'destination', 'destiny', 'departure', 1, '"Destination" es el destino de un viaje. "Destiny" es el destino como suerte.', 'Traduce la palabra', '{vocabulary,travel}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 12)
-- Enfoque: Vocabulario de salud
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', '"Dolor de cabeza" en inglés es:', 'headache', 'stomachache', 'backache', 1, '"Headache" significa dolor de cabeza.', 'Traduce la palabra', '{vocabulary,health}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Medicamento" en inglés es:', 'medicine', 'surgery', 'bandage', 1, '"Medicine" significa medicamento o medicina.', 'Traduce la palabra', '{vocabulary,health}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Cita médica" en inglés es:', 'appointment', 'prescription', 'emergency', 1, '"Appointment" es una cita médica o profesional.', 'Traduce la palabra', '{vocabulary,health}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Fiebre" en inglés es:', 'fever', 'flu', 'pain', 1, '"Fever" significa fiebre.', 'Traduce la palabra', '{vocabulary,health}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Tos" en inglés es:', 'cough', 'sneeze', 'snore', 1, '"Cough" significa tos. "Sneeze" es estornudo.', 'Traduce la palabra', '{vocabulary,health}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 13)
-- Enfoque: Dinero y compras
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', '"Descuento" en inglés es:', 'discount', 'refund', 'deposit', 1, '"Discount" significa descuento.', 'Traduce la palabra', '{vocabulary,money}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Recibo" en inglés es:', 'receipt', 'recipe', 'ticket', 1, '"Receipt" es el recibo de compra. ¡Ojo!: "recipe" es receta de cocina.', 'Traduce la palabra', '{vocabulary,money}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Reembolso" en inglés es:', 'refund', 'discount', 'deposit', 1, '"Refund" significa reembolso o devolución de dinero.', 'Traduce la palabra', '{vocabulary,money}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Efectivo" en inglés es:', 'cash', 'card', 'coin', 1, '"Cash" significa dinero en efectivo.', 'Traduce la palabra', '{vocabulary,money}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Intermediate (Set 14)
-- Enfoque: Falsos amigos (Set 2)
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', '"Carpet" significa:', 'alfombra', 'carpeta', 'cortina', 1, '"Carpet" = alfombra. "Carpeta" en inglés es "folder".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Lecture" significa:', 'conferencia / clase', 'lectura', 'biblioteca', 1, '"Lecture" = conferencia o clase magistral. "Lectura" en inglés es "reading".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Assist" significa:', 'ayudar', 'asistir a un evento', 'insistir', 1, '"Assist" = ayudar. "Asistir" (ir a un lugar) en inglés es "attend".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Argument" significa:', 'discusión / pelea', 'argumento de película', 'acuerdo', 1, '"Argument" = discusión. El argumento de una película es "plot".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Notice" significa:', 'aviso / notar', 'noticia', 'permiso', 1, '"Notice" = aviso o notar algo. "Noticia" en inglés es "news".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Pretend" significa:', 'fingir', 'pretender / intentar', 'prometer', 1, '"Pretend" = fingir. "Pretender" en inglés es "intend" o "try".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Soap" significa:', 'jabón', 'sopa', 'espuma', 1, '"Soap" = jabón. "Sopa" en inglés es "soup".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL),
('vocabulary', '"Vase" significa:', 'florero', 'vaso', 'botella', 1, '"Vase" = florero. "Vaso" en inglés es "glass".', 'Traduce la palabra', '{vocabulary,false-friends}', 'intermediate', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Advanced (Set 5)
-- Enfoque: Modismos / Idioms (Set 2)
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', '"Bite the bullet" significa:', 'armarse de valor y hacerlo', 'morder una bala', 'comer muy rápido', 1, '"Bite the bullet" = decidirse a hacer algo difícil o desagradable de una vez.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Hit the nail on the head" significa:', 'dar en el clavo / acertar', 'clavar un clavo', 'golpearse la cabeza', 1, '"Hit the nail on the head" = acertar exactamente con lo que se dice.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Cut corners" significa:', 'hacer algo a medias para ahorrar', 'cortar esquinas de papel', 'conducir en zigzag', 1, '"Cut corners" = ahorrar tiempo o dinero haciendo algo con menos calidad.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Break a leg" significa:', 'mucha suerte (en el escenario)', 'rómpete una pierna', 'baila con energía', 1, '"Break a leg" = desearle suerte a alguien antes de una presentación.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Burn the midnight oil" significa:', 'trabajar hasta muy tarde', 'quemar aceite a medianoche', 'desperdiciar recursos', 1, '"Burn the midnight oil" = quedarse trabajando o estudiando hasta la madrugada.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Beat around the bush" significa:', 'dar rodeos sin ir al grano', 'golpear un arbusto', 'buscar algo perdido', 1, '"Beat around the bush" = evitar hablar directamente de un tema.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Call it a day" significa:', 'dar por terminada la jornada', 'llamar durante el día', 'agendar una cita', 1, '"Call it a day" = decidir que ya se trabajó suficiente por hoy.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Get out of hand" significa:', 'salirse de control', 'soltarse de la mano', 'terminar una tarea', 1, '"Get out of hand" = descontrolarse una situación.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Miss the boat" significa:', 'perder la oportunidad', 'perder un barco real', 'llegar temprano', 1, '"Miss the boat" = dejar pasar una oportunidad por actuar tarde.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '"Get cold feet" significa:', 'arrepentirse por nervios', 'tener los pies fríos', 'enfermarse de gripe', 1, '"Get cold feet" = acobardarse justo antes de hacer algo importante.', '¿Qué significa esta expresión?', '{vocabulary,idioms}', 'advanced', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Advanced (Set 6)
-- Enfoque: Pares de palabras que se confunden (lend/borrow,
-- say/tell, remind/remember, affect/effect...)
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', 'Can you _____ me your pen? 🖊️', 'lend', 'borrow', 'rent', 1, '"Lend" = prestar A alguien. "Borrow" = pedir prestado DE alguien.', '¿Me puedes _____ tu bolígrafo?', '{vocabulary,confusing-words}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'I need to _____ money from the bank. 🏦', 'borrow', 'lend', 'owe', 1, '"Borrow" = pedir prestado. El banco te presta ("lends"), tú pides prestado ("borrow").', 'Necesito _____ dinero del banco.', '{vocabulary,confusing-words}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'Please _____ me to call my mom. 📞', 'remind', 'remember', 'repeat', 1, '"Remind" = recordarle algo A OTRO. "Remember" = recordar uno mismo.', 'Por favor _____ que llame a mi mamá.', '{vocabulary,confusing-words}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'I can''t _____ his name. 🤔', 'remember', 'remind', 'memorize', 1, '"Remember" = recordar uno mismo. "Remind" necesita otra persona.', 'No puedo _____ su nombre.', '{vocabulary,confusing-words}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'She didn''t _____ a word at the meeting. 🤐', 'say', 'tell', 'speak', 1, '"Say" no lleva persona como objeto directo; "tell" sí ("tell me").', 'Ella no _____ una palabra en la reunión.', '{vocabulary,confusing-words}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'Can you _____ me the truth? 🙏', 'tell', 'say', 'talk', 1, '"Tell" lleva persona: "tell me". Con "say" sería "say it to me".', '¿Puedes _____ la verdad?', '{vocabulary,confusing-words}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'The weather can _____ your mood. 🌧️', 'affect', 'effect', 'infect', 1, '"Affect" es el verbo (afectar); "effect" es el sustantivo (efecto).', 'El clima puede _____ tu estado de ánimo.', '{vocabulary,confusing-words}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', '_____ at that painting! 🖼️', 'Look', 'See', 'Watch', 1, '"Look at" = mirar con intención. "See" = ver sin querer. "Watch" = observar algo en movimiento.', '¡_____ esa pintura!', '{vocabulary,confusing-words}', 'advanced', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — VOCABULARY / Advanced (Set 7)
-- Enfoque: Registro formal (equivalente formal de verbos comunes)
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

('vocabulary', 'Formal synonym of "find out":', 'discover', 'invent', 'search', 1, '"Discover" es el equivalente formal de "find out" (descubrir).', 'Sinónimo formal de "find out"', '{vocabulary,formal-register}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'Formal synonym of "ask for":', 'request', 'question', 'answer', 1, '"Request" es el equivalente formal de "ask for" (solicitar).', 'Sinónimo formal de "ask for"', '{vocabulary,formal-register}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'Formal synonym of "need":', 'require', 'desire', 'acquire', 1, '"Require" es el equivalente formal de "need" (requerir).', 'Sinónimo formal de "need"', '{vocabulary,formal-register}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'Formal synonym of "help":', 'assist', 'insist', 'resist', 1, '"Assist" es el equivalente formal de "help" (ayudar).', 'Sinónimo formal de "help"', '{vocabulary,formal-register}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'Formal synonym of "get":', 'obtain', 'contain', 'maintain', 1, '"Obtain" es el equivalente formal de "get" (obtener).', 'Sinónimo formal de "get"', '{vocabulary,formal-register}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'Formal synonym of "show":', 'demonstrate', 'decorate', 'dominate', 1, '"Demonstrate" es el equivalente formal de "show" (demostrar).', 'Sinónimo formal de "show"', '{vocabulary,formal-register}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'Formal synonym of "end":', 'conclude', 'include', 'exclude', 1, '"Conclude" es el equivalente formal de "end" (concluir).', 'Sinónimo formal de "end"', '{vocabulary,formal-register}', 'advanced', 'english', NULL, false, NULL),
('vocabulary', 'Formal synonym of "use":', 'utilize', 'realize', 'apologize', 1, '"Utilize" es el equivalente formal de "use" (utilizar).', 'Sinónimo formal de "use"', '{vocabulary,formal-register}', 'advanced', 'english', NULL, false, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Beginner (Set 6)
-- Enfoque: sh vs ch, sonido "h", letras mudas 2, "oo" corta vs
-- larga, palabras irregulares y frases de cortesía
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- sh vs ch
('pronunciation', 'Shoes', 'Shoes', '', '', 1, 'Zapatos. La "sh" es suave y continua, como pedir silencio.', '', '{"pronunciation","sh-ch"}', 'beginner', 'english', '/ʃuːz/', true, NULL),
('pronunciation', 'Choose', 'Choose', '', '', 1, 'Elegir. La "ch" es explosiva, distinta de la "sh" de "shoes".', '', '{"pronunciation","sh-ch"}', 'beginner', 'english', '/tʃuːz/', true, NULL),
('pronunciation', 'Watch', 'Watch', '', '', 1, 'Mirar / reloj. Termina en "ch" explosiva, distinta de "wash".', '', '{"pronunciation","sh-ch"}', 'beginner', 'english', '/wɑːtʃ/', true, NULL),
('pronunciation', 'Wash', 'Wash', '', '', 1, 'Lavar. Termina en "sh" suave, distinta de "watch".', '', '{"pronunciation","sh-ch"}', 'beginner', 'english', '/wɑːʃ/', true, NULL),
('pronunciation', 'Chicken', 'Chicken', '', '', 1, 'Pollo. Empieza con "ch" explosiva. No confundir con "kitchen" (cocina).', '', '{"pronunciation","sh-ch"}', 'beginner', 'english', '/ˈtʃɪkɪn/', true, NULL),
('pronunciation', 'Kitchen', 'Kitchen', '', '', 1, 'Cocina. La "ch" va en medio. No confundir con "chicken" (pollo).', '', '{"pronunciation","sh-ch"}', 'beginner', 'english', '/ˈkɪtʃɪn/', true, NULL),

-- Sonido "h" (sí se pronuncia, aspirada — error común omitirla)
('pronunciation', 'Hello', 'Hello', '', '', 1, 'Hola. La "h" SÍ se pronuncia en inglés, con aire aspirado.', '', '{"pronunciation","h-sound"}', 'beginner', 'english', '/həˈloʊ/', true, NULL),
('pronunciation', 'Hungry', 'Hungry', '', '', 1, 'Hambriento. La "h" inicial se aspira, no es muda como en español.', '', '{"pronunciation","h-sound"}', 'beginner', 'english', '/ˈhʌŋɡri/', true, NULL),
('pronunciation', 'Hospital', 'Hospital', '', '', 1, 'Hospital. La "h" se aspira y el acento va en la primera sílaba: HOS-pi-tal.', '', '{"pronunciation","h-sound"}', 'beginner', 'english', '/ˈhɑːspɪtəl/', true, NULL),

-- Letras mudas 2
('pronunciation', 'Island', 'Island', '', '', 1, 'Isla. La "s" es muda: se dice "AI-land".', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/ˈaɪlənd/', true, NULL),
('pronunciation', 'Listen', 'Listen', '', '', 1, 'Escuchar. La "t" es muda: se dice "LI-sen".', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/ˈlɪsən/', true, NULL),
('pronunciation', 'Wednesday', 'Wednesday', '', '', 1, 'Miércoles. La primera "d" es muda: se dice "WENZ-day".', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/ˈwenzdeɪ/', true, NULL),
('pronunciation', 'Half', 'Half', '', '', 1, 'Mitad. La "l" es muda: se dice "HAF".', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/hæf/', true, NULL),
('pronunciation', 'Walk', 'Walk', '', '', 1, 'Caminar. La "l" es muda: se dice "WOK".', '', '{"pronunciation","silent-letters"}', 'beginner', 'english', '/wɔːk/', true, NULL),

-- "oo" corta vs larga
('pronunciation', 'Book', 'Book', '', '', 1, 'Libro. La "oo" aquí es CORTA y relajada.', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/bʊk/', true, NULL),
('pronunciation', 'Moon', 'Moon', '', '', 1, 'Luna. La "oo" aquí es LARGA, se alarga más que en "book".', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/muːn/', true, NULL),
('pronunciation', 'Good', 'Good', '', '', 1, 'Bueno. La "oo" es corta, como en "book".', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/ɡʊd/', true, NULL),
('pronunciation', 'Food', 'Food', '', '', 1, 'Comida. La "oo" es larga, como en "moon".', '', '{"pronunciation","vowels"}', 'beginner', 'english', '/fuːd/', true, NULL),

-- Palabras irregulares frecuentes
('pronunciation', 'Women', 'Women', '', '', 1, 'Mujeres. Se pronuncia "WI-min", la "o" suena como "i". Clásica trampa.', '', '{"pronunciation","irregular"}', 'beginner', 'english', '/ˈwɪmɪn/', true, NULL),
('pronunciation', 'People', 'People', '', '', 1, 'Gente. Se pronuncia "PI-pol", la "eo" suena como "i" larga.', '', '{"pronunciation","irregular"}', 'beginner', 'english', '/ˈpiːpəl/', true, NULL),
('pronunciation', 'Clothes', 'Clothes', '', '', 1, 'Ropa. Se pronuncia casi como "close", en UNA sola sílaba.', '', '{"pronunciation","irregular"}', 'beginner', 'english', '/kloʊðz/', true, NULL),

-- Números 2
('pronunciation', 'Fifteen', 'Fifteen', '', '', 1, 'Quince. El acento va al FINAL, distinto de "fifty" (cincuenta).', '', '{"pronunciation","numbers"}', 'beginner', 'english', '/ˌfɪfˈtiːn/', true, NULL),
('pronunciation', 'Fifty', 'Fifty', '', '', 1, 'Cincuenta. El acento va al PRINCIPIO, distinto de "fifteen" (quince).', '', '{"pronunciation","numbers"}', 'beginner', 'english', '/ˈfɪfti/', true, NULL),

-- Frases de cortesía
('pronunciation', 'Excuse me', 'Excuse me', '', '', 1, 'Disculpe / permiso.', '', '{"pronunciation","phrases","greetings"}', 'beginner', 'english', '/ɪkˈskjuːz miː/', true, NULL),
('pronunciation', 'You''re welcome', 'You''re welcome', '', '', 1, 'De nada.', '', '{"pronunciation","phrases","greetings"}', 'beginner', 'english', '/jʊr ˈwelkəm/', true, NULL),
('pronunciation', 'I''m sorry', 'I''m sorry', '', '', 1, 'Lo siento.', '', '{"pronunciation","phrases","greetings"}', 'beginner', 'english', '/aɪm ˈsɑːri/', true, NULL),
('pronunciation', 'How are you?', 'How are you?', '', '', 1, '¿Cómo estás?', '', '{"pronunciation","phrases","greetings"}', 'beginner', 'english', '/haʊ ɑːr juː/', true, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Intermediate (Set 6)
-- Enfoque: más pares sustantivo/verbo, sonido "zh", th sorda vs
-- sonora, homófonos 2, letras mudas difíciles y palabras largas 2
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- Acento sustantivo vs verbo (set 2)
('pronunciation', 'OBject (noun)', 'OBject', '', '', 1, 'Objeto (sustantivo). El acento va en la primera sílaba.', '', '{"pronunciation","stress-shift"}', 'intermediate', 'english', '/ˈɑːbdʒɪkt/', true, NULL),
('pronunciation', 'obJECT (verb)', 'obJECT', '', '', 1, 'Objetar / oponerse (verbo). El acento va en la segunda sílaba.', '', '{"pronunciation","stress-shift"}', 'intermediate', 'english', '/əbˈdʒekt/', true, NULL),
('pronunciation', 'INcrease (noun)', 'INcrease', '', '', 1, 'Aumento (sustantivo). El acento va en la primera sílaba.', '', '{"pronunciation","stress-shift"}', 'intermediate', 'english', '/ˈɪnkriːs/', true, NULL),
('pronunciation', 'inCREASE (verb)', 'inCREASE', '', '', 1, 'Aumentar (verbo). El acento va en la segunda sílaba.', '', '{"pronunciation","stress-shift"}', 'intermediate', 'english', '/ɪnˈkriːs/', true, NULL),
('pronunciation', 'PERmit (noun)', 'PERmit', '', '', 1, 'Permiso (sustantivo). El acento va en la primera sílaba.', '', '{"pronunciation","stress-shift"}', 'intermediate', 'english', '/ˈpɜːrmɪt/', true, NULL),
('pronunciation', 'perMIT (verb)', 'perMIT', '', '', 1, 'Permitir (verbo). El acento va en la segunda sílaba.', '', '{"pronunciation","stress-shift"}', 'intermediate', 'english', '/pərˈmɪt/', true, NULL),

-- Sonido "zh" /ʒ/ (no existe en español)
('pronunciation', 'Usually', 'Usually', '', '', 1, 'Usualmente. La "s" suena como "zh", vibrada y suave: "IU-zhuali".', '', '{"pronunciation","zh-sound"}', 'intermediate', 'english', '/ˈjuːʒuəli/', true, NULL),
('pronunciation', 'Pleasure', 'Pleasure', '', '', 1, 'Placer. La "s" suena como "zh": "PLE-zher".', '', '{"pronunciation","zh-sound"}', 'intermediate', 'english', '/ˈpleʒər/', true, NULL),
('pronunciation', 'Measure', 'Measure', '', '', 1, 'Medir / medida. La "s" suena como "zh": "ME-zher".', '', '{"pronunciation","zh-sound"}', 'intermediate', 'english', '/ˈmeʒər/', true, NULL),
('pronunciation', 'Decision', 'Decision', '', '', 1, 'Decisión. La "s" suena como "zh": "di-SI-zhon".', '', '{"pronunciation","zh-sound"}', 'intermediate', 'english', '/dɪˈsɪʒən/', true, NULL),

-- th sorda vs sonora (pares breath/breathe, bath/bathe)
('pronunciation', 'Breath', 'Breath', '', '', 1, 'Respiración (sustantivo). Vocal corta y "th" sorda: "breth".', '', '{"pronunciation","th-pairs"}', 'intermediate', 'english', '/breθ/', true, NULL),
('pronunciation', 'Breathe', 'Breathe', '', '', 1, 'Respirar (verbo). Vocal larga y "th" sonora: "briidh".', '', '{"pronunciation","th-pairs"}', 'intermediate', 'english', '/briːð/', true, NULL),
('pronunciation', 'Bath', 'Bath', '', '', 1, 'Baño (sustantivo). "th" sorda al final.', '', '{"pronunciation","th-pairs"}', 'intermediate', 'english', '/bæθ/', true, NULL),
('pronunciation', 'Bathe', 'Bathe', '', '', 1, 'Bañarse (verbo). Vocal larga y "th" sonora al final.', '', '{"pronunciation","th-pairs"}', 'intermediate', 'english', '/beɪð/', true, NULL),

-- Homófonos 2
('pronunciation', 'Piece', 'Piece', '', '', 1, 'Pedazo. Suena exactamente igual que "peace" (paz).', '', '{"pronunciation","homophones"}', 'intermediate', 'english', '/piːs/', true, NULL),
('pronunciation', 'Break', 'Break', '', '', 1, 'Romper / descanso. Suena exactamente igual que "brake" (freno).', '', '{"pronunciation","homophones"}', 'intermediate', 'english', '/breɪk/', true, NULL),
('pronunciation', 'Flour', 'Flour', '', '', 1, 'Harina. Suena exactamente igual que "flower" (flor).', '', '{"pronunciation","homophones"}', 'intermediate', 'english', '/ˈflaʊər/', true, NULL),
('pronunciation', 'Wear', 'Wear', '', '', 1, 'Vestir / usar ropa. Suena exactamente igual que "where" (dónde).', '', '{"pronunciation","homophones"}', 'intermediate', 'english', '/wer/', true, NULL),

-- Letras mudas difíciles
('pronunciation', 'Receipt', 'Receipt', '', '', 1, 'Recibo. La "p" es muda: "ri-SIIT".', '', '{"pronunciation","silent-letters"}', 'intermediate', 'english', '/rɪˈsiːt/', true, NULL),
('pronunciation', 'Doubt', 'Doubt', '', '', 1, 'Duda. La "b" es muda: "DAUT".', '', '{"pronunciation","silent-letters"}', 'intermediate', 'english', '/daʊt/', true, NULL),
('pronunciation', 'Castle', 'Castle', '', '', 1, 'Castillo. La "t" es muda: "CA-sol".', '', '{"pronunciation","silent-letters"}', 'intermediate', 'english', '/ˈkæsəl/', true, NULL),
('pronunciation', 'Muscle', 'Muscle', '', '', 1, 'Músculo. La "c" es muda: "MA-sol".', '', '{"pronunciation","silent-letters"}', 'intermediate', 'english', '/ˈmʌsəl/', true, NULL),
('pronunciation', 'Subtle', 'Subtle', '', '', 1, 'Sutil. La "b" es muda: "SA-tol".', '', '{"pronunciation","silent-letters"}', 'intermediate', 'english', '/ˈsʌtəl/', true, NULL),

-- Palabras largas 2
('pronunciation', 'Temperature', 'Temperature', '', '', 1, 'Temperatura. Se comprime a 3 sílabas: "TEM-pra-cher".', '', '{"pronunciation","multisyllable"}', 'intermediate', 'english', '/ˈtemprətʃər/', true, NULL),
('pronunciation', 'Literature', 'Literature', '', '', 1, 'Literatura. Se comprime: "LI-tra-cher", acento en la primera sílaba.', '', '{"pronunciation","multisyllable"}', 'intermediate', 'english', '/ˈlɪtrətʃər/', true, NULL),
('pronunciation', 'Development', 'Development', '', '', 1, 'Desarrollo. El acento va en la segunda sílaba: di-VE-lop-ment.', '', '{"pronunciation","multisyllable"}', 'intermediate', 'english', '/dɪˈveləpmənt/', true, NULL),
('pronunciation', 'Environment', 'Environment', '', '', 1, 'Medio ambiente. El acento va en la segunda sílaba: en-VAI-ron-ment.', '', '{"pronunciation","multisyllable"}', 'intermediate', 'english', '/ɪnˈvaɪrənmənt/', true, NULL);


-- ==========================================
-- Card Ninja — PRONUNCIATION / Advanced (Set 3)
-- Enfoque: palabras notoriamente difíciles, familias de acento,
-- habla conectada (didja/wouldja) y un trabalenguas
-- ==========================================

INSERT INTO learning_challenges
(type, question, option1, option2, option3, correct_option, explanation_es, question_es, tags, difficulty, language_learning, phonetic, requires_audio, audio_url)
VALUES

-- Palabras notoriamente difíciles
('pronunciation', 'Squirrel', 'Squirrel', '', '', 1, 'Ardilla. Una de las palabras más difíciles: "SKWIR-rol", la "rr" sin vibrar.', '', '{"pronunciation","hard-words"}', 'advanced', 'english', '/ˈskwɜːrəl/', true, NULL),
('pronunciation', 'Colonel', 'Colonel', '', '', 1, 'Coronel. Se pronuncia "KER-nel" — no se pronuncia como se escribe en absoluto.', '', '{"pronunciation","hard-words"}', 'advanced', 'english', '/ˈkɜːrnəl/', true, NULL),
('pronunciation', 'Choir', 'Choir', '', '', 1, 'Coro. Se pronuncia "KWAIER", el "ch" suena como "kw".', '', '{"pronunciation","hard-words"}', 'advanced', 'english', '/ˈkwaɪər/', true, NULL),
('pronunciation', 'Rural', 'Rural', '', '', 1, 'Rural. Dos "r" inglesas seguidas de "l" — difícil incluso para nativos.', '', '{"pronunciation","hard-words"}', 'advanced', 'english', '/ˈrʊrəl/', true, NULL),
('pronunciation', 'Sixth', 'Sixth', '', '', 1, 'Sexto. El grupo final "ksth" exige practicar la transición: "SIKS-z".', '', '{"pronunciation","hard-words"}', 'advanced', 'english', '/sɪksθ/', true, NULL),
('pronunciation', 'February', 'February', '', '', 1, 'Febrero. La primera "r" casi desaparece: "FEB-iu-eri".', '', '{"pronunciation","hard-words"}', 'advanced', 'english', '/ˈfebrueri/', true, NULL),
('pronunciation', 'Entrepreneur', 'Entrepreneur', '', '', 1, 'Emprendedor. Palabra francesa: "an-tre-pre-NER", acento al final.', '', '{"pronunciation","hard-words"}', 'advanced', 'english', '/ˌɑːntrəprəˈnɜːr/', true, NULL),
('pronunciation', 'Phenomenon', 'Phenomenon', '', '', 1, 'Fenómeno. El acento va en la segunda sílaba: fe-NO-me-non.', '', '{"pronunciation","hard-words"}', 'advanced', 'english', '/fəˈnɑːmɪnən/', true, NULL),
('pronunciation', 'Genre', 'Genre', '', '', 1, 'Género (de cine/música). Empieza con el sonido "zh" francés: "ZHAN-ra".', '', '{"pronunciation","hard-words"}', 'advanced', 'english', '/ˈʒɑːnrə/', true, NULL),
('pronunciation', 'Drawer', 'Drawer', '', '', 1, 'Cajón. Se pronuncia en UNA sílaba: "DROR", no "dra-wer".', '', '{"pronunciation","hard-words"}', 'advanced', 'english', '/drɔːr/', true, NULL),

-- Familias de acento (la sílaba fuerte se mueve al derivar la palabra)
('pronunciation', 'PHOtograph', 'PHOtograph', '', '', 1, 'Fotografía (la foto). El acento va en la PRIMERA sílaba: FO-to-graf.', '', '{"pronunciation","stress-shift"}', 'advanced', 'english', '/ˈfoʊtəɡræf/', true, NULL),
('pronunciation', 'phoTOgraphy', 'phoTOgraphy', '', '', 1, 'Fotografía (el arte). El acento SALTA a la segunda sílaba: fo-TO-gra-fi.', '', '{"pronunciation","stress-shift"}', 'advanced', 'english', '/fəˈtɑːɡrəfi/', true, NULL),

-- Habla conectada (reducciones de preguntas)
('pronunciation', 'Did you eat yet?', 'Did you eat yet?', '', '', 1, '¿Ya comiste? En habla rápida "did you" suena como "didja": "DI-dya iit yet".', '', '{"pronunciation","connected-speech"}', 'advanced', 'english', '/dɪdʒuː iːt jet/', true, NULL),
('pronunciation', 'Would you mind?', 'Would you mind?', '', '', 1, '¿Te importaría? "Would you" se funde en "wouldja": "WU-dya maind".', '', '{"pronunciation","connected-speech"}', 'advanced', 'english', '/wʊdʒuː maɪnd/', true, NULL),
('pronunciation', 'What do you mean?', 'What do you mean?', '', '', 1, '¿Qué quieres decir? En habla rápida suena como "whaddaya mean".', '', '{"pronunciation","connected-speech"}', 'advanced', 'english', '/ˌwʌt də juː miːn/', true, NULL),

-- Trabalenguas
('pronunciation', 'She sells seashells', 'She sells seashells', '', '', 1, 'Ella vende conchas de mar. Trabalenguas clásico para dominar "s" vs "sh".', '', '{"pronunciation","tongue-twisters"}', 'advanced', 'english', '/ʃiː selz ˈsiːʃelz/', true, NULL);


-- ============================================================
-- BARAJAR LA RESPUESTA CORRECTA (solo vocabulary)
-- Mueve la respuesta correcta a una posición aleatoria (1-3)
-- para que no siempre sea la opción 1. Las filas de pronunciation
-- NO se tocan: no son opción múltiple (option2/3 vacías) y el
-- backend espera correct_option=1 en ellas.
-- Idempotente: intercambia la posición actual de la correcta con
-- una aleatoria, así que puede correrse las veces que sea.
-- ============================================================

UPDATE learning_challenges c SET
  option1 = CASE
      WHEN r.pos = 1 THEN (CASE c.correct_option WHEN 1 THEN c.option1 WHEN 2 THEN c.option2 ELSE c.option3 END)
      WHEN c.correct_option = 1 THEN (CASE r.pos WHEN 2 THEN c.option2 ELSE c.option3 END)
      ELSE c.option1 END,
  option2 = CASE
      WHEN r.pos = 2 THEN (CASE c.correct_option WHEN 1 THEN c.option1 WHEN 2 THEN c.option2 ELSE c.option3 END)
      WHEN c.correct_option = 2 THEN (CASE r.pos WHEN 1 THEN c.option1 ELSE c.option3 END)
      ELSE c.option2 END,
  option3 = CASE
      WHEN r.pos = 3 THEN (CASE c.correct_option WHEN 1 THEN c.option1 WHEN 2 THEN c.option2 ELSE c.option3 END)
      WHEN c.correct_option = 3 THEN (CASE r.pos WHEN 1 THEN c.option1 ELSE c.option2 END)
      ELSE c.option3 END,
  correct_option = r.pos
FROM (
  SELECT id, (floor(random()*3)::int + 1) AS pos
  FROM learning_challenges
  WHERE type = 'vocabulary' AND option2 <> '' AND option3 <> ''
) r
WHERE c.id = r.id;
