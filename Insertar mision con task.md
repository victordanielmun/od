-- 1. Creamos la Misión principal
WITH nueva_mision AS (
    INSERT INTO missions (
        scene_key, 
        title, 
        description_en, 
        objective_en, 
        type, 
        status, 
        reward_gold, 
        reward_xp
    )
    VALUES (
        'Town Square', 
        'Mastering Social Basics', 
        'Aprende a navegar las complejidades sociales de la plaza, desde saludos informales hasta protocolos reales.', 
        'Completa los 3 niveles de interacción social.', 
        'talk_to_npc', 
        'active', 
        300, 
        500
    )
    RETURNING id
)
-- 2. Creamos las Tareas con target_npc_template_id en NULL
INSERT INTO mission_tasks (
    mission_id, 
    type, 
    "order", 
    description_en, 
    target_npc_template_id, 
    target_phrase_en -- Aquí podemos poner una pista de lo que se espera
)
SELECT id, 'talk_to_npc', 1, 'Saluda a los jóvenes usando 3 formas informales (Hi, Hey, What''s up, Yo).', NULL, 'informal_greetings' FROM nueva_mision
UNION ALL
SELECT id, 'talk_to_npc', 2, 'Saluda al Mayordomo con 3 frases formales (Good morning, Hello, Pleasure to meet you).', NULL, 'formal_greetings' FROM nueva_mision
UNION ALL
SELECT id, 'talk_to_npc', 3, 'Saluda al Guardián según la hora del día (Morning/Afternoon/Evening).', NULL, 'time_based_greeting' FROM nueva_mision;





-- Insertar los 3 NPCs en el nuevo mapa 'Town Square'
-- Nota: npc_definition_id debe ser el ID del sprite/base que quieras usar (ej. 1 para joven, 2 para mayordomo, 3 para guardia)
INSERT INTO npc_templates (
    scene_key, 
    npc_definition_id, 
    position_x, 
    position_y, 
    instructions,      -- Aquí va el "Instrucciones AI (Prompt)"
    success_message,   -- Aquí va el "Mensaje de Éxito"
    greeting           -- Aquí va el "Saludo Inicial"
) 
VALUES 
-- NPC 1: El Joven
('Town Square', 1, 400, 500, 
 'You are a casual teenager. The player must use at least 3 informal greetings (Hi, Hey, What''s up, Yo). Rules: 1. If they use Spanish, correct them kindly. 2. Track progress with {completed_phrases}.', 
 'You''re one of us now!', 
 'Yo! What''s the word?'),

-- NPC 2: El Mayordomo
('Town Square', 2, 800, 200, 
 'You are a strict Royal Butler. The player must use 3 formal greetings (Good morning, Hello). Reject slang. Manners make the man.', 
 'Most distinguished. Proceed.', 
 'Good day. Who goes there?'),

-- NPC 3: El Guardián
('Town Square', 3, 1200, 600, 
 'You are the Gatekeeper. The player must use the correct time-based greeting according to the world clock. Point at the sun if they fail.', 
 'Accurate as a clock! Pass.', 
 'Halt! State your business.');
