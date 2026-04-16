-- Insert definitions
INSERT INTO npc_definitions (name, sprite, type, default_state) VALUES 
('Mission Master', 'sprite1', 'quest', 'idle'),
('Trainer', 'sprite2', 'quest', 'idle');

-- Insert templates (assuming lobby is the scene)
INSERT INTO npc_templates (scene_key, npc_definition_id, position_x, position_y) VALUES 
('lobby', 1, 1000, 800),
('lobby', 2, 1200, 900);

-- Insert mission
INSERT INTO missions (scene_key, title, description_en, objective_en, type) VALUES 
('lobby', 'The Ruby Cave', 'Find the ruby in the cave', 'Speak with the Mission Master', 'talk_to_npc');

-- Insert tasks
INSERT INTO mission_tasks (mission_id, type, "order", description_en, target_phrase_en) VALUES 
(1, 'talk_to_npc', 1, 'Greet the Mission Master', 'Hello mission master');
