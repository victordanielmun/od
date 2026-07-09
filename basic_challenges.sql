-- Archivo de Revisión de Retos (Nivel Básico)
-- Puedes correr este código en tu base de datos PostgreSQL, o importarlo.

INSERT INTO learning_challenges 
(type, question, question_es, option_1, option_2, option_3, correct_option, explanation_es, tags, difficulty, language_learning)
VALUES 

-- ==========================================
-- NIVEL 1: Vocabulario básico (Imagen → Palabra)
-- Categorías: Animales, Comida, Objetos, Colores
-- ==========================================
('vocabulary', 'What is this? 🐶', '¿Qué es esto?', 'Cat', 'Dog', 'Bird', 2, 'Dog significa perro en inglés.', '{"vocabulary","animals","beginner"}', 'beginner', 'english'),
('vocabulary', 'What is this? 🍎', '¿Qué es esto?', 'Apple', 'Banana', 'Orange', 1, 'Apple significa manzana en inglés.', '{"vocabulary","food","beginner"}', 'beginner', 'english'),
('vocabulary', 'What is this? 🚗', '¿Qué es esto?', 'Bus', 'Bike', 'Car', 3, 'Car significa auto o carro.', '{"vocabulary","objects","beginner"}', 'beginner', 'english'),
('vocabulary', 'What color is this? 🔴', '¿Qué color es este?', 'Red', 'Blue', 'Green', 1, 'Red es el color rojo.', '{"vocabulary","colors","beginner"}', 'beginner', 'english'),
('vocabulary', 'What color is this? 🔵', '¿Qué color es este?', 'Black', 'Blue', 'Yellow', 2, 'Blue es el color azul.', '{"vocabulary","colors","beginner"}', 'beginner', 'english'),
('vocabulary', 'What color is this? 🟢', '¿Qué color es este?', 'Grey', 'Brown', 'Green', 3, 'Green es el color verde.', '{"vocabulary","colors","beginner"}', 'beginner', 'english'),
('vocabulary', 'What is this? 🪑', '¿Qué es esto?', 'Table', 'Chair', 'Bed', 2, 'Chair significa silla.', '{"vocabulary","objects","beginner"}', 'beginner', 'english'),
('vocabulary', 'What is this? 📱', '¿Qué es esto?', 'Phone', 'Bone', 'Stone', 1, 'Phone significa teléfono o celular.', '{"vocabulary","objects","beginner"}', 'beginner', 'english'),


-- ==========================================
-- NIVEL 2: Traducción Rápida (con distractores visuales/auditivos)
-- Categorías: Objetos y Acciones
-- ==========================================
('vocabulary', '**"Casa"** en inglés es:', 'Traduce la palabra', 'House', 'Horse', 'Mouse', 1, 'House significa casa. Horse es caballo y Mouse es ratón.', '{"vocabulary","objects","beginner"}', 'beginner', 'english'),
('vocabulary', '**"Correr"** en inglés es:', 'Traduce la palabra', 'Walk', 'Run', 'Rain', 2, 'Run significa correr. Walk es caminar.', '{"vocabulary","actions","beginner"}', 'beginner', 'english'),
('vocabulary', '**"Dormir"** en inglés es:', 'Traduce la palabra', 'Slip', 'Sleep', 'Sweep', 2, 'Sleep significa dormir. Slip es resbalar.', '{"vocabulary","actions","beginner"}', 'beginner', 'english'),
('vocabulary', '**"Libro"** en inglés es:', 'Traduce la palabra', 'Look', 'Cook', 'Book', 3, 'Book significa libro.', '{"vocabulary","objects","beginner"}', 'beginner', 'english'),
('vocabulary', '**"Comer"** en inglés es:', 'Traduce la palabra', 'Eat', 'It', 'Heat', 1, 'Eat significa comer. "It" es un pronombre y "Heat" es calor.', '{"vocabulary","actions","beginner"}', 'beginner', 'english'),
('vocabulary', '**"Saltar"** en inglés es:', 'Traduce la palabra', 'Pump', 'Jump', 'Dump', 2, 'Jump significa saltar.', '{"vocabulary","actions","beginner"}', 'beginner', 'english'),
('vocabulary', '**"Amarillo"** en inglés es:', 'Traduce la palabra', 'Jello', 'Yellow', 'Hello', 2, 'Yellow es amarillo.', '{"vocabulary","colors","beginner"}', 'beginner', 'english'),

-- ==========================================
-- NIVEL 3: Completar la oración (Fill in the blank)
-- Categorías: Saludos, Despedidas, Expresiones Comunes
-- ==========================================
('grammar', 'Good _____! 🌅', 'Tema: Saludos (Mañana)', 'morning', 'night', 'evening', 1, '"Good morning" significa buenos días.', '{"grammar","greetings","beginner"}', 'beginner', 'english'),
('grammar', 'Good _____! 🌃', 'Tema: Saludos (Noche)', 'morning', 'night', 'afternoon', 2, '"Good night" significa buenas noches (despedida).', '{"grammar","greetings","beginner"}', 'beginner', 'english'),
('grammar', 'See you _____! 👋', 'Tema: Despedida', 'late', 'later', 'letter', 2, '"See you later" significa nos vemos luego.', '{"grammar","farewells","beginner"}', 'beginner', 'english'),
('grammar', 'How are _____?', 'Tema: Saludos', 'you', 'your', 'yours', 1, '"How are you?" significa ¿cómo estás?', '{"grammar","greetings","beginner"}', 'beginner', 'english'),
('grammar', 'Nice to _____ you! 🤝', 'Tema: Presentaciones', 'meat', 'meet', 'met', 2, '"Nice to meet you" significa encantado de conocerte.', '{"grammar","greetings","beginner"}', 'beginner', 'english'),
('grammar', '_____ afternoon! ☀️', 'Tema: Saludos (Tarde)', 'God', 'Good', 'Gold', 2, '"Good afternoon" significa buenas tardes.', '{"grammar","greetings","beginner"}', 'beginner', 'english'),
('grammar', 'Have a _____ day! ✨', 'Tema: Despedida', 'good', 'god', 'goat', 1, '"Have a good day" significa que tengas un buen día.', '{"grammar","farewells","beginner"}', 'beginner', 'english');
