-- Insert definitions
INSERT INTO npc_definitions (name, sprite, type, default_state) VALUES 
('Mission Master', 'sprite1', 'quest', 'idle'),
('Trainer', 'sprite2', 'quest', 'idle');


-- Insert mission
INSERT INTO missions (scene_key, title, description_en, objective_en, type) VALUES 
('lobby', 'The Ruby Cave', 'Find the ruby in the cave', 'Speak with the Mission Master', 'talk_to_npc');

-- Insert tasks
INSERT INTO mission_tasks (mission_id, type, "order", description_en, target_phrase_en) VALUES 
(1, 'talk_to_npc', 1, 'Greet the Mission Master', 'Hello mission master');
