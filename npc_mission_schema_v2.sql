-- Odyssey NPC AI System: Schema MQ v2

-- 1. ENUMs
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'npc_state') THEN
        CREATE TYPE npc_state AS ENUM ('idle', 'talking', 'happy', 'angry', 'sad', 'surprised', 'thinking', 'grateful', 'waiting');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'npc_type') THEN
        CREATE TYPE npc_type AS ENUM ('quest', 'shop', 'ambient');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'npc_role') THEN
        CREATE TYPE npc_role AS ENUM ('task_npc', 'informational_npc');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_type') THEN
        CREATE TYPE mission_type AS ENUM ('find_item', 'defeat_enemy', 'talk_to_npc', 'deliver_message', 'pronunciation_challenge');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_type') THEN
        CREATE TYPE task_type AS ENUM ('bring_item', 'defeat_enemy', 'talk_to_npc', 'deliver_message', 'pronunciation_threshold');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'progress_status') THEN
        CREATE TYPE progress_status AS ENUM ('not_started', 'in_progress', 'completed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pronunciation_eval') THEN
        CREATE TYPE pronunciation_eval AS ENUM ('excellent', 'good', 'needs_work', 'bad', 'none');
    END IF;
END $$;

-- 2. Tables

-- NPC Definitions: Base reusable NPCs
CREATE TABLE IF NOT EXISTS npc_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sprite VARCHAR(100) NOT NULL,
    type npc_type NOT NULL DEFAULT 'ambient',
    default_state npc_state NOT NULL DEFAULT 'idle',
    interaction_mode VARCHAR(20) DEFAULT 'hybrid',
    voice_type VARCHAR(20) DEFAULT 'male',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- NPC Templates: Positioning NPCs in maps
CREATE TABLE IF NOT EXISTS npc_templates (
    id SERIAL PRIMARY KEY,
    scene_key VARCHAR(100) NOT NULL, -- FK logic handles this via application logic or trigger
    npc_definition_id INTEGER REFERENCES npc_definitions(id) ON DELETE CASCADE,
    position_x INTEGER NOT NULL,
    position_y INTEGER NOT NULL,
    facing_direction VARCHAR(10) DEFAULT 'south',
    interaction_radius INTEGER DEFAULT 64,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Missions
CREATE TABLE IF NOT EXISTS missions (
    id SERIAL PRIMARY KEY,
    scene_key VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description_en TEXT,
    objective_en TEXT,
    type mission_type NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Mission Tasks
CREATE TABLE IF NOT EXISTS mission_tasks (
    id SERIAL PRIMARY KEY,
    mission_id INTEGER REFERENCES missions(id) ON DELETE CASCADE,
    type task_type NOT NULL,
    "order" INTEGER NOT NULL,
    description_en TEXT,
    target_npc_template_id INTEGER REFERENCES npc_templates(id),
    required_item VARCHAR(100),
    required_enemy VARCHAR(100),
    pronunciation_min_score INTEGER DEFAULT 80,
    target_phrase_en TEXT,
    message_to_deliver TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- NPC Mission Roles: Behaivor of NPCs during a specific mission
CREATE TABLE IF NOT EXISTS npc_mission_roles (
    id SERIAL PRIMARY KEY,
    npc_template_id INTEGER REFERENCES npc_templates(id) ON DELETE CASCADE,
    mission_id INTEGER REFERENCES missions(id) ON DELETE CASCADE,
    role npc_role NOT NULL,
    task_description TEXT, -- Specific for task_npc
    knowledge_summary TEXT, -- What this NPC knows about the mission
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- NPC Room Instances: Dynamic shared state in an active room
CREATE TABLE IF NOT EXISTS npc_room_instances (
    id SERIAL PRIMARY KEY,
    room_id UUID NOT NULL, -- UUID because Rooms table uses UUID
    npc_template_id INTEGER REFERENCES npc_templates(id) ON DELETE CASCADE,
    current_state npc_state NOT NULL DEFAULT 'idle',
    task_completed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    player_id UUID NOT NULL, -- UUID because users table uses UUID
    npc_instance_id INTEGER REFERENCES npc_room_instances(id) ON DELETE CASCADE,
    mission_id INTEGER REFERENCES missions(id),
    session_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Conversation Messages
CREATE TABLE IF NOT EXISTS conversation_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    player_input TEXT,
    pronunciation_score FLOAT,
    npc_response TEXT,
    npc_state npc_state NOT NULL DEFAULT 'talking',
    pronunciation_eval pronunciation_eval DEFAULT 'none',
    pronunciation_message TEXT,
    feedback_suggestion TEXT,
    task_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Player Mission Progress
CREATE TABLE IF NOT EXISTS player_mission_progress (
    id SERIAL PRIMARY KEY,
    player_id UUID NOT NULL,
    mission_id INTEGER REFERENCES missions(id) ON DELETE CASCADE,
    room_id UUID,
    status progress_status DEFAULT 'not_started',
    tasks_completed JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Player Learning Stats
CREATE TABLE IF NOT EXISTS player_learning_stats (
    id SERIAL PRIMARY KEY,
    player_id UUID NOT NULL UNIQUE,
    avg_pronunciation_score FLOAT DEFAULT 0,
    total_conversations INTEGER DEFAULT 0,
    weak_phonemes JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes for performance
CREATE INDEX idx_npc_templates_scene ON npc_templates(scene_key);
CREATE INDEX idx_npc_room_instances_room ON npc_room_instances(room_id);
CREATE INDEX idx_conversations_player ON conversations(player_id);
CREATE INDEX idx_player_mission_progress_player ON player_mission_progress(player_id, mission_id);
