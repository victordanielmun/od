DROP TABLE IF EXISTS "public"."achievements";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS achievements_id_seq;

-- Table Definition
CREATE TABLE "public"."achievements" (
    "id" int4 NOT NULL DEFAULT nextval('achievements_id_seq'::regclass),
    "key" varchar(50) NOT NULL,
    "name" varchar(100) NOT NULL,
    "description" varchar(300) NOT NULL,
    "icon" varchar(10) NOT NULL,
    "category" varchar(50),
    "threshold" int4,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX achievements_key_key ON public.achievements USING btree (key);
CREATE INDEX ix_achievements_id ON public.achievements USING btree (id);

DROP TABLE IF EXISTS "public"."conversation_messages";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS conversation_messages_id_seq;
DROP TYPE IF EXISTS "public"."npc_state";
CREATE TYPE "public"."npc_state" AS ENUM ('idle', 'talking', 'happy', 'angry', 'sad', 'surprised', 'thinking', 'grateful', 'waiting');
DROP TYPE IF EXISTS "public"."pronunciation_eval";
CREATE TYPE "public"."pronunciation_eval" AS ENUM ('excellent', 'good', 'needs_work', 'bad', 'none');

-- Table Definition
CREATE TABLE "public"."conversation_messages" (
    "id" int4 NOT NULL DEFAULT nextval('conversation_messages_id_seq'::regclass),
    "conversation_id" int8,
    "player_input" text,
    "pronunciation_score" numeric,
    "npc_response" text,
    "npc_state" "public"."npc_state" NOT NULL DEFAULT 'talking'::npc_state,
    "pronunciation_eval" "public"."pronunciation_eval" DEFAULT 'none'::pronunciation_eval,
    "pronunciation_message" text,
    "feedback_suggestion" text,
    "task_completed" bool DEFAULT false,
    "created_at" timestamptz,
    "pronunciation_msg" text,
    "npc_response_es" text,
    CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."conversations";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS conversations_id_seq;

-- Table Definition
CREATE TABLE "public"."conversations" (
    "id" int4 NOT NULL DEFAULT nextval('conversations_id_seq'::regclass),
    "player_id" uuid NOT NULL,
    "npc_instance_id" int8,
    "mission_id" int8,
    "session_id" varchar(100),
    "created_at" timestamptz,
    CONSTRAINT "conversations_npc_instance_id_fkey" FOREIGN KEY ("npc_instance_id") REFERENCES "public"."npc_room_instances"("id") ON DELETE CASCADE,
    CONSTRAINT "conversations_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id"),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_conversations_player ON public.conversations USING btree (player_id);

DROP TABLE IF EXISTS "public"."enemies";
-- Table Definition
CREATE TABLE "public"."enemies" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "name" text,
    "level" int8,
    "hp_max" int8,
    "mp_max" int8,
    "attack" int8,
    "defense" int8,
    "speed" int8,
    "exp_reward" int8,
    "gold_reward" int8,
    "ai_behavior" text,
    "skill_ids" jsonb,
    "sprite_key" text,
    "created_at" timestamptz,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."friend_requests";
-- Table Definition
CREATE TABLE "public"."friend_requests" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "requester_id" uuid NOT NULL,
    "addressee_id" uuid NOT NULL,
    "status" varchar(16) NOT NULL DEFAULT 'pending'::character varying,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "deleted_at" timestamptz,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_friend_requests_deleted_at ON public.friend_requests USING btree (deleted_at);
CREATE INDEX idx_friend_requests_status ON public.friend_requests USING btree (status);
CREATE UNIQUE INDEX idx_friend_request_pair ON public.friend_requests USING btree (requester_id, addressee_id);

DROP TABLE IF EXISTS "public"."friendships";
-- Table Definition
CREATE TABLE "public"."friendships" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user1_id" uuid NOT NULL,
    "user2_id" uuid NOT NULL,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "deleted_at" timestamptz,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_friendships_deleted_at ON public.friendships USING btree (deleted_at);
CREATE UNIQUE INDEX idx_friendship_pair ON public.friendships USING btree (user1_id, user2_id);

DROP TABLE IF EXISTS "public"."inventories";
-- Table Definition
CREATE TABLE "public"."inventories" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "player_id" text,
    "item_id" uuid,
    "quantity" int8,
    "slot_index" int8,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    CONSTRAINT "fk_inventories_item" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id"),
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."items";
-- Table Definition
CREATE TABLE "public"."items" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "name" text,
    "description" text,
    "item_type" text,
    "effect_type" text,
    "effect_value" int8,
    "price" int8,
    "max_stack" int8,
    "icon_key" text,
    "created_at" timestamptz,
    "attack_bonus" int8,
    "defense_bonus" int8,
    "required_level" int8,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."learning_challenges";
-- Table Definition
CREATE TABLE "public"."learning_challenges" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "type" varchar(30) NOT NULL,
    "question" text NOT NULL,
    "option1" text NOT NULL,
    "option2" text NOT NULL,
    "option3" text NOT NULL,
    "correct_option" int8 NOT NULL,
    "explanation_es" text,
    "tags" _text NOT NULL DEFAULT '{}'::text[],
    "difficulty" varchar(20) NOT NULL DEFAULT 'beginner'::character varying,
    "language_learning" varchar(20) NOT NULL DEFAULT 'english'::character varying,
    "phonetic" varchar(100),
    "requires_audio" bool NOT NULL DEFAULT false,
    "audio_url" varchar(500),
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "deleted_at" timestamptz,
    "question_es" text,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_learning_challenges_deleted_at ON public.learning_challenges USING btree (deleted_at);

DROP TABLE IF EXISTS "public"."map_configs";
-- Table Definition
CREATE TABLE "public"."map_configs" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "scene_key" text NOT NULL,
    "walls_json" text NOT NULL,
    "updated_by" uuid,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "map_data" text,
    "is_public" bool DEFAULT false,
    "max_users" int8 DEFAULT 50,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX idx_map_configs_scene_key ON public.map_configs USING btree (scene_key);

DROP TABLE IF EXISTS "public"."map_pickups";
-- Table Definition
CREATE TABLE "public"."map_pickups" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "scene_key" varchar(100) NOT NULL,
    "item_id" uuid NOT NULL,
    "x" numeric,
    "y" numeric,
    "quantity" int8 DEFAULT 1,
    "is_picked_up" bool DEFAULT false,
    "created_at" timestamptz,
    CONSTRAINT "fk_map_pickups_item" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id"),
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."mission_tasks";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS mission_tasks_id_seq;
DROP TYPE IF EXISTS "public"."task_type";
CREATE TYPE "public"."task_type" AS ENUM ('bring_item', 'defeat_enemy', 'talk_to_npc', 'deliver_message', 'pronunciation_threshold', 'find_item', 'collect_items', 'kill_all', 'kill_boss');

-- Table Definition
CREATE TABLE "public"."mission_tasks" (
    "id" int4 NOT NULL DEFAULT nextval('mission_tasks_id_seq'::regclass),
    "mission_id" int8,
    "type" "public"."task_type" NOT NULL,
    "order" int8,
    "description_en" text,
    "target_npc_template_id" int8,
    "required_item" varchar(100),
    "required_enemy" varchar(100),
    "pronunciation_min_score" int4 DEFAULT 80,
    "target_phrase_en" text,
    "message_to_deliver" text,
    "created_at" timestamptz,
    "required_kills" int8 DEFAULT 0,
    CONSTRAINT "mission_tasks_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE,
    CONSTRAINT "mission_tasks_target_npc_template_id_fkey" FOREIGN KEY ("target_npc_template_id") REFERENCES "public"."npc_templates"("id"),
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."missions";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS missions_id_seq;
DROP TYPE IF EXISTS "public"."mission_type";
CREATE TYPE "public"."mission_type" AS ENUM ('find_item', 'defeat_enemy', 'talk_to_npc', 'deliver_message', 'pronunciation_challenge', 'find_items', 'kill_all', 'kill_boss');

-- Table Definition
CREATE TABLE "public"."missions" (
    "id" int4 NOT NULL DEFAULT nextval('missions_id_seq'::regclass),
    "scene_key" varchar(100) NOT NULL,
    "title" varchar(200) NOT NULL,
    "description_en" text,
    "objective_en" text,
    "type" "public"."mission_type" NOT NULL,
    "status" varchar(20) DEFAULT 'active'::character varying,
    "created_at" timestamptz,
    "reward_item_id" uuid,
    "reward_quantity" int8 DEFAULT 0,
    "reward_gold" int8 DEFAULT 0,
    "mode" varchar(20) DEFAULT 'individual'::character varying,
    "objective_target" varchar(200),
    "reward_xp" int4 DEFAULT 0,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."npc_definitions";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS npc_definitions_id_seq;
DROP TYPE IF EXISTS "public"."npc_type";
CREATE TYPE "public"."npc_type" AS ENUM ('quest', 'shop', 'ambient', 'quest_giver', 'merchant', 'guide', 'other', 'quest_master');
DROP TYPE IF EXISTS "public"."npc_state";
CREATE TYPE "public"."npc_state" AS ENUM ('idle', 'talking', 'happy', 'angry', 'sad', 'surprised', 'thinking', 'grateful', 'waiting');

-- Table Definition
CREATE TABLE "public"."npc_definitions" (
    "id" int4 NOT NULL DEFAULT nextval('npc_definitions_id_seq'::regclass),
    "name" varchar(100) NOT NULL,
    "sprite" varchar(100) NOT NULL,
    "type" "public"."npc_type" DEFAULT 'other'::npc_type,
    "default_state" "public"."npc_state" NOT NULL DEFAULT 'idle'::npc_state,
    "created_at" timestamptz,
    "interaction_mode" varchar(20) DEFAULT 'hybrid'::character varying,
    "voice_type" varchar(20) DEFAULT 'male'::character varying,
    "shop_id" int8,
    "gift_item_id" uuid,
    "gift_quantity" int8 DEFAULT 0,
    "greeting" text,
    CONSTRAINT "fk_npc_definitions_shop" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id"),
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."npc_dialogue_caches";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS npc_dialogue_caches_id_seq;

-- Table Definition
CREATE TABLE "public"."npc_dialogue_caches" (
    "id" int8 NOT NULL DEFAULT nextval('npc_dialogue_caches_id_seq'::regclass),
    "npc_template_id" int8 NOT NULL,
    "mission_id" int8,
    "task_id" int8,
    "normalized_input" text NOT NULL,
    "condition_met" bool NOT NULL,
    "response_json" text NOT NULL,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_npc_dialogue_caches_condition_met ON public.npc_dialogue_caches USING btree (condition_met);
CREATE INDEX idx_npc_dialogue_caches_normalized_input ON public.npc_dialogue_caches USING btree (normalized_input);
CREATE INDEX idx_npc_dialogue_caches_task_id ON public.npc_dialogue_caches USING btree (task_id);
CREATE INDEX idx_npc_dialogue_caches_mission_id ON public.npc_dialogue_caches USING btree (mission_id);
CREATE INDEX idx_npc_dialogue_caches_npc_template_id ON public.npc_dialogue_caches USING btree (npc_template_id);

DROP TABLE IF EXISTS "public"."npc_mission_roles";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS npc_mission_roles_id_seq;
DROP TYPE IF EXISTS "public"."npc_role";
CREATE TYPE "public"."npc_role" AS ENUM ('task_npc', 'informational_npc');

-- Table Definition
CREATE TABLE "public"."npc_mission_roles" (
    "id" int4 NOT NULL DEFAULT nextval('npc_mission_roles_id_seq'::regclass),
    "npc_template_id" int8,
    "mission_id" int8,
    "role" "public"."npc_role" NOT NULL,
    "task_description" text,
    "knowledge_summary" text,
    "created_at" timestamptz,
    CONSTRAINT "npc_mission_roles_npc_template_id_fkey" FOREIGN KEY ("npc_template_id") REFERENCES "public"."npc_templates"("id") ON DELETE CASCADE,
    CONSTRAINT "npc_mission_roles_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."npc_room_instances";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS npc_room_instances_id_seq;
DROP TYPE IF EXISTS "public"."npc_state";
CREATE TYPE "public"."npc_state" AS ENUM ('idle', 'talking', 'happy', 'angry', 'sad', 'surprised', 'thinking', 'grateful', 'waiting');

-- Table Definition
CREATE TABLE "public"."npc_room_instances" (
    "id" int4 NOT NULL DEFAULT nextval('npc_room_instances_id_seq'::regclass),
    "room_id" uuid NOT NULL,
    "npc_template_id" int8,
    "current_state" "public"."npc_state" NOT NULL DEFAULT 'idle'::npc_state,
    "task_completed" bool DEFAULT false,
    "updated_at" timestamptz,
    CONSTRAINT "npc_room_instances_npc_template_id_fkey" FOREIGN KEY ("npc_template_id") REFERENCES "public"."npc_templates"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_npc_room_instances_npc_template" FOREIGN KEY ("npc_template_id") REFERENCES "public"."npc_templates"("id"),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_npc_room_instances_room ON public.npc_room_instances USING btree (room_id);

DROP TABLE IF EXISTS "public"."npc_templates";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS npc_templates_id_seq;

-- Table Definition
CREATE TABLE "public"."npc_templates" (
    "id" int4 NOT NULL DEFAULT nextval('npc_templates_id_seq'::regclass),
    "scene_key" varchar(100) NOT NULL,
    "npc_definition_id" int8,
    "position_x" int8,
    "position_y" int8,
    "facing_direction" varchar(10) DEFAULT 'south'::character varying,
    "interaction_radius" int4 DEFAULT 64,
    "created_at" timestamptz,
    "movement_type" varchar(20) DEFAULT 'static'::character varying,
    "movement_range" int8 DEFAULT 0,
    "movement_speed" int8 DEFAULT 50,
    "instructions" text,
    "success_message" text,
    "greeting" text,
    CONSTRAINT "npc_templates_npc_definition_id_fkey" FOREIGN KEY ("npc_definition_id") REFERENCES "public"."npc_definitions"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_npc_templates_npc_definition" FOREIGN KEY ("npc_definition_id") REFERENCES "public"."npc_definitions"("id"),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_npc_templates_scene ON public.npc_templates USING btree (scene_key);

DROP TABLE IF EXISTS "public"."player_learning_stats";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS player_learning_stats_id_seq;

-- Table Definition
CREATE TABLE "public"."player_learning_stats" (
    "id" int4 NOT NULL DEFAULT nextval('player_learning_stats_id_seq'::regclass),
    "player_id" uuid NOT NULL,
    "avg_pronunciation_score" float8 DEFAULT 0,
    "total_conversations" int4 DEFAULT 0,
    "weak_phonemes" jsonb,
    "updated_at" timestamptz,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX player_learning_stats_player_id_key ON public.player_learning_stats USING btree (player_id);

DROP TABLE IF EXISTS "public"."player_mission_progress";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS player_mission_progress_id_seq;
DROP TYPE IF EXISTS "public"."progress_status";
CREATE TYPE "public"."progress_status" AS ENUM ('not_started', 'in_progress', 'completed');

-- Table Definition
CREATE TABLE "public"."player_mission_progress" (
    "id" int4 NOT NULL DEFAULT nextval('player_mission_progress_id_seq'::regclass),
    "player_id" uuid NOT NULL,
    "mission_id" int4,
    "room_id" uuid,
    "status" "public"."progress_status" DEFAULT 'not_started'::progress_status,
    "tasks_completed" jsonb DEFAULT '{}'::jsonb,
    "started_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "completed_at" timestamptz,
    CONSTRAINT "player_mission_progress_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_player_mission_progress_player ON public.player_mission_progress USING btree (player_id, mission_id);

DROP TABLE IF EXISTS "public"."player_mission_progresses";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS player_mission_progresses_id_seq;
DROP TYPE IF EXISTS "public"."progress_status";
CREATE TYPE "public"."progress_status" AS ENUM ('not_started', 'in_progress', 'completed');

-- Table Definition
CREATE TABLE "public"."player_mission_progresses" (
    "id" int8 NOT NULL DEFAULT nextval('player_mission_progresses_id_seq'::regclass),
    "player_id" uuid NOT NULL,
    "mission_id" int8,
    "room_id" uuid,
    "status" "public"."progress_status" DEFAULT 'not_started'::progress_status,
    "tasks_completed" jsonb,
    "started_at" timestamptz,
    "completed_at" timestamptz,
    "kill_counts" jsonb,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."player_npc_gifts";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS player_npc_gifts_id_seq;

-- Table Definition
CREATE TABLE "public"."player_npc_gifts" (
    "id" int8 NOT NULL DEFAULT nextval('player_npc_gifts_id_seq'::regclass),
    "player_id" uuid NOT NULL,
    "npc_definition_id" int8 NOT NULL,
    "received_at" timestamptz,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_player_npc_gift ON public.player_npc_gifts USING btree (player_id, npc_definition_id);

DROP TABLE IF EXISTS "public"."player_skills";
-- Table Definition
CREATE TABLE "public"."player_skills" (
    "player_id" text NOT NULL,
    "skill_id" text NOT NULL,
    "unlocked_at" timestamptz,
    PRIMARY KEY ("player_id","skill_id")
);

DROP TABLE IF EXISTS "public"."player_stats";
-- Table Definition
CREATE TABLE "public"."player_stats" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "class" text DEFAULT 'warrior'::text,
    "level" int8 DEFAULT 1,
    "experience" int8 DEFAULT 0,
    "hp_current" int8,
    "hp_max" int8 DEFAULT 100,
    "mp_current" int8,
    "mp_max" int8 DEFAULT 50,
    "attack" int8 DEFAULT 10,
    "defense" int8 DEFAULT 5,
    "speed" int8 DEFAULT 10,
    "skill_points" int8 DEFAULT 0,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "gold" int8 DEFAULT 100,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX uni_player_stats_user_id ON public.player_stats USING btree (user_id);

DROP TABLE IF EXISTS "public"."recordings";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS recordings_id_seq;

-- Table Definition
CREATE TABLE "public"."recordings" (
    "id" int4 NOT NULL DEFAULT nextval('recordings_id_seq'::regclass),
    "user_id" uuid,
    "word_id" int4 NOT NULL,
    "audio_path" varchar(500),
    "transcription" text,
    "confidence_score" float8,
    "pronunciation_score" float8,
    "feedback" json,
    "created_at" timestamp,
    CONSTRAINT "recordings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"),
    CONSTRAINT "recordings_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id"),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX ix_recordings_id ON public.recordings USING btree (id);

DROP TABLE IF EXISTS "public"."rooms";
-- Table Definition
CREATE TABLE "public"."rooms" (
    "id" uuid NOT NULL,
    "name" varchar(50) NOT NULL,
    "max_users" int8 DEFAULT 50,
    "map_data" jsonb,
    "is_public" bool DEFAULT true,
    "created_by" uuid NOT NULL,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "type" varchar(20) DEFAULT 'public'::character varying,
    "scene_key" varchar(50) NOT NULL,
    "parent_id" uuid,
    "invite_code" varchar(10),
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX idx_rooms_name ON public.rooms USING btree (name);
CREATE INDEX idx_rooms_invite_code ON public.rooms USING btree (invite_code);

DROP TABLE IF EXISTS "public"."shop_items";
-- Table Definition
CREATE TABLE "public"."shop_items" (
    "shop_id" int8 NOT NULL,
    "item_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    CONSTRAINT "fk_shop_items_shop" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id"),
    CONSTRAINT "fk_shop_items_item" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id"),
    PRIMARY KEY ("shop_id","item_id")
);

DROP TABLE IF EXISTS "public"."shops";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS shops_id_seq;

-- Table Definition
CREATE TABLE "public"."shops" (
    "id" int8 NOT NULL DEFAULT nextval('shops_id_seq'::regclass),
    "name" varchar(100) NOT NULL,
    "description" text,
    "created_at" timestamptz,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."skills";
-- Table Definition
CREATE TABLE "public"."skills" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "name" text,
    "description" text,
    "skill_type" text,
    "mp_cost" int8,
    "power" int8,
    "target_type" text,
    "required_level" int8,
    "animation_key" text,
    "created_at" timestamptz,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."user_achievements";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS user_achievements_id_seq;

-- Table Definition
CREATE TABLE "public"."user_achievements" (
    "id" int4 NOT NULL DEFAULT nextval('user_achievements_id_seq'::regclass),
    "user_id" uuid NOT NULL,
    "achievement_id" int4 NOT NULL,
    "unlocked_at" timestamp,
    CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"),
    CONSTRAINT "user_achievements_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id"),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX ix_user_achievements_id ON public.user_achievements USING btree (id);

DROP TABLE IF EXISTS "public"."user_challenge_attempts";
-- Table Definition
CREATE TABLE "public"."user_challenge_attempts" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "challenge_id" uuid NOT NULL,
    "selected_option" int8 NOT NULL,
    "is_correct" bool NOT NULL DEFAULT false,
    "feedback_ai" text,
    "answered_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "fk_user_challenge_attempts_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"),
    CONSTRAINT "fk_learning_challenges_attempts" FOREIGN KEY ("challenge_id") REFERENCES "public"."learning_challenges"("id"),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_user_challenge_attempts_user_id ON public.user_challenge_attempts USING btree (user_id);
CREATE INDEX idx_user_challenge_attempts_challenge_id ON public.user_challenge_attempts USING btree (challenge_id);

DROP TABLE IF EXISTS "public"."user_learning_profiles";
-- Table Definition
CREATE TABLE "public"."user_learning_profiles" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "english_level" varchar(20) NOT NULL DEFAULT 'beginner'::character varying,
    "preferred_tags" _text NOT NULL DEFAULT '{}'::text[],
    "weekly_score" int8 NOT NULL DEFAULT 0,
    "weekly_correct" int8 NOT NULL DEFAULT 0,
    "weekly_attempts" int8 NOT NULL DEFAULT 0,
    "week_start" date,
    "current_level_xp" int8 NOT NULL DEFAULT 0,
    "total_xp" int8 NOT NULL DEFAULT 0,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "deleted_at" timestamptz,
    CONSTRAINT "fk_user_learning_profiles_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX idx_user_learning_profiles_deleted_at ON public.user_learning_profiles USING btree (deleted_at);
CREATE UNIQUE INDEX idx_user_learning_profiles_user_id ON public.user_learning_profiles USING btree (user_id);

DROP TABLE IF EXISTS "public"."user_progress";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS user_progress_id_seq;

-- Table Definition
CREATE TABLE "public"."user_progress" (
    "id" int4 NOT NULL DEFAULT nextval('user_progress_id_seq'::regclass),
    "user_id" uuid NOT NULL,
    "word_id" int4 NOT NULL,
    "attempts" int4,
    "best_score" float8,
    "last_practice" timestamp,
    "mastered" bool,
    CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id"),
    CONSTRAINT "user_progress_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id"),
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX ix_user_progress_id ON public.user_progress USING btree (id);

DROP TABLE IF EXISTS "public"."users";
-- Table Definition
CREATE TABLE "public"."users" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "username" text NOT NULL,
    "email" text NOT NULL,
    "password" text,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "deleted_at" timestamptz,
    "is_guest" bool NOT NULL DEFAULT false,
    "role" text NOT NULL DEFAULT 'user'::text,
    "character_id" text NOT NULL DEFAULT '1'::text,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX uni_users_username ON public.users USING btree (username);
CREATE UNIQUE INDEX uni_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at);

DROP TABLE IF EXISTS "public"."words";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS words_id_seq;

-- Table Definition
CREATE TABLE "public"."words" (
    "id" int4 NOT NULL DEFAULT nextval('words_id_seq'::regclass),
    "text" varchar(200) NOT NULL,
    "difficulty" varchar(20),
    "phonetic" varchar(200),
    "category" varchar(50),
    "audio_url" varchar(500),
    "created_at" timestamp,
    PRIMARY KEY ("id")
);


-- Indices
CREATE INDEX ix_words_id ON public.words USING btree (id);

INSERT INTO "public"."achievements" ("id", "key", "name", "description", "icon", "category", "threshold") VALUES
(1, 'first_word', 'First Step', 'Complete your first practice', '👶', 'practice', NULL),
(2, 'ten_words', 'Explorer', 'Practice 10 different words', '🗺️', 'practice', NULL),
(3, 'all_words', 'Completionist', 'Practice all 50+ words', '📚', 'practice', NULL),
(4, 'practice_50', 'Dedicated', 'Complete 50 practice attempts', '💪', 'practice', NULL),
(5, 'practice_100', 'Unstoppable', 'Complete 100 practice attempts', '🚀', 'practice', NULL),
(6, 'first_perfect', 'Perfectionist', 'Get your first perfect score (95%+)', '💎', 'mastery', NULL),
(7, 'ten_perfect', 'Diamond Voice', 'Get 10 perfect scores', '🌟', 'mastery', NULL),
(8, 'high_score', 'Legendary', 'Achieve a score of 98% or higher', '👑', 'mastery', NULL),
(9, 'mastery_5', 'Quick Learner', 'Master 5 words', '🎓', 'mastery', NULL),
(10, 'mastery_10', 'Scholar', 'Master 10 words', '🏅', 'mastery', NULL),
(11, 'mastery_25', 'Word Wizard', 'Master 25 words', '🧙', 'mastery', NULL),
(12, 'streak_3', 'Warming Up', 'Practice 3 days in a row', '🔥', 'streak', NULL),
(13, 'streak_7', 'On Fire', 'Practice 7 days in a row', '⚡', 'streak', NULL),
(14, 'streak_30', 'Unstoppable Force', 'Practice 30 days in a row', '🌋', 'streak', NULL);
INSERT INTO "public"."conversation_messages" ("id", "conversation_id", "player_input", "pronunciation_score", "npc_response", "npc_state", "pronunciation_eval", "pronunciation_message", "feedback_suggestion", "task_completed", "created_at", "pronunciation_msg", "npc_response_es") VALUES
(1, 1, 'hi', 100, 'Hey there! Great job! You said ''hi'' perfectly. That''s one of the most common informal greetings in English. You can also use ''hey'' or ''hey you'' with friends. Now you''ve completed the task!', 'happy', 'excellent', NULL, 'Try using ''hi'' with a smile to sound even friendlier!', 't', '2026-04-28 03:31:13.340136+00', 'You pronounced ''hi'' very clearly with a friendly tone.', NULL),
(2, 1, 'thanks', 100, 'Now you sound like a native speaker', 'happy', 'excellent', NULL, 'Great job! You''re ready for the next challenge.', 't', '2026-04-28 03:31:40.504845+00', 'Your pronunciation is clear and natural.', NULL),
(3, 2, 'Hi', 100, 'Hey there! Welcome! I''m glad you said ''hi''. Now, let''s try some other informal greetings like ''hey you''. Can you say ''hey you''?', 'happy', 'excellent', NULL, 'Try saying ''hey you'' with a friendly tone.', 'f', '2026-04-28 03:34:16.910539+00', 'Perfect pronunciation of ''hi''!', NULL),
(4, 3, 'Hi', 100, 'Hi! Great job! You used the informal greeting ''Hi'' perfectly. Now you can also try ''Hey you'' or just ''Hey'' to greet someone casually.', 'happy', 'excellent', NULL, 'Keep practicing with other informal greetings like ''Hey you'' or ''What''s up''.', 't', '2026-05-05 01:24:10.770792+00', 'Your pronunciation of ''Hi'' was spot on!', NULL),
(5, 4, 'Hola', 100, '¡Hola! Soy un aldeano. Como forastero, debes aprender a saludar. Una manera informal es con ''Hi''. Inténtalo.', 'waiting', 'excellent', NULL, 'Di ''Hi'' en lugar de ''Hola''.', 'f', '2026-05-05 03:33:43.628236+00', 'Excelente pronunciación, pero necesito que digas ''Hi'' en inglés.', NULL),
(6, 4, 'Hi', 100, 'Genial ahora sabes una manera de saludar', 'happy', 'excellent', NULL, 'Sigue practicando saludos informales como ''Hi''.', 't', '2026-05-05 03:34:21.583448+00', 'Perfecta pronunciación de ''Hi''.', NULL),
(7, 6, 'Hola', 100, '¡Hola! Bienvenido, forastero. Para saludar de manera informal aquí, puedes decir ''Hi''. ¡Inténtalo!', 'waiting', 'excellent', NULL, 'Di ''Hi'' en lugar de ''Hola'' para completar el saludo informal.', 'f', '2026-05-06 03:29:09.240563+00', 'Has pronunciado ''Hola'' perfectamente, pero recuerda que para esta tarea debes usar ''Hi''.', '¡Hola! Bienvenido, forastero. Para saludar de manera informal aquí, puedes decir ''Hi''. ¡Inténtalo!'),
(8, 8, 'Hola', 100, 'Hello there, stranger! You must be new around here. To properly greet someone in this land, you should say ''Hi''. Go on, give it a try!', 'talking', 'excellent', NULL, 'Try saying ''Hi'' with a short ''i'' sound, like the word ''high'' without the ''gh''.', 'f', '2026-05-06 03:33:34.015748+00', 'Your pronunciation of ''Hola'' is perfect, but for this task we need ''Hi''.', '¡Hola, forastero! Debes ser nuevo por aquí. Para saludar correctamente a alguien en esta tierra, debes decir ''Hi''. ¡Vamos, inténtalo!'),
(9, 9, 'hola', 100, 'Hello there! I see you''re trying to greet me, but as a stranger in our village, you need to learn the proper way. A friendly and informal greeting is ''Hi''. Try saying ''Hi'' to me!', 'waiting', 'good', NULL, 'Try saying ''Hi'' with a clear ''h'' sound and a short ''i'' like in ''see''.', 'f', '2026-05-06 03:40:15.024641+00', 'You said ''hola'' which is Spanish. For the task, you need to use the English greeting ''Hi''.', '¡Hola! Veo que intentas saludarme, pero como forastero en nuestra aldea, necesitas aprender la forma adecuada. Un saludo amigable e informal es ''Hi''. ¡Intenta decirme ''Hi''!'),
(10, 14, 'Hola', 100, 'Oh! Hello, traveler. As a foreigner, you should learn a simple informal greeting: “Hi”. Can you say it in English for me?', 'waiting', 'needs_work', NULL, 'Try saying: “Hi”.', 'f', '2026-05-06 04:11:59.361479+00', 'You said “Hola” (Spanish). For this quest, I need the English greeting: “Hi”.', '¡Oh! Hola, viajero. Como forastero, debes aprender un saludo informal y sencillo: “Hi”. ¿Puedes decirlo en inglés para mí?'),
(11, 14, 'Hi', 100, 'Ah, perfect! You said it correctly: “Hi”. As a foreigner, that’s the right simple informal greeting here.', 'happy', 'excellent', NULL, 'Nice! Try using it when you meet someone new: “Hi!”', 't', '2026-05-06 04:12:43.52858+00', 'Great job—“Hi” is clear and natural.', '¡Ah, perfecto! Lo dijiste correctamente: “Hi”. Como forastero, ese es el saludo informal y simple correcto aquí.'),
(12, 15, 'Hola', 100, 'Oh! Hello, traveler. As a foreigner, you should learn an informal greeting too—try saying “Hi” in English to me.', 'waiting', 'good', NULL, 'Say it clearly: Hi', 'f', '2026-05-06 04:19:07.904081+00', 'You said “Hola” (Spanish). For this quest, I need the English greeting: “Hi”.', '¡Oh! Hola, viajero. Como forastero, también debes aprender un saludo informal: intenta decir “Hi” en inglés para mí.'),
(13, 15, 'Hi', 100, 'Hi! Perfect—now you know the informal greeting. Great job, traveler!', 'happy', 'excellent', NULL, 'Nice! Try using “Hi” when you meet someone new in town.', 't', '2026-05-06 04:19:27.499949+00', 'Great pronunciation and you used the correct English greeting: “Hi”.', '¡Hola! Perfecto: ya sabes el saludo informal. ¡Buen trabajo, viajero!'),
(14, 16, 'Hola', 100, 'Hello, stranger! To communicate with the local language, it’s easy to learn greetings. You can say: Good morning, Good afternoon, and Good evening. Try all three!', 'talking', 'good', NULL, 'Say them in English exactly like this: Good morning. Good afternoon. Good evening.', 'f', '2026-05-06 04:20:50.517372+00', 'Nice! You said a greeting, but for this task I need you to say the three English greetings: Good morning, Good afternoon, and Good evening.', '¡Hola, extraño! Para comunicarte con el idioma local, es fácil aprender saludos. Puedes decir: Good morning, Good afternoon y Good evening. ¡Intenta los tres!'),
(15, 16, 'good morning', 100, 'Ah, excellent! You said: “Good morning.” Now you need to say all three greetings: “Good morning,” “Good afternoon,” and “Good evening.” Can you say the other two?', 'happy', 'excellent', NULL, 'Next, try: “Good afternoon” and then “Good evening.” Keep it clear and natural.', 'f', '2026-05-06 04:21:16.689936+00', 'Great job—“Good morning” sounds perfect!', '¡Ah, excelente! Dijiste: “Good morning”. Ahora necesitas decir los tres saludos: “Good morning”, “Good afternoon” y “Good evening”. ¿Puedes decir los otros dos?'),
(16, 16, 'good afternoon and good evening', 100, 'Hi! Great job—now you said all three greetings: “Good morning,” “Good afternoon,” and “Good evening.” Perfect! Great, now you can greet anyone at any time of day.', 'happy', 'excellent', NULL, 'Try using them in real conversations: “Good morning!” in the morning, “Good afternoon!” in the afternoon, and “Good evening!” at night.', 't', '2026-05-06 04:21:56.964468+00', 'Excellent! Your pronunciation is clear and you used all the correct phrases.', '¡Hola! Gran trabajo—ahora dijiste los tres saludos: “Good morning”, “Good afternoon” y “Good evening”. ¡Perfecto! Genial, ahora sabes saludar en cualquier hora del día.'),
(17, 17, 'hola', 100, 'Hey! I’m Aldeano. Nice to meet you—welcome! 😊 As a quick local greeting, you can say: “Hi”, “Hey”, or “What’s up?”', 'happy', 'good', NULL, 'Prueba a decir en inglés una de estas tres: Hi / Hey / What’s up?', 'f', '2026-05-06 04:22:33.670426+00', '¡Bien! Pero para esta misión necesitas que lo digas en inglés: “Hi”, “Hey” o “What’s up?”.', '¡Hey! Soy Aldeano. ¡Mucho gusto—bienvenido! 😊 Como saludo rápido en el idioma local, puedes decir: “Hi”, “Hey”, o “What’s up?”'),
(18, 17, 'hello', 100, 'Hey! “Hello” is a great greeting. 😊 But for this mission, I need you to say ALL THREE in English: “Hi”, “Hey”, and “What’s up?” Can you do that?', 'waiting', 'good', NULL, 'Try: “Hi!” then “Hey!” then “What’s up?” (all in English).', 'f', '2026-05-06 04:25:31.653334+00', 'Nice pronunciation! For the task, use the exact words: “Hi”, “Hey”, and “What’s up?”', '¡Ey! “Hello” es un gran saludo. 😊 Pero para esta misión necesito que digas TODO en inglés: “Hi”, “Hey” y “What’s up?”. ¿Puedes hacerlo?'),
(19, 17, 'yes i can do Hi Hey and What is up', 100, 'Awesome! You said all three greetings correctly: “Hi”, “Hey”, and “What’s up?” 😄 Hey you did it!', 'happy', 'excellent', NULL, 'Nice work—now you can use them anytime!', 't', '2026-05-06 04:26:04.945134+00', 'Perfect! Your pronunciation and the greetings were spot on.', '¡Genial! Dijiste las tres salutaciones correctamente: “Hi”, “Hey” y “What’s up?” 😄 ¡Hey, lo hiciste!'),
(20, 18, 'Hola', 100, 'Hello, traveler! As a newcomer, you should learn an informal greeting. Try saying it in English: “Hi”.', 'happy', 'good', NULL, 'Say it clearly: “Hi” (one short word).', 'f', '2026-05-06 04:58:37.633637+00', 'Nice! You greeted me, but you said it in Spanish. For this quest, say the English greeting “Hi”.', '¡Hola, viajero! Como forastero, debes aprender un saludo informal. Intenta decirlo en inglés: “Hi”.'),
(21, 18, 'hi', 100, 'Ah, perfect! You said “hi” — that’s the informal greeting we use here. Welcome, traveler!', 'happy', 'excellent', NULL, 'Try using it anytime you meet someone quickly: “Hi!”', 't', '2026-05-06 04:59:19.131123+00', 'Great job! “Hi” is short and clear—pronunciation was perfect.', '¡Ah, perfecto! Dijiste “hi” — ese es el saludo informal que usamos aquí. ¡Bienvenido, viajero!'),
(22, 19, 'hola', 100, 'Hello, traveler! As a newcomer, you should learn an informal greeting. Try saying it in English: “Hi”.', 'happy', 'good', NULL, 'Say it clearly: “Hi” (one short word).', 'f', '2026-05-06 05:00:14.060378+00', 'Nice! You greeted me, but you said it in Spanish. For this quest, say the English greeting “Hi”.', '¡Hola, viajero! Como forastero, debes aprender un saludo informal. Intenta decirlo en inglés: “Hi”.'),
(23, 19, 'hi', 100, 'Ah, perfect! You said “hi” — that’s the informal greeting we use here. Welcome, traveler!', 'happy', 'excellent', NULL, 'Try using it anytime you meet someone quickly: “Hi!”', 't', '2026-05-06 05:00:26.383475+00', 'Great job! “Hi” is short and clear—pronunciation was perfect.', '¡Ah, perfecto! Dijiste “hi” — ese es el saludo informal que usamos aquí. ¡Bienvenido, viajero!'),
(24, 21, 'hello', 100, 'Hello, traveler! I’m the village aldeano. As a foreigner, you should learn a simple informal greeting: “Hi”. Can you say it for me—just “Hi”?', 'waiting', 'good', NULL, 'Try: Hi (short, one syllable).', 'f', '2026-05-06 05:14:45.00261+00', 'Nice greeting! But for this lesson, I need the informal word: “Hi”.', '¡Hola, viajero! Soy el aldeano del pueblo. Como forastero, debes aprender un saludo informal y sencillo: “Hi”. ¿Puedes decirlo para mí—solo “Hi”?'),
(25, 21, 'bye', 100, 'Oh! Not “Hi,” traveler. As a foreigner, you should try the informal greeting: “Hi.” Can you say exactly “Hi” for me?', 'waiting', 'bad', NULL, 'Say: Hi', 'f', '2026-05-06 05:15:04.569375+00', 'You said “bye,” but the task requires the greeting “Hi.” Try saying “Hi” (no extra words).', '¡Oh! No es “Hi”, viajero. Como forastero, debes intentar el saludo informal: “Hi”. ¿Puedes decirme exactamente “Hi”?'),
(26, 21, 'hi', 100, 'Ah, perfect! You said “hi” — that’s the informal greeting we use here. Welcome, traveler!', 'happy', 'excellent', NULL, 'Try using it anytime you meet someone quickly: “Hi!”', 't', '2026-05-06 05:15:19.547452+00', 'Great job! “Hi” is short and clear—pronunciation was perfect.', '¡Ah, perfecto! Dijiste “hi” — ese es el saludo informal que usamos aquí. ¡Bienvenido, viajero!'),
(27, 22, 'hello', 100, 'Hello, traveler! I’m the village aldeano. As a foreigner, you should learn a simple informal greeting: “Hi”. Can you say it for me—just “Hi”?', 'waiting', 'good', NULL, 'Try: Hi (short, one syllable).', 'f', '2026-05-06 05:21:50.803223+00', 'Nice greeting! But for this lesson, I need the informal word: “Hi”.', '¡Hola, viajero! Soy el aldeano del pueblo. Como forastero, debes aprender un saludo informal y sencillo: “Hi”. ¿Puedes decirlo para mí—solo “Hi”?'),
(28, 22, 'bye', 100, 'Oh! Not “Hi,” traveler. As a foreigner, you should try the informal greeting: “Hi.” Can you say exactly “Hi” for me?', 'waiting', 'bad', NULL, 'Say: Hi', 'f', '2026-05-06 05:22:15.232656+00', 'You said “bye,” but the task requires the greeting “Hi.” Try saying “Hi” (no extra words).', '¡Oh! No es “Hi”, viajero. Como forastero, debes intentar el saludo informal: “Hi”. ¿Puedes decirme exactamente “Hi”?'),
(29, 22, 'and', 100, 'Hi! As a foreigner, you should learn the informal greeting: say exactly “Hi”. You didn’t say it yet—can you try again?', 'waiting', 'bad', NULL, 'Say exactly: Hi (two letters, no extra words).', 'f', '2026-05-06 05:22:33.943677+00', 'You didn’t say the word “Hi”. Try saying just: Hi.', '¡Hola! Como forastero, debes aprender el saludo informal: di exactamente “Hi”. Aún no lo dijiste—¿puedes intentarlo de nuevo?'),
(30, 22, 'hi', 100, 'Ah, perfect! You said “hi” — that’s the informal greeting we use here. Welcome, traveler!', 'happy', 'excellent', NULL, 'Try using it anytime you meet someone quickly: “Hi!”', 't', '2026-05-06 05:22:53.057908+00', 'Great job! “Hi” is short and clear—pronunciation was perfect.', '¡Ah, perfecto! Dijiste “hi” — ese es el saludo informal que usamos aquí. ¡Bienvenido, viajero!'),
(31, 23, 'hello', 100, 'Hello, stranger! To communicate with the local language, it’s easy to learn greetings. You can say: “Good morning”, “Good afternoon”, and “Good evening”. Try to say all three in English!', 'talking', 'good', NULL, 'Say them in order: “Good morning”, “Good afternoon”, “Good evening”.', 'f', '2026-05-06 05:23:33.973341+00', 'Nice! “Hello” is correct, but for this task you need the three specific greetings: Good morning, Good afternoon, and Good evening.', '¡Hola, extraño! Para comunicarte con el idioma local, es fácil aprender saludos. Puedes decir: “Good morning”, “Good afternoon” y “Good evening”. ¡Intenta decir los tres en inglés!'),
(32, 23, 'good morning', 100, 'Ah, perfect start! You said “Good morning.” Now, you need to learn all three greetings in English: “Good morning”, “Good afternoon”, and “Good evening”. Can you say the other two too?', 'happy', 'excellent', NULL, 'Say the remaining greetings: “Good afternoon” and “Good evening”.', 'f', '2026-05-06 05:23:56.727705+00', 'Great job—“Good morning” sounds excellent!', '¡Ah, perfecto inicio! Dijiste “Good morning”. Ahora necesitas aprender los tres saludos en inglés: “Good morning”, “Good afternoon” y “Good evening”. ¿Puedes decir los otros dos también?'),
(33, 23, 'good afternoon and good evening', 100, 'Good job! You said “Good afternoon” and “Good evening” correctly. Great, now you know how to greet at any time of the day!', 'happy', 'excellent', NULL, 'Keep practicing with different people and times of day to make it automatic.', 't', '2026-05-06 05:24:20.572025+00', 'Excellent! Your pronunciation is clear for all three greetings.', '¡Bien hecho! Dijiste correctamente “Good afternoon” y “Good evening”. ¡Genial, ahora sabes saludar en cualquier hora del día!'),
(34, 24, 'hi', 100, 'Hey! Nice to meet you. 😊 Try one more: say “Hi,” “Hey,” or “What’s up?” in English.', 'happy', 'excellent', NULL, 'Now say either “Hey” or “What’s up?” in English.', 'f', '2026-05-06 05:24:43.736971+00', 'Great job! Your “Hi” sounds clear.', '¡Hey! Mucho gusto. 😊 Intenta una más: di “Hi”, “Hey” o “What’s up?” en inglés.'),
(35, 24, 'hi hey whats up', 100, 'Nice! You said all three: “Hi,” “Hey,” and “What’s up?” 🎉 Perfect job!', 'happy', 'excellent', NULL, 'Awesome—now try using them in a full sentence like: “Hi! What’s up?”', 't', '2026-05-06 05:25:03.080787+00', 'Great pronunciation and perfect choice of greetings!', '¡Bien! Dijiste las tres: “Hi”, “Hey” y “What’s up”? 🎉 ¡Trabajo perfecto!'),
(68, 25, 'hi', 100, 'Hi! Nice to meet you. 😊 What’s up today?', 'happy', 'excellent', NULL, 'To complete my little greeting challenge, say all three: “Hi,” “Hey,” and “What’s up?”', 'f', '2026-05-13 02:33:42.799759+00', 'Great job! Your “hi” sounds perfect.', '¡Hola! Mucho gusto. 😊 ¿Qué tal hoy?'),
(69, 25, 'i am fine', 100, 'Nice! 😊 “I am fine” is totally understandable. A more natural way is: “I’m fine.” So—what’s up with you today?', 'happy', 'good', NULL, 'Try: “I’m fine, thanks!”', 'f', '2026-05-13 02:34:13.046284+00', 'Good job! Your message is clear. For English, it’s more natural to say “I’m fine” instead of “I am fine.”', '¡Genial! 😊 “I am fine” se entiende perfectamente. Una forma más natural es: “I’m fine”. Entonces—¿qué tal hoy?'),
(70, 26, 'hello', 100, 'Hello, traveler! I’m the village aldeano. As a foreigner, you should learn a simple informal greeting: “Hi”. Can you say it for me—just “Hi”?', 'waiting', 'good', NULL, 'Try: Hi (short, one syllable).', 'f', '2026-05-13 02:36:06.732057+00', 'Nice greeting! But for this lesson, I need the informal word: “Hi”.', '¡Hola, viajero! Soy el aldeano del pueblo. Como forastero, debes aprender un saludo informal y sencillo: “Hi”. ¿Puedes decirlo para mí—solo “Hi”?'),
(71, 26, 'Hi', 100, 'Ah, perfect! You said “hi” — that’s the informal greeting we use here. Welcome, traveler!', 'happy', 'excellent', NULL, 'Try using it anytime you meet someone quickly: “Hi!”', 't', '2026-05-13 02:36:17.645672+00', 'Great job! “Hi” is short and clear—pronunciation was perfect.', '¡Ah, perfecto! Dijiste “hi” — ese es el saludo informal que usamos aquí. ¡Bienvenido, viajero!'),
(72, 27, 'hola', 100, 'Hello stranger! To communicate with the local people, you should learn simple greetings. A very easy way is to say: Good morning, Good afternoon, and Good evening. Can you try saying all three in English?', 'talking', 'good', NULL, 'Try saying: “Good morning”, then “Good afternoon”, then “Good evening”.', 'f', '2026-05-13 02:36:50.828231+00', 'Nice! But for this task, I need the greetings in English: Good morning, Good afternoon, and Good evening.', '¡Hola extraño! Para comunicarte con la gente local, debes aprender saludos sencillos. Una forma fácil es decir: Good morning, Good afternoon y Good evening. ¿Puedes intentarlo diciendo los tres en inglés?'),
(73, 27, 'good morning good afternoon and good evening', 100, 'Good job! “Good morning, good afternoon, and good evening” — perfect. Great, now you know how to greet anyone at any time of the day!', 'happy', 'excellent', NULL, 'Try using them in a real sentence next: “Good morning! How are you?”', 't', '2026-05-13 02:37:33.792444+00', 'Excellent! You said all three greetings correctly in English.', '¡Bien hecho! “Good morning, good afternoon y good evening” — perfecto. ¡Genial, ahora sabes saludar en cualquier hora del día!'),
(74, 28, 'hi', 100, 'Hi! Nice to meet you. Can you also say: “Hey” and “What’s up?”', 'happy', 'excellent', NULL, 'Try the next two greetings: “Hey” and “What’s up?”', 'f', '2026-05-13 02:38:03.41858+00', 'Great! “Hi” sounds clear.', '¡Hola! Mucho gusto. ¿Puedes decir también: “Hey” y “What’s up?”'),
(75, 28, 'hey whats up', 100, 'Hey! What’s up! Perfect — you said all three greetings: “Hi,” “Hey,” and “What’s up?” 🎉', 'happy', 'excellent', NULL, 'Nice! Keep practicing with the same rhythm: Hi → Hey → What’s up.', 't', '2026-05-13 02:38:17.84324+00', 'Great job! Clear and natural pronunciation.', '¡Hey! ¿Qué tal? Perfecto — dijiste las tres formas: “Hi”, “Hey” y “What’s up?” 🎉');
INSERT INTO "public"."conversations" ("id", "player_id", "npc_instance_id", "mission_id", "session_id", "created_at") VALUES
(1, '36815b68-5a9b-4eaa-8c62-33d2af011d7a', 23, 2, '', '2026-04-28 03:31:10.806109+00'),
(2, '36815b68-5a9b-4eaa-8c62-33d2af011d7a', 21, 2, '', '2026-04-28 03:34:13.803483+00'),
(3, 'e6c2c30d-fa0c-4013-b784-08c9719edd7b', 26, 2, '', '2026-05-05 01:24:07.877105+00'),
(4, 'f2942d3c-cc72-46d5-bfae-a3ff6757ef40', 32, 2, '', '2026-05-05 03:33:40.719229+00'),
(5, '8138478e-5e31-447e-b29a-9adccbf5bfcb', 32, 2, '', '2026-05-06 03:22:05.173724+00'),
(6, 'c9f91b14-d48e-470b-8dd3-1ad90203704a', 40, 2, '', '2026-05-06 03:29:05.251352+00'),
(7, 'c9f91b14-d48e-470b-8dd3-1ad90203704a', 32, 2, '', '2026-05-06 03:32:24.387596+00'),
(8, '6f272f33-616c-4410-b5f5-be46619911f9', 46, 2, '', '2026-05-06 03:33:30.16626+00'),
(9, '2a2acf1b-6654-45c0-9f4f-30f3abcfeb03', 52, 2, '', '2026-05-06 03:40:11.039606+00'),
(10, '2a2acf1b-6654-45c0-9f4f-30f3abcfeb03', 32, 2, '', '2026-05-06 03:43:28.971344+00'),
(11, '01ef31f7-3978-4fa2-bbf7-a37ba759a299', 61, 2, '', '2026-05-06 03:46:29.131769+00'),
(12, '01ef31f7-3978-4fa2-bbf7-a37ba759a299', 32, 2, '', '2026-05-06 03:47:12.110207+00'),
(13, '471dd84c-9b13-4991-bd25-6c18f66a6d50', 64, 2, '', '2026-05-06 03:48:16.236468+00'),
(14, '41b2c4f7-667c-4754-9609-80628f7dcdad', 67, 2, '', '2026-05-06 04:11:56.327513+00'),
(15, '21c1c3f2-3710-4895-a5fc-b454a09370ee', 73, 2, '', '2026-05-06 04:19:05.267009+00'),
(16, '21c1c3f2-3710-4895-a5fc-b454a09370ee', 74, 2, '', '2026-05-06 04:20:48.370617+00'),
(17, '21c1c3f2-3710-4895-a5fc-b454a09370ee', 75, 2, '', '2026-05-06 04:22:30.880956+00'),
(18, '02ee5138-4aa4-4a3b-89f7-166ef9b8e614', 76, 2, '', '2026-05-06 04:58:34.789069+00'),
(19, '503e7441-fa60-48bb-95b6-5c0a0244ddc9', 82, 2, '', '2026-05-06 05:00:14.039273+00'),
(20, 'd29b73fc-8a49-437c-acb6-d3269a700768', 32, 2, '', '2026-05-06 05:08:05.410855+00'),
(21, '082e23ad-fb98-4344-af9a-04fa0863a736', 91, 2, '', '2026-05-06 05:14:41.821931+00'),
(22, '28faaa00-e5ea-4975-a28d-69ec0c997a38', 94, 2, '', '2026-05-06 05:21:50.782789+00'),
(23, '28faaa00-e5ea-4975-a28d-69ec0c997a38', 96, 2, '', '2026-05-06 05:23:31.684002+00'),
(24, '28faaa00-e5ea-4975-a28d-69ec0c997a38', 95, 2, '', '2026-05-06 05:24:41.989965+00'),
(25, 'b418dbdf-8346-4243-a1ca-bb9fdb02e97f', 33, 2, '', '2026-05-13 02:33:40.133784+00'),
(26, 'b418dbdf-8346-4243-a1ca-bb9fdb02e97f', 109, 2, '', '2026-05-13 02:36:06.711809+00'),
(27, 'b418dbdf-8346-4243-a1ca-bb9fdb02e97f', 110, 2, '', '2026-05-13 02:36:48.370445+00'),
(28, 'b418dbdf-8346-4243-a1ca-bb9fdb02e97f', 111, 2, '', '2026-05-13 02:38:01.12908+00');
INSERT INTO "public"."enemies" ("id", "name", "level", "hp_max", "mp_max", "attack", "defense", "speed", "exp_reward", "gold_reward", "ai_behavior", "skill_ids", "sprite_key", "created_at") VALUES
('387b772e-5be0-4bd7-904c-345467777d71', 'Lince', 1, 100, 50, 5, 5, 50, 20, 10, 'aggressive', '[]', '1', '2026-05-15 01:47:41.159891+00');
INSERT INTO "public"."friend_requests" ("id", "requester_id", "addressee_id", "status", "created_at", "updated_at", "deleted_at") VALUES
('054d9477-b61a-45b8-9751-70aa67180f28', '46acd5ea-0ef8-4a0e-88b1-54eb7b5027a9', '49bbddfb-0a16-46fa-a157-524b1f124461', 'accepted', '2025-12-29 00:17:14.061687+00', '2025-12-29 00:31:20.540255+00', NULL);
INSERT INTO "public"."friendships" ("id", "user1_id", "user2_id", "created_at", "updated_at", "deleted_at") VALUES
('5b45fb64-20e8-4cd4-b53a-390a0226165b', '46acd5ea-0ef8-4a0e-88b1-54eb7b5027a9', '49bbddfb-0a16-46fa-a157-524b1f124461', '2025-12-29 00:31:20.528309+00', '2025-12-29 00:31:20.528309+00', NULL);
INSERT INTO "public"."inventories" ("id", "player_id", "item_id", "quantity", "slot_index", "created_at", "updated_at") VALUES
('dda54ead-d860-4ea1-a018-d7c8c5bf7a08', '36815b68-5a9b-4eaa-8c62-33d2af011d7a', '137881e6-06f2-46ec-81a3-5a4878924918', 3, 0, '2026-04-04 00:58:18.719302+00', '2026-04-21 15:20:00.886534+00'),
('dc530e76-3b78-4cda-9447-43f8a16f3285', '36815b68-5a9b-4eaa-8c62-33d2af011d7a', 'bfd1359a-b574-45a1-9b55-adc7330a788f', 1, 0, '2026-04-21 15:35:52.194736+00', '2026-04-21 15:35:52.194736+00'),
('a3b95c9f-8daa-45ad-8815-84f9ff0bef52', '00000000-0000-0000-0000-000000000000', 'bfd1359a-b574-45a1-9b55-adc7330a788f', 8, 0, '2026-04-28 03:31:40.474454+00', '2026-05-06 05:25:03.065702+00'),
('9064a4b5-0d3a-4360-b11b-f0552db6e2fc', 'b418dbdf-8346-4243-a1ca-bb9fdb02e97f', 'bfd1359a-b574-45a1-9b55-adc7330a788f', 2, 0, '2026-05-13 02:38:17.829709+00', '2026-05-13 02:38:17.829709+00');
INSERT INTO "public"."items" ("id", "name", "description", "item_type", "effect_type", "effect_value", "price", "max_stack", "icon_key", "created_at", "attack_bonus", "defense_bonus", "required_level") VALUES
('137881e6-06f2-46ec-81a3-5a4878924918', 'key', 'key', 'mission_item', 'none', 0, 979, 99, '1.png', '2026-04-03 02:07:28.813668+00', 0, 0, 1),
('bfd1359a-b574-45a1-9b55-adc7330a788f', 'Health Potion', 'Restores 50 HP', 'health', 'heal_hp', 50, 10, 10, '2.png', '0001-01-01 00:00:00+00', 0, 0, 1);
INSERT INTO "public"."learning_challenges" ("id", "type", "question", "option1", "option2", "option3", "correct_option", "explanation_es", "tags", "difficulty", "language_learning", "phonetic", "requires_audio", "audio_url", "created_at", "updated_at", "deleted_at", "question_es") VALUES
('6c4341c5-db84-4191-8afc-fc2e7adbb51f', 'pronunciation', 'Adventure', 'Adventure', '', '', 1, 'Aventura', '{vocabulary,rpg}', 'beginner', 'english', '/ədˈventʃər/', 't', '', '2026-03-11 03:07:06.927608+00', '2026-03-11 03:07:06.927608+00', NULL, NULL),
('560e46c8-f7a8-4244-8c18-42fcbc4c4de6', 'pronunciation', 'Odyssey', 'Odyssey', '', '', 1, 'Odisea, un viaje largo y lleno de aventuras', '{vocabulary,rpg}', 'intermediate', 'english', '/ˈɒdəsi/', 't', '', '2026-03-11 03:07:06.927608+00', '2026-03-11 03:07:06.927608+00', NULL, NULL),
('7525cc67-a265-4d00-8a24-5dfacb80abbd', 'pronunciation', 'Dungeon', 'Dungeon', '', '', 1, 'Mazmorra', '{vocabulary,rpg}', 'beginner', 'english', '/ˈdʌndʒən/', 't', '', '2026-03-11 03:07:06.927608+00', '2026-03-11 03:07:06.927608+00', NULL, NULL),
('ee6248aa-c8af-42ba-bb73-1d712fe5b943', 'pronunciation', 'Welcome to the game', 'Welcome to the game', '', '', 1, 'Bienvenido al juego', '{phrases,greetings}', 'beginner', 'english', '/ˈwelkəm tu ðə ɡeɪm/', 't', '', '2026-03-11 03:07:06.927608+00', '2026-03-11 03:07:06.927608+00', NULL, NULL),
('49b53828-4323-47df-a2e1-306c72372975', 'vocabulary', 'Which item is usually found in a dungeon?', 'Treasure Chest', 'Modern Car', 'Office Chair', 1, 'Los cofres de tesoro (Treasure Chests) son clásicos en las mazmorras de RPG.', '{vocabulary,rpg}', 'beginner', 'english', '', 'f', '', '2026-05-21 16:43:07.113793+00', '2026-05-21 16:43:07.113793+00', NULL, '¿Qué objeto se encuentra usualmente en una mazmorra?'),
('8e6f26d0-ce7a-4c89-a8d8-9e4a200e3b88', 'grammar', 'I _ a brave warrior.', 'am', 'is', 'are', 1, 'Se usa ''am'' con el pronombre ''I'' (Verb to be).', '{grammar,basics}', 'beginner', 'english', '', 'f', '', '2026-05-21 16:43:07.121748+00', '2026-05-21 16:43:07.121748+00', NULL, 'Yo _____ un guerrero valiente.'),
('c87499b0-9c91-493f-8cbe-043e69953569', 'grammar', 'I _____ a brave warrior.', 'am', 'is', 'are', 1, 'Se usa ''am'' con el pronombre ''I'' (Verb to be).', '{grammar,basics}', 'beginner', 'english', '', 'f', '', '2026-05-21 23:53:50.006791+00', '2026-05-21 23:53:50.006791+00', NULL, 'Yo _____ un guerrero valiente.');
INSERT INTO "public"."map_configs" ("id", "scene_key", "walls_json", "updated_by", "created_at", "updated_at", "map_data", "is_public", "max_users") VALUES
('e9d6c466-dc61-4d1a-9783-3af898cd348e', 'lobby', '{"width":800,"height":800,"defaultSpawnX":1000,"defaultSpawnY":750,"bgmTrack":"bgm_pixelated_prelude","isPublic":false,"maxUsers":50,"walls":[],"floors":[{"x":150,"y":250,"frame":"sprite1"},{"x":150,"y":350,"frame":"sprite1"},{"x":150,"y":450,"frame":"sprite1"},{"x":150,"y":550,"frame":"sprite1"},{"x":250,"y":250,"frame":"sprite1"},{"x":250,"y":350,"frame":"sprite1"},{"x":250,"y":450,"frame":"sprite1"},{"x":250,"y":550,"frame":"sprite1"},{"x":350,"y":250,"frame":"sprite1"},{"x":350,"y":350,"frame":"sprite1"},{"x":350,"y":450,"frame":"sprite1"},{"x":350,"y":550,"frame":"sprite1"},{"x":450,"y":250,"frame":"sprite1"},{"x":450,"y":350,"frame":"sprite1"},{"x":450,"y":450,"frame":"sprite1"},{"x":450,"y":550,"frame":"sprite1"}],"forest":[],"builds":[],"spawns":[],"npcZones":[{"x":150,"y":350,"definitionId":"7","missionIds":[]},{"x":150,"y":550,"definitionId":"8","missionIds":[]}],"pickups":[],"voids":[],"colliders":[],"exits":[],"storeTiles":[],"furniture":[]}', '080d7054-0a5b-42c9-b68c-f4f716a48b48', '2026-04-23 16:57:19.245989+00', '2026-05-06 03:13:54.606128+00', '{"width":800,"height":800,"defaultSpawnX":1000,"defaultSpawnY":750,"bgmTrack":"bgm_pixelated_prelude"}', 'f', 50),
('dd88f9c0-7bc0-449b-9c78-20aef014d871', 'greeting village', '{
  "width": 800,
  "height": 800,
  "defaultSpawnX": 1000,
  "defaultSpawnY": 750,
  "bgmTrack": "none",
  "isPublic": false,
  "maxUsers": 50,
  "walls": [],
  "floors": [
    {
      "x": 750,
      "y": 250,
      "frame": "sprite1"
    },
    {
      "x": 750,
      "y": 350,
      "frame": "sprite1"
    },
    {
      "x": 750,
      "y": 450,
      "frame": "sprite1"
    },
    {
      "x": 650,
      "y": 450,
      "frame": "sprite1"
    },
    {
      "x": 550,
      "y": 450,
      "frame": "sprite1"
    },
    {
      "x": 450,
      "y": 450,
      "frame": "sprite1"
    },
    {
      "x": 350,
      "y": 450,
      "frame": "sprite1"
    },
    {
      "x": 350,
      "y": 350,
      "frame": "sprite1"
    },
    {
      "x": 250,
      "y": 350,
      "frame": "sprite1"
    },
    {
      "x": 150,
      "y": 350,
      "frame": "sprite1"
    },
    {
      "x": 150,
      "y": 450,
      "frame": "sprite1"
    },
    {
      "x": 250,
      "y": 450,
      "frame": "sprite1"
    },
    {
      "x": 50,
      "y": 450,
      "frame": "sprite1"
    },
    {
      "x": 50,
      "y": 350,
      "frame": "sprite1"
    },
    {
      "x": 50,
      "y": 250,
      "frame": "sprite1"
    },
    {
      "x": 150,
      "y": 250,
      "frame": "sprite1"
    },
    {
      "x": 250,
      "y": 250,
      "frame": "sprite1"
    },
    {
      "x": 450,
      "y": 250,
      "frame": "sprite1"
    },
    {
      "x": 550,
      "y": 250,
      "frame": "sprite1"
    },
    {
      "x": 650,
      "y": 250,
      "frame": "sprite1"
    },
    {
      "x": 650,
      "y": 350,
      "frame": "sprite1"
    },
    {
      "x": 550,
      "y": 350,
      "frame": "sprite1"
    },
    {
      "x": 450,
      "y": 350,
      "frame": "sprite1"
    },
    {
      "x": 350,
      "y": 250,
      "frame": "sprite1"
    },
    {
      "x": 750,
      "y": 550,
      "frame": "sprite1"
    },
    {
      "x": 650,
      "y": 550,
      "frame": "sprite1"
    },
    {
      "x": 550,
      "y": 550,
      "frame": "sprite1"
    },
    {
      "x": 450,
      "y": 550,
      "frame": "sprite1"
    },
    {
      "x": 350,
      "y": 550,
      "frame": "sprite1"
    },
    {
      "x": 250,
      "y": 550,
      "frame": "sprite1"
    },
    {
      "x": 150,
      "y": 550,
      "frame": "sprite1"
    },
    {
      "x": 50,
      "y": 550,
      "frame": "sprite1"
    },
    {
      "x": 550,
      "y": 650,
      "frame": "sprite1"
    },
    {
      "x": 650,
      "y": 650,
      "frame": "sprite1"
    },
    {
      "x": 650,
      "y": 750,
      "frame": "sprite1"
    }
  ],
  "forest": [],
  "builds": [],
  "spawns": [],
  "npcZones": [
    {
      "x": 350,
      "y": 250,
      "definitionId": "9",
      "missionIds": [
        "2"
      ]
    },
    {
      "x": 50,
      "y": 350,
      "definitionId": "9",
      "missionIds": [
        "2"
      ]
    },
    {
      "x": 350,
      "y": 450,
      "definitionId": "9",
      "missionIds": [
        "2"
      ]
    }
  ],
  "pickups": [],
  "voids": [],
  "colliders": [],
  "storeTiles": [],
  "furniture": [],
  "enemySpawns": []
}', '080d7054-0a5b-42c9-b68c-f4f716a48b48', '2026-04-24 18:02:44.007126+00', '2026-05-15 02:49:19.727344+00', '{"width":800,"height":800,"defaultSpawnX":1000,"defaultSpawnY":750,"bgmTrack":"none"}', 'f', 50),
('a1db8fad-9e77-488a-9618-87b03105ba74', 'mision1', '{"width":800,"height":800,"defaultSpawnX":1000,"defaultSpawnY":750,"bgmTrack":"none","isPublic":false,"maxUsers":50,"walls":[],"floors":[{"x":550,"y":750,"frame":"sprite1"},{"x":50,"y":150,"frame":"sprite1"},{"x":50,"y":250,"frame":"sprite1"},{"x":50,"y":350,"frame":"sprite1"},{"x":50,"y":450,"frame":"sprite1"},{"x":50,"y":550,"frame":"sprite1"},{"x":50,"y":650,"frame":"sprite1"},{"x":50,"y":750,"frame":"sprite1"},{"x":150,"y":150,"frame":"sprite1"},{"x":150,"y":250,"frame":"sprite1"},{"x":150,"y":350,"frame":"sprite1"},{"x":150,"y":450,"frame":"sprite1"},{"x":150,"y":550,"frame":"sprite1"},{"x":150,"y":650,"frame":"sprite1"},{"x":150,"y":750,"frame":"sprite1"},{"x":250,"y":150,"frame":"sprite1"},{"x":250,"y":250,"frame":"sprite1"},{"x":250,"y":350,"frame":"sprite1"},{"x":250,"y":450,"frame":"sprite1"},{"x":250,"y":550,"frame":"sprite1"},{"x":250,"y":650,"frame":"sprite1"},{"x":250,"y":750,"frame":"sprite1"},{"x":350,"y":150,"frame":"sprite1"},{"x":350,"y":250,"frame":"sprite1"},{"x":350,"y":350,"frame":"sprite1"},{"x":350,"y":550,"frame":"sprite1"},{"x":350,"y":650,"frame":"sprite1"},{"x":350,"y":750,"frame":"sprite1"},{"x":450,"y":150,"frame":"sprite1"},{"x":450,"y":250,"frame":"sprite1"},{"x":450,"y":350,"frame":"sprite1"},{"x":450,"y":450,"frame":"sprite1"},{"x":450,"y":550,"frame":"sprite1"},{"x":450,"y":650,"frame":"sprite1"},{"x":450,"y":750,"frame":"sprite1"},{"x":550,"y":150,"frame":"sprite1"},{"x":550,"y":250,"frame":"sprite1"},{"x":550,"y":350,"frame":"sprite1"},{"x":550,"y":450,"frame":"sprite1"},{"x":550,"y":550,"frame":"sprite1"},{"x":550,"y":650,"frame":"sprite1"},{"x":650,"y":150,"frame":"sprite1"},{"x":650,"y":250,"frame":"sprite1"},{"x":650,"y":350,"frame":"sprite1"},{"x":650,"y":450,"frame":"sprite1"},{"x":650,"y":550,"frame":"sprite1"},{"x":650,"y":650,"frame":"sprite1"},{"x":650,"y":750,"frame":"sprite1"},{"x":750,"y":150,"frame":"sprite1"},{"x":750,"y":250,"frame":"sprite1"},{"x":750,"y":350,"frame":"sprite1"},{"x":750,"y":450,"frame":"sprite1"},{"x":750,"y":550,"frame":"sprite1"},{"x":750,"y":650,"frame":"sprite1"},{"x":750,"y":750,"frame":"sprite1"},{"x":50,"y":50,"frame":"sprite1"},{"x":150,"y":50,"frame":"sprite1"},{"x":250,"y":50,"frame":"sprite1"},{"x":350,"y":50,"frame":"sprite1"},{"x":450,"y":50,"frame":"sprite1"},{"x":550,"y":50,"frame":"sprite1"},{"x":650,"y":50,"frame":"sprite1"},{"x":750,"y":50,"frame":"sprite1"},{"x":350,"y":450,"frame":"sprite1"}],"forest":[],"builds":[],"spawns":[],"npcZones":[],"pickups":[],"voids":[],"colliders":[],"exits":[],"storeTiles":[],"furniture":[]}', '080d7054-0a5b-42c9-b68c-f4f716a48b48', '2026-04-21 15:18:46.126086+00', '2026-04-24 04:52:17.998312+00', '{"width":800,"height":800,"defaultSpawnX":1000,"defaultSpawnY":750,"bgmTrack":"none"}', 'f', 50),
('ee8cf397-ddbf-4f4b-85d7-de3d0560e833', 'combate1', '{
  "width": 800,
  "height": 800,
  "defaultSpawnX": 1000,
  "defaultSpawnY": 750,
  "bgmTrack": "none",
  "isPublic": true,
  "maxUsers": 50,
  "walls": [],
  "floors": [],
  "forest": [],
  "builds": [],
  "spawns": [],
  "npcZones": [],
  "pickups": [],
  "voids": [],
  "colliders": [],
  "storeTiles": [],
  "furniture": [],
  "enemySpawns": [
    {
      "x": 350,
      "y": 350,
      "npcId": "387b772e-5be0-4bd7-904c-345467777d71",
      "waveNum": 1,
      "hp": 50,
      "speed": 120,
      "damage": 10
    },
    {
      "x": 150,
      "y": 650,
      "npcId": "387b772e-5be0-4bd7-904c-345467777d71",
      "waveNum": 1,
      "hp": 50,
      "speed": 120,
      "damage": 10
    }
  ]
}', '080d7054-0a5b-42c9-b68c-f4f716a48b48', '2026-05-14 15:03:37.181283+00', '2026-05-21 02:54:47.704585+00', '{"width":800,"height":800,"enemies":[{"enemy_id":"92b94afe-be5c-47f0-ba94-37f069b525f7","spawn_x":350,"spawn_y":350,"wave_num":1,"npc_id":"387b772e-5be0-4bd7-904c-345467777d71","sprite_id":"1","hp":50,"speed":120,"damage":10,"attack_rate":0},{"enemy_id":"7f9b6df3-3a70-4d5a-953f-2b8f1589d830","spawn_x":150,"spawn_y":650,"wave_num":1,"npc_id":"387b772e-5be0-4bd7-904c-345467777d71","sprite_id":"1","hp":50,"speed":120,"damage":10,"attack_rate":0}]}', 't', 50);

INSERT INTO "public"."mission_tasks" ("id", "mission_id", "type", "order", "description_en", "target_npc_template_id", "required_item", "required_enemy", "pronunciation_min_score", "target_phrase_en", "message_to_deliver", "created_at", "required_kills") VALUES
(4, 2, 'talk_to_npc', 1, 'Saluda al aldeano con Hi', 25, '', '', 80, '', '', '2026-05-05 03:32:44.136925+00', 0),
(5, 2, 'talk_to_npc', 2, 'Saluda al aldeano con good morning', 24, '', '', 80, '', '', '2026-05-05 14:17:27.443116+00', 0),
(6, 2, 'talk_to_npc', 3, 'Saludos informales', 26, '', '', 80, '', '', '2026-05-06 03:18:46.653764+00', 0),
(7, 3, 'kill_all', 1, 'Elimina a todos los enemigos ', NULL, '', 'Lince', 80, '', '', '2026-05-20 20:59:46.862745+00', 2);
INSERT INTO "public"."missions" ("id", "scene_key", "title", "description_en", "objective_en", "type", "status", "created_at", "reward_item_id", "reward_quantity", "reward_gold", "mode", "objective_target", "reward_xp") VALUES
(1, 'mision1', 'Busca la llave', 'Busca la key en el mapa y entregala al alcalde', 'Busca la llave', 'find_item', 'active', '2026-04-24 04:51:46.559719+00', 'bfd1359a-b574-45a1-9b55-adc7330a788f', 1, 300, 'individual', 'key', 0),
(2, 'greeting village', 'Aprende a saludar', 'Debes saludar a todos los aldeanos de la Villa', 'Saluda a todos los aldeanos', 'talk_to_npc', 'active', '2026-04-24 18:04:13.214432+00', 'bfd1359a-b574-45a1-9b55-adc7330a788f', 2, 0, 'individual', '', 0),
(3, 'combate1', 'combate1', 'eleimina a todos', 'elimina a todos', 'kill_all', 'active', '2026-05-14 15:42:47.222521+00', NULL, 0, 0, 'individual', '', 0);
INSERT INTO "public"."npc_definitions" ("id", "name", "sprite", "type", "default_state", "created_at", "interaction_mode", "voice_type", "shop_id", "gift_item_id", "gift_quantity", "greeting") VALUES
(7, 'Mision master', '1', 'quest_master', 'idle', '2026-04-24 05:00:55.358413+00', 'hybrid', 'female', NULL, 'bfd1359a-b574-45a1-9b55-adc7330a788f', 1, 'Hi '),
(8, 'comerciante NCP', '1', 'merchant', 'idle', '2026-04-24 05:05:28.662177+00', 'hybrid', 'female', 1, NULL, 0, 'Hey you'),
(9, 'aldeano', '1', 'other', 'idle', '2026-04-24 18:30:09.331976+00', 'hybrid', 'female', NULL, NULL, 0, ''),
(10, 'Aldeano 1', '2', 'other', 'idle', '2026-05-12 02:16:05.265946+00', 'audio_only', 'female', NULL, NULL, 0, ''),
(11, 'Aldeano2', '3', 'other', 'idle', '2026-05-12 02:16:35.942681+00', 'hybrid', 'male', NULL, NULL, 0, ''),
(12, 'Aldeano3', '4', 'other', 'idle', '2026-05-12 02:16:58.473355+00', 'hybrid', 'female', NULL, NULL, 0, '');
INSERT INTO "public"."npc_dialogue_caches" ("id", "npc_template_id", "mission_id", "task_id", "normalized_input", "condition_met", "response_json", "created_at", "updated_at") VALUES
(1, 25, 2, 4, 'hola', 'f', '{"npc_response":"Hello, traveler! As a newcomer, you should learn an informal greeting. Try saying it in English: “Hi”.","npc_response_es":"¡Hola, viajero! Como forastero, debes aprender un saludo informal. Intenta decirlo en inglés: “Hi”.","npc_state":"happy","pronunciation_eval":"good","pronunciation_message":"Nice! You greeted me, but you said it in Spanish. For this quest, say the English greeting “Hi”.","feedback_suggestion":"Say it clearly: “Hi” (one short word).","task_completed":false,"task_progress":"Goal: greet me with “Hi” in English.","is_shop":false,"item_gift":null,"gift_quantity":0}', '2026-05-06 04:58:37.618852+00', '2026-05-06 04:58:37.618852+00'),
(2, 25, 2, 4, 'hi', 't', '{"npc_response":"Ah, perfect! You said “hi” — that’s the informal greeting we use here. Welcome, traveler!","npc_response_es":"¡Ah, perfecto! Dijiste “hi” — ese es el saludo informal que usamos aquí. ¡Bienvenido, viajero!","npc_state":"happy","pronunciation_eval":"excellent","pronunciation_message":"Great job! “Hi” is short and clear—pronunciation was perfect.","feedback_suggestion":"Try using it anytime you meet someone quickly: “Hi!”","task_completed":true,"task_progress":"Great now you learn to say Hi","is_shop":false,"item_gift":null,"gift_quantity":0}', '2026-05-06 04:59:19.109601+00', '2026-05-06 04:59:19.109601+00'),
(3, 25, 2, 4, 'hello', 'f', '{"npc_response":"Hello, traveler! I’m the village aldeano. As a foreigner, you should learn a simple informal greeting: “Hi”. Can you say it for me—just “Hi”?","npc_response_es":"¡Hola, viajero! Soy el aldeano del pueblo. Como forastero, debes aprender un saludo informal y sencillo: “Hi”. ¿Puedes decirlo para mí—solo “Hi”?","npc_state":"waiting","pronunciation_eval":"good","pronunciation_message":"Nice greeting! But for this lesson, I need the informal word: “Hi”.","feedback_suggestion":"Try: Hi (short, one syllable).","task_completed":false,"task_progress":"Say the English greeting “Hi” to complete the task.","is_shop":false,"item_gift":null,"gift_quantity":0}', '2026-05-06 05:14:44.985857+00', '2026-05-06 05:14:44.985857+00'),
(4, 25, 2, 4, 'bye', 't', '{"npc_response":"Oh! Not “Hi,” traveler. As a foreigner, you should try the informal greeting: “Hi.” Can you say exactly “Hi” for me?","npc_response_es":"¡Oh! No es “Hi”, viajero. Como forastero, debes intentar el saludo informal: “Hi”. ¿Puedes decirme exactamente “Hi”?","npc_state":"waiting","pronunciation_eval":"bad","pronunciation_message":"You said “bye,” but the task requires the greeting “Hi.” Try saying “Hi” (no extra words).","feedback_suggestion":"Say: Hi","task_completed":false,"task_progress":"You haven’t said the required English greeting yet. Say “Hi” to complete the task.","is_shop":false,"item_gift":null,"gift_quantity":0}', '2026-05-06 05:15:04.553414+00', '2026-05-06 05:15:04.553414+00'),
(5, 25, 2, 4, 'and', 't', '{"npc_response":"Hi! As a foreigner, you should learn the informal greeting: say exactly “Hi”. You didn’t say it yet—can you try again?","npc_response_es":"¡Hola! Como forastero, debes aprender el saludo informal: di exactamente “Hi”. Aún no lo dijiste—¿puedes intentarlo de nuevo?","npc_state":"waiting","pronunciation_eval":"bad","pronunciation_message":"You didn’t say the word “Hi”. Try saying just: Hi.","feedback_suggestion":"Say exactly: Hi (two letters, no extra words).","task_completed":false,"task_progress":"Need the player to say exactly “Hi” in English.","is_shop":false,"item_gift":null,"gift_quantity":0}', '2026-05-06 05:22:33.932152+00', '2026-05-06 05:22:33.932152+00'),
(6, 24, 2, 5, 'hello', 'f', '{"npc_response":"Hello, stranger! To communicate with the local language, it’s easy to learn greetings. You can say: “Good morning”, “Good afternoon”, and “Good evening”. Try to say all three in English!","npc_response_es":"¡Hola, extraño! Para comunicarte con el idioma local, es fácil aprender saludos. Puedes decir: “Good morning”, “Good afternoon” y “Good evening”. ¡Intenta decir los tres en inglés!","npc_state":"talking","pronunciation_eval":"good","pronunciation_message":"Nice! “Hello” is correct, but for this task you need the three specific greetings: Good morning, Good afternoon, and Good evening.","feedback_suggestion":"Say them in order: “Good morning”, “Good afternoon”, “Good evening”.","task_completed":false,"task_progress":"You said “hello”. Now say all three required greetings in English: Good morning, Good afternoon, Good evening.","is_shop":false,"item_gift":null,"gift_quantity":0}', '2026-05-06 05:23:33.959814+00', '2026-05-06 05:23:33.959814+00'),
(7, 24, 2, 5, 'good morning', 't', '{"npc_response":"Ah, perfect start! You said “Good morning.” Now, you need to learn all three greetings in English: “Good morning”, “Good afternoon”, and “Good evening”. Can you say the other two too?","npc_response_es":"¡Ah, perfecto inicio! Dijiste “Good morning”. Ahora necesitas aprender los tres saludos en inglés: “Good morning”, “Good afternoon” y “Good evening”. ¿Puedes decir los otros dos también?","npc_state":"happy","pronunciation_eval":"excellent","pronunciation_message":"Great job—“Good morning” sounds excellent!","feedback_suggestion":"Say the remaining greetings: “Good afternoon” and “Good evening”.","task_completed":false,"task_progress":"Progress: 1/3 greetings done (Good morning). Need: Good afternoon + Good evening.","is_shop":false,"item_gift":null,"gift_quantity":0}', '2026-05-06 05:23:56.714102+00', '2026-05-06 05:23:56.714102+00'),
(8, 24, 2, 5, 'good afternoon and good evening', 't', '{"npc_response":"Good job! You said “Good afternoon” and “Good evening” correctly. Great, now you know how to greet at any time of the day!","npc_response_es":"¡Bien hecho! Dijiste correctamente “Good afternoon” y “Good evening”. ¡Genial, ahora sabes saludar en cualquier hora del día!","npc_state":"happy","pronunciation_eval":"excellent","pronunciation_message":"Excellent! Your pronunciation is clear for all three greetings.","feedback_suggestion":"Keep practicing with different people and times of day to make it automatic.","task_completed":true,"task_progress":"You said all three greetings in English: Good morning, Good afternoon, and Good evening.","is_shop":false,"item_gift":null,"gift_quantity":0}', '2026-05-06 05:24:20.549146+00', '2026-05-06 05:24:20.549146+00'),
(9, 26, 2, 6, 'hi', 'f', '{"npc_response":"Hey! Nice to meet you. 😊 Try one more: say “Hi,” “Hey,” or “What’s up?” in English.","npc_response_es":"¡Hey! Mucho gusto. 😊 Intenta una más: di “Hi”, “Hey” o “What’s up?” en inglés.","npc_state":"happy","pronunciation_eval":"excellent","pronunciation_message":"Great job! Your “Hi” sounds clear.","feedback_suggestion":"Now say either “Hey” or “What’s up?” in English.","task_completed":false,"task_progress":"You said: Hi. Next: say “Hey” and “What’s up?” (both in English).","is_shop":false,"item_gift":null,"gift_quantity":0}', '2026-05-06 05:24:43.725009+00', '2026-05-06 05:24:43.725009+00'),
(10, 26, 2, 6, 'hi hey whats up', 't', '{"npc_response":"Nice! You said all three: “Hi,” “Hey,” and “What’s up?” 🎉 Perfect job!","npc_response_es":"¡Bien! Dijiste las tres: “Hi”, “Hey” y “What’s up”? 🎉 ¡Trabajo perfecto!","npc_state":"happy","pronunciation_eval":"excellent","pronunciation_message":"Great pronunciation and perfect choice of greetings!","feedback_suggestion":"Awesome—now try using them in a full sentence like: “Hi! What’s up?”","task_completed":true,"task_progress":"Task 6 completed: Saludos informales.","is_shop":false,"item_gift":null,"gift_quantity":0}', '2026-05-06 05:25:03.049639+00', '2026-05-06 05:25:03.049639+00'),
(43, 26, 2, NULL, 'hi', 'f', '{"npc_response":"Hi! Nice to meet you. 😊 What’s up today?","npc_response_es":"¡Hola! Mucho gusto. 😊 ¿Qué tal hoy?","npc_state":"happy","pronunciation_eval":"excellent","pronunciation_message":"Great job! Your “hi” sounds perfect.","feedback_suggestion":"To complete my little greeting challenge, say all three: “Hi,” “Hey,” and “What’s up?”","task_completed":false,"task_progress":"Progress: You said “Hi” ✅ Now say “Hey” and “What’s up?”","is_shop":false,"item_gift":null,"gift_quantity":0,"mission_newly_completed":false}', '2026-05-13 02:33:42.785529+00', '2026-05-13 02:33:42.785529+00'),
(44, 26, 2, NULL, 'i am fine', 'f', '{"npc_response":"Nice! 😊 “I am fine” is totally understandable. A more natural way is: “I’m fine.” So—what’s up with you today?","npc_response_es":"¡Genial! 😊 “I am fine” se entiende perfectamente. Una forma más natural es: “I’m fine”. Entonces—¿qué tal hoy?","npc_state":"happy","pronunciation_eval":"good","pronunciation_message":"Good job! Your message is clear. For English, it’s more natural to say “I’m fine” instead of “I am fine.”","feedback_suggestion":"Try: “I’m fine, thanks!”","task_completed":false,"task_progress":"Not yet. To complete the task, say all three greetings in English: “Hi”, “Hey”, and “What’s up?”.","is_shop":false,"item_gift":null,"gift_quantity":0,"mission_newly_completed":false}', '2026-05-13 02:34:13.034282+00', '2026-05-13 02:34:13.034282+00'),
(45, 24, 2, 5, 'hola', 'f', '{"npc_response":"Hello stranger! To communicate with the local people, you should learn simple greetings. A very easy way is to say: Good morning, Good afternoon, and Good evening. Can you try saying all three in English?","npc_response_es":"¡Hola extraño! Para comunicarte con la gente local, debes aprender saludos sencillos. Una forma fácil es decir: Good morning, Good afternoon y Good evening. ¿Puedes intentarlo diciendo los tres en inglés?","npc_state":"talking","pronunciation_eval":"good","pronunciation_message":"Nice! But for this task, I need the greetings in English: Good morning, Good afternoon, and Good evening.","feedback_suggestion":"Try saying: “Good morning”, then “Good afternoon”, then “Good evening”.","task_completed":false,"task_progress":"You said a greeting, but you still need to say all three: Good morning, Good afternoon, Good evening (in English).","is_shop":false,"item_gift":null,"gift_quantity":0,"mission_newly_completed":false}', '2026-05-13 02:36:50.816359+00', '2026-05-13 02:36:50.816359+00'),
(46, 24, 2, 5, 'good morning good afternoon and good evening', 't', '{"npc_response":"Good job! “Good morning, good afternoon, and good evening” — perfect. Great, now you know how to greet anyone at any time of the day!","npc_response_es":"¡Bien hecho! “Good morning, good afternoon y good evening” — perfecto. ¡Genial, ahora sabes saludar en cualquier hora del día!","npc_state":"happy","pronunciation_eval":"excellent","pronunciation_message":"Excellent! You said all three greetings correctly in English.","feedback_suggestion":"Try using them in a real sentence next: “Good morning! How are you?”","task_completed":true,"task_progress":"You said all three greetings in English: Good morning, Good afternoon, and Good evening.","is_shop":false,"item_gift":null,"gift_quantity":0,"mission_newly_completed":false}', '2026-05-13 02:37:33.771595+00', '2026-05-13 02:37:33.771595+00'),
(47, 26, 2, 6, 'hi', 't', '{"npc_response":"Hi! Nice to meet you. Can you also say: “Hey” and “What’s up?”","npc_response_es":"¡Hola! Mucho gusto. ¿Puedes decir también: “Hey” y “What’s up?”","npc_state":"happy","pronunciation_eval":"excellent","pronunciation_message":"Great! “Hi” sounds clear.","feedback_suggestion":"Try the next two greetings: “Hey” and “What’s up?”","task_completed":false,"task_progress":"You’ve said “Hi”. Now say “Hey” and “What’s up?” in English.","is_shop":false,"item_gift":null,"gift_quantity":0,"mission_newly_completed":false}', '2026-05-13 02:38:03.408+00', '2026-05-13 02:38:03.408+00'),
(48, 26, 2, 6, 'hey whats up', 't', '{"npc_response":"Hey! What’s up! Perfect — you said all three greetings: “Hi,” “Hey,” and “What’s up?” 🎉","npc_response_es":"¡Hey! ¿Qué tal? Perfecto — dijiste las tres formas: “Hi”, “Hey” y “What’s up?” 🎉","npc_state":"happy","pronunciation_eval":"excellent","pronunciation_message":"Great job! Clear and natural pronunciation.","feedback_suggestion":"Nice! Keep practicing with the same rhythm: Hi → Hey → What’s up.","task_completed":true,"task_progress":"Task 6 complete: “Saludos informales” (Hi, Hey, What’s up).","is_shop":false,"item_gift":null,"gift_quantity":0,"mission_newly_completed":false}', '2026-05-13 02:38:17.813038+00', '2026-05-13 02:38:17.813038+00');

INSERT INTO "public"."npc_room_instances" ("id", "room_id", "npc_template_id", "current_state", "task_completed", "updated_at") VALUES
(33, '0fc112f3-9ef9-4024-bafc-7c7ffa3b15b7', 26, 'happy', 'f', '2026-05-13 02:34:13.04299+00'),
(96, 'b1b6dc47-db04-46e3-91ae-258b2af51327', 24, 'happy', 't', '2026-05-06 05:24:20.566158+00'),
(74, 'b206f1fc-ee90-4647-9dc9-b96bafb9cd8c', 24, 'happy', 't', '2026-05-06 04:21:56.96011+00'),
(95, 'b1b6dc47-db04-46e3-91ae-258b2af51327', 26, 'happy', 't', '2026-05-06 05:25:03.076891+00'),
(75, 'b206f1fc-ee90-4647-9dc9-b96bafb9cd8c', 26, 'happy', 't', '2026-05-06 04:26:04.941359+00'),
(77, '012af53b-61da-450f-bff5-c8e02775f99b', 26, 'idle', 'f', '2026-05-06 04:58:21.972365+00'),
(78, '012af53b-61da-450f-bff5-c8e02775f99b', 24, 'idle', 'f', '2026-05-06 04:58:21.97671+00'),
(15, '0fc112f3-9ef9-4024-bafc-7c7ffa3b15b7', 18, 'idle', 'f', '2026-04-24 05:01:21.331779+00'),
(16, '0fc112f3-9ef9-4024-bafc-7c7ffa3b15b7', 19, 'idle', 'f', '2026-04-24 05:05:48.951598+00'),
(22, '01f6fdd9-cfd9-45a6-9952-c7f41bdb2188', 24, 'idle', 'f', '2026-04-28 03:24:50.521539+00'),
(97, '16f81af6-6a1c-4a61-b5db-e89a2af4986f', 25, 'idle', 'f', '2026-05-12 21:55:37.411349+00'),
(23, '90726058-cdd8-4bea-919d-a0d186456e92', 24, 'happy', 't', '2026-04-28 03:31:40.498935+00'),
(21, '0fc112f3-9ef9-4024-bafc-7c7ffa3b15b7', 24, 'happy', 'f', '2026-04-28 03:34:16.899017+00'),
(24, 'cf15e649-42ad-4541-b1d7-4d407befe4db', 24, 'idle', 'f', '2026-05-05 01:22:14.840828+00'),
(25, '25e303f8-61fb-4bf3-b6f7-5d29a00b3361', 24, 'idle', 'f', '2026-05-05 01:23:43.053016+00'),
(26, 'fac01ee1-888a-41a9-9053-6e7fc33becd3', 24, 'happy', 'f', '2026-05-05 01:24:10.74759+00'),
(27, 'ecc9956f-1033-4791-8b71-98c4164c9c14', 24, 'idle', 'f', '2026-05-05 01:24:44.167846+00'),
(28, 'c9ee515a-0a3e-4492-9f1e-f348465f513a', 24, 'idle', 'f', '2026-05-05 01:24:45.137286+00'),
(29, '1b616447-c9e5-4fd1-9887-7746570667c2', 24, 'idle', 'f', '2026-05-05 01:25:05.483578+00'),
(30, '209aa510-3ae4-4c50-b9f8-13f590952f42', 24, 'idle', 'f', '2026-05-05 02:30:53.929604+00'),
(31, '85343db9-74f7-4b44-bba7-140acef2f9ef', 24, 'idle', 'f', '2026-05-05 02:33:53.177183+00'),
(76, '012af53b-61da-450f-bff5-c8e02775f99b', 25, 'happy', 't', '2026-05-06 04:59:19.128483+00'),
(32, '0fc112f3-9ef9-4024-bafc-7c7ffa3b15b7', 25, 'happy', 't', '2026-05-05 03:34:21.577132+00'),
(34, 'f739465d-4079-4a9d-bab2-5a2491f741dd', 26, 'idle', 'f', '2026-05-05 13:41:16.525052+00'),
(35, 'f739465d-4079-4a9d-bab2-5a2491f741dd', 24, 'idle', 'f', '2026-05-05 13:41:16.5358+00'),
(36, 'f739465d-4079-4a9d-bab2-5a2491f741dd', 25, 'idle', 'f', '2026-05-05 13:41:16.541751+00'),
(37, '72cd2a2e-c0f6-406b-a718-5a74d4724989', 26, 'idle', 'f', '2026-05-06 03:15:29.784815+00'),
(38, '72cd2a2e-c0f6-406b-a718-5a74d4724989', 25, 'idle', 'f', '2026-05-06 03:15:29.796656+00'),
(39, '72cd2a2e-c0f6-406b-a718-5a74d4724989', 24, 'idle', 'f', '2026-05-06 03:15:29.802829+00'),
(41, 'd294eb15-2b41-4a33-84c3-089aca3ae681', 24, 'idle', 'f', '2026-05-06 03:28:55.321511+00'),
(42, 'd294eb15-2b41-4a33-84c3-089aca3ae681', 26, 'idle', 'f', '2026-05-06 03:28:55.32622+00'),
(40, 'd294eb15-2b41-4a33-84c3-089aca3ae681', 25, 'waiting', 'f', '2026-05-06 03:29:09.236386+00'),
(43, 'a37384b0-d861-4fad-8a64-34e42f636ff2', 25, 'idle', 'f', '2026-05-06 03:33:09.670828+00'),
(44, 'a37384b0-d861-4fad-8a64-34e42f636ff2', 24, 'idle', 'f', '2026-05-06 03:33:09.68082+00'),
(45, 'a37384b0-d861-4fad-8a64-34e42f636ff2', 26, 'idle', 'f', '2026-05-06 03:33:09.685099+00'),
(47, '66b53b50-5a28-45d5-8167-7aaf3a6ce068', 24, 'idle', 'f', '2026-05-06 03:33:10.889793+00'),
(48, '66b53b50-5a28-45d5-8167-7aaf3a6ce068', 26, 'idle', 'f', '2026-05-06 03:33:10.896106+00'),
(46, '66b53b50-5a28-45d5-8167-7aaf3a6ce068', 25, 'talking', 'f', '2026-05-06 03:33:34.00903+00'),
(49, 'b50bbdc8-7953-44a5-80d4-38f62a465182', 25, 'idle', 'f', '2026-05-06 03:39:58.548881+00'),
(50, 'b50bbdc8-7953-44a5-80d4-38f62a465182', 24, 'idle', 'f', '2026-05-06 03:39:58.558404+00'),
(51, 'b50bbdc8-7953-44a5-80d4-38f62a465182', 26, 'idle', 'f', '2026-05-06 03:39:58.564582+00'),
(53, 'd7956cde-44f8-4bdc-9ac6-fb4b22784ea9', 24, 'idle', 'f', '2026-05-06 03:39:59.517636+00'),
(54, 'd7956cde-44f8-4bdc-9ac6-fb4b22784ea9', 26, 'idle', 'f', '2026-05-06 03:39:59.521436+00'),
(52, 'd7956cde-44f8-4bdc-9ac6-fb4b22784ea9', 25, 'waiting', 'f', '2026-05-06 03:40:15.015788+00'),
(55, 'df5c2fc0-1130-4614-989c-2f1b74155b35', 25, 'idle', 'f', '2026-05-06 03:46:11.911004+00'),
(56, 'df5c2fc0-1130-4614-989c-2f1b74155b35', 24, 'idle', 'f', '2026-05-06 03:46:11.920557+00'),
(57, 'df5c2fc0-1130-4614-989c-2f1b74155b35', 26, 'idle', 'f', '2026-05-06 03:46:11.924293+00'),
(58, 'bb9c85e2-ebb2-4793-87cf-b568fbe8f336', 25, 'idle', 'f', '2026-05-06 03:46:11.926465+00'),
(59, 'bb9c85e2-ebb2-4793-87cf-b568fbe8f336', 24, 'idle', 'f', '2026-05-06 03:46:11.93154+00'),
(60, 'bb9c85e2-ebb2-4793-87cf-b568fbe8f336', 26, 'idle', 'f', '2026-05-06 03:46:11.935803+00'),
(61, 'c8f4491c-5a94-4f3b-9d55-47e9b579fbc0', 25, 'idle', 'f', '2026-05-06 03:46:13.835828+00'),
(62, 'c8f4491c-5a94-4f3b-9d55-47e9b579fbc0', 24, 'idle', 'f', '2026-05-06 03:46:13.841781+00'),
(63, 'c8f4491c-5a94-4f3b-9d55-47e9b579fbc0', 26, 'idle', 'f', '2026-05-06 03:46:13.844517+00'),
(64, 'c4358bbf-b199-40dd-8843-dccebc557dff', 25, 'idle', 'f', '2026-05-06 03:47:57.884441+00'),
(65, 'c4358bbf-b199-40dd-8843-dccebc557dff', 24, 'idle', 'f', '2026-05-06 03:47:57.890973+00'),
(66, 'c4358bbf-b199-40dd-8843-dccebc557dff', 26, 'idle', 'f', '2026-05-06 03:47:57.89634+00'),
(68, '769e5979-4b02-4455-b1da-4c872d2b4ce4', 24, 'idle', 'f', '2026-05-06 04:11:37.615969+00'),
(69, '769e5979-4b02-4455-b1da-4c872d2b4ce4', 26, 'idle', 'f', '2026-05-06 04:11:37.619642+00'),
(79, 'e5c88a8b-c87a-4a33-8afc-adb5967e72ac', 25, 'idle', 'f', '2026-05-06 05:00:01.623308+00'),
(67, '769e5979-4b02-4455-b1da-4c872d2b4ce4', 25, 'happy', 't', '2026-05-06 04:12:43.525191+00'),
(70, '3095d5ef-3d82-4175-954c-f4bae25420b9', 25, 'idle', 'f', '2026-05-06 04:18:54.489614+00'),
(71, '3095d5ef-3d82-4175-954c-f4bae25420b9', 24, 'idle', 'f', '2026-05-06 04:18:54.495026+00'),
(72, '3095d5ef-3d82-4175-954c-f4bae25420b9', 26, 'idle', 'f', '2026-05-06 04:18:54.49864+00'),
(80, 'e5c88a8b-c87a-4a33-8afc-adb5967e72ac', 26, 'idle', 'f', '2026-05-06 05:00:01.627518+00'),
(73, 'b206f1fc-ee90-4647-9dc9-b96bafb9cd8c', 25, 'happy', 't', '2026-05-06 04:19:27.496642+00'),
(81, 'e5c88a8b-c87a-4a33-8afc-adb5967e72ac', 24, 'idle', 'f', '2026-05-06 05:00:01.631328+00'),
(83, '54e17c5f-0471-4133-a966-62b361c0f350', 26, 'idle', 'f', '2026-05-06 05:00:02.750269+00'),
(84, '54e17c5f-0471-4133-a966-62b361c0f350', 24, 'idle', 'f', '2026-05-06 05:00:02.753954+00'),
(98, '16f81af6-6a1c-4a61-b5db-e89a2af4986f', 26, 'idle', 'f', '2026-05-12 21:55:37.426287+00'),
(82, '54e17c5f-0471-4133-a966-62b361c0f350', 25, 'happy', 't', '2026-05-06 05:00:26.379708+00'),
(85, '511ead0d-7706-442a-84f2-22541437b8f2', 25, 'idle', 'f', '2026-05-06 05:01:47.888911+00'),
(86, '511ead0d-7706-442a-84f2-22541437b8f2', 26, 'idle', 'f', '2026-05-06 05:01:47.895622+00'),
(87, '511ead0d-7706-442a-84f2-22541437b8f2', 24, 'idle', 'f', '2026-05-06 05:01:47.899376+00'),
(88, '8caa7616-0230-4544-bd88-bc8c6c73c4ea', 25, 'idle', 'f', '2026-05-06 05:08:43.018343+00'),
(89, '8caa7616-0230-4544-bd88-bc8c6c73c4ea', 26, 'idle', 'f', '2026-05-06 05:08:43.026839+00'),
(90, '8caa7616-0230-4544-bd88-bc8c6c73c4ea', 24, 'idle', 'f', '2026-05-06 05:08:43.03025+00'),
(92, 'b1072a52-9273-4210-a731-a5a76e82b017', 26, 'idle', 'f', '2026-05-06 05:14:22.11467+00'),
(93, 'b1072a52-9273-4210-a731-a5a76e82b017', 24, 'idle', 'f', '2026-05-06 05:14:22.120738+00'),
(99, '16f81af6-6a1c-4a61-b5db-e89a2af4986f', 24, 'idle', 'f', '2026-05-12 21:55:37.433419+00'),
(100, '7e729cae-75de-4593-b3be-24e06c44e1bf', 25, 'idle', 'f', '2026-05-13 02:07:57.001849+00'),
(91, 'b1072a52-9273-4210-a731-a5a76e82b017', 25, 'happy', 't', '2026-05-06 05:15:19.542117+00'),
(101, '7e729cae-75de-4593-b3be-24e06c44e1bf', 26, 'idle', 'f', '2026-05-13 02:07:57.012917+00'),
(102, '7e729cae-75de-4593-b3be-24e06c44e1bf', 24, 'idle', 'f', '2026-05-13 02:07:57.01726+00'),
(103, '59d848ea-c83c-4449-aa60-560a8e1c9995', 25, 'idle', 'f', '2026-05-13 02:09:47.270528+00'),
(94, 'b1b6dc47-db04-46e3-91ae-258b2af51327', 25, 'happy', 't', '2026-05-06 05:22:53.053806+00'),
(104, '59d848ea-c83c-4449-aa60-560a8e1c9995', 26, 'idle', 'f', '2026-05-13 02:09:47.279098+00'),
(105, '59d848ea-c83c-4449-aa60-560a8e1c9995', 24, 'idle', 'f', '2026-05-13 02:09:47.282829+00'),
(106, 'fba1c1a7-50c3-41bc-b2a2-e51da21b50f4', 25, 'idle', 'f', '2026-05-13 02:22:53.304349+00'),
(107, 'fba1c1a7-50c3-41bc-b2a2-e51da21b50f4', 26, 'idle', 'f', '2026-05-13 02:22:53.311305+00'),
(108, 'fba1c1a7-50c3-41bc-b2a2-e51da21b50f4', 24, 'idle', 'f', '2026-05-13 02:22:53.316151+00'),
(109, '6720290e-fe21-4238-86c7-7caf80e2e8df', 25, 'happy', 't', '2026-05-13 02:36:17.641788+00'),
(110, '6720290e-fe21-4238-86c7-7caf80e2e8df', 24, 'happy', 't', '2026-05-13 02:37:33.788586+00'),
(111, '6720290e-fe21-4238-86c7-7caf80e2e8df', 26, 'happy', 't', '2026-05-13 02:38:17.840032+00'),
(114, '86b06838-44cb-496d-8bf7-9d1c433b7a42', 18, 'idle', 'f', '2026-05-13 02:38:38.36004+00'),
(112, 'c9bbdca2-3449-44de-8b57-8c0716748650', 18, 'idle', 'f', '2026-05-13 02:38:22.225884+00'),
(113, 'c9bbdca2-3449-44de-8b57-8c0716748650', 19, 'idle', 'f', '2026-05-13 02:38:22.233382+00'),
(115, '86b06838-44cb-496d-8bf7-9d1c433b7a42', 19, 'idle', 'f', '2026-05-13 02:38:38.370295+00'),
(116, '07c2f9bb-84f4-4a09-b74d-fd8c66ebcdd6', 25, 'idle', 'f', '2026-05-13 02:53:20.457377+00'),
(117, '07c2f9bb-84f4-4a09-b74d-fd8c66ebcdd6', 24, 'idle', 'f', '2026-05-13 02:53:22.438974+00'),
(118, '07c2f9bb-84f4-4a09-b74d-fd8c66ebcdd6', 26, 'idle', 'f', '2026-05-13 02:53:23.308875+00'),
(119, '736a35dc-d8c4-4af1-bae6-4f960aee1c11', 25, 'idle', 'f', '2026-05-15 03:31:41.594557+00'),
(120, '736a35dc-d8c4-4af1-bae6-4f960aee1c11', 24, 'idle', 'f', '2026-05-15 03:31:41.605543+00'),
(121, '736a35dc-d8c4-4af1-bae6-4f960aee1c11', 26, 'idle', 'f', '2026-05-15 03:31:41.611912+00'),
(122, '7190150d-54bf-44c9-80f6-56c82ccde01e', 25, 'idle', 'f', '2026-05-15 03:31:44.251307+00'),
(123, '7190150d-54bf-44c9-80f6-56c82ccde01e', 24, 'idle', 'f', '2026-05-15 03:31:44.261537+00'),
(124, '7190150d-54bf-44c9-80f6-56c82ccde01e', 26, 'idle', 'f', '2026-05-15 03:31:44.268496+00'),
(125, 'e752af35-a076-4cb9-a0a9-d02139603aac', 18, 'idle', 'f', '2026-05-15 17:10:17.827665+00'),
(126, 'e752af35-a076-4cb9-a0a9-d02139603aac', 19, 'idle', 'f', '2026-05-15 17:10:17.840708+00'),
(127, 'e94e8b3c-a75e-40c5-98b5-1499e1dee1fa', 18, 'idle', 'f', '2026-05-20 02:06:09.481042+00'),
(128, 'e94e8b3c-a75e-40c5-98b5-1499e1dee1fa', 19, 'idle', 'f', '2026-05-20 02:06:09.492027+00'),
(129, '5ed5b028-6a83-4e1a-b9bb-3f0721e06933', 18, 'idle', 'f', '2026-05-20 02:16:12.087459+00'),
(130, '5ed5b028-6a83-4e1a-b9bb-3f0721e06933', 19, 'idle', 'f', '2026-05-20 02:16:12.097507+00'),
(131, 'fa85e37a-d063-4a84-967d-7357995d1768', 18, 'idle', 'f', '2026-05-20 02:16:20.809591+00'),
(132, 'fa85e37a-d063-4a84-967d-7357995d1768', 19, 'idle', 'f', '2026-05-20 02:16:20.814007+00'),
(133, 'dee2edb8-d934-4276-a3f8-b9cef50f40cf', 18, 'idle', 'f', '2026-05-20 02:27:32.714106+00'),
(134, 'dee2edb8-d934-4276-a3f8-b9cef50f40cf', 19, 'idle', 'f', '2026-05-20 02:27:32.7211+00'),
(135, '10325bc8-441c-49a6-8f17-7c43b57e5b6b', 18, 'idle', 'f', '2026-05-20 02:29:18.417362+00'),
(136, '10325bc8-441c-49a6-8f17-7c43b57e5b6b', 19, 'idle', 'f', '2026-05-20 02:29:18.428035+00'),
(137, '0cb7f505-ecb2-44bb-bdc8-df3b4bd26670', 18, 'idle', 'f', '2026-05-20 02:48:36.866573+00'),
(138, '0cb7f505-ecb2-44bb-bdc8-df3b4bd26670', 19, 'idle', 'f', '2026-05-20 02:48:36.874657+00'),
(139, 'a763eb17-92d9-43a6-8f8c-ebefec51a81f', 18, 'idle', 'f', '2026-05-20 02:51:28.818719+00'),
(140, 'a763eb17-92d9-43a6-8f8c-ebefec51a81f', 19, 'idle', 'f', '2026-05-20 02:51:28.827874+00'),
(141, '7a58427f-f8b0-461d-8441-a14bf96661e0', 18, 'idle', 'f', '2026-05-20 03:00:23.73537+00'),
(142, '7a58427f-f8b0-461d-8441-a14bf96661e0', 19, 'idle', 'f', '2026-05-20 03:00:23.744049+00'),
(143, 'a34916db-4a95-4f7b-81cb-f4f0b56ba295', 18, 'idle', 'f', '2026-05-20 03:01:34.057173+00'),
(144, 'a34916db-4a95-4f7b-81cb-f4f0b56ba295', 19, 'idle', 'f', '2026-05-20 03:01:34.067052+00'),
(145, 'bff2a55a-e5b1-4b18-95e1-26a074b7109e', 18, 'idle', 'f', '2026-05-20 12:46:07.104256+00'),
(146, 'bff2a55a-e5b1-4b18-95e1-26a074b7109e', 19, 'idle', 'f', '2026-05-20 12:46:07.116431+00'),
(147, '222276a9-bbae-4f12-9fa5-e9cf71f772f9', 18, 'idle', 'f', '2026-05-20 19:46:49.835886+00'),
(148, '222276a9-bbae-4f12-9fa5-e9cf71f772f9', 19, 'idle', 'f', '2026-05-20 19:46:49.849691+00'),
(149, '9250d685-79b2-4c71-a881-0174b663a9bb', 18, 'idle', 'f', '2026-05-20 19:47:13.818017+00'),
(150, '9250d685-79b2-4c71-a881-0174b663a9bb', 19, 'idle', 'f', '2026-05-20 19:47:13.829525+00'),
(151, '8e88bb0b-14b8-4d6d-8829-5eef76901736', 18, 'idle', 'f', '2026-05-20 19:48:30.359558+00'),
(152, '8e88bb0b-14b8-4d6d-8829-5eef76901736', 19, 'idle', 'f', '2026-05-20 19:48:30.366669+00'),
(153, '47c039d6-aac9-4585-953f-084da486ffcf', 18, 'idle', 'f', '2026-05-20 20:33:20.493569+00'),
(154, '47c039d6-aac9-4585-953f-084da486ffcf', 19, 'idle', 'f', '2026-05-20 20:33:20.511436+00'),
(155, 'b348fa28-a4be-4dcc-a67d-7bbf5778c6b3', 18, 'idle', 'f', '2026-05-20 21:55:05.25985+00'),
(156, 'b348fa28-a4be-4dcc-a67d-7bbf5778c6b3', 19, 'idle', 'f', '2026-05-20 21:55:05.267955+00'),
(157, '510c41ca-5ebc-4caa-84c3-882b73ed3640', 18, 'idle', 'f', '2026-05-21 02:52:17.364254+00'),
(158, '510c41ca-5ebc-4caa-84c3-882b73ed3640', 19, 'idle', 'f', '2026-05-21 02:52:17.37875+00'),
(159, '04958b0f-8a24-4691-822e-8dea9ea9617a', 18, 'idle', 'f', '2026-05-21 02:52:40.702918+00'),
(160, '04958b0f-8a24-4691-822e-8dea9ea9617a', 19, 'idle', 'f', '2026-05-21 02:52:40.712835+00'),
(161, '70ce1b95-01f4-42ac-abc5-38d0e54828dd', 18, 'idle', 'f', '2026-05-21 02:53:38.037029+00'),
(162, '70ce1b95-01f4-42ac-abc5-38d0e54828dd', 19, 'idle', 'f', '2026-05-21 02:53:38.048603+00'),
(163, '4443c446-60ae-46c8-8e0a-f5292b63d9af', 18, 'idle', 'f', '2026-05-21 02:54:13.144614+00'),
(164, '4443c446-60ae-46c8-8e0a-f5292b63d9af', 19, 'idle', 'f', '2026-05-21 02:54:13.150521+00'),
(165, '8105731d-27c6-4913-ac99-8399273cf410', 18, 'idle', 'f', '2026-05-21 04:21:50.568026+00'),
(166, '8105731d-27c6-4913-ac99-8399273cf410', 19, 'idle', 'f', '2026-05-21 04:21:50.580035+00'),
(167, 'f13d4015-bfdc-4816-9906-955c9672e3aa', 18, 'idle', 'f', '2026-05-21 04:22:26.142964+00'),
(168, 'f13d4015-bfdc-4816-9906-955c9672e3aa', 19, 'idle', 'f', '2026-05-21 04:22:26.15212+00'),
(169, '5280ede4-34e6-4433-a014-aabfb9fa0ac3', 18, 'idle', 'f', '2026-05-21 17:38:12.171684+00'),
(170, '5280ede4-34e6-4433-a014-aabfb9fa0ac3', 19, 'idle', 'f', '2026-05-21 17:38:12.187348+00');
INSERT INTO "public"."npc_templates" ("id", "scene_key", "npc_definition_id", "position_x", "position_y", "facing_direction", "interaction_radius", "created_at", "movement_type", "movement_range", "movement_speed", "instructions", "success_message", "greeting") VALUES
(25, 'greeting village', 9, 350, 250, 'south', 64, '2026-05-05 03:02:44.258921+00', 'static', 0, 50, 'Saluda al Jugador en español, En tu rol de aldeano dile que como forastero debe aprender a saludar, una manera informal es usando Hi, el usuario debe intentarlo, si lo hace bien se da como cumplido el proposito para este NPC', 'Great now you learn to say Hi', 'Hello stranger!'),
(24, 'greeting village', 9, 50, 350, 'south', 64, '2026-04-24 18:45:26.26899+00', 'static', 0, 50, 'Explicar en español al jugador primero saludo como Hola extraño, luego dile que debe aprender a comunicarse con el lenguaje local que una forma facil de saludar es diciendo Good morning, Good afternoon, good Evening  y que lo intente solo si dice las 3 saludos puede cumplir la tarea', 'Great, ahora sabes saludar en cualquier hora del dia', 'Hello '),
(26, 'greeting village', 9, 350, 450, 'south', 64, '2026-05-05 03:03:04.799202+00', 'static', 0, 50, 'Learn to communicate in the local language, that an easy way to greet is by saying "Hi," "Hey," or "What''s up?" and that they should try it; only if they say all three greetings can they complete the task.', 'Hey you did it', 'Hi you'),
(18, 'lobby', 7, 150, 350, 'south', 64, '2026-04-24 05:01:16.124497+00', 'static', 0, 50, '', '', ''),
(19, 'lobby', 8, 150, 550, 'south', 64, '2026-04-24 05:05:43.82035+00', 'static', 0, 50, '', '', '');


INSERT INTO "public"."player_mission_progresses" ("id", "player_id", "mission_id", "room_id", "status", "tasks_completed", "started_at", "completed_at", "kill_counts") VALUES
(1, '36815b68-5a9b-4eaa-8c62-33d2af011d7a', 1, NULL, 'not_started', '{}', '2026-04-24 03:17:39.777597+00', NULL, NULL),
(2, '36815b68-5a9b-4eaa-8c62-33d2af011d7a', 2, NULL, 'completed', '{"1": true}', '2026-04-24 18:33:25.13261+00', '2026-04-28 03:31:40.463797+00', NULL),
(3, 'e6c2c30d-fa0c-4013-b784-08c9719edd7b', 1, NULL, 'not_started', '{}', '2026-05-05 01:23:37.71365+00', NULL, NULL),
(4, 'e6c2c30d-fa0c-4013-b784-08c9719edd7b', 2, NULL, 'not_started', '{}', '2026-05-05 01:23:37.736359+00', NULL, NULL),
(5, 'f2942d3c-cc72-46d5-bfae-a3ff6757ef40', 1, NULL, 'not_started', '{}', '2026-05-05 02:33:48.206117+00', NULL, NULL),
(6, 'f2942d3c-cc72-46d5-bfae-a3ff6757ef40', 2, NULL, 'completed', '{"4": true}', '2026-05-05 02:33:48.220128+00', '2026-05-05 03:34:21.539687+00', NULL),
(7, 'c3e477b2-f29f-4d60-a93f-c32823fa6adb', 1, NULL, 'not_started', '{}', '2026-05-05 13:40:41.780256+00', NULL, NULL),
(8, 'c3e477b2-f29f-4d60-a93f-c32823fa6adb', 2, NULL, 'not_started', '{}', '2026-05-05 13:40:41.794343+00', NULL, NULL),
(9, '8138478e-5e31-447e-b29a-9adccbf5bfcb', 1, NULL, 'not_started', '{}', '2026-05-06 03:15:23.563817+00', NULL, NULL),
(10, '8138478e-5e31-447e-b29a-9adccbf5bfcb', 2, NULL, 'not_started', '{}', '2026-05-06 03:15:23.577948+00', NULL, NULL),
(11, 'c9f91b14-d48e-470b-8dd3-1ad90203704a', 1, NULL, 'not_started', '{}', '2026-05-06 03:28:50.172488+00', NULL, NULL),
(12, 'c9f91b14-d48e-470b-8dd3-1ad90203704a', 2, NULL, 'not_started', '{}', '2026-05-06 03:28:50.184402+00', NULL, NULL),
(13, '6f272f33-616c-4410-b5f5-be46619911f9', 1, NULL, 'not_started', '{}', '2026-05-06 03:33:05.354791+00', NULL, NULL),
(14, '6f272f33-616c-4410-b5f5-be46619911f9', 2, NULL, 'not_started', '{}', '2026-05-06 03:33:05.367786+00', NULL, NULL),
(15, '2a2acf1b-6654-45c0-9f4f-30f3abcfeb03', 1, NULL, 'not_started', '{}', '2026-05-06 03:39:54.163403+00', NULL, NULL),
(16, '2a2acf1b-6654-45c0-9f4f-30f3abcfeb03', 2, NULL, 'not_started', '{}', '2026-05-06 03:39:54.176268+00', NULL, NULL),
(17, '01ef31f7-3978-4fa2-bbf7-a37ba759a299', 1, NULL, 'not_started', '{}', '2026-05-06 03:46:05.294612+00', NULL, NULL),
(18, '01ef31f7-3978-4fa2-bbf7-a37ba759a299', 2, NULL, 'not_started', '{}', '2026-05-06 03:46:05.308757+00', NULL, NULL),
(19, '471dd84c-9b13-4991-bd25-6c18f66a6d50', 1, NULL, 'not_started', '{}', '2026-05-06 03:47:53.087211+00', NULL, NULL),
(20, '471dd84c-9b13-4991-bd25-6c18f66a6d50', 2, NULL, 'not_started', '{}', '2026-05-06 03:47:53.100348+00', NULL, NULL),
(21, '41b2c4f7-667c-4754-9609-80628f7dcdad', 1, NULL, 'not_started', '{}', '2026-05-06 04:11:33.572924+00', NULL, NULL),
(22, '41b2c4f7-667c-4754-9609-80628f7dcdad', 2, NULL, 'in_progress', '{"4": true}', '2026-05-06 04:11:33.580978+00', NULL, NULL),
(23, '21c1c3f2-3710-4895-a5fc-b454a09370ee', 1, NULL, 'not_started', '{}', '2026-05-06 04:18:43.162673+00', NULL, NULL),
(71, '0b105701-7387-4023-953e-e5b25f48e5f1', 3, NULL, 'not_started', '{}', '2026-05-20 01:31:01.336389+00', NULL, NULL),
(72, 'beb5f06e-fb4b-4468-b447-0184f7159580', 3, NULL, 'not_started', '{}', '2026-05-20 01:32:28.798607+00', NULL, NULL),
(24, '21c1c3f2-3710-4895-a5fc-b454a09370ee', 2, NULL, 'completed', '{"4": true, "5": true, "6": true}', '2026-05-06 04:18:43.176269+00', '2026-05-06 04:26:04.924017+00', NULL),
(25, '02ee5138-4aa4-4a3b-89f7-166ef9b8e614', 1, NULL, 'not_started', '{}', '2026-05-06 04:58:17.231682+00', NULL, NULL),
(26, '02ee5138-4aa4-4a3b-89f7-166ef9b8e614', 2, NULL, 'in_progress', '{"4": true}', '2026-05-06 04:58:17.243166+00', NULL, NULL),
(27, '503e7441-fa60-48bb-95b6-5c0a0244ddc9', 1, NULL, 'not_started', '{}', '2026-05-06 04:59:57.168293+00', NULL, NULL),
(28, '503e7441-fa60-48bb-95b6-5c0a0244ddc9', 2, NULL, 'in_progress', '{"4": true}', '2026-05-06 04:59:57.17917+00', NULL, NULL),
(29, 'd29b73fc-8a49-437c-acb6-d3269a700768', 1, NULL, 'not_started', '{}', '2026-05-06 05:01:42.945437+00', NULL, NULL),
(30, 'd29b73fc-8a49-437c-acb6-d3269a700768', 2, NULL, 'not_started', '{}', '2026-05-06 05:01:42.956149+00', NULL, NULL),
(31, 'fc3df20e-d3a2-49e4-ba43-66baf832dd5e', 1, NULL, 'not_started', '{}', '2026-05-06 05:08:38.648462+00', NULL, NULL),
(32, 'fc3df20e-d3a2-49e4-ba43-66baf832dd5e', 2, NULL, 'not_started', '{}', '2026-05-06 05:08:38.659614+00', NULL, NULL),
(33, '082e23ad-fb98-4344-af9a-04fa0863a736', 1, NULL, 'not_started', '{}', '2026-05-06 05:14:17.234832+00', NULL, NULL),
(34, '082e23ad-fb98-4344-af9a-04fa0863a736', 2, NULL, 'in_progress', '{"4": true}', '2026-05-06 05:14:17.247963+00', NULL, NULL),
(35, '28faaa00-e5ea-4975-a28d-69ec0c997a38', 1, NULL, 'not_started', '{}', '2026-05-06 05:21:30.474708+00', NULL, NULL),
(73, 'beb5f06e-fb4b-4468-b447-0184f7159580', 1, NULL, 'not_started', '{}', '2026-05-20 01:32:36.843973+00', NULL, NULL),
(74, 'beb5f06e-fb4b-4468-b447-0184f7159580', 2, NULL, 'not_started', '{}', '2026-05-20 01:32:36.854423+00', NULL, NULL),
(36, '28faaa00-e5ea-4975-a28d-69ec0c997a38', 2, NULL, 'completed', '{"4": true, "5": true, "6": true}', '2026-05-06 05:21:30.486073+00', '2026-05-06 05:25:03.058857+00', NULL),
(37, '7e90e84c-c22d-47d8-85b7-945fe9bdb873', 1, NULL, 'not_started', '{}', '2026-05-12 21:52:33.815733+00', NULL, NULL),
(38, '7e90e84c-c22d-47d8-85b7-945fe9bdb873', 2, NULL, 'not_started', '{}', '2026-05-12 21:52:33.835471+00', NULL, NULL),
(39, 'b418dbdf-8346-4243-a1ca-bb9fdb02e97f', 1, NULL, 'not_started', '{}', '2026-05-13 02:04:52.945927+00', NULL, NULL),
(75, '3ce5b420-931a-4e9f-91d3-101eb5f56af5', 1, NULL, 'not_started', '{}', '2026-05-20 02:15:34.19545+00', NULL, NULL),
(76, '3ce5b420-931a-4e9f-91d3-101eb5f56af5', 2, NULL, 'not_started', '{}', '2026-05-20 02:15:34.206836+00', NULL, NULL),
(40, 'b418dbdf-8346-4243-a1ca-bb9fdb02e97f', 2, NULL, 'completed', '{"4": true, "5": true, "6": true}', '2026-05-13 02:04:52.965966+00', '2026-05-13 02:38:17.820386+00', NULL),
(41, '36815b68-5a9b-4eaa-8c62-33d2af011d7a', 3, NULL, 'not_started', '{}', '2026-05-14 15:43:27.832073+00', NULL, NULL),
(42, '78ff274b-244a-49e3-ab7a-9a5504168b8e', 1, NULL, 'not_started', '{}', '2026-05-15 02:50:27.516164+00', NULL, NULL),
(43, '78ff274b-244a-49e3-ab7a-9a5504168b8e', 2, NULL, 'not_started', '{}', '2026-05-15 02:50:27.526409+00', NULL, NULL),
(44, '78ff274b-244a-49e3-ab7a-9a5504168b8e', 3, NULL, 'not_started', '{}', '2026-05-15 02:50:27.5349+00', NULL, NULL),
(45, 'a36038a1-14fd-489b-bf12-35e9c4e095f2', 1, NULL, 'not_started', '{}', '2026-05-15 03:35:53.453075+00', NULL, NULL),
(46, 'a36038a1-14fd-489b-bf12-35e9c4e095f2', 2, NULL, 'not_started', '{}', '2026-05-15 03:35:53.464178+00', NULL, NULL),
(47, 'a36038a1-14fd-489b-bf12-35e9c4e095f2', 3, NULL, 'not_started', '{}', '2026-05-15 03:35:53.471188+00', NULL, NULL),
(48, '9267999c-5078-4d68-93c4-5c4f9a2ce50f', 1, NULL, 'not_started', '{}', '2026-05-15 03:47:23.671761+00', NULL, NULL),
(49, '9267999c-5078-4d68-93c4-5c4f9a2ce50f', 2, NULL, 'not_started', '{}', '2026-05-15 03:47:23.684462+00', NULL, NULL),
(50, '9267999c-5078-4d68-93c4-5c4f9a2ce50f', 3, NULL, 'not_started', '{}', '2026-05-15 03:47:23.691043+00', NULL, NULL),
(51, '7a8ec061-9d96-49cb-8531-41ca6a44396a', 1, NULL, 'not_started', '{}', '2026-05-15 14:09:13.499791+00', NULL, NULL),
(52, '7a8ec061-9d96-49cb-8531-41ca6a44396a', 2, NULL, 'not_started', '{}', '2026-05-15 14:09:13.512459+00', NULL, NULL),
(53, '7a8ec061-9d96-49cb-8531-41ca6a44396a', 3, NULL, 'not_started', '{}', '2026-05-15 14:09:13.519623+00', NULL, NULL),
(54, 'd4652907-a3cc-4982-bbcb-e579974f377c', 1, NULL, 'not_started', '{}', '2026-05-15 16:58:11.752209+00', NULL, NULL),
(55, 'd4652907-a3cc-4982-bbcb-e579974f377c', 2, NULL, 'not_started', '{}', '2026-05-15 16:58:11.761228+00', NULL, NULL),
(56, 'd4652907-a3cc-4982-bbcb-e579974f377c', 3, NULL, 'not_started', '{}', '2026-05-15 16:58:11.768116+00', NULL, NULL),
(57, '3ab95f8e-067b-448d-9a1b-eae0dad715a4', 1, NULL, 'not_started', '{}', '2026-05-20 00:14:00.504099+00', NULL, NULL),
(58, '3ab95f8e-067b-448d-9a1b-eae0dad715a4', 2, NULL, 'not_started', '{}', '2026-05-20 00:14:00.515989+00', NULL, NULL),
(59, '3ab95f8e-067b-448d-9a1b-eae0dad715a4', 3, NULL, 'not_started', '{}', '2026-05-20 00:14:00.522866+00', NULL, NULL),
(60, 'da4cd88e-eabb-4a5c-8b4b-32f5ba98ea1d', 1, NULL, 'not_started', '{}', '2026-05-20 00:21:41.448784+00', NULL, NULL),
(61, 'da4cd88e-eabb-4a5c-8b4b-32f5ba98ea1d', 2, NULL, 'not_started', '{}', '2026-05-20 00:21:41.733233+00', NULL, NULL),
(62, 'da4cd88e-eabb-4a5c-8b4b-32f5ba98ea1d', 3, NULL, 'not_started', '{}', '2026-05-20 00:21:41.740456+00', NULL, NULL),
(63, 'a68ceb5f-3ec5-44a5-8295-5c9c1be21466', 1, NULL, 'not_started', '{}', '2026-05-20 01:01:48.440285+00', NULL, NULL),
(64, 'a68ceb5f-3ec5-44a5-8295-5c9c1be21466', 2, NULL, 'not_started', '{}', '2026-05-20 01:01:48.449432+00', NULL, NULL),
(65, 'a68ceb5f-3ec5-44a5-8295-5c9c1be21466', 3, NULL, 'not_started', '{}', '2026-05-20 01:01:48.456821+00', NULL, NULL),
(66, '7e712c0b-79b2-4d53-8237-36d2d88b98d7', 1, NULL, 'not_started', '{}', '2026-05-20 01:29:09.97132+00', NULL, NULL),
(67, '7e712c0b-79b2-4d53-8237-36d2d88b98d7', 2, NULL, 'not_started', '{}', '2026-05-20 01:29:09.984491+00', NULL, NULL),
(68, '7e712c0b-79b2-4d53-8237-36d2d88b98d7', 3, NULL, 'not_started', '{}', '2026-05-20 01:29:09.992752+00', NULL, NULL),
(69, '0b105701-7387-4023-953e-e5b25f48e5f1', 1, NULL, 'not_started', '{}', '2026-05-20 01:31:01.32036+00', NULL, NULL),
(70, '0b105701-7387-4023-953e-e5b25f48e5f1', 2, NULL, 'not_started', '{}', '2026-05-20 01:31:01.328386+00', NULL, NULL),
(77, '3ce5b420-931a-4e9f-91d3-101eb5f56af5', 3, NULL, 'not_started', '{}', '2026-05-20 02:15:34.215742+00', NULL, NULL),
(78, '3e30b0c3-358b-41f8-9eca-849ce5812ccd', 1, NULL, 'not_started', '{}', '2026-05-20 02:15:46.366013+00', NULL, NULL),
(79, '3e30b0c3-358b-41f8-9eca-849ce5812ccd', 2, NULL, 'not_started', '{}', '2026-05-20 02:15:46.379647+00', NULL, NULL),
(80, '3e30b0c3-358b-41f8-9eca-849ce5812ccd', 3, NULL, 'not_started', '{}', '2026-05-20 02:15:46.387289+00', NULL, NULL),
(81, 'f16616c4-22de-402c-babf-d699bc7253ef', 1, NULL, 'not_started', '{}', '2026-05-20 02:26:54.499754+00', NULL, NULL),
(82, 'f16616c4-22de-402c-babf-d699bc7253ef', 2, NULL, 'not_started', '{}', '2026-05-20 02:26:54.511732+00', NULL, NULL),
(83, 'f16616c4-22de-402c-babf-d699bc7253ef', 3, NULL, 'not_started', '{}', '2026-05-20 02:26:54.521082+00', NULL, NULL),
(84, 'cc4c480f-bad9-4977-b452-7d9bbf3dd416', 1, NULL, 'not_started', '{}', '2026-05-20 02:28:31.70368+00', NULL, NULL),
(85, 'cc4c480f-bad9-4977-b452-7d9bbf3dd416', 2, NULL, 'not_started', '{}', '2026-05-20 02:28:31.713887+00', NULL, NULL),
(86, 'cc4c480f-bad9-4977-b452-7d9bbf3dd416', 3, NULL, 'not_started', '{}', '2026-05-20 02:28:31.720734+00', NULL, NULL),
(87, 'ea85a374-daf0-4f3a-8122-381dcc2fe940', 1, NULL, 'not_started', '{}', '2026-05-20 02:48:07.332164+00', NULL, NULL),
(88, 'ea85a374-daf0-4f3a-8122-381dcc2fe940', 2, NULL, 'not_started', '{}', '2026-05-20 02:48:07.346702+00', NULL, NULL),
(89, 'ea85a374-daf0-4f3a-8122-381dcc2fe940', 3, NULL, 'not_started', '{}', '2026-05-20 02:48:07.354715+00', NULL, NULL),
(90, 'bf4aff77-a79c-4974-a75f-b91d116f6ea1', 1, NULL, 'not_started', '{}', '2026-05-20 12:42:58.404504+00', NULL, NULL),
(91, 'bf4aff77-a79c-4974-a75f-b91d116f6ea1', 2, NULL, 'not_started', '{}', '2026-05-20 12:42:58.420651+00', NULL, NULL),
(92, 'bf4aff77-a79c-4974-a75f-b91d116f6ea1', 3, NULL, 'not_started', '{}', '2026-05-20 12:42:58.429253+00', NULL, NULL),
(93, '8a848c84-7125-4ec7-b9ba-6e007a7abcf7', 1, NULL, 'not_started', '{}', '2026-05-20 19:45:47.24273+00', NULL, NULL),
(94, '8a848c84-7125-4ec7-b9ba-6e007a7abcf7', 2, NULL, 'not_started', '{}', '2026-05-20 19:45:47.261299+00', NULL, NULL),
(95, '8a848c84-7125-4ec7-b9ba-6e007a7abcf7', 3, NULL, 'not_started', '{}', '2026-05-20 19:45:47.280852+00', NULL, NULL),
(96, 'c623cd1d-ea5f-4227-819f-be38161adef5', 1, NULL, 'not_started', '{}', '2026-05-20 20:32:39.686386+00', NULL, NULL),
(97, 'c623cd1d-ea5f-4227-819f-be38161adef5', 2, NULL, 'not_started', '{}', '2026-05-20 20:32:39.704234+00', NULL, NULL),
(98, 'c623cd1d-ea5f-4227-819f-be38161adef5', 3, NULL, 'completed', '{"7": true}', '2026-05-20 20:32:39.715738+00', '2026-05-20 21:55:00.881797+00', NULL),
(99, '5805b78d-86e7-464c-a6c6-d53fa063608a', 1, NULL, 'not_started', '{}', '2026-05-21 02:52:00.287073+00', NULL, NULL),
(100, '5805b78d-86e7-464c-a6c6-d53fa063608a', 2, NULL, 'not_started', '{}', '2026-05-21 02:52:00.410932+00', NULL, NULL),
(101, '5805b78d-86e7-464c-a6c6-d53fa063608a', 3, NULL, 'completed', '{"7": true}', '2026-05-21 02:52:00.570227+00', '2026-05-21 02:53:33.641133+00', NULL),
(102, '75191c20-9775-4354-a53b-3394efb5c674', 1, NULL, 'not_started', '{}', '2026-05-21 14:24:48.720422+00', NULL, NULL),
(103, '75191c20-9775-4354-a53b-3394efb5c674', 2, NULL, 'not_started', '{}', '2026-05-21 14:24:48.735194+00', NULL, NULL),
(104, '75191c20-9775-4354-a53b-3394efb5c674', 3, NULL, 'not_started', '{}', '2026-05-21 14:24:48.742689+00', NULL, NULL),
(105, '56b22b35-852d-46de-a225-19f446967cdd', 1, NULL, 'not_started', '{}', '2026-05-21 17:23:28.81172+00', NULL, NULL),
(106, '56b22b35-852d-46de-a225-19f446967cdd', 2, NULL, 'not_started', '{}', '2026-05-21 17:23:28.825443+00', NULL, NULL),
(107, '56b22b35-852d-46de-a225-19f446967cdd', 3, NULL, 'not_started', '{}', '2026-05-21 17:23:28.833704+00', NULL, NULL),
(108, 'e92d94e5-332a-48c3-9de2-62e4ffce3400', 1, NULL, 'not_started', '{}', '2026-05-21 19:09:20.186456+00', NULL, NULL),
(109, 'e92d94e5-332a-48c3-9de2-62e4ffce3400', 2, NULL, 'not_started', '{}', '2026-05-21 19:09:20.200822+00', NULL, NULL),
(110, 'e92d94e5-332a-48c3-9de2-62e4ffce3400', 3, NULL, 'not_started', '{}', '2026-05-21 19:09:20.212776+00', NULL, NULL);
INSERT INTO "public"."player_npc_gifts" ("id", "player_id", "npc_definition_id", "received_at") VALUES
(1, '36815b68-5a9b-4eaa-8c62-33d2af011d7a', 2, '0001-01-01 00:00:00+00');

INSERT INTO "public"."player_stats" ("id", "user_id", "class", "level", "experience", "hp_current", "hp_max", "mp_current", "mp_max", "attack", "defense", "speed", "skill_points", "created_at", "updated_at", "gold") VALUES
('36815b68-5a9b-4eaa-8c62-33d2af011d7a', '080d7054-0a5b-42c9-b68c-f4f716a48b48', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-04 00:58:18.656912+00', '2026-04-04 00:58:18.656912+00', 100),
('a75c4dbc-8888-45da-a644-ec02aa6ecf54', '2bced79f-771e-48da-af96-936299962a67', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-07 01:13:46.545332+00', '2026-04-07 01:13:46.545332+00', 100),
('a7049f71-08b6-41bd-b0b0-14ed4e531bee', 'b6b385c7-b732-47ec-8dbb-2d998ccd8753', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-08 04:35:28.09853+00', '2026-04-08 04:35:28.09853+00', 100),
('1720c4ca-18d8-4861-a614-4056e2a6750c', '09a16dd5-2e05-4b4f-ad6c-bb67cb3abcf2', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-16 02:21:00.590394+00', '2026-04-16 02:21:00.590394+00', 100),
('c2ac03ef-7554-46e3-926d-37d0a189e934', '7f7f7ec6-0a6a-42ef-a563-390597f66ddc', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-16 03:03:58.714195+00', '2026-04-16 03:03:58.714195+00', 100),
('7683b991-c9dd-4f72-9f8b-f702a0068ab3', '0a0f7532-5e01-47e1-ab25-747f0250fdd5', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-17 01:13:16.571941+00', '2026-04-17 01:13:16.571941+00', 100),
('b18b463e-2765-4b69-b7cc-3b421971feed', '26138cb0-4b1b-4039-b803-02dad9893941', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-20 23:57:43.23348+00', '2026-04-20 23:57:43.23348+00', 100),
('99202838-2d70-4f52-9afe-ef9916aab77e', 'ffa47002-9965-4701-8fef-4d99958b0553', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-21 00:50:37.43163+00', '2026-04-21 00:50:37.43163+00', 100),
('10ec4e3e-e4ee-411b-b4e3-b88c9a3743a4', '0129d1a3-1fcc-4123-86f5-2d016211486b', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-21 00:50:40.077851+00', '2026-04-21 00:50:40.077851+00', 100),
('ad375a64-9ef4-4db7-9b51-6419d10ebc3f', '26465489-d4ba-4e30-9b84-a13e023ed93c', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-21 00:50:49.653949+00', '2026-04-21 00:50:49.653949+00', 100),
('b4ee3d62-ba24-4f8a-a7a5-b900e19e0451', '577c1baa-1d0f-4a2b-a939-db029e34257c', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-21 00:53:12.241985+00', '2026-04-21 00:53:12.241985+00', 100),
('1ff2c6ff-2f86-4bd9-a278-cca1a9318610', '8f6d9085-d2da-4c7b-a38d-3731263ed77e', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-21 00:55:34.978182+00', '2026-04-21 00:55:34.978182+00', 100),
('0474c21a-9ffb-4040-a36c-224070d7c936', 'aa3b7756-c054-42cb-845a-a48717cee556', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-21 00:55:40.606429+00', '2026-04-21 00:55:40.606429+00', 100),
('d87153b3-cb9a-4e4c-a82c-893d16ac8b9a', '7b4ef4e3-dae4-4c1c-aa15-42800c3007ee', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-21 01:45:01.706246+00', '2026-04-21 01:45:01.706246+00', 100),
('da9235ce-e591-46ce-aa2d-bd3d04bddc27', '62e7c3c4-46f5-4fd9-9ed5-613911e35de1', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-04-21 01:45:35.813852+00', '2026-04-21 01:45:35.813852+00', 100),
('e6c2c30d-fa0c-4013-b784-08c9719edd7b', '62e5426b-9987-4e58-abc5-98f10ec6fa8a', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-05 01:23:25.889589+00', '2026-05-05 01:23:25.889589+00', 100),
('f2942d3c-cc72-46d5-bfae-a3ff6757ef40', 'c35da669-c190-4a4b-bf7c-6fb1317794f9', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-05 02:33:39.84854+00', '2026-05-05 02:33:39.84854+00', 100),
('c3e477b2-f29f-4d60-a93f-c32823fa6adb', '18237bbe-a3e4-4871-9b89-1290c878d616', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-05 13:40:32.126417+00', '2026-05-05 13:40:32.126417+00', 100),
('8138478e-5e31-447e-b29a-9adccbf5bfcb', 'b05216b9-8db5-46e5-b431-1b49951d6ab2', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 03:12:58.656491+00', '2026-05-06 03:12:58.656491+00', 100),
('c9f91b14-d48e-470b-8dd3-1ad90203704a', '13b750ce-b9af-4732-91c8-4cd616eaad6b', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 03:28:40.95637+00', '2026-05-06 03:28:40.95637+00', 100),
('6f272f33-616c-4410-b5f5-be46619911f9', '8bae3373-5629-4d83-baac-10039165e6cb', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 03:32:47.386999+00', '2026-05-06 03:32:47.386999+00', 100),
('2a2acf1b-6654-45c0-9f4f-30f3abcfeb03', '345d924a-f33f-490b-a737-d27caf225fbf', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 03:39:45.417898+00', '2026-05-06 03:39:45.417898+00', 100),
('01ef31f7-3978-4fa2-bbf7-a37ba759a299', '51539628-4ad4-497c-89b0-5e121a9630f0', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 03:45:54.370698+00', '2026-05-06 03:45:54.370698+00', 100),
('471dd84c-9b13-4991-bd25-6c18f66a6d50', '0382f5b7-7d6c-4448-89af-9fffc93523f8', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 03:47:43.625597+00', '2026-05-06 03:47:43.625597+00', 100),
('41b2c4f7-667c-4754-9609-80628f7dcdad', 'bead34b1-2f3d-47b4-9e97-ee0d274d264a', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 04:11:24.687192+00', '2026-05-06 04:11:24.687192+00', 100),
('21c1c3f2-3710-4895-a5fc-b454a09370ee', 'dec23984-a581-4d4f-9bdf-95974935f435', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 04:18:33.865621+00', '2026-05-06 04:18:33.865621+00', 100),
('02ee5138-4aa4-4a3b-89f7-166ef9b8e614', '4a2ea43e-05cf-4877-accb-c2cd995f63e5', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 04:58:08.083669+00', '2026-05-06 04:58:08.083669+00', 100),
('503e7441-fa60-48bb-95b6-5c0a0244ddc9', '50205a84-51ff-42cc-b077-7bb638b8842f', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 04:59:48.682195+00', '2026-05-06 04:59:48.682195+00', 100),
('d29b73fc-8a49-437c-acb6-d3269a700768', 'af7ffa29-bbf9-4aab-a0bb-aabdf1523c2b', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 05:01:33.167876+00', '2026-05-06 05:01:33.167876+00', 100),
('fc3df20e-d3a2-49e4-ba43-66baf832dd5e', 'add56347-1dbe-4eb2-a5c8-a2cfefb3f640', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 05:08:28.728034+00', '2026-05-06 05:08:28.728034+00', 100),
('082e23ad-fb98-4344-af9a-04fa0863a736', 'b8efdf31-cf3a-408e-a8cf-6f6889491957', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 05:14:08.102765+00', '2026-05-06 05:14:08.102765+00', 100),
('28faaa00-e5ea-4975-a28d-69ec0c997a38', '2fc2cad4-c03e-41e5-8c30-675015ae8039', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-06 05:21:21.196633+00', '2026-05-06 05:21:21.196633+00', 100),
('c324935a-5231-4c65-8a9c-11a998a760d5', 'a21fa9d5-cd25-47d1-9121-9c57baee8546', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-07 01:30:07.814607+00', '2026-05-07 01:30:07.814607+00', 100),
('816944fc-8014-4ff6-b8eb-423fb3f518c4', 'f5fe1643-d508-4b73-affc-8c46304f0b7b', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-12 21:46:50.316984+00', '2026-05-12 21:46:50.316984+00', 100),
('7e90e84c-c22d-47d8-85b7-945fe9bdb873', 'bed9cc1c-aeb8-44f1-bf90-d651d2228d23', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-12 21:52:14.805637+00', '2026-05-12 21:52:14.805637+00', 100),
('9dc4e6ba-d32d-4f79-84a0-6bb07aa96a5e', '9199e056-e62a-4032-b380-00ecd2b6a85d', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-13 00:42:26.537806+00', '2026-05-13 00:42:26.537806+00', 100),
('b418dbdf-8346-4243-a1ca-bb9fdb02e97f', 'd130d73d-ff94-4ea1-ab38-d67c04f2cec2', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-13 01:34:56.873702+00', '2026-05-13 02:38:17.823553+00', 100),
('78ff274b-244a-49e3-ab7a-9a5504168b8e', '33c2f625-aa58-44eb-8430-26bc0829cd1f', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-15 02:50:18.529542+00', '2026-05-15 02:50:18.529542+00', 100),
('a36038a1-14fd-489b-bf12-35e9c4e095f2', '97db8b92-9325-4d5e-99b1-00e95f949608', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-15 03:35:41.166256+00', '2026-05-15 03:35:41.166256+00', 100),
('9267999c-5078-4d68-93c4-5c4f9a2ce50f', 'b0ffce77-47fc-4484-aafc-fefef5848d61', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-15 03:47:13.679449+00', '2026-05-15 03:47:13.679449+00', 100),
('7a8ec061-9d96-49cb-8531-41ca6a44396a', 'c7f74a82-382c-49ee-98c9-3027a63a1265', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-15 14:08:51.954419+00', '2026-05-15 14:08:51.954419+00', 100),
('d4652907-a3cc-4982-bbcb-e579974f377c', '19b048ec-74bc-42dd-b334-2ea8c7e9e320', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-15 16:58:00.188914+00', '2026-05-15 16:58:00.188914+00', 100),
('3ab95f8e-067b-448d-9a1b-eae0dad715a4', 'ea259346-a686-420c-bfd4-48c8186ca840', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 00:13:45.634835+00', '2026-05-20 00:13:45.634835+00', 100),
('da4cd88e-eabb-4a5c-8b4b-32f5ba98ea1d', '1c578468-f1a6-4f1e-bd70-3011409c21b1', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 00:21:27.348354+00', '2026-05-20 00:21:27.348354+00', 100),
('a68ceb5f-3ec5-44a5-8295-5c9c1be21466', 'a24597cc-f8bf-4ef6-84aa-292c1af1ecea', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 01:01:38.914949+00', '2026-05-20 01:01:38.914949+00', 100),
('7e712c0b-79b2-4d53-8237-36d2d88b98d7', '61d397cb-40e6-4c25-9649-80888876e773', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 01:29:00.068385+00', '2026-05-20 01:29:00.068385+00', 100),
('0b105701-7387-4023-953e-e5b25f48e5f1', 'e9280112-559c-4318-b5c3-b40ed0600ba8', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 01:30:46.739899+00', '2026-05-20 01:30:46.739899+00', 100),
('beb5f06e-fb4b-4468-b447-0184f7159580', '1d020702-d923-4542-962f-1e697caf9265', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 01:32:25.635299+00', '2026-05-20 01:32:25.635299+00', 100),
('3ce5b420-931a-4e9f-91d3-101eb5f56af5', '66f1be57-b54c-4e28-85de-84b9b9d40423', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 02:15:17.940878+00', '2026-05-20 02:15:17.940878+00', 100),
('3e30b0c3-358b-41f8-9eca-849ce5812ccd', '90578fb0-278b-4b78-9a42-546cada8b581', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 02:15:18.980026+00', '2026-05-20 02:15:18.980026+00', 100),
('f16616c4-22de-402c-babf-d699bc7253ef', '1ca85acf-b5a8-4f94-a4e2-aed53dde51ae', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 02:26:43.527108+00', '2026-05-20 02:26:43.527108+00', 100),
('cc4c480f-bad9-4977-b452-7d9bbf3dd416', '93e0c880-c10b-4733-9329-e88b511dcd74', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 02:28:22.896441+00', '2026-05-20 02:28:22.896441+00', 100),
('ea85a374-daf0-4f3a-8122-381dcc2fe940', '95206ff2-9ce7-4224-b9f1-d4c089fe3950', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 02:47:43.218042+00', '2026-05-20 02:47:43.218042+00', 100),
('bf4aff77-a79c-4974-a75f-b91d116f6ea1', '33f6cac6-0fff-4848-8962-d563d79b912f', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 12:39:53.929133+00', '2026-05-20 12:39:53.929133+00', 100),
('8a848c84-7125-4ec7-b9ba-6e007a7abcf7', '71efe59b-c644-4be8-87e0-45d9474dc9a9', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 19:45:28.70206+00', '2026-05-20 19:45:28.70206+00', 100),
('c623cd1d-ea5f-4227-819f-be38161adef5', '81cc82f1-c4eb-4b65-a367-15604a618d8d', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-20 20:30:30.243106+00', '2026-05-20 21:55:00.888419+00', 100),
('5805b78d-86e7-464c-a6c6-d53fa063608a', '1447f0d3-5d24-48a0-91de-428f2112e616', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-21 02:51:48.804525+00', '2026-05-21 02:53:33.649227+00', 100),
('75191c20-9775-4354-a53b-3394efb5c674', 'af5c7e86-c3b2-42d6-88b3-f37b85950aa5', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-21 14:22:21.960528+00', '2026-05-21 14:22:21.960528+00', 100),
('56b22b35-852d-46de-a225-19f446967cdd', 'd608c0f5-0336-4c08-9a1c-88a1e73a2b41', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-21 17:23:07.341113+00', '2026-05-21 17:23:07.341113+00', 100),
('e92d94e5-332a-48c3-9de2-62e4ffce3400', 'a7b0eabf-4d33-463a-8369-e48b6763d67a', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 0, '2026-05-21 19:09:05.338208+00', '2026-05-21 19:09:05.338208+00', 100);
INSERT INTO "public"."recordings" ("id", "user_id", "word_id", "audio_path", "transcription", "confidence_score", "pronunciation_score", "feedback", "created_at") VALUES
(1, NULL, 9, NULL, 'book', 100, 100, '{"overall": "Excellent! \ud83c\udf1f", "similarity_ratio": 1.0, "phonetic_ratio": 1.0, "tips": ["Perfect match! Keep it up! \ud83c\udf89"], "match": true}', '2026-03-11 01:46:01.141224'),
(2, NULL, 8, 'uploads\124de606-5e2a-4130-8851-4ed91ba5179e.webm', 'car', 100, 100, '{"overall": "Excellent! \ud83c\udf1f", "similarity_ratio": 1.0, "phonetic_ratio": 1.0, "tips": ["Perfect match! Keep it up! \ud83c\udf89"], "match": true}', '2026-03-11 02:29:19.710865'),
(3, NULL, 9, 'uploads\9989150c-37cd-44c5-8017-c269c4ccf323.webm', 'okay', 100, 50, '{"overall": "Needs improvement \u2013 listen carefully and try again. \ud83d\udd04", "similarity_ratio": 0.5, "phonetic_ratio": 0.5, "tips": ["Focus on these words: book"], "match": false, "word_differences": [{"expected": "book", "heard": "okay"}], "word_analysis": [{"expected": "book", "heard": "okay", "text_match": false, "text_similarity": 0.5, "phonetic_similarity": 0.5, "phonetically_close": false}]}', '2026-03-11 02:31:41.468764'),
(4, NULL, 9, 'uploads\93a5955f-5eb9-4bfb-94ab-ce03449a25a8.webm', 'book', 100, 100, '{"overall": "Excellent! \ud83c\udf1f", "similarity_ratio": 1.0, "phonetic_ratio": 1.0, "tips": ["Perfect match! Keep it up! \ud83c\udf89"], "match": true}', '2026-03-11 02:31:57.823948'),
(5, NULL, 6, 'uploads\d0e2e874-3d3c-44f3-be05-188a6d7c9833.webm', 'hope youishes', 100, 14.1, '{"overall": "Let''s try once more \u2013 focus on each syllable. \ud83c\udfaf", "similarity_ratio": 0.235, "phonetic_ratio": 0.0, "tips": ["Focus on these words: food", "You added extra words \u2013 try to match the phrase exactly."], "match": false, "word_differences": [{"expected": "food", "heard": "hope"}], "word_analysis": [{"expected": "food", "heard": "hope", "text_match": false, "text_similarity": 0.25, "phonetic_similarity": 0.0, "phonetically_close": false}, {"expected": "(missing)", "heard": "youishes", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}]}', '2026-03-11 02:32:28.1637'),
(6, NULL, 6, 'uploads\a30528fc-1aa2-473d-b65c-326269a9b112.webm', 'food', 100, 100, '{"overall": "Excellent! \ud83c\udf1f", "similarity_ratio": 1.0, "phonetic_ratio": 1.0, "tips": ["Perfect match! Keep it up! \ud83c\udf89"], "match": true}', '2026-03-11 02:32:58.998303'),
(7, NULL, 6, 'uploads\342b6123-753c-4dd0-a032-d7759eada15f.webm', '24 tag onors and i send a book every year', 100, 5.3, '{"overall": "Let''s try once more \u2013 focus on each syllable. \ud83c\udfaf", "similarity_ratio": 0.089, "phonetic_ratio": 0.0, "tips": ["Focus on these words: food", "You added extra words \u2013 try to match the phrase exactly."], "match": false, "word_differences": [{"expected": "food", "heard": "24"}], "word_analysis": [{"expected": "food", "heard": "24", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}, {"expected": "(missing)", "heard": "tag", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}, {"expected": "(missing)", "heard": "onors", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}, {"expected": "(missing)", "heard": "and", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}, {"expected": "(missing)", "heard": "i", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}, {"expected": "(missing)", "heard": "send", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}, {"expected": "(missing)", "heard": "a", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}, {"expected": "(missing)", "heard": "book", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}, {"expected": "(missing)", "heard": "every", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}, {"expected": "(missing)", "heard": "year", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}]}', '2026-03-11 02:33:29.450084'),
(8, NULL, 13, 'uploads\f85d2be6-5e44-45a6-b7c6-859266c53832.webm', 'farmate museum', 100, 29.4, '{"overall": "Let''s try once more \u2013 focus on each syllable. \ud83c\udfaf", "similarity_ratio": 0.3, "phonetic_ratio": 0.285, "tips": ["Focus on these words: family", "You added extra words \u2013 try to match the phrase exactly."], "match": false, "word_differences": [{"expected": "family", "heard": "farmate"}], "word_analysis": [{"expected": "family", "heard": "farmate", "text_match": false, "text_similarity": 0.462, "phonetic_similarity": 0.571, "phonetically_close": false}, {"expected": "(missing)", "heard": "museum", "text_match": false, "text_similarity": 0.0, "phonetic_similarity": 0.0, "phonetically_close": false}]}', '2026-03-11 02:33:46.52797'),
(9, NULL, 1, 'uploads\eab25c0a-1a05-4cd9-9109-d72786d7aa0e.webm', 'hello', 100, 100, '{"overall": "Excellent! \ud83c\udf1f", "similarity_ratio": 1.0, "phonetic_ratio": 1.0, "tips": ["Perfect match! Keep it up! \ud83c\udf89"], "match": true}', '2026-03-11 02:37:49.18465');
INSERT INTO "public"."rooms" ("id", "name", "max_users", "map_data", "is_public", "created_by", "created_at", "updated_at", "type", "scene_key", "parent_id", "invite_code") VALUES
('0fc112f3-9ef9-4024-bafc-7c7ffa3b15b7', 'Main Lobby', 50, '{}', 't', '080d7054-0a5b-42c9-b68c-f4f716a48b48', '2026-04-23 16:56:26.805018+00', '2026-04-23 16:56:26.805018+00', 'public', '', NULL, ''),
('98188556-7382-4d9b-8425-bc4ea85c5c06', 'mision1-bd64', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-04-24 05:51:29.476972+00', '2026-04-24 05:51:29.476972+00', 'mission', 'mision1', NULL, '2366'),
('460e3121-8cd0-492e-b881-5dd1a6a8c8d8', 'mision1-f2ee', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-04-24 05:51:31.39194+00', '2026-04-24 05:51:31.39194+00', 'mission', 'mision1', NULL, '7104'),
('01f6fdd9-cfd9-45a6-9952-c7f41bdb2188', 'greeting village-940a', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-04-28 03:24:49.774514+00', '2026-04-28 03:24:49.774514+00', 'mission', 'greeting village', NULL, '7128'),
('90726058-cdd8-4bea-919d-a0d186456e92', 'greeting village-2372', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-04-28 03:24:50.736989+00', '2026-04-28 03:24:50.736989+00', 'mission', 'greeting village', NULL, '5367'),
('cf15e649-42ad-4541-b1d7-4d407befe4db', 'greeting village-55a0', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-05 01:22:14.417916+00', '2026-05-05 01:22:14.417916+00', 'mission', 'greeting village', NULL, '8067'),
('25e303f8-61fb-4bf3-b6f7-5d29a00b3361', 'greeting village-e606', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-05 01:23:42.65816+00', '2026-05-05 01:23:42.65816+00', 'mission', 'greeting village', NULL, '2952'),
('fac01ee1-888a-41a9-9053-6e7fc33becd3', 'greeting village-b4b3', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-05 01:23:44.152954+00', '2026-05-05 01:23:44.152954+00', 'mission', 'greeting village', NULL, '2138'),
('ecc9956f-1033-4791-8b71-98c4164c9c14', 'greeting village-4a37', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-05 01:24:43.715862+00', '2026-05-05 01:24:43.715862+00', 'mission', 'greeting village', NULL, '2359'),
('c9ee515a-0a3e-4492-9f1e-f348465f513a', 'greeting village-4767', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-05 01:24:44.998537+00', '2026-05-05 01:24:44.998537+00', 'mission', 'greeting village', NULL, '8436'),
('1b616447-c9e5-4fd1-9887-7746570667c2', 'greeting village-033b', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-05 01:25:05.047869+00', '2026-05-05 01:25:05.047869+00', 'mission', 'greeting village', NULL, '4178'),
('209aa510-3ae4-4c50-b9f8-13f590952f42', 'greeting village-6a57', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-05 02:30:53.52506+00', '2026-05-05 02:30:53.52506+00', 'mission', 'greeting village', NULL, '7977'),
('3ae2fb89-6eaf-4aca-8e50-57e8b3c0b378', 'mision1-19af', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-05 02:31:59.394123+00', '2026-05-05 02:31:59.394123+00', 'mission', 'mision1', NULL, '1458'),
('85343db9-74f7-4b44-bba7-140acef2f9ef', 'greeting village-41c5', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-05 02:33:52.791262+00', '2026-05-05 02:33:52.791262+00', 'mission', 'greeting village', NULL, '1707'),
('f739465d-4079-4a9d-bab2-5a2491f741dd', 'greeting village-9f0a', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-05 13:41:16.163728+00', '2026-05-05 13:41:16.163728+00', 'mission', 'greeting village', NULL, '9263'),
('72cd2a2e-c0f6-406b-a718-5a74d4724989', 'greeting village-0874', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 03:15:29.412646+00', '2026-05-06 03:15:29.412646+00', 'mission', 'greeting village', NULL, '8018'),
('d294eb15-2b41-4a33-84c3-089aca3ae681', 'greeting village-e47a', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 03:28:55.267379+00', '2026-05-06 03:28:55.267379+00', 'mission', 'greeting village', NULL, '4798'),
('a37384b0-d861-4fad-8a64-34e42f636ff2', 'greeting village-57fe', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 03:33:09.307745+00', '2026-05-06 03:33:09.307745+00', 'mission', 'greeting village', NULL, '7140'),
('66b53b50-5a28-45d5-8167-7aaf3a6ce068', 'greeting village-5b4e', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 03:33:10.834424+00', '2026-05-06 03:33:10.834424+00', 'mission', 'greeting village', NULL, '5913'),
('b50bbdc8-7953-44a5-80d4-38f62a465182', 'greeting village-0650', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 03:39:58.194972+00', '2026-05-06 03:39:58.194972+00', 'mission', 'greeting village', NULL, '7211'),
('d7956cde-44f8-4bdc-9ac6-fb4b22784ea9', 'greeting village-0978', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 03:39:59.464333+00', '2026-05-06 03:39:59.464333+00', 'mission', 'greeting village', NULL, '6793'),
('df5c2fc0-1130-4614-989c-2f1b74155b35', 'greeting village-5768', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 03:46:11.559636+00', '2026-05-06 03:46:11.559636+00', 'mission', 'greeting village', NULL, '5666'),
('bb9c85e2-ebb2-4793-87cf-b568fbe8f336', 'greeting village-e9e9', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 03:46:11.786957+00', '2026-05-06 03:46:11.786957+00', 'mission', 'greeting village', NULL, '7140'),
('c8f4491c-5a94-4f3b-9d55-47e9b579fbc0', 'greeting village-a194', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 03:46:13.503904+00', '2026-05-06 03:46:13.503904+00', 'mission', 'greeting village', NULL, '4215'),
('c4358bbf-b199-40dd-8843-dccebc557dff', 'greeting village-0bd0', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 03:47:57.538259+00', '2026-05-06 03:47:57.538259+00', 'mission', 'greeting village', NULL, '7566'),
('769e5979-4b02-4455-b1da-4c872d2b4ce4', 'greeting village-e504', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 04:11:37.243321+00', '2026-05-06 04:11:37.243321+00', 'mission', 'greeting village', NULL, '2854'),
('3095d5ef-3d82-4175-954c-f4bae25420b9', 'greeting village-4e20', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 04:18:54.138432+00', '2026-05-06 04:18:54.138432+00', 'mission', 'greeting village', NULL, '8725'),
('b206f1fc-ee90-4647-9dc9-b96bafb9cd8c', 'greeting village-b66c', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 04:18:56.033505+00', '2026-05-06 04:18:56.033505+00', 'mission', 'greeting village', NULL, '2665'),
('012af53b-61da-450f-bff5-c8e02775f99b', 'greeting village-64d1', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 04:58:21.602521+00', '2026-05-06 04:58:21.602521+00', 'mission', 'greeting village', NULL, '2153'),
('e5c88a8b-c87a-4a33-8afc-adb5967e72ac', 'greeting village-5c59', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 05:00:01.271811+00', '2026-05-06 05:00:01.271811+00', 'mission', 'greeting village', NULL, '3964'),
('54e17c5f-0471-4133-a966-62b361c0f350', 'greeting village-5fb2', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 05:00:02.704041+00', '2026-05-06 05:00:02.704041+00', 'mission', 'greeting village', NULL, '9224'),
('511ead0d-7706-442a-84f2-22541437b8f2', 'greeting village-65a3', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 05:01:47.544143+00', '2026-05-06 05:01:47.544143+00', 'mission', 'greeting village', NULL, '8875'),
('8caa7616-0230-4544-bd88-bc8c6c73c4ea', 'greeting village-35c6', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 05:08:42.658828+00', '2026-05-06 05:08:42.658828+00', 'mission', 'greeting village', NULL, '9553'),
('b1072a52-9273-4210-a731-a5a76e82b017', 'greeting village-546c', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 05:14:21.7429+00', '2026-05-06 05:14:21.7429+00', 'mission', 'greeting village', NULL, '5280'),
('b1b6dc47-db04-46e3-91ae-258b2af51327', 'greeting village-cc5a', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-06 05:21:34.871586+00', '2026-05-06 05:21:34.871586+00', 'mission', 'greeting village', NULL, '1882'),
('16f81af6-6a1c-4a61-b5db-e89a2af4986f', 'greeting village-81c2', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-12 21:55:37.065049+00', '2026-05-12 21:55:37.065049+00', 'mission', 'greeting village', NULL, '7737'),
('7e729cae-75de-4593-b3be-24e06c44e1bf', 'greeting village-2884', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-13 02:07:56.643422+00', '2026-05-13 02:07:56.643422+00', 'mission', 'greeting village', NULL, '5899'),
('59d848ea-c83c-4449-aa60-560a8e1c9995', 'greeting village-1c0f', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-13 02:09:46.902254+00', '2026-05-13 02:09:46.902254+00', 'mission', 'greeting village', NULL, '7359'),
('fba1c1a7-50c3-41bc-b2a2-e51da21b50f4', 'greeting village-55c3', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-13 02:22:52.944708+00', '2026-05-13 02:22:52.944708+00', 'mission', 'greeting village', NULL, '4697'),
('6720290e-fe21-4238-86c7-7caf80e2e8df', 'greeting village-ba69', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-13 02:35:54.432062+00', '2026-05-13 02:35:54.432062+00', 'mission', 'greeting village', NULL, '7112'),
('c9bbdca2-3449-44de-8b57-8c0716748650', 'lobby-7582', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-13 02:38:21.850699+00', '2026-05-13 02:38:21.850699+00', 'mission', 'lobby', NULL, '7386'),
('86b06838-44cb-496d-8bf7-9d1c433b7a42', 'lobby-4fdf', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-13 02:38:37.997496+00', '2026-05-13 02:38:37.997496+00', 'mission', 'lobby', NULL, '9527'),
('07c2f9bb-84f4-4a09-b74d-fd8c66ebcdd6', 'greeting village-e7fc', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-13 02:53:19.184732+00', '2026-05-13 02:53:19.184732+00', 'mission', 'greeting village', NULL, '5163'),
('99b4394c-809a-426c-aa50-5aa0992c42de', 'combate1-de48', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 02:50:32.601238+00', '2026-05-15 02:50:32.601238+00', 'public', 'combate1', NULL, ''),
('9e4cb9cd-c097-43e7-aa5f-252f1323292f', 'combate1-7101', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:13:06.151676+00', '2026-05-15 03:13:06.151676+00', 'public', 'combate1', NULL, ''),
('87f2c352-bafb-42d6-ac12-5f3dfee5e1aa', 'combate1-b501', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:15:13.45383+00', '2026-05-15 03:15:13.45383+00', 'public', 'combate1', NULL, ''),
('ea121782-114d-4e7a-8417-2cb43db1c4ba', 'combate1-6e09', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:15:19.392618+00', '2026-05-15 03:15:19.392618+00', 'public', 'combate1', NULL, ''),
('a2b0fb90-754b-4080-b773-5d5326f30abc', 'combate1-58af', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:15:34.867472+00', '2026-05-15 03:15:34.867472+00', 'public', 'combate1', NULL, ''),
('7488ceb2-555f-4f02-be5c-78380e20e257', 'combate1-6dd9', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:18:45.095256+00', '2026-05-15 03:18:45.095256+00', 'public', 'combate1', NULL, ''),
('e5771050-60c2-466a-9e88-af2b9efd9390', 'combate1-b2b6', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:18:50.101768+00', '2026-05-15 03:18:50.101768+00', 'public', 'combate1', NULL, ''),
('5f6e1ada-da4d-4a79-bc29-a6e6ef25eafc', 'combate1-7e64', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:19:26.294266+00', '2026-05-15 03:19:26.294266+00', 'public', 'combate1', NULL, ''),
('4b316fce-e2f4-476b-9b83-b5e833020d0a', 'combate1-31e1', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:19:48.126354+00', '2026-05-15 03:19:48.126354+00', 'public', 'combate1', NULL, ''),
('4deea511-3b99-49d9-bbd4-b1d2a1de6ee1', 'combate1-31c0', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:21:07.51209+00', '2026-05-15 03:21:07.51209+00', 'public', 'combate1', NULL, ''),
('c8565c5d-f58a-4629-871b-45674df4cffa', 'combate1-b798', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:21:27.900405+00', '2026-05-15 03:21:27.900405+00', 'public', 'combate1', NULL, ''),
('023ba88c-ffb2-4ea8-b44a-e3ed0029d5dc', 'combate1-f9c9', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:28:56.057209+00', '2026-05-15 03:28:56.057209+00', 'public', 'combate1', NULL, ''),
('78e13e20-ba35-4d71-9d11-d4fc0e649877', 'combate1-b09a', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:29:13.856024+00', '2026-05-15 03:29:13.856024+00', 'public', 'combate1', NULL, ''),
('91aa1d51-3b40-4632-bf47-19a556442ee3', 'greeting village-6791', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:29:35.725439+00', '2026-05-15 03:29:35.725439+00', 'mission', 'greeting village', NULL, '9667'),
('736a35dc-d8c4-4af1-bae6-4f960aee1c11', 'greeting village-a3e3', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:30:35.16284+00', '2026-05-15 03:30:35.16284+00', 'mission', 'greeting village', NULL, '2996'),
('7190150d-54bf-44c9-80f6-56c82ccde01e', 'greeting village-8bb5', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:31:43.669642+00', '2026-05-15 03:31:43.669642+00', 'mission', 'greeting village', NULL, '4186'),
('a39520d6-38f8-481a-ada6-914f9b9f48c8', 'combate1-d1ec', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:32:20.136256+00', '2026-05-15 03:32:20.136256+00', 'public', 'combate1', NULL, ''),
('d9146d1b-4f8a-4184-865c-d5afa772882d', 'combate1-c866', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:32:35.374645+00', '2026-05-15 03:32:35.374645+00', 'public', 'combate1', NULL, ''),
('e5151139-3a9b-4eb1-8c74-a65164d38be3', 'combate1-cc56', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:32:52.110358+00', '2026-05-15 03:32:52.110358+00', 'public', 'combate1', NULL, ''),
('c3469ba1-e1c7-409d-b66f-03518124f499', 'combate1-aa14', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:33:23.039312+00', '2026-05-15 03:33:23.039312+00', 'public', 'combate1', NULL, ''),
('cb6c89cb-7e29-4df3-9a9e-ff3f8ec71c11', 'combate1-aa0c', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:33:34.618754+00', '2026-05-15 03:33:34.618754+00', 'public', 'combate1', NULL, ''),
('40ad02ef-6740-486e-aeb4-3edd567b8a56', 'combate1-1bd3', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:43:30.286678+00', '2026-05-15 03:43:30.286678+00', 'public', 'combate1', NULL, ''),
('9ce3906c-1a5b-4629-808d-c0d1b3079b1b', 'combate1-481c', 50, NULL, 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:43:30.288264+00', '2026-05-15 03:43:30.288264+00', 'public', 'combate1', NULL, ''),
('9a83b6a8-f791-4e7f-83eb-e76aa2512833', 'combate1-6871', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:45:51.843686+00', '2026-05-15 03:45:51.843686+00', 'public', 'combate1', NULL, ''),
('477ca95f-772c-472d-acb5-bfe930ad53d9', 'combate1-124e', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:45:54.767322+00', '2026-05-15 03:45:54.767322+00', 'public', 'combate1', NULL, ''),
('7db70122-8f0f-493e-8614-cdc8207732b6', 'combate1-a279', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:46:41.422213+00', '2026-05-15 03:46:41.422213+00', 'public', 'combate1', NULL, ''),
('581047ae-ba4a-4f6c-bfcf-3fc01389cee3', 'combate1-916a', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:46:42.531153+00', '2026-05-15 03:46:42.531153+00', 'public', 'combate1', NULL, ''),
('59eb3c0b-e70a-4b9f-8c7c-f5858e4d4d45', 'combate1-fe12', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 03:47:28.343421+00', '2026-05-15 03:47:28.343421+00', 'public', 'combate1', NULL, ''),
('4413ac1b-c9ab-433d-8d42-17b6642eaa3a', 'combate1-5108', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 14:09:18.046949+00', '2026-05-15 14:09:18.046949+00', 'public', 'combate1', NULL, ''),
('8179440e-f101-4309-8c70-27f186741f22', 'combate1-6221', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 14:09:41.086516+00', '2026-05-15 14:09:41.086516+00', 'public', 'combate1', NULL, ''),
('ba6f2f62-4efd-48f1-aa6b-c9bb17dad2a2', 'combate1-db63', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 14:15:06.20099+00', '2026-05-15 14:15:06.20099+00', 'public', 'combate1', NULL, ''),
('b9bede02-22f8-4d01-a0e4-6f8ff6fee281', 'combate1-d919', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 14:50:32.286695+00', '2026-05-15 14:50:32.286695+00', 'public', 'combate1', NULL, ''),
('0347b422-7abd-4678-b295-f30cb741cabb', 'combate1-d827', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 14:50:44.139221+00', '2026-05-15 14:50:44.139221+00', 'public', 'combate1', NULL, ''),
('c756e170-a2e6-472f-ba2a-631934ae5997', 'combate1-165f', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 16:57:27.244528+00', '2026-05-15 16:57:27.244528+00', 'public', 'combate1', NULL, ''),
('dad8cade-7a2f-4737-a912-7e3f525efb4b', 'combate1-88be', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 17:03:57.171703+00', '2026-05-15 17:03:57.171703+00', 'public', 'combate1', NULL, ''),
('0e57a92b-a4c0-4bc8-b46c-9aa7637e8f05', 'combate1-d302', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 17:04:56.15785+00', '2026-05-15 17:04:56.15785+00', 'public', 'combate1', NULL, ''),
('332c9424-ff64-496b-881a-f1d756311d6c', 'combate1-013a', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 17:08:22.149805+00', '2026-05-15 17:08:22.149805+00', 'public', 'combate1', NULL, ''),
('e30e8930-afb9-40f9-b0b4-798fef6ac7e0', 'combate1-0bfe', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 17:08:45.133793+00', '2026-05-15 17:08:45.133793+00', 'public', 'combate1', NULL, ''),
('221e022e-c088-4bc3-afac-e3c2bedb44ed', 'combate1-7ff7', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 17:09:54.399443+00', '2026-05-15 17:09:54.399443+00', 'public', 'combate1', NULL, ''),
('e752af35-a076-4cb9-a0a9-d02139603aac', 'lobby-90f0', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 17:10:17.478143+00', '2026-05-15 17:10:17.478143+00', 'mission', 'lobby', NULL, '2526'),
('c237046a-15d7-4d56-9ee9-43ec650a69be', 'combate1-b077', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-15 21:27:46.206682+00', '2026-05-15 21:27:46.206682+00', 'public', 'combate1', NULL, ''),
('bef792c9-6819-4724-a54e-68930416166f', 'combate1-05b0', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 00:14:10.522892+00', '2026-05-20 00:14:10.522892+00', 'public', 'combate1', NULL, ''),
('c31a4ceb-a559-453e-8492-617eb4bbe94c', 'combate1-3db3', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 00:19:30.775641+00', '2026-05-20 00:19:30.775641+00', 'public', 'combate1', NULL, ''),
('9caf519f-1748-4603-a153-7f62d903e64c', 'combate1-2426', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 00:19:57.060469+00', '2026-05-20 00:19:57.060469+00', 'public', 'combate1', NULL, ''),
('51045016-4f48-49b7-bb70-c32ef176eba0', 'combate1-1c20', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 00:22:36.830632+00', '2026-05-20 00:22:36.830632+00', 'public', 'combate1', NULL, ''),
('6b0950fa-5f91-4336-8c4f-f87fb8c54559', 'combate1-ef91', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 00:22:41.313212+00', '2026-05-20 00:22:41.313212+00', 'public', 'combate1', NULL, ''),
('11559b37-09ac-42cd-ac2f-0ce254ebdb9b', 'combate1-d7f7', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 00:22:41.314321+00', '2026-05-20 00:22:41.314321+00', 'public', 'combate1', NULL, ''),
('f4952c94-c83d-4f37-83da-b76921e4286a', 'combate1-045b', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 00:22:46.554169+00', '2026-05-20 00:22:46.554169+00', 'public', 'combate1', NULL, ''),
('2992bee4-2865-42c5-bcb5-b94640d309fa', 'combate1-19a6', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:01:53.082644+00', '2026-05-20 01:01:53.082644+00', 'public', 'combate1', NULL, ''),
('bb1f8c99-3e0a-4945-b3ed-a0294d41add8', 'combate1-04a2', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:02:09.50071+00', '2026-05-20 01:02:09.50071+00', 'public', 'combate1', NULL, ''),
('76e4cf63-be5c-42db-bcd7-c6f4fc138608', 'combate1-29ef', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:03:02.338267+00', '2026-05-20 01:03:02.338267+00', 'public', 'combate1', NULL, ''),
('729a8601-4564-42cb-8bf5-a4075f479ef9', 'combate1-010f', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:13:04.27739+00', '2026-05-20 01:13:04.27739+00', 'public', 'combate1', NULL, ''),
('60b5cd18-279f-489b-93ff-68d8fb85d76b', 'combate1-6de0', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:13:19.199274+00', '2026-05-20 01:13:19.199274+00', 'public', 'combate1', NULL, ''),
('8f9d0d4b-5d58-44e0-82da-9e8f57f91141', 'combate1-7c33', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:19:05.990917+00', '2026-05-20 01:19:05.990917+00', 'public', 'combate1', NULL, ''),
('4d6d1d3d-ea80-4694-8724-34517defe4e1', 'combate1-8778', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:21:00.223231+00', '2026-05-20 01:21:00.223231+00', 'public', 'combate1', NULL, ''),
('2bf9193e-f838-410e-8b57-439e70db2577', 'combate1-3f42', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:21:31.308166+00', '2026-05-20 01:21:31.308166+00', 'public', 'combate1', NULL, ''),
('fab1df52-c26d-4ada-aaa7-680968f64133', 'combate1-7d83', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:29:14.487503+00', '2026-05-20 01:29:14.487503+00', 'public', 'combate1', NULL, ''),
('d7a5b4aa-2173-4226-9f6b-bba4947e0463', 'combate1-a04c', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:29:29.947563+00', '2026-05-20 01:29:29.947563+00', 'public', 'combate1', NULL, ''),
('4f233513-63df-43b0-89c6-14bc5de15401', 'combate1-9216', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:32:42.076999+00', '2026-05-20 01:32:42.076999+00', 'public', 'combate1', NULL, ''),
('fe197e08-9183-4407-a08b-b6246274d81a', 'combate1-6946', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:49:45.483692+00', '2026-05-20 01:49:45.483692+00', 'public', 'combate1', NULL, ''),
('c40669e8-8e42-4d13-b829-08e41c2c4cf6', 'combate1-4a7d', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:49:56.432382+00', '2026-05-20 01:49:56.432382+00', 'public', 'combate1', NULL, ''),
('4aa5d8e3-f510-4051-865e-aeaedfedd21f', 'combate1-d3e1', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:49:56.446844+00', '2026-05-20 01:49:56.446844+00', 'public', 'combate1', NULL, ''),
('65c1ca76-f4db-4d81-8fd9-f5dab91e41f4', 'combate1-ac6d', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 01:50:06.391243+00', '2026-05-20 01:50:06.391243+00', 'public', 'combate1', NULL, ''),
('f8fa7d00-1077-4028-a85f-e06a149440a2', 'combate1-199b', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:02:20.035691+00', '2026-05-20 02:02:20.035691+00', 'public', 'combate1', NULL, ''),
('e94e8b3c-a75e-40c5-98b5-1499e1dee1fa', 'combate1-a8e9', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:05:54.257776+00', '2026-05-20 02:05:54.257776+00', 'public', 'combate1', NULL, ''),
('63e9b29a-5450-4b1e-8540-17dd7a930973', 'lobby-9c7f', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:06:09.133023+00', '2026-05-20 02:06:09.133023+00', 'mission', 'lobby', NULL, '5641'),
('c99b8720-54cc-49b6-bbd3-5c244b76e376', 'combate1-4757', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:06:37.677043+00', '2026-05-20 02:06:37.677043+00', 'public', 'combate1', NULL, ''),
('af79d3b2-5704-4446-85b8-245e526422e8', 'combate1-8064', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:06:42.572067+00', '2026-05-20 02:06:42.572067+00', 'public', 'combate1', NULL, ''),
('3efde919-777f-4769-8f05-481f63393f63', 'combate1-3a05', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:07:13.241409+00', '2026-05-20 02:07:13.241409+00', 'public', 'combate1', NULL, ''),
('fa85e37a-d063-4a84-967d-7357995d1768', 'combate1-0152', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:15:38.8703+00', '2026-05-20 02:15:38.8703+00', 'public', 'combate1', NULL, ''),
('5ed5b028-6a83-4e1a-b9bb-3f0721e06933', 'lobby-7bbe', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:16:11.742908+00', '2026-05-20 02:16:11.742908+00', 'mission', 'lobby', NULL, '8293'),
('74ed5c8b-cc9a-424f-be6a-b64331c5982e', 'lobby-6c4d', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:16:20.477362+00', '2026-05-20 02:16:20.477362+00', 'mission', 'lobby', NULL, '9972'),
('00133c87-e2c5-49cf-993d-56515a8823bd', 'combate1-2c02', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:26:12.026695+00', '2026-05-20 02:26:12.026695+00', 'public', 'combate1', NULL, ''),
('dee2edb8-d934-4276-a3f8-b9cef50f40cf', 'lobby-94c8', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:27:32.675022+00', '2026-05-20 02:27:32.675022+00', 'mission', 'lobby', NULL, '7874'),
('95941016-ed37-42e3-a899-1191d95ec227', 'combate1-4a26', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:28:49.208245+00', '2026-05-20 02:28:49.208245+00', 'public', 'combate1', NULL, ''),
('10325bc8-441c-49a6-8f17-7c43b57e5b6b', 'lobby-458f', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:29:18.068281+00', '2026-05-20 02:29:18.068281+00', 'mission', 'lobby', NULL, '7500'),
('4d47343e-b952-448a-a637-0f88fed3cd18', 'combate1-aff2', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:48:11.742561+00', '2026-05-20 02:48:11.742561+00', 'public', 'combate1', NULL, ''),
('0cb7f505-ecb2-44bb-bdc8-df3b4bd26670', 'lobby-8361', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:48:36.52583+00', '2026-05-20 02:48:36.52583+00', 'mission', 'lobby', NULL, '3271'),
('a763eb17-92d9-43a6-8f8c-ebefec51a81f', 'combate1-2a17', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:51:12.120091+00', '2026-05-20 02:51:12.120091+00', 'public', 'combate1', NULL, ''),
('f1b6c6b5-08ed-4a2a-9846-15cc32011f2b', 'lobby-787a', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 02:51:28.467605+00', '2026-05-20 02:51:28.467605+00', 'mission', 'lobby', NULL, '4707'),
('55f9ae54-90ee-47c0-bf3a-7a09ce717544', 'combate1-7a27', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 03:00:08.582884+00', '2026-05-20 03:00:08.582884+00', 'public', 'combate1', NULL, ''),
('7a58427f-f8b0-461d-8441-a14bf96661e0', 'lobby-aac9', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 03:00:23.379471+00', '2026-05-20 03:00:23.379471+00', 'mission', 'lobby', NULL, '6882'),
('a34916db-4a95-4f7b-81cb-f4f0b56ba295', 'combate1-70ab', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 03:01:18.92777+00', '2026-05-20 03:01:18.92777+00', 'public', 'combate1', NULL, ''),
('83e4e221-39ee-4b5d-b9e6-df8fc0e63193', 'lobby-08c5', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 03:01:33.695898+00', '2026-05-20 03:01:33.695898+00', 'mission', 'lobby', NULL, '5816'),
('ab1a4d35-a52f-427c-b5bd-9e344a764329', 'combate1-02e8', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 03:02:02.152565+00', '2026-05-20 03:02:02.152565+00', 'public', 'combate1', NULL, ''),
('65486277-bd0e-4cef-9a39-870076c0e1cc', 'combate1-af24', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 03:05:34.290814+00', '2026-05-20 03:05:34.290814+00', 'public', 'combate1', NULL, ''),
('767b46e8-4b38-4bcf-84cd-dd1e0da31881', 'combate1-3b37', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 03:05:50.252585+00', '2026-05-20 03:05:50.252585+00', 'public', 'combate1', NULL, ''),
('bff2a55a-e5b1-4b18-95e1-26a074b7109e', 'combate1-7f19', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 12:43:04.469517+00', '2026-05-20 12:43:04.469517+00', 'public', 'combate1', NULL, ''),
('12905e41-d6e9-49f7-a656-673ddd993fa7', 'lobby-63c2', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 12:46:06.732197+00', '2026-05-20 12:46:06.732197+00', 'mission', 'lobby', NULL, '3233'),
('222276a9-bbae-4f12-9fa5-e9cf71f772f9', 'combate1-c821', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 19:45:51.239795+00', '2026-05-20 19:45:51.239795+00', 'public', 'combate1', NULL, ''),
('66bfb356-4048-465a-9633-c4038689e149', 'lobby-3ceb', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 19:46:49.754284+00', '2026-05-20 19:46:49.754284+00', 'mission', 'lobby', NULL, '4751'),
('9250d685-79b2-4c71-a881-0174b663a9bb', 'combate1-d333', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 19:47:02.661425+00', '2026-05-20 19:47:02.661425+00', 'public', 'combate1', NULL, ''),
('5a750634-bd8b-4d3b-a997-63138ad6caae', 'lobby-0415', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 19:47:13.441352+00', '2026-05-20 19:47:13.441352+00', 'mission', 'lobby', NULL, '4505'),
('8e88bb0b-14b8-4d6d-8829-5eef76901736', 'combate1-e9dc', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 19:48:22.028319+00', '2026-05-20 19:48:22.028319+00', 'public', 'combate1', NULL, ''),
('39342da8-a4b4-4f51-8ad8-04aa31776784', 'lobby-44bc', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 19:48:29.998501+00', '2026-05-20 19:48:29.998501+00', 'mission', 'lobby', NULL, '6454'),
('47c039d6-aac9-4585-953f-084da486ffcf', 'combate1-7fb0', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 20:32:43.670511+00', '2026-05-20 20:32:43.670511+00', 'public', 'combate1', NULL, ''),
('9cfe9f94-bf25-4dac-90a8-798f7d5aacc8', 'lobby-e88e', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 20:33:20.138031+00', '2026-05-20 20:33:20.138031+00', 'mission', 'lobby', NULL, '8935'),
('055ba23c-9f30-4d3b-aa52-9af6eb2bd8ff', 'combate1-71ed', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 20:34:22.95705+00', '2026-05-20 20:34:22.95705+00', 'public', 'combate1', NULL, ''),
('220fb7c9-f950-411d-9408-7d6610c16ac4', 'combate1-14a0', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 20:34:33.735088+00', '2026-05-20 20:34:33.735088+00', 'public', 'combate1', NULL, ''),
('013b7f52-59d9-4b98-925e-341b65231401', 'combate1-8ed7', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 20:59:56.857746+00', '2026-05-20 20:59:56.857746+00', 'public', 'combate1', NULL, ''),
('1a37d64d-f575-4db1-af2d-3096ec66c88d', 'combate1-4ab4', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 21:19:32.116347+00', '2026-05-20 21:19:32.116347+00', 'public', 'combate1', NULL, ''),
('5d728082-f46f-4403-8580-1f2b4ca70fb5', 'combate1-e3e2', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 21:44:58.452129+00', '2026-05-20 21:44:58.452129+00', 'public', 'combate1', NULL, ''),
('052c8f21-b957-47d9-bc12-1b783c5d84b0', 'combate1-76f2', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 21:45:34.919164+00', '2026-05-20 21:45:34.919164+00', 'public', 'combate1', NULL, ''),
('4ace5043-69a3-44af-86cb-23cbaecd9e57', 'combate1-c505', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 21:47:12.451125+00', '2026-05-20 21:47:12.451125+00', 'public', 'combate1', NULL, ''),
('eba54fb0-b4b1-409f-a03b-d9b9522412b2', 'combate1-ec1f', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 21:54:49.019621+00', '2026-05-20 21:54:49.019621+00', 'public', 'combate1', NULL, ''),
('b348fa28-a4be-4dcc-a67d-7bbf5778c6b3', 'lobby-3880', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-20 21:55:04.91068+00', '2026-05-20 21:55:04.91068+00', 'mission', 'lobby', NULL, '8965'),
('a332321b-a331-43dd-8ce8-7ec963f8d58d', 'combate1-9a74', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:52:04.713677+00', '2026-05-21 02:52:04.713677+00', 'public', 'combate1', NULL, ''),
('510c41ca-5ebc-4caa-84c3-882b73ed3640', 'lobby-87bd', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:52:16.99842+00', '2026-05-21 02:52:16.99842+00', 'mission', 'lobby', NULL, '9195'),
('04958b0f-8a24-4691-822e-8dea9ea9617a', 'combate1-8926', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:52:30.05387+00', '2026-05-21 02:52:30.05387+00', 'public', 'combate1', NULL, ''),
('570986c6-1f12-4d31-a977-dba80a037d38', 'lobby-164a', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:52:40.351445+00', '2026-05-21 02:52:40.351445+00', 'mission', 'lobby', NULL, '6320'),
('1f38b74a-5e19-4973-bfa3-1f6d43217e64', 'combate1-40a7', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:52:56.158399+00', '2026-05-21 02:52:56.158399+00', 'public', 'combate1', NULL, ''),
('236e5448-326e-4fc8-8460-ad1d1c5e125e', 'combate1-a449', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:53:22.629195+00', '2026-05-21 02:53:22.629195+00', 'public', 'combate1', NULL, ''),
('70ce1b95-01f4-42ac-abc5-38d0e54828dd', 'lobby-1cb7', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:53:37.677011+00', '2026-05-21 02:53:37.677011+00', 'mission', 'lobby', NULL, '6339'),
('4443c446-60ae-46c8-8e0a-f5292b63d9af', 'combate1-797d', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:53:54.660003+00', '2026-05-21 02:53:54.660003+00', 'public', 'combate1', NULL, ''),
('38f3b39c-7380-435c-a70e-52e1703f519e', 'lobby-40b2', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:54:12.786133+00', '2026-05-21 02:54:12.786133+00', 'mission', 'lobby', NULL, '5781'),
('1a284336-b55a-4a32-92d7-e01f933169a6', 'combate1-d4e0', 50, '{"width": 800, "height": 800, "enemies": [{"npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "82f39617-f1a2-48a7-858c-b44cf727a739", "wave_num": 1, "sprite_id": "1"}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:54:23.674983+00', '2026-05-21 02:54:23.674983+00', 'public', 'combate1', NULL, ''),
('0c56488a-4675-4bbc-bd48-ca07a426ded3', 'combate1-29c0', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 02:55:38.156561+00', '2026-05-21 02:55:38.156561+00', 'public', 'combate1', NULL, ''),
('97a3dc00-078b-4c49-b381-f9a7d8ef5552', 'combate1-b0bb', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 04:21:08.088246+00', '2026-05-21 04:21:08.088246+00', 'public', 'combate1', NULL, ''),
('99dacf95-a127-453b-b530-985ea8e6bfa3', 'combate1-70b5', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 04:21:29.67524+00', '2026-05-21 04:21:29.67524+00', 'public', 'combate1', NULL, ''),
('8105731d-27c6-4913-ac99-8399273cf410', 'lobby-1375', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 04:21:50.191638+00', '2026-05-21 04:21:50.191638+00', 'mission', 'lobby', NULL, '1158'),
('3841a808-4f4b-4a71-9ca1-27810b6c03d5', 'combate1-b5f1', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 04:22:02.98977+00', '2026-05-21 04:22:02.98977+00', 'public', 'combate1', NULL, ''),
('f13d4015-bfdc-4816-9906-955c9672e3aa', 'lobby-c16f', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 04:22:25.788826+00', '2026-05-21 04:22:25.788826+00', 'mission', 'lobby', NULL, '7303'),
('fc01b41b-cd95-40ae-9161-e79fa8748596', 'combate1-88c5', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 04:22:37.50425+00', '2026-05-21 04:22:37.50425+00', 'public', 'combate1', NULL, ''),
('df056d30-59dd-4dee-899c-06508735b991', 'combate1-9715', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 14:24:54.823603+00', '2026-05-21 14:24:54.823603+00', 'public', 'combate1', NULL, ''),
('8deda079-8baf-44dc-a021-a105a78bf2db', 'combate1-68b6', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 14:25:16.402368+00', '2026-05-21 14:25:16.402368+00', 'public', 'combate1', NULL, ''),
('dd48c0b6-765f-4179-8f30-c78dd76f546e', 'combate1-5050', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 14:25:56.879682+00', '2026-05-21 14:25:56.879682+00', 'public', 'combate1', NULL, ''),
('c3b5a2f7-0e18-4cbb-86e6-ee6d8a6fa045', 'combate1-596b', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 14:27:34.443252+00', '2026-05-21 14:27:34.443252+00', 'public', 'combate1', NULL, ''),
('0a3bde67-f54d-44ee-acb8-bf3e3cf2b8d4', 'combate1-1b28', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 14:34:41.11085+00', '2026-05-21 14:34:41.11085+00', 'public', 'combate1', NULL, ''),
('e3c51c4c-2fb2-4ced-8dc7-9bddb385cc90', 'combate1-114f', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 16:27:00.367697+00', '2026-05-21 16:27:00.367697+00', 'public', 'combate1', NULL, ''),
('71be3dca-7aee-416d-be16-04911a31efc1', 'combate1-2101', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 17:21:43.558489+00', '2026-05-21 17:21:43.558489+00', 'public', 'combate1', NULL, ''),
('e8fa05d4-07e5-4100-83a8-aa99bbfd2326', 'combate1-6be1', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 17:23:33.478376+00', '2026-05-21 17:23:33.478376+00', 'public', 'combate1', NULL, ''),
('9422149d-c746-4316-b9ec-2055835c4762', 'combate1-5cbb', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 17:27:12.573694+00', '2026-05-21 17:27:12.573694+00', 'public', 'combate1', NULL, ''),
('5280ede4-34e6-4433-a014-aabfb9fa0ac3', 'lobby-d2f5', 50, '{"width": 800, "height": 800, "bgmTrack": "bgm_pixelated_prelude", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 17:38:11.78483+00', '2026-05-21 17:38:11.78483+00', 'mission', 'lobby', NULL, '7188'),
('5b1e0ace-a51f-4692-9529-291478ba0bb4', 'combate1-0fb2', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 17:23:41.356173+00', '2026-05-21 17:23:41.356173+00', 'public', 'combate1', NULL, ''),
('f17bdb0e-939d-4971-bff0-e2a5466a8ece', 'combate1-a378', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 19:09:24.433796+00', '2026-05-21 19:09:24.433796+00', 'public', 'combate1', NULL, ''),
('345c9541-3875-4a1d-b3c8-c3ee403237e8', 'combate1-2fa9', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 19:09:46.381736+00', '2026-05-21 19:09:46.381736+00', 'public', 'combate1', NULL, ''),
('ff4d53a9-6aa3-401f-8b4e-75fe66fbeeb8', 'greeting village-ec19', 50, '{"width": 800, "height": 800, "bgmTrack": "none", "defaultSpawnX": 1000, "defaultSpawnY": 750}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-21 23:59:23.220329+00', '2026-05-21 23:59:23.220329+00', 'mission', 'greeting village', NULL, '3177'),
('094c8fa1-dc9a-45cc-b768-95974a30876d', 'combate1-7c9a', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-22 00:00:12.027366+00', '2026-05-22 00:00:12.027366+00', 'public', 'combate1', NULL, ''),
('ec558f04-11f1-45e4-92a5-eac50d4fa284', 'combate1-e63f', 50, '{"width": 800, "height": 800, "enemies": [{"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 350, "spawn_y": 350, "enemy_id": "92b94afe-be5c-47f0-ba94-37f069b525f7", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}, {"hp": 50, "speed": 120, "damage": 10, "npc_id": "387b772e-5be0-4bd7-904c-345467777d71", "spawn_x": 150, "spawn_y": 650, "enemy_id": "7f9b6df3-3a70-4d5a-953f-2b8f1589d830", "wave_num": 1, "sprite_id": "1", "attack_rate": 0}]}', 't', '00000000-0000-0000-0000-000000000000', '2026-05-22 00:00:34.139207+00', '2026-05-22 00:00:34.139207+00', 'public', 'combate1', NULL, '');
INSERT INTO "public"."shop_items" ("shop_id", "item_id") VALUES
(1, 'bfd1359a-b574-45a1-9b55-adc7330a788f');
INSERT INTO "public"."shops" ("id", "name", "description", "created_at") VALUES
(1, 'Potion Store', 'The best Potion Store', '2026-04-08 02:55:37.097954+00');


INSERT INTO "public"."user_challenge_attempts" ("id", "user_id", "challenge_id", "selected_option", "is_correct", "feedback_ai", "answered_at") VALUES
('d94964d7-d1ef-496f-85b5-c5ffb0b20a13', '080d7054-0a5b-42c9-b68c-f4f716a48b48', 'ee6248aa-c8af-42ba-bb73-1d712fe5b943', 0, 't', 'Perfect match! Keep it up! 🎉', '2026-03-12 00:01:12.074428+00'),
('c5c85715-c7aa-4a69-94b1-f7fbfccdf547', '080d7054-0a5b-42c9-b68c-f4f716a48b48', '6c4341c5-db84-4191-8afc-fc2e7adbb51f', 0, 'f', 'Focus on these words: adventure. You added extra words – try to match the phrase exactly.', '2026-03-12 00:01:58.198941+00'),
('8fc8c904-c504-4959-a061-abea4621e89e', '080d7054-0a5b-42c9-b68c-f4f716a48b48', '6c4341c5-db84-4191-8afc-fc2e7adbb51f', 0, 't', 'Perfect match! Keep it up! 🎉', '2026-03-12 00:46:22.987488+00'),
('21dc3194-a9e3-4e82-80c8-25b3c847468d', 'a033d2f8-061a-432a-b075-0884993ecad9', 'ee6248aa-c8af-42ba-bb73-1d712fe5b943', 1, 't', 'Bienvenido al juego', '2026-03-12 21:13:42.736873+00'),
('606b5854-624a-42b5-b447-4a77810d9232', '080d7054-0a5b-42c9-b68c-f4f716a48b48', '6c4341c5-db84-4191-8afc-fc2e7adbb51f', 0, 'f', 'Focus on these words: adventure. You added extra words – try to match the phrase exactly.', '2026-03-26 04:09:12.632286+00'),
('eb23596d-b310-40a8-a8d5-eb524c2d514f', '080d7054-0a5b-42c9-b68c-f4f716a48b48', 'ee6248aa-c8af-42ba-bb73-1d712fe5b943', 0, 'f', 'Focus on these words: welcome, to. Try to pronounce all words in the phrase.', '2026-03-26 04:09:50.504059+00'),
('023e6e5a-90e3-4abe-880a-0cf6a13c6385', 'af5c7e86-c3b2-42d6-88b3-f37b85950aa5', '49b53828-4323-47df-a2e1-306c72372975', 1, 't', '', '2026-05-21 17:22:03.157111+00'),
('2ec57792-90d7-4739-988e-bde8b156a5b1', 'd608c0f5-0336-4c08-9a1c-88a1e73a2b41', '49b53828-4323-47df-a2e1-306c72372975', 1, 't', '', '2026-05-21 17:27:25.078217+00'),
('9cd9625f-7774-4078-aa4c-c5eee60726f5', 'd608c0f5-0336-4c08-9a1c-88a1e73a2b41', '49b53828-4323-47df-a2e1-306c72372975', 3, 'f', '', '2026-05-21 17:27:35.096976+00');
INSERT INTO "public"."user_learning_profiles" ("id", "user_id", "english_level", "preferred_tags", "weekly_score", "weekly_correct", "weekly_attempts", "week_start", "current_level_xp", "total_xp", "created_at", "updated_at", "deleted_at") VALUES
('07303b2d-5a92-4724-bd07-7be09452deb8', '61e7b355-28f9-4a59-b2cd-6f8c4f385763', 'beginner', '{}', 0, 0, 0, '0001-01-01', 0, 0, '2026-03-12 02:53:08.751124+00', '2026-03-12 02:53:08.751124+00', NULL),
('e22713dd-ccd9-4cb2-b0bb-c47cb0456e24', 'fb3dad1b-4166-4fc0-a8d0-37bbc5d0af06', 'beginner', '{}', 0, 0, 0, '0001-01-01', 0, 0, '2026-03-12 02:53:43.701451+00', '2026-03-12 02:53:43.701451+00', NULL),
('d5898a7b-8276-404c-bf49-c90b15c4f647', 'a033d2f8-061a-432a-b075-0884993ecad9', 'beginner', '{}', 15, 1, 1, '0001-01-01', 15, 15, '2026-03-12 21:13:42.789557+00', '2026-03-12 21:13:42.803151+00', NULL),
('fd290d9a-64d2-4e1d-b085-2f70776928c1', '080d7054-0a5b-42c9-b68c-f4f716a48b48', 'beginner', '{}', 45, 2, 5, '0001-01-01', 45, 45, '2026-03-12 00:01:12.094088+00', '2026-03-26 04:09:50.505888+00', NULL),
('7c6e6167-936b-426d-adfd-f3353e8c21a8', '2bced79f-771e-48da-af96-936299962a67', 'beginner', '{}', 0, 0, 0, '0001-01-01', 0, 0, '2026-04-07 01:13:47.499082+00', '2026-04-07 01:13:47.499082+00', NULL),
('ee5a2aba-728b-4579-b2e3-1fb09146b6a8', 'f5fe1643-d508-4b73-affc-8c46304f0b7b', 'beginner', '{}', 0, 0, 0, '0001-01-01', 0, 0, '2026-05-12 21:46:50.580338+00', '2026-05-12 21:46:50.580338+00', NULL),
('044590b3-61a5-452d-9a45-19742a0d2cae', 'af5c7e86-c3b2-42d6-88b3-f37b85950aa5', 'beginner', '{}', 15, 1, 1, '0001-01-01', 15, 15, '2026-05-21 17:22:03.169048+00', '2026-05-21 17:22:03.171858+00', NULL),
('f6832c60-108a-4b4e-b8e7-c1b0b0cbe022', 'd608c0f5-0336-4c08-9a1c-88a1e73a2b41', 'beginner', '{}', 20, 1, 2, '0001-01-01', 20, 20, '2026-05-21 17:27:25.085845+00', '2026-05-21 17:27:35.100695+00', NULL);

INSERT INTO "public"."users" ("id", "username", "email", "password", "created_at", "updated_at", "deleted_at", "is_guest", "role", "character_id") VALUES
('1a73f9cd-9dba-4101-8d01-828213a4ac13', 'Guest_d34e211f', 'd34e211f-fb47-4a35-b92f-864d09f2697c@guest.local', '$2a$10$0c3JJ3rs5Jh93lT1H7I/WuLsHod0lbI0H7EOSWR7Ws1oQs0WGRAq2', '2025-12-11 02:32:38.164693+00', '2025-12-11 02:32:38.164693+00', NULL, 'f', 'user', '1'),
('9a170632-9a4f-468b-a5ee-155cf0424689', 'Guest_768b1343', '768b1343-8ef9-4a1c-90d0-027ee35ddd25@guest.local', '$2a$10$A5hMajdQNj7kM2Q5xXFR6eSP7r5NFIMmdXw5urOHXn7i/Bdnfop3O', '2025-12-11 02:33:01.88292+00', '2025-12-11 02:33:01.88292+00', NULL, 'f', 'user', '1'),
('38a41e02-47cc-4115-a8d2-6ea88b90e9f7', 'Guest_d9ed83d6', 'd9ed83d6-d5b5-46f7-817b-14095f7c00b5@guest.local', '$2a$10$mlii6Ejk8NHSw1H7idi34e06Rv9H4UQ6nHLvp065mj78cCqIgdM8e', '2025-12-11 02:33:02.053734+00', '2025-12-11 02:33:02.053734+00', NULL, 'f', 'user', '1'),
('accdca5d-e374-45bb-b7de-654c913558c7', 'Guest_57e7e320', '57e7e320-77c0-46a2-b43b-e7b0e7c5e52f@guest.local', '$2a$10$gn2cA9JBkN3SHBC9KMrvXeczRGtpfutvKeqPLpfTqfW71DttoJazC', '2025-12-21 22:22:13.795936+00', '2025-12-21 22:22:13.795936+00', NULL, 'f', 'user', '1'),
('61d18e5d-48be-4032-afc9-8abe83fe969c', 'Guest_af745321', 'af745321-8854-4f42-9309-90a4df6e9117@guest.local', '$2a$10$teGK54xVjyXvcsOxNuHK6.EsB5gC71VE12w6FgLvW5U6Mxfuyqypu', '2025-12-21 22:22:35.412794+00', '2025-12-21 22:22:35.412794+00', NULL, 'f', 'user', '1'),
('b7f75e35-0dbb-44ca-81ed-cb43045de52f', 'Guest_cff2c0e0', 'cff2c0e0-2cd3-4624-8acf-5c5b365d5fe9@guest.local', '$2a$10$Zg4zYRNUtEd0DkiD1K6V5e0wE5P1l.Z5FxPtLfpBDxpmZcvPziLcW', '2025-12-28 03:25:21.102877+00', '2025-12-28 03:25:21.102877+00', NULL, 'f', 'user', '1'),
('0c3c7262-b493-4cf7-9d5f-ad1ddd3fd567', 'Guest_c91f62cc', 'c91f62cc-1e98-46d4-8213-c3807dc72b55@guest.local', '$2a$10$px//iWNgwP72L7YSINOPOe.QJyUIvQI0nkrCpGL4MYREQU3nh2P1.', '2025-12-28 03:25:44.939805+00', '2025-12-28 03:25:44.939805+00', NULL, 'f', 'user', '1'),
('49bbddfb-0a16-46fa-a157-524b1f124461', 'test1', 'test1@test.com', '$2a$10$RWtr51Dxa4EJiRWNKEicduJI9H3fUbnDysJ0YtjAC2Hqa9AvZftvm', '2025-12-28 03:36:02.851881+00', '2025-12-28 03:36:02.851881+00', NULL, 'f', 'user', '1'),
('46acd5ea-0ef8-4a0e-88b1-54eb7b5027a9', 'test2', 'test2@test.com', '$2a$10$Efitphw7efvYq0BGgm9Nau6GYuX0f1IwznxsXqZuv3FgLZbfpl52q', '2025-12-28 03:36:42.971238+00', '2025-12-28 03:36:42.971238+00', NULL, 'f', 'user', '1'),
('befd6717-6dcf-41f6-a006-e2a3d6c7305b', 'Guest_701440e3', '701440e3-e102-4f0c-82a7-45ef372f9518@guest.local', '$2a$10$SxFsuoqE3AIq09kljkLdcO7GVIrgoeo3oVzMU4wE48gyDd4uqWiwu', '2025-12-28 20:50:43.922377+00', '2025-12-28 20:50:43.922377+00', NULL, 't', 'user', '1'),
('33f4ab03-dc02-4b55-855b-d52391e06927', 'Guest_e3987f7c', 'e3987f7c-f17c-45fa-b568-ff503e5b9b84@guest.local', '$2a$10$.Za6nUG8aOS/SpTBpOSfc.8NADPGh0TJaZoJrTWOvuPrI/FLBNH1u', '2025-12-28 20:58:18.716832+00', '2025-12-28 20:58:18.716832+00', NULL, 't', 'user', '1'),
('597b5bf8-9a83-48f5-ada8-7a2e9aad0a35', 'Guest_2b956946', '2b956946-c784-4889-bf47-001d04c43b9d@guest.local', '$2a$10$CyWPXsXP4SHSIG3KK65ylO.zLJ1XTtHGOlkZ6v3suhMmpWlj.rYae', '2025-12-28 22:03:46.389436+00', '2025-12-28 22:03:46.389436+00', NULL, 't', 'user', '1'),
('302e8b63-c700-45c4-8598-555ccde566df', 'Guest_46040974', '46040974-89d1-4523-affc-2c1c984a300f@guest.local', '$2a$10$SL/C1myMtdZivn0PGLhGYuLb34lPzbNonTeIcDD6zQiRxYTSuaDeG', '2025-12-28 22:10:57.426418+00', '2025-12-28 22:10:57.426418+00', NULL, 't', 'user', '1'),
('2a44cc0c-ec20-4db8-8394-3371b4f3a283', 'Guest_851d6b97', '851d6b97-bbed-429b-8c82-d7803bbf1d10@guest.local', '$2a$10$0NcUegrZnby1HxAsoSZVfOE4D7kBzt9JeJSZkSGQDiUrsDQVqqLp2', '2025-12-28 22:32:09.224434+00', '2025-12-28 22:32:09.224434+00', NULL, 't', 'user', '1'),
('980fcd4c-d1bd-457d-a2de-f24f12ea70f8', 'Guest_fbca5adf', 'fbca5adf-fab1-460b-9ffd-f3419c3df9e9@guest.local', '$2a$10$PsWLJZAvH7tLitjrrqPndubMcAlKbT/gElilepTJ/x5kFQCjouxTq', '2025-12-28 23:42:31.964534+00', '2025-12-28 23:42:31.964534+00', NULL, 't', 'user', '1'),
('2edc7251-2a42-415b-a8b8-96eb11d22956', 'Guest_3109b9a0', '3109b9a0-2cbd-403d-a45c-8f258df54a88@guest.local', '$2a$10$nlG7VEkHs.h10iirNuVwe.kcgTTUr6NduEffbwMRi8.bFYMlm2cvq', '2025-12-29 03:51:31.271757+00', '2025-12-29 03:51:31.271757+00', NULL, 't', 'user', '1'),
('591539bb-917d-40b5-992e-1b3b349afcb4', 'Guest_7717b235', '7717b235-db24-433c-8ff7-562af78a5097@guest.local', '$2a$10$tF6fmGJbIhgmBMPvVFk.y.yJlAQbbaX41lMLzFRUqp6HChFn1cB9i', '2026-02-06 20:21:21.685429+00', '2026-02-06 20:21:21.685429+00', NULL, 't', 'user', '1'),
('080d7054-0a5b-42c9-b68c-f4f716a48b48', 'Admin', 'admin@odyssey.dev', '$2a$10$tq7DccPVpWR/Ra5yfSV/ce5JC4GOahLfM907hnu1zPWk/hN1lWgCq', '2026-02-11 00:27:40.173999+00', '2026-02-11 00:27:40.173999+00', NULL, 'f', 'admin', '1'),
('db21eaec-948f-4582-b3f5-7786045f1f80', 'Guest_4033b8dd', '4033b8dd-8a3b-4127-b9ae-f8b86f2be803@guest.local', '$2a$10$YpHba6okVcdChZZfHrRt1.ognd4fpOjgIzlH0qLXeXFmbEV6gBxoK', '2026-02-11 00:33:58.831339+00', '2026-02-11 00:33:58.831339+00', NULL, 't', 'user', '1'),
('06468317-3dab-4bd8-8994-562b5bc089d4', 'Guest_e9980a38', 'e9980a38-bb37-4f1e-b1b3-291b38dc7446@guest.local', '$2a$10$32LBSjWKNylwI7Sz2lTb8evSBjgj06Vyfyvpli8EyL5FnX8t3dFRm', '2026-02-11 00:38:52.76781+00', '2026-02-11 00:38:52.76781+00', NULL, 't', 'user', '1'),
('70532dec-4006-42c3-9445-5630feccaa58', 'Guest_b6362e00', 'b6362e00-441f-4ddf-9142-404131f0e5f4@guest.local', '$2a$10$GMZmSBAK//wqvNaTwKEloOwZOy6NXCzD30DC7C4PiLM5O6E0VCQmS', '2026-02-11 20:33:18.454631+00', '2026-02-11 20:33:18.454631+00', NULL, 't', 'user', '1'),
('09a16b33-d65f-477f-8ecd-65773cf21bf2', 'Guest_2c1f54a5', '2c1f54a5-62dc-4b53-8758-ece8725bc73d@guest.local', '$2a$10$LpOrrxpu71FcJy5s1KEIL.iIzvFXOnEZ4v.NVHfOJb5uq2crHUj2W', '2026-02-13 04:11:02.362194+00', '2026-02-13 04:11:02.362194+00', NULL, 't', 'user', '1'),
('658b483c-f261-44fe-b436-d1a1fefa66ab', 'Guest_c52745aa', 'c52745aa-ca0a-423f-8182-49b8164b0dc8@guest.local', '$2a$10$tRLNAwSD5t2QSRuYS8BDF./AXUmmXDW98PTNwIJvob6E5PuZWWpiu', '2026-02-13 16:00:05.74338+00', '2026-02-13 16:00:05.74338+00', NULL, 't', 'user', '1'),
('d0fca698-2116-4ddc-9537-e9b3eaea6159', 'Guest_241c5e0c', '241c5e0c-0912-45c1-9e1e-59f3b0554b78@guest.local', '$2a$10$AekPjet/o3GWiJq7AyFJLup94SaKi0Bvu70.i9bTRgK1TLKANrQCy', '2026-02-17 02:27:44.65472+00', '2026-02-17 02:27:44.65472+00', NULL, 't', 'user', '1'),
('8e6ddabb-c4d3-4ea4-925f-f5b0e519daf9', 'Guest_257602ea', '257602ea-fa06-4561-beb2-9af9424318f1@guest.local', '$2a$10$fDypBY2xEQbywpuGiMyk.eLppM8pW4iEJN6UuIyMmB0kLeYye9r7q', '2026-02-17 02:29:10.47974+00', '2026-02-17 02:29:10.47974+00', NULL, 't', 'user', '1'),
('c439ce84-5531-400c-b925-97c11bd37268', 'Guest_dd4e18f8', 'dd4e18f8-8b3c-4926-8c74-9bc2de0e4806@guest.local', '$2a$10$0POxTPl908KNTp5Xvma5ae7VVMx7bo4cZHhDpACKZ6frxdTDIRSfa', '2026-02-17 02:31:30.644388+00', '2026-02-17 02:31:30.644388+00', NULL, 't', 'user', '1'),
('eca69a9a-297f-4b39-87f1-f89e15d68af9', 'Guest_7fa76b68', '7fa76b68-5b2e-4085-a543-8ad52c43c906@guest.local', '$2a$10$1LDc1u8P5sryUjm1CudbVONMevLFHUQkxeqj5PRFbdp7mvz8q1842', '2026-02-18 02:51:08.956308+00', '2026-02-18 02:51:08.956308+00', NULL, 't', 'user', '1'),
('789e9656-b8ec-4f7b-a555-0a2c40527f25', 'Guest_2dfbdba1', '2dfbdba1-43e3-4a5b-b6d0-7b1edc045881@guest.local', '$2a$10$SMLWTu7hKdKudEwLuePmXu7TUrGq6645hZtM4XyIGInWoKlZxCJoK', '2026-02-18 02:52:02.705405+00', '2026-02-18 02:52:02.705405+00', NULL, 't', 'user', '1'),
('367ea644-1e5f-41a3-9026-d9b365a0479c', 'Guest_f45cab35', 'f45cab35-b77f-455f-8de0-86d1000a0ffd@guest.local', '$2a$10$ewEAYxRNG52oQh1cW74xvu5.uOv9DqpEyamwH6Yv//M5bAuIB4S1S', '2026-02-18 03:24:23.344875+00', '2026-02-18 03:24:23.344875+00', NULL, 't', 'user', '1'),
('63dbf683-1e3b-4398-8cfc-b6ffe826489f', 'Guest_35165732', '35165732-ba9f-4785-a9ff-bdcda8fc201c@guest.local', '$2a$10$pF0I3c0bdlotgk2JclQpP.JsDSvapPvNO.d5PyiAGtP3FYU5.P6GG', '2026-02-19 01:43:03.103766+00', '2026-02-19 01:43:03.103766+00', NULL, 't', 'user', '1'),
('1f7e73a7-6d42-4fe3-a9d8-98f626d6bdac', 'Guest_328504cf', '328504cf-20c9-4eee-8702-23ff9bdb69c8@guest.local', '$2a$10$tjIoBECLM7.UBvsGOZR6BueGeUYpEMG74xW87icBd9eqGFQV3B8Om', '2026-02-19 04:03:40.097183+00', '2026-02-19 04:03:40.097183+00', NULL, 't', 'user', '1'),
('b82195cd-50ce-4530-a115-0eeeea002f08', 'Guest_2d9f0e8e', '2d9f0e8e-a0ee-41cd-8ca9-f727a40ec150@guest.local', '$2a$10$w.t02s9zVq6sa9cQHWYJZedFcERpHdlcuN41zyLDEpF8Ho4h1Qw/y', '2026-02-19 18:54:11.414748+00', '2026-02-19 18:54:11.414748+00', NULL, 't', 'user', '1'),
('0f9ccd1b-8059-401f-8cc2-a332440ce557', 'Guest_3f6d0759', '3f6d0759-1846-4e53-a945-dc2aa45f37c3@guest.local', '$2a$10$P2EWOs44qsLf3u7d/N6ow.TiCC5H1QJoD9YNgQ48BYgZDI6muwIlq', '2026-02-19 19:03:02.136632+00', '2026-02-19 19:03:02.136632+00', NULL, 't', 'user', '1'),
('6f8754d8-58c0-4d5a-8800-dfd7db85d442', 'Guest_977f5794', '977f5794-50b4-4165-9875-7a5c4699ba27@guest.local', '$2a$10$0pWRatYUVU23FQ59.oFp8.blj3gWvow4eTw5YwuiwRqYNe0dGk12u', '2026-02-20 00:18:02.210951+00', '2026-02-20 00:18:02.210951+00', NULL, 't', 'user', '1'),
('e84a82d2-6707-4fd9-94ff-89f03a3cb431', 'Guest_0f349199', '0f349199-12d1-42f5-85c5-a6e7bc95ba21@guest.local', '$2a$10$qXNQ7PoWz/vf8NhafUpGGumrGpFPVnKxsbPXjz.bEmjNS3wuaYcsC', '2026-02-20 18:38:01.896645+00', '2026-02-20 18:38:01.896645+00', NULL, 't', 'user', '1'),
('bb090990-71e6-405f-bfc6-b5d6847cb66b', 'Guest_79650331', '79650331-90f6-4cf3-8dc7-89221fb4a2de@guest.local', '$2a$10$iKcZP3TGajMvue39I7/NYeTaWgk54xOLCJMyIoudKyNyhJ4suQs8m', '2026-02-24 04:40:35.200772+00', '2026-02-24 04:40:35.200772+00', NULL, 't', 'user', '1'),
('6484721a-fa3d-4fe4-8064-2caff5502636', 'Guest_937c5903', '937c5903-0fc3-447a-b5a3-c3725496e414@guest.local', '$2a$10$jLNKMnD2FNYlikewhXBb3OmCyXnnZLsIDaD08KoKZBq4Xz7iqaqxe', '2026-02-25 04:05:55.101605+00', '2026-02-25 04:05:55.101605+00', NULL, 't', 'user', '1'),
('e02abf0e-fca6-4c0b-9339-1ff736b69e54', 'Guest_2839518a', '2839518a-dc0c-4cfb-baf8-f486926ee236@guest.local', '$2a$10$N7Yn6lqT8iN5ZbEFu1LdFOFMMi.A0MjdTFnRxdN3MrJeA./YI4nyW', '2026-02-25 04:22:38.348913+00', '2026-02-25 04:22:38.348913+00', NULL, 't', 'user', '1'),
('a8e51ce5-4b6d-4c13-b270-2a681839e112', 'Guest_57e004fd', '57e004fd-37b2-49e3-8e38-53f1bf555885@guest.local', '$2a$10$M6OvIc1OagLXSw53dkkYRer8wYgCAijIAIHw/UqMwufZOZ05ZhevO', '2026-02-26 03:51:17.50444+00', '2026-02-26 03:51:17.50444+00', NULL, 't', 'user', '1'),
('5d4e5bab-098f-443d-a400-f163f73eda19', 'Guest_d33614a9', 'd33614a9-a577-4983-8b78-ca00f3ec3459@guest.local', '$2a$10$t79t4JpXpyHjvA5od/PE6.wfc.lHJc5g.QYRd/SxxX80D6QYHXzMa', '2026-02-26 03:54:10.250674+00', '2026-02-26 03:54:10.250674+00', NULL, 't', 'user', '1'),
('2990ef4e-b3ed-4a94-8aac-81346a366bb1', 'Guest_7373d4f9', '7373d4f9-30f9-45b8-8e10-e8b4d697ed65@guest.local', '$2a$10$5YF5KVIrWzOE1pTS03uJN.f.F3ji9SiGJdWjO6KXoO18URerhKw9i', '2026-02-26 04:01:10.352737+00', '2026-02-26 04:01:10.352737+00', NULL, 't', 'user', '1'),
('c9e4f440-8959-4b5c-96db-a5c4fabfa73b', 'Guest_ecb3aa2f', 'ecb3aa2f-dbec-4257-beff-2daa0749230c@guest.local', '$2a$10$T.U2OQ.vNQQheOzfO1fLoeGUIb9JpcKgmAK/tlGXjtMXKJes8SqvW', '2026-02-26 04:24:32.579598+00', '2026-02-26 04:24:32.579598+00', NULL, 't', 'user', '1'),
('468de8c9-9491-4566-b811-f49df051b983', 'Guest_fe712ef0', 'fe712ef0-21b7-4940-bb4e-b34934cc09e3@guest.local', '$2a$10$zSbyXpudl/lOXIlgVgtqp.8H2AwZtCg7mmS6VkYCyNefedMvivWyS', '2026-02-26 04:37:39.03061+00', '2026-02-26 04:37:39.03061+00', NULL, 't', 'user', '1'),
('d24314bf-90b7-4255-89f8-e94b61d957c8', 'Guest_0b51c677', '0b51c677-960e-4c70-a8c6-fdf6708dd9cb@guest.local', '$2a$10$JgQFW/DSDbcVAyEVAiB9r.N8GXT0mc.ALOGT26BN7zcAMyfzZ12YO', '2026-02-27 00:53:13.729381+00', '2026-02-27 00:53:13.729381+00', NULL, 't', 'user', '1'),
('7ccfd91f-bd2b-44bc-92e5-021bb371058c', 'Guest_7b21783e', '7b21783e-9f8a-4717-bcac-5adf793108c8@guest.local', '$2a$10$FXQoat/KoV83.y7rv4rv4.CY9p11z0X3/5i5R3EtOQipqn6M/3w6G', '2026-02-27 01:59:50.704143+00', '2026-02-27 01:59:50.704143+00', NULL, 't', 'user', '1'),
('799b3baf-7d20-4cd7-8c97-1732673058a9', 'Guest_b35906b0', 'b35906b0-4153-4f8b-a5ef-ca0a9c3d6ffc@guest.local', '$2a$10$S28B/0EkkfCXFx/CbGl36e3K.7F49oGXoepsBV5V0H79KE8s7AwBe', '2026-03-06 02:31:34.902668+00', '2026-03-06 02:31:34.902668+00', NULL, 't', 'user', '3'),
('f585042f-af89-4432-8f21-860c4775b0c5', 'Guest_f0099d07', 'f0099d07-119d-4ecc-80d0-36aee4c7955f@guest.local', '$2a$10$OvecKDRaATFvMCIzXi94cuvPKbbR7TjwPxn.yzYWhI2tKEdfUHTc.', '2026-03-06 02:31:54.957878+00', '2026-03-06 02:31:54.957878+00', NULL, 't', 'user', '3'),
('4a54c29e-9368-45f0-952b-59eb05ecb7c4', 'Guest_c261e66d', 'c261e66d-3439-4d99-a71b-124ea24e60b6@guest.local', '$2a$10$NC5KGM568adNn8SKx0MGN.6aZaf1PXyDWifL1/zzQt.dGNxnQ5XfW', '2026-03-06 02:32:42.908358+00', '2026-03-06 02:32:42.908358+00', NULL, 't', 'user', '2'),
('4d985917-74fa-4109-87b1-39719f63e239', 'Guest_e2201d44', 'e2201d44-1730-4a20-b778-c0c47a622c31@guest.local', '$2a$10$D/fmIy0m9HiZkUjZaWgZHuD/2h7FQk65cnnHIXOxOZepWPgxzF8JG', '2026-03-06 02:33:13.74708+00', '2026-03-06 02:33:13.74708+00', NULL, 't', 'user', '1'),
('ee60c635-7d66-4134-9eff-4a93454ba1e7', 'Guest_172264ff', '172264ff-e5fa-4737-b10d-ed32b3cb6bd9@guest.local', '$2a$10$7n8xhgz8cgRF/T4vYdxGQ.5mm2v3vN7nGoZ.f8Zxy9zIiH9PTmYcu', '2026-03-06 02:33:25.214368+00', '2026-03-06 02:33:25.214368+00', NULL, 't', 'user', '3'),
('b42f31d4-9bba-41c5-bda5-0eef0ecfb706', 'Guest_a1ff32b4', 'a1ff32b4-9278-44cc-8432-5d73ecd86cfe@guest.local', '$2a$10$30FUaDkFrG9RAU1f4dW4X..G.qzgp8eu1NN5hTsFGor6GOzvFZYKC', '2026-03-06 02:33:34.023439+00', '2026-03-06 02:33:34.023439+00', NULL, 't', 'user', '2'),
('59e0716e-af9b-44c5-9185-1d26131671b2', 'Guest_b75a1c79', 'b75a1c79-2ba8-4ed1-925d-77f28c6ca9f9@guest.local', '$2a$10$9OE451b9336lfQY3uXVbbOcRqhFrs/DUbaeiNVveC.qEYKjOQZWRy', '2026-03-06 02:43:56.086016+00', '2026-03-06 02:43:56.086016+00', NULL, 't', 'user', '2'),
('101db453-9f2e-4338-8619-4d0dc3ddfce5', 'Guest_68d3e823', '68d3e823-93e5-4ea0-8386-32043f425148@guest.local', '$2a$10$fpD3H6SME0Mg0Y8E6DGTueIQmzzRGWUO/RnWy02NPUq.VW8LJ7n7G', '2026-03-06 02:44:08.292526+00', '2026-03-06 02:44:08.292526+00', NULL, 't', 'user', '2'),
('4a3b5660-9adf-43b4-8f1a-30460156c583', 'Guest_5a2c747c', '5a2c747c-544a-4b09-85a5-a61907e9430b@guest.local', '$2a$10$WAX/q9ngbwyAt/y109WP1OcYt/LUw.w8MmYgK.NOG7./HHcZ/s9pO', '2026-03-06 02:44:20.309898+00', '2026-03-06 02:44:20.309898+00', NULL, 't', 'user', '2'),
('0e9374c2-e724-4e66-bdc3-04f039711df5', 'Guest_ccb890ad', 'ccb890ad-9a02-4eca-bc4c-ecbc37d16a6c@guest.local', '$2a$10$yWuLIP7VfGcp56o8RAJ1lex.pFxIfDR39R1le7yKpI7GV/YrRf6Iu', '2026-03-06 02:44:41.63916+00', '2026-03-06 02:44:41.63916+00', NULL, 't', 'user', '3'),
('75bec1ad-2ef1-4fac-aafe-685b2237ac62', 'Guest_58224f80', '58224f80-8ecb-40e8-90c1-cc3759c0db13@guest.local', '$2a$10$1LRJcQRrfP9Y/GlPxNs6P.ToTftAnxcC5qZb9UHKnY8VFq.0tY6LC', '2026-03-06 03:38:16.037888+00', '2026-03-06 03:38:16.037888+00', NULL, 't', 'user', '1'),
('aef0470b-bbab-4caf-a09f-68b1df1b202d', 'Guest_733ded4a', '733ded4a-72a4-4296-b033-a2273fdfbfc1@guest.local', '$2a$10$SUXqFOQVmTBIxThVQGboHOoX0pXZGCJNc0T39ZJoHhB1IaZYzZ/3S', '2026-03-06 03:43:32.446176+00', '2026-03-06 03:43:32.446176+00', NULL, 't', 'user', '3'),
('2ff46b37-be16-44d3-a4aa-82c304a180ec', 'Guest_c54ecaf7', 'c54ecaf7-3d90-43fc-af9e-70340608167b@guest.local', '$2a$10$2dzVAUkHKRFN6wufnKnfxOXqIlUkO6se5mdYZLt4F/P62OQMdpmMS', '2026-03-06 22:13:26.226065+00', '2026-03-06 22:13:26.226065+00', NULL, 't', 'user', '1'),
('416002d9-78ae-4b12-a209-dd813666b52a', 'Guest_f35949d1', 'f35949d1-0c23-411f-bb81-eb6185ce89e6@guest.local', '$2a$10$AxGq7HGDcX4wvXtKXvOMZeYJo/2ftW6tp/vtvZ7iSkr83MXxYJiS6', '2026-03-08 00:46:52.801589+00', '2026-03-08 00:46:52.801589+00', NULL, 't', 'user', '3'),
('51563a84-f48c-456a-af43-2bdc583575f7', 'Guest_d9d42964', 'd9d42964-6d7e-486d-939f-9c42471d3d10@guest.local', '$2a$10$QvRpg/aPP9qUM7Noe0Q8vOApsypcPlkG.iBSpaKMpczpVjKBF/lKO', '2026-03-08 00:54:44.936064+00', '2026-03-08 00:54:44.936064+00', NULL, 't', 'user', '3'),
('1331aa79-25fa-4451-8c99-c322a3d31660', 'Guest_a8f972dc', 'a8f972dc-dbf0-476b-b5ae-396489fce1c7@guest.local', '$2a$10$FOSShxrDITkie4ifILrhYuGvQPuUzylowvO.9b5IbLJHU0RBY8V..', '2026-03-08 00:54:54.622516+00', '2026-03-08 00:54:54.622516+00', NULL, 't', 'user', '1'),
('d6cd74a2-8759-406f-8b0f-ac6ed34182ef', 'Guest_7fcbf55e', '7fcbf55e-25ca-4ad4-826b-70a3f87a509f@guest.local', '$2a$10$vr3hFPGGTmc3moIydl.mKOIKzg6Y6xZ3QjptBXTAvB9v6R1USaCFK', '2026-03-08 00:57:15.987747+00', '2026-03-08 00:57:15.987747+00', NULL, 't', 'user', '2'),
('af62d700-a98f-40b3-80e6-be58c39b9b46', 'Guest_0e9c9dcc', '0e9c9dcc-0d2d-45b3-adfa-0285cfda5866@guest.local', '$2a$10$QAZ8MIhYZfpCkol1/IbGGOtD2yhXYkfH6hFKTI0KP1mWHkxtOmPo6', '2026-03-08 00:57:17.019856+00', '2026-03-08 00:57:17.019856+00', NULL, 't', 'user', '2'),
('57831e0b-9ea2-4bdf-bb5b-6484cd3e0fac', 'Guest_cf7d3905', 'cf7d3905-47ee-42aa-8190-02aa3ee71e2f@guest.local', '$2a$10$b88SujSLYB6X9MfDjpItMuZUdZ6W0ThqkjrtrGIm4XXcaKd79yhOC', '2026-03-08 00:57:18.061149+00', '2026-03-08 00:57:18.061149+00', NULL, 't', 'user', '2'),
('e0fbd67e-a207-4299-b182-c3939cf210f3', 'Guest_568f60fd', '568f60fd-f193-4295-944c-b1ba72cc3897@guest.local', '$2a$10$EU3sUR.JZ2JEocdEo7lM9uF.eRPO3rI3QTWpr3THYhXdRoturhBs.', '2026-03-08 00:57:18.456432+00', '2026-03-08 00:57:18.456432+00', NULL, 't', 'user', '3'),
('53497c6d-e616-4148-b016-ea61a68899b5', 'Guest_59e658e6', '59e658e6-c698-44ad-a2b4-1112c35137de@guest.local', '$2a$10$wsWK2adNIr3sZ.psKDe40OqEqIwRtCrqLdnMqMxgCly53tLe6AdX6', '2026-03-08 00:57:24.324691+00', '2026-03-08 00:57:24.324691+00', NULL, 't', 'user', '3'),
('d51c5991-d436-4dba-ba2b-714d80d1c635', 'Guest_bca40b3f', 'bca40b3f-a9d1-4c3f-9f68-bc692c229629@guest.local', '$2a$10$zVIsd.E.GB53qEnboVAPDeaQWnisrH0mDSov6M9XGlbiY7tPJl0Ay', '2026-03-09 15:17:19.777456+00', '2026-03-09 15:17:19.777456+00', NULL, 't', 'user', '2'),
('cb4a0f42-8198-4305-bd03-59fa0e0c016a', 'Guest_9806f481', '9806f481-0a91-45c2-8b5d-f147a29785a8@guest.local', '$2a$10$89chOfYGufKBPepaMpFR3uWkyoG02Mvhhp3nHgFsLFky091uOwL2e', '2026-03-09 15:17:34.170028+00', '2026-03-09 15:17:34.170028+00', NULL, 't', 'user', '1'),
('defbaeb9-c5a4-49ee-8723-c95ba27d08b9', 'Guest_60e50a51', '60e50a51-f904-425f-a92a-9879be1433d1@guest.local', '$2a$10$Lju1ZvFUUyNGQpH2KqPkDOg2pDX9HfP5wer1BAXdqpUHwaiAD0Nhu', '2026-03-11 23:54:23.592547+00', '2026-03-11 23:54:23.592547+00', NULL, 't', 'user', '3'),
('975e0b37-d3a2-478d-b950-6c4c12d4fa51', 'Guest_898d1e9a', '898d1e9a-918c-4116-a30d-44b6af083b18@guest.local', '$2a$10$1vniqgbC8sZK9FwuVAHTR.ncUgsNJYdvpNyDtjlNYbrC2goW1jUP6', '2026-03-12 00:32:31.362435+00', '2026-03-12 00:32:31.362435+00', NULL, 't', 'user', '2'),
('e1fbfdae-533c-452e-aab2-28abdbc6a060', 'Guest_29777ac5', '29777ac5-726e-494f-bcf6-ece2039bad07@guest.local', '$2a$10$xWcLvApUaL4cyMEuhPXmPuRXm1LDRfhJNn/LZbz//cpjbbPa46/FK', '2026-03-12 00:34:10.752907+00', '2026-03-12 00:34:10.752907+00', NULL, 't', 'user', '3'),
('c0ab817f-a852-47da-b409-591f28770159', 'Guest_39daa9fd', '39daa9fd-aa74-45cb-a4a0-6cda2c6b533d@guest.local', '$2a$10$K.GmYzfpXw.JsSQnv1cpOOQB2tZcPGx1Vg1ElyIxmj.mwgl2rJRPi', '2026-03-12 00:52:45.017582+00', '2026-03-12 00:52:45.017582+00', NULL, 't', 'user', '2'),
('e8735db5-089e-4a78-9726-bf62c0d1f181', 'Guest_6c548daf', '6c548daf-0f0f-4e39-a3a2-71800cee5078@guest.local', '$2a$10$8KkzaOQA0BSJ9RBtTOAsNeuBeJP0XeMopNEZvkD4NQGSy5JBJgc4m', '2026-03-12 02:37:28.349463+00', '2026-03-12 02:37:28.349463+00', NULL, 't', 'user', '1'),
('6dcdbc93-795e-41c6-be13-cbeb507e507c', 'Guest_dca0c463', 'dca0c463-fd8c-4387-aad5-999019cc1e75@guest.local', '$2a$10$/E7gCefeS64FBYAUk3PKN.qJwjCQT6zclI6PFK2YK/ap7VVU93ojm', '2026-03-12 02:51:25.069541+00', '2026-03-12 02:51:25.069541+00', NULL, 't', 'user', '2'),
('61e7b355-28f9-4a59-b2cd-6f8c4f385763', 'Player1', 'p1@gmail.com', '$2a$10$eK33qbOhL7dpmIQXjP1DsuaX2RsJo74MSGU4Mw.64tM0vbKY47Oqe', '2026-03-12 02:53:08.521686+00', '2026-03-12 02:53:08.521686+00', NULL, 'f', 'user', '1'),
('fb3dad1b-4166-4fc0-a8d0-37bbc5d0af06', 'player 2', 'p2@gmail.com', '$2a$10$k7V6efxM68YzTA10eGlyTOnIIg/jsahy676GJ8MDOfiR7o7BmpC4.', '2026-03-12 02:53:43.536034+00', '2026-03-12 02:53:43.536034+00', NULL, 'f', 'user', '1'),
('df842f8f-24b5-48cd-9e99-a877aa94ab5c', 'Guest_9d1d5440', '9d1d5440-080f-4fa1-a400-0fabda0edd3c@guest.local', '$2a$10$mXYqVUtivPIRpb1FqPj0SOKDAOFag7erILGdK6xehDjKcp05yOjii', '2026-03-12 13:33:27.880377+00', '2026-03-12 13:33:27.880377+00', NULL, 't', 'user', '1'),
('0e037f0e-6861-491d-8b10-d31723e84969', 'Guest_01d575bd', '01d575bd-b28e-43e1-acdb-b8a66eb9b792@guest.local', '$2a$10$T2eGfVLlWnYQRzg9Rzza4ebnaURyKQAcFW/WxyKQ5ACcLS3eyd7CO', '2026-03-12 13:48:31.537082+00', '2026-03-12 13:48:31.537082+00', NULL, 't', 'user', '2'),
('98df549e-d620-49ef-a4d4-edf1d25b43ed', 'Guest_683872ee', '683872ee-6638-4d31-9573-55294ac42f57@guest.local', '$2a$10$PGrg5He.IH4g8oRJ6kIQyuzdmiGsb430VLZKzFdiByl/qp561PrFS', '2026-03-12 14:19:24.624474+00', '2026-03-12 14:19:24.624474+00', NULL, 't', 'user', '1'),
('2843954c-01b4-4028-b52e-363349e66965', 'Guest_3216d7e7', '3216d7e7-be5d-4260-8983-d1b2026c9077@guest.local', '$2a$10$SECgALFGiNoDcYKOiknOAe7U6mMEsaDNYyuI9EvdblQzwHzpuE8qK', '2026-03-12 18:10:33.847773+00', '2026-03-12 18:10:33.847773+00', NULL, 't', 'user', '3'),
('a033d2f8-061a-432a-b075-0884993ecad9', 'Guest_8eb21176', '8eb21176-0d3a-4394-b513-7e2981d79301@guest.local', '$2a$10$p1w2IY1b7.wOrc37sw7kjuwmJni0zBirkSU6AxGipIdnNKg3gQlh.', '2026-03-12 18:56:23.831204+00', '2026-03-12 18:56:23.831204+00', NULL, 't', 'user', '3'),
('36e9e14a-eafe-4a64-bcf0-716289b6a51a', 'Guest_9d25d113', '9d25d113-f27d-441d-b191-05aa1422b04a@guest.local', '$2a$10$BubFStvv8IoFwsa1QuskKu6Yw2T44TEsN7dhFug3sSumOCea5JlSC', '2026-03-12 23:53:23.770586+00', '2026-03-12 23:53:23.770586+00', NULL, 't', 'user', '2'),
('237eddc6-e9e8-4c47-9ceb-2e3ab4fe61f7', 'Guest_ea04511e', 'ea04511e-97a5-412f-b957-d0cf1a9adf31@guest.local', '$2a$10$dIY73kuurk.dvYQ.djz08.doWUdfVfr3cAG4QD1gYXOCUqqbn2rRW', '2026-03-17 02:03:33.099675+00', '2026-03-17 02:03:33.099675+00', NULL, 't', 'user', '3'),
('6a63be96-52ae-4cf3-ab1f-b9d3f9dfa364', 'Guest_267af262', '267af262-af42-4212-8ee9-0cfd6d818796@guest.local', '$2a$10$tjD12Yyi9Hju1Z8GtUaSXO4f.ifio7.xcigICZhTzdozTlMjztY1i', '2026-03-17 02:57:11.506217+00', '2026-03-17 02:57:11.506217+00', NULL, 't', 'user', '1'),
('89e784c4-a250-46b5-87e7-f4f87102b84f', 'Guest_61f0237b', '61f0237b-7090-4edd-b3e5-6ad3443ffe77@guest.local', '$2a$10$ezob68h5QQOokutWpXafveuGoLauL6MAznzkD.XaVbnM0rUO0NzGu', '2026-03-17 02:57:11.607325+00', '2026-03-17 02:57:11.607325+00', NULL, 't', 'user', '3'),
('267e4ae3-bded-4c25-86a0-30f7728ae78b', 'Guest_f6e812a1', 'f6e812a1-b965-4d67-8e7c-9cd574df9adb@guest.local', '$2a$10$o6klhxmROAg0Nwn7nVLgiey8ruksAYod4N7tC9O.kFvY1V7jH50X.', '2026-03-17 03:17:39.587506+00', '2026-03-17 03:17:39.587506+00', NULL, 't', 'user', '3'),
('75822068-183a-469f-9419-d5cfce1b3df0', 'Guest_17081056', '17081056-ca21-483a-afee-5edffe63408f@guest.local', '$2a$10$keImPMFmezf4waT6hWv/lOjChZU8J212ErsyPARVyxGzXxVeB24r2', '2026-03-17 03:18:45.356919+00', '2026-03-17 03:18:45.356919+00', NULL, 't', 'user', '1'),
('42d9490d-dd95-4082-9f71-d356d4328728', 'Guest_1f13c05d', '1f13c05d-e5fb-45e2-9e17-ccf8c7f1eef7@guest.local', '$2a$10$3BbItegh0U93HlIrDKy3x.YI87aUYyvag25a1EDp.Rr51NRgBlfEq', '2026-03-17 03:18:45.52126+00', '2026-03-17 03:18:45.52126+00', NULL, 't', 'user', '1'),
('e74b31fa-d52b-40b2-9d0a-280ba56ee32b', 'Guest_a6d17074', 'a6d17074-2888-42ea-a3a0-0062c534d4f3@guest.local', '$2a$10$Ug4YkNXMlrjCJyQJdOePtujGlEdb98jytgkwG972RXafIPh6WW9.e', '2026-03-17 03:18:45.787371+00', '2026-03-17 03:18:45.787371+00', NULL, 't', 'user', '1'),
('161255dc-f13c-412f-8c3b-eebb34737708', 'Guest_8e2b584e', '8e2b584e-f0b3-405c-86a1-c00843199960@guest.local', '$2a$10$HUHy9NX5nU4oMvMHke6vNueUVqWYcQ5FAqjDnOwpj5F0FaKH2lFcm', '2026-03-17 03:18:45.980619+00', '2026-03-17 03:18:45.980619+00', NULL, 't', 'user', '2'),
('f1640de5-67f1-4c73-9f68-7f6d0d3621d4', 'Guest_5f3c8084', '5f3c8084-0fcd-4d9e-9683-e1b6cf10e6e9@guest.local', '$2a$10$y5a8ZX4gpqSuECOhuCnfPORPJ7F3BSGGUaC5e2cHj9l1SlfYg47U.', '2026-03-17 03:18:46.188012+00', '2026-03-17 03:18:46.188012+00', NULL, 't', 'user', '1'),
('6fdab63d-cd16-48d5-83d8-aad3f6860dff', 'Guest_02fc6b08', '02fc6b08-7dc9-4ade-aa58-d5e95c85c9fa@guest.local', '$2a$10$xdKkGhaJxav7HSLzJggD6.VXW4VMIZb0ZYMpdx1QTyraG8kwGH.Cq', '2026-03-17 03:18:46.323271+00', '2026-03-17 03:18:46.323271+00', NULL, 't', 'user', '3'),
('1c0209c7-d172-49cf-b8ae-9f9252602202', 'Guest_531d1602', '531d1602-7b53-4f27-913e-4d25d13af7ae@guest.local', '$2a$10$MiO8rfl3j/miHyZ8ZPZWOu60Iiy54ABdAHabgcqcCvJAhiCrltkcm', '2026-03-17 03:18:46.525998+00', '2026-03-17 03:18:46.525998+00', NULL, 't', 'user', '1'),
('b00e24db-ff44-4411-a305-0c4a3f8ceaca', 'Guest_8181a02e', '8181a02e-58c7-4286-8cb2-6154661a96f0@guest.local', '$2a$10$3VXEV7MTFUmNMR1NpSNfm.Gd0lt8/WRa3Vq9gF3BcvsqkVjR1vcDe', '2026-03-17 03:18:46.747996+00', '2026-03-17 03:18:46.747996+00', NULL, 't', 'user', '2'),
('a822daa1-c0bd-46df-b296-f1e4230ab3bc', 'Guest_e442a77d', 'e442a77d-aadd-45b9-8d8e-d7dbfbbd46bc@guest.local', '$2a$10$GQr.RXEqr7euQS9e7UyS2OvdCch8WgdPhFQU4PgnAkGYCkuwQedCW', '2026-03-17 03:18:46.946258+00', '2026-03-17 03:18:46.946258+00', NULL, 't', 'user', '3'),
('68b033fa-540b-47d1-a46b-3734ed76698f', 'Guest_cc75949e', 'cc75949e-7ebd-43b1-abcf-708350370df4@guest.local', '$2a$10$oK8gM6yZCSGVn1dcl/wbk.Vq4itIp9966DFvOBn9CQZ/bceYtxR0S', '2026-03-17 03:18:47.129551+00', '2026-03-17 03:18:47.129551+00', NULL, 't', 'user', '3'),
('79b4f72e-2cad-485d-adc4-950ab1577af3', 'Guest_16a868a6', '16a868a6-3d74-4d12-b6ba-a4019a0bcaef@guest.local', '$2a$10$VlsSK9FdndRL5eECP5eW8.7HQqYE0rlI66rmmstfYSu78/rgjpy5q', '2026-03-17 03:18:47.337824+00', '2026-03-17 03:18:47.337824+00', NULL, 't', 'user', '2'),
('2fd4ea1a-244b-4432-a6b5-5b2813aab992', 'Guest_cda25af8', 'cda25af8-9ca9-4cf4-8390-54579543a114@guest.local', '$2a$10$P6iXb4/psnskiFnWgs9Wm.RRi04ezXMifh9Qr21IelnEWHFskEm1y', '2026-03-17 03:18:47.595048+00', '2026-03-17 03:18:47.595048+00', NULL, 't', 'user', '3'),
('5b72e83b-9b86-4d8b-8c85-f0b0062ac338', 'Guest_84cd3d2c', '84cd3d2c-fa37-4aab-bcea-a88fd3a14116@guest.local', '$2a$10$rlc3H1tf16CE7ZqXUrhvBuCveIJOCdIVJaq2YDsJ1aJDwDDt889Be', '2026-03-17 03:18:47.774419+00', '2026-03-17 03:18:47.774419+00', NULL, 't', 'user', '2'),
('d05cabcf-8a25-48b0-b22f-09b6b812d8ab', 'Guest_5cfcb377', '5cfcb377-060c-44db-8b39-580bc061b404@guest.local', '$2a$10$dRPpeC2x/yMeLWXKnGJQI./xT2ZAEvn9a0UiHTbVZCKfo/2SsrCBS', '2026-03-17 03:18:47.944336+00', '2026-03-17 03:18:47.944336+00', NULL, 't', 'user', '1'),
('9bcc0c8c-d9d9-40f7-ab86-37e4c0ec2c24', 'Guest_b9d7e65a', 'b9d7e65a-37b8-4510-98eb-949632212e54@guest.local', '$2a$10$zk5DS2VGE7PMm6xTJsF2IO5LwbBoqcuLxwN9k7bKHycKpLwctIYGS', '2026-03-17 03:18:48.12841+00', '2026-03-17 03:18:48.12841+00', NULL, 't', 'user', '3'),
('33d38baa-ccac-4c16-8a69-039d6286f5a5', 'Guest_3b1c6ba3', '3b1c6ba3-5a8e-4282-ad68-567f7351e9bb@guest.local', '$2a$10$8.xYd7hQv0.kdy72NdXm/eDFkpMMGQEltqGPE2PGnqdPZL75SWB0i', '2026-03-17 03:20:38.511365+00', '2026-03-17 03:20:38.511365+00', NULL, 't', 'user', '2'),
('7b1b3f84-bc36-42bf-a85d-229080f9a895', 'Guest_3d5cc4be', '3d5cc4be-6649-42d0-801a-a47434d0a053@guest.local', '$2a$10$0D2o1fiuhdWPGLAltlXosutvOexVljvziuXgRw3Te9hTM8Zx4LhEi', '2026-03-17 03:24:49.216777+00', '2026-03-17 03:24:49.216777+00', NULL, 't', 'user', '2'),
('42cd0e37-3193-475b-8973-76fbf5399393', 'Guest_b5e2afde', 'b5e2afde-fd26-41f0-ae36-465790bdc7cb@guest.local', '$2a$10$Ff7ZwT38V2P0tRE7/mGA1eBhu5w8oMxq/UNERpTTS0dhDya.WVMZq', '2026-03-17 03:24:49.399142+00', '2026-03-17 03:24:49.399142+00', NULL, 't', 'user', '2'),
('6109caeb-c4b9-476d-a5f5-bb8e80eb2112', 'Guest_4ee11b16', '4ee11b16-58e6-42bf-b3e8-c5afe49c66fe@guest.local', '$2a$10$oNAwj8Xq4jVyFpCJrpEMauK4ddzITO9OAbIm6iMJmCXAe3QSRWkvy', '2026-03-17 03:24:49.599942+00', '2026-03-17 03:24:49.599942+00', NULL, 't', 'user', '2'),
('ef57fade-475a-4255-84ec-d2fbdfdfb5cc', 'Guest_fef6a801', 'fef6a801-ba6f-41d9-a6c5-0dc70e6f9cef@guest.local', '$2a$10$Slq/5zaSeRBzolFeWB4uDuh4ZXwfemLgLxMqbcwgW.50US3PIQTY6', '2026-03-17 03:24:49.796604+00', '2026-03-17 03:24:49.796604+00', NULL, 't', 'user', '3'),
('b8b8e652-dc93-4fca-a63c-3cad100a07b4', 'Guest_e1737db4', 'e1737db4-9706-4402-969e-4beaa5c375ed@guest.local', '$2a$10$n2HtbYKeEPO3fZrK6Xk3metHmdRMi7.tR44Or/hVfI41S2dPSIoIK', '2026-03-17 03:24:50.00035+00', '2026-03-17 03:24:50.00035+00', NULL, 't', 'user', '1'),
('95569f19-bada-4a48-aa42-a0a98ae03580', 'Guest_c3e512ef', 'c3e512ef-eaa6-4ce8-8428-805fe0a5f27a@guest.local', '$2a$10$PFYG20KApO0Vu64NhQL3peLST0vGHINbKPac6n84ttmygCKEFIfWm', '2026-03-17 03:24:50.205994+00', '2026-03-17 03:24:50.205994+00', NULL, 't', 'user', '2'),
('30bfc58c-257e-411a-9d01-318d3ac1f60f', 'Guest_33939133', '33939133-c900-4e87-8606-363f45331131@guest.local', '$2a$10$vOxF1LVFqqDBB72ReFNxp.GrM/X07uq5YOXWfDw0q4esWCQyYEUR.', '2026-03-17 03:24:50.389279+00', '2026-03-17 03:24:50.389279+00', NULL, 't', 'user', '2'),
('c516d13f-4c9b-45b7-b4fc-47814123eb3f', 'Guest_ff832c23', 'ff832c23-f8db-4ba6-98b7-368d36c0d1d0@guest.local', '$2a$10$IwYNOYEqAhm/J4A5JOSds.c5vkqXXjNgxFV9pSZzswtgPnum1jVXK', '2026-03-17 03:24:50.614363+00', '2026-03-17 03:24:50.614363+00', NULL, 't', 'user', '3'),
('96248812-3d38-4de1-82a7-9bd75c145494', 'Guest_8add1592', '8add1592-7589-4b55-9c61-21f5f1a0a686@guest.local', '$2a$10$A1OSW//PPqf63XpXLH/ABeofoRYv/8DU0/f2h6p1mpjRqB9h.KI76', '2026-03-17 03:24:50.822658+00', '2026-03-17 03:24:50.822658+00', NULL, 't', 'user', '1'),
('fc8826a4-5ba8-4e52-a11d-d63f25a194df', 'Guest_f883730b', 'f883730b-d8af-49be-8d2e-96002860a427@guest.local', '$2a$10$AVZjsu/M0r0pVWAdqZh7Xee9BYdpECa9MLiSe1rb8x2yYB.XO5df.', '2026-03-17 03:24:51.007548+00', '2026-03-17 03:24:51.007548+00', NULL, 't', 'user', '2'),
('571e1e9a-37ce-40f3-8c85-0198d7966d78', 'Guest_ab9c8efd', 'ab9c8efd-3e13-4bbb-846a-bf73e289644f@guest.local', '$2a$10$vzVk7pNx5BSwLhvjicClTungeOiEd8WyYRpNq5I6.KTs22Cpm7f62', '2026-03-17 03:24:51.200303+00', '2026-03-17 03:24:51.200303+00', NULL, 't', 'user', '2'),
('ed868f3e-5ada-4dff-a66c-84079a0c8da9', 'Guest_0d274cd0', '0d274cd0-1043-4ffd-b591-41df596a4f1e@guest.local', '$2a$10$cIlABjYaIJrRYtXgQ.jb7O5Keh1CMFDkIQoKPqhIDgYJiDHDDw1GW', '2026-03-17 03:24:51.399604+00', '2026-03-17 03:24:51.399604+00', NULL, 't', 'user', '1'),
('b49db512-24a0-4fd7-b965-65c08b21dda6', 'Guest_ab3f76ad', 'ab3f76ad-d39b-4624-b298-a097bc2feb9c@guest.local', '$2a$10$o7205DpajPr.RQBWNfrTg.84xfIJ5U7APcjDcEg4fNq/wm6/udphG', '2026-03-17 03:24:51.607516+00', '2026-03-17 03:24:51.607516+00', NULL, 't', 'user', '3'),
('86c20e92-aabf-4f99-acf3-138c09e5d572', 'Guest_a83263c1', 'a83263c1-b038-4ddc-b903-a235bf7acd74@guest.local', '$2a$10$JPHmzgw1Xa2A7f3CXFaLsur1Ti7Sl.X.j8LVM3xTIVT4hBK0MiGp2', '2026-03-17 03:24:51.807881+00', '2026-03-17 03:24:51.807881+00', NULL, 't', 'user', '3'),
('4d2405a6-de77-496a-ac43-3f767ebe2388', 'Guest_c87b5558', 'c87b5558-1e71-4e26-953a-aff90e508a99@guest.local', '$2a$10$KjHv8iIt7uQqXo8dHmv95en9MDcLq0jlvVHnszRObFsvWy8wsMAIq', '2026-03-17 03:24:52.005389+00', '2026-03-17 03:24:52.005389+00', NULL, 't', 'user', '1'),
('8828e95e-af91-46ac-9b46-98bfb8a6992b', 'Guest_c0d0759f', 'c0d0759f-6811-4a87-b347-631e263941b9@guest.local', '$2a$10$sJLjnER7skOFq2dGiTRHneUQ3clc0K295bfCFX0ExL9Rd.JHtN9ku', '2026-03-17 03:25:21.628088+00', '2026-03-17 03:25:21.628088+00', NULL, 't', 'user', '3'),
('60d524da-d407-4ac9-9890-8f19c058b663', 'Guest_a098ee8c', 'a098ee8c-3485-4145-86c5-9a39c4f76d72@guest.local', '$2a$10$wF46HkoE1LpoBXCmUKFFa.GZpB/USbNNM89ZISr/fv91SZ8CMZBwu', '2026-03-17 03:29:34.88068+00', '2026-03-17 03:29:34.88068+00', NULL, 't', 'user', '1'),
('96c1f50e-a544-4cf4-8dbc-59e6eb7a0c5d', 'Guest_3ce2d60e', '3ce2d60e-c41d-4a9a-81d7-a5069926a06f@guest.local', '$2a$10$bqOEB6w.jYz9LGFvhLlXqeivCfJ7rUeEO8pz2G6AYJR79B1vkVKBO', '2026-03-17 03:29:35.030336+00', '2026-03-17 03:29:35.030336+00', NULL, 't', 'user', '2'),
('3c5833c6-5c6d-451b-93f7-0f7d1864c5ab', 'Guest_eafac72a', 'eafac72a-b58a-426f-a268-1943bb41ba74@guest.local', '$2a$10$Oyvj4ELxan4HXn1E7GN0.uT8ydPiZrPOsFdH.kY4YVp14xXFMg3o.', '2026-03-17 03:29:35.253102+00', '2026-03-17 03:29:35.253102+00', NULL, 't', 'user', '3'),
('5282d08f-e38f-4912-86c0-fb435f6dc042', 'Guest_c628a24f', 'c628a24f-fb76-4017-8e30-11a8db9de111@guest.local', '$2a$10$cAhwky7av0phHge9INwdB.IjXx5UbYJ7l67Qj5gnSZOF0Zj5RfYda', '2026-03-17 03:29:35.454299+00', '2026-03-17 03:29:35.454299+00', NULL, 't', 'user', '3'),
('c4b5e4f9-c4a1-4ddd-93ed-8b57b60ff06d', 'Guest_c5ba8c6b', 'c5ba8c6b-3560-4ba9-a142-f2222356bdfc@guest.local', '$2a$10$41PEtWVaO9YiAfgL7XxwfeqsMB53cgunu.KnBwkUgHVPBNjf1pivK', '2026-03-17 03:29:35.719018+00', '2026-03-17 03:29:35.719018+00', NULL, 't', 'user', '2'),
('27432567-4edd-4600-bb73-e4c1d0b268f8', 'Guest_029f9808', '029f9808-5e19-4241-839a-628046c914d5@guest.local', '$2a$10$HKe1Ie7EIqX9ByRaV32g4es4QMsbIIEXq6vtHX0xGumnmbhEcBvWS', '2026-03-17 03:29:35.95964+00', '2026-03-17 03:29:35.95964+00', NULL, 't', 'user', '3'),
('62224423-cf5b-4b60-9868-5eccd5342364', 'Guest_d467277d', 'd467277d-01d2-417e-bf93-91fb1d9d3143@guest.local', '$2a$10$lNMMgpM5nUXmxbF0Qp9LD.4qvYYRQ/A2Um9jc2sEIbgUHMV0tB51e', '2026-03-17 03:29:36.110149+00', '2026-03-17 03:29:36.110149+00', NULL, 't', 'user', '1'),
('c78cf2b2-0b5f-4c78-b4a2-6a5fe6f6dc62', 'Guest_1f32d429', '1f32d429-1795-41fa-af08-aec4721918c7@guest.local', '$2a$10$E.9Jldkble6.vAfKy.Q2hOY/fE2qpkxQqeNr0b2mv7iAJoy2AUgGK', '2026-03-17 03:29:36.326915+00', '2026-03-17 03:29:36.326915+00', NULL, 't', 'user', '3'),
('e9b4d75d-249d-45ec-a6bd-f90702abe58c', 'Guest_bb020a8c', 'bb020a8c-0cdb-4173-9e3c-536d2cbf61dd@guest.local', '$2a$10$GUvTo8krG1UvBm.vU2ZHXuDUsg1zzQzdJZbedpf4T8HYBXUIOGilW', '2026-03-17 03:29:36.5439+00', '2026-03-17 03:29:36.5439+00', NULL, 't', 'user', '2'),
('f62252cf-7db1-4d2e-8574-5e7e69063373', 'Guest_0baa0f59', '0baa0f59-4294-4269-8332-b87abfd9edd4@guest.local', '$2a$10$2QI.nz6MRiaYq./xzqWE4ODsHsGbjgSz0DwlofQIJXTL/X7b.ob.q', '2026-03-17 03:29:36.790054+00', '2026-03-17 03:29:36.790054+00', NULL, 't', 'user', '1'),
('633f1aae-d1ff-4da9-9342-e4798a42c0c2', 'Guest_0bd4037c', '0bd4037c-23b2-4c49-a15d-bb6132963a6f@guest.local', '$2a$10$qxixEmqoHYMGFCcPqhsOMOsMZUY2bky1u.1obBAZVYUOtRFtNdIkm', '2026-03-17 03:29:36.960252+00', '2026-03-17 03:29:36.960252+00', NULL, 't', 'user', '3'),
('bb10e01f-c8a1-470f-962c-f116cae5d090', 'Guest_246b2f38', '246b2f38-205a-4a33-a3f4-3b9162faaf70@guest.local', '$2a$10$zBtOVlbDLqdmxVJX1VIv.O5sFX.UmzbslU/lp3Fw9NmLqSKKaM9j2', '2026-03-17 03:29:37.186126+00', '2026-03-17 03:29:37.186126+00', NULL, 't', 'user', '3'),
('732c82bb-3a27-40bd-96c9-46b147acaaf4', 'Guest_6260d840', '6260d840-2a8b-4d78-ba7d-f9d539038656@guest.local', '$2a$10$nNea6qcISQLVAyOkeEhTXuZCOOCXfoPs6Q/DqQFqMR.PDNK66AM2u', '2026-03-17 03:29:37.635909+00', '2026-03-17 03:29:37.635909+00', NULL, 't', 'user', '1'),
('aaeb17ce-977e-4e8f-b46b-36fb3ac2635b', 'Guest_14e79792', '14e79792-0055-4857-b516-a0b6e20383ac@guest.local', '$2a$10$VO1SBPd2o.aNQGOL6uW7huubet4sE6xzWIGk5XlJmK2BMkQ./vaIO', '2026-03-17 03:29:37.926075+00', '2026-03-17 03:29:37.926075+00', NULL, 't', 'user', '1'),
('3af2e5e0-1c81-4c28-aa24-1dc2e392c8a7', 'Guest_4f0c9586', '4f0c9586-5832-4dc9-aac8-568a9032150f@guest.local', '$2a$10$o4.cVp/qTlyBXj.vMLTEqemFIqdPZI/S4uM7E9RRzZBUU51LmaGzy', '2026-03-17 03:29:38.249604+00', '2026-03-17 03:29:38.249604+00', NULL, 't', 'user', '1'),
('9529fa24-3ca7-43da-bc8a-39c0cfcf9b40', 'Guest_d4d0458e', 'd4d0458e-b0d5-4bc9-b0ba-c2601856d585@guest.local', '$2a$10$QzKQx5fozYGfVjm4KjLskOHu2boxLO4rieFEyjFEWSbc/rzJ0SPoG', '2026-03-18 02:37:15.458698+00', '2026-03-18 02:37:15.458698+00', NULL, 't', 'user', '1'),
('7c1e55c7-8e19-4aa6-b28f-445184a8a8bf', 'Guest_da3f6115', 'da3f6115-7a05-4b40-a3bf-bb52f8244e77@guest.local', '$2a$10$h6S.MQhudYCRIvoVRpmq5OKJfM4g.3m3wpXo21lQUKGpfWE7v9Qwi', '2026-03-18 03:14:33.669788+00', '2026-03-18 03:14:33.669788+00', NULL, 't', 'user', '3'),
('a8117d3b-e5ba-4a27-9af2-5976fc9e24db', 'Guest_ed298862', 'ed298862-f884-4f9d-b436-c1f7aeefcd2b@guest.local', '$2a$10$z/0gYCtH8sTsc8QUNdTMAumyqKFP6V1bA/HRUBJ8sYCH7QPEBPxuK', '2026-03-18 03:16:23.412558+00', '2026-03-18 03:16:23.412558+00', NULL, 't', 'user', '3'),
('2711e241-1186-401a-be95-30373f77c031', 'Guest_56b1cb6f', '56b1cb6f-f484-4098-931e-a8741e466a19@guest.local', '$2a$10$.V3ltozMmKM2iJH0ENnZEe/UP2P0V8MwejyOk6f5dtlfQ6FsHvoWK', '2026-03-18 03:17:24.838665+00', '2026-03-18 03:17:24.838665+00', NULL, 't', 'user', '3'),
('7ad5be16-e97e-49f9-aead-899a5cba2f2a', 'Guest_4f7d2df0', '4f7d2df0-7fbd-412b-85ba-6728f6dd42a0@guest.local', '$2a$10$0vkt6pcFEDmE8Dh2oyNS7.Syh5HTdyDjsfx41eIbw/ypTQkiJH5WG', '2026-03-18 03:18:22.544484+00', '2026-03-18 03:18:22.544484+00', NULL, 't', 'user', '2'),
('00f826d4-a072-451a-b923-a646ce57e0f7', 'Guest_642a732f', '642a732f-2e90-4a4b-9856-71e191a83885@guest.local', '$2a$10$YCaOj4Ue2rmTnUI7NOe1.e62whvaK86.VtUMt8P9DHapQbwsKv8Xi', '2026-03-25 01:28:30.40357+00', '2026-03-25 01:28:30.40357+00', NULL, 't', 'user', '2'),
('2edb3fec-e285-4ee8-986d-c1ced1bc27d7', 'Guest_b911155e', 'b911155e-849f-4c95-90ad-504feb8e42b2@guest.local', '$2a$10$ju4CIAYlkpvgdVqYEkV5xeWywRD7UHiD2vw828NDRRGKuWh4oq4oW', '2026-03-25 01:44:18.659433+00', '2026-03-25 01:44:18.659433+00', NULL, 't', 'user', '1'),
('9a6684dd-bbe1-4d97-a319-35c46df38507', 'Guest_51fa88ec', '51fa88ec-dcdf-44cc-b415-3e9745c374cf@guest.local', '$2a$10$5DY4ZZ7iDUaAXirZHL0hjO1.LyxusFFoEIRJW1MunTpQ/ELOExzGC', '2026-03-25 01:45:12.022659+00', '2026-03-25 01:45:12.022659+00', NULL, 't', 'user', '3'),
('cf04ec46-94e4-4788-94af-413a9c934fb2', 'Guest_d5032ed9', 'd5032ed9-6950-4c92-99bc-f4bfbe22f30b@guest.local', '$2a$10$/IXEGmgDNKN9gKk7w41f3.WbzBTDUDrbQAYZ0L46w1xcvg5D9td3.', '2026-03-25 01:46:14.775004+00', '2026-03-25 01:46:14.775004+00', NULL, 't', 'user', '3'),
('2bced79f-771e-48da-af96-936299962a67', 'admin.demo@exampladmin_demo_rpge.com', 'admin.demo@example.com', '$2a$10$JCuNfi84sZJUzTHRzFeumOLCelF/Uq7Lf3VDVgIl/AjNN01TTggJi', '2026-04-07 01:13:46.5351+00', '2026-04-07 01:13:46.5351+00', NULL, 'f', 'user', '1'),
('b6b385c7-b732-47ec-8dbb-2d998ccd8753', 'Guest_24d4ef9f', '24d4ef9f-18ef-4521-badd-d081fb5f3c21@guest.local', '$2a$10$EXdr4uZ9gGWLQV.pfKW/ju.561u/xAYiOo92p87WPozlZtnCvwS1y', '2026-04-08 04:35:28.070423+00', '2026-04-08 04:35:28.070423+00', NULL, 't', 'user', '3'),
('09a16dd5-2e05-4b4f-ad6c-bb67cb3abcf2', 'Guest_8bf33235', '8bf33235-39e6-4dae-a666-b0d00838e93d@guest.local', '$2a$10$6yqaDYkC5iQxedf8pOVaReErc9fv8/J98GUZgbFduLDuzfw6qxkdK', '2026-04-16 02:21:00.556044+00', '2026-04-16 02:21:00.556044+00', NULL, 't', 'user', '1'),
('7f7f7ec6-0a6a-42ef-a563-390597f66ddc', 'Guest_e05d7c25', 'e05d7c25-625c-42cc-a702-1b5d5548a3d8@guest.local', '$2a$10$Ny/7Slpc/ZuWtDJTAPjZte7bhgM0lieZNIP5xBPXzdyR2Ew30Ejnm', '2026-04-16 03:03:58.710834+00', '2026-04-16 03:03:58.710834+00', NULL, 't', 'user', '3'),
('0a0f7532-5e01-47e1-ab25-747f0250fdd5', 'Guest_dcfc1d59', 'dcfc1d59-ead8-4c64-b073-78f830a5e32e@guest.local', '$2a$10$/isfuPrXTjRW5v59gaXc6u1ZPy3t9XRb1PFBTu5RzoQdG977W/5s2', '2026-04-17 01:13:16.553817+00', '2026-04-17 01:13:16.553817+00', NULL, 't', 'user', '3'),
('26138cb0-4b1b-4039-b803-02dad9893941', 'Guest_d8a68e36', 'd8a68e36-7eb7-4dc0-879f-ef9377ad8e69@guest.local', '$2a$10$hA93n0MB2OE6rfWc5pwT9OTkJuhtYqpRIVy3bgj3PpND0nN4os1ze', '2026-04-20 23:57:43.224502+00', '2026-04-20 23:57:43.224502+00', NULL, 't', 'user', '3'),
('ffa47002-9965-4701-8fef-4d99958b0553', 'Guest_57e3b6ea', '57e3b6ea-6c31-4532-b2f8-7f42f22f6999@guest.local', '$2a$10$62EZw/.RQcv4NBE2MD/vQuLsd.G0n/AcOwQbdQ.gIJ.xrh/V1xh/m', '2026-04-21 00:50:37.391269+00', '2026-04-21 00:50:37.391269+00', NULL, 't', 'user', '2'),
('0129d1a3-1fcc-4123-86f5-2d016211486b', 'Guest_3031ad14', '3031ad14-159f-419f-91d2-56ce5f09c4e7@guest.local', '$2a$10$P/Wr9dIVhLP21Iz0MLmbWOY1kRt/je4j6s8j8xpZhss5Sx7zfJ6ou', '2026-04-21 00:50:39.933027+00', '2026-04-21 00:50:39.933027+00', NULL, 't', 'user', '1'),
('26465489-d4ba-4e30-9b84-a13e023ed93c', 'Guest_5d15d7cd', '5d15d7cd-42cb-43a5-8258-e10958366e3f@guest.local', '$2a$10$fGrd91WNl0t9tQliwcz54.Ymf8OlIz0N7sjk3z8rLc8zYjacei9xW', '2026-04-21 00:50:47.217718+00', '2026-04-21 00:50:47.217718+00', NULL, 't', 'user', '1'),
('577c1baa-1d0f-4a2b-a939-db029e34257c', 'Guest_8586462f', '8586462f-f488-4a35-9b2d-c15761f140b5@guest.local', '$2a$10$DFsbP0J5w1dEMJ7zltwuRuYBxln3NBKYOS.QHcc4vw2OPG011h47.', '2026-04-21 00:53:12.104028+00', '2026-04-21 00:53:12.104028+00', NULL, 't', 'user', '3'),
('8f6d9085-d2da-4c7b-a38d-3731263ed77e', 'Guest_1d11cf48', '1d11cf48-403f-4b1f-a7ab-7a81ea3945e7@guest.local', '$2a$10$5UxPPq/rSiMkZzoqL4GH8.eNiUSjiL5sYni7Qsf4i02hh2bX0/Ci.', '2026-04-21 00:55:32.240596+00', '2026-04-21 00:55:32.240596+00', NULL, 't', 'user', '3'),
('aa3b7756-c054-42cb-845a-a48717cee556', 'Guest_3975bb97', '3975bb97-0b06-4b2e-82d6-ca96c2c4f796@guest.local', '$2a$10$DHF5W5MSJXNfn1tUhnvKde/euHdWk826HxpE4/0pkToPv2mMBlPT6', '2026-04-21 00:55:39.870862+00', '2026-04-21 00:55:39.870862+00', NULL, 't', 'user', '1'),
('7b4ef4e3-dae4-4c1c-aa15-42800c3007ee', 'Guest_4790994a', '4790994a-093b-430b-8b08-aaa779da7498@guest.local', '$2a$10$ezh6/98raCwFYh95CdsYeu.S/I4Y3gi1PzPvOz8vsHCjyDW.GRE5m', '2026-04-21 01:45:01.693102+00', '2026-04-21 01:45:01.693102+00', NULL, 't', 'user', '2'),
('62e7c3c4-46f5-4fd9-9ed5-613911e35de1', 'Guest_7b41f909', '7b41f909-0a8f-4b3f-9162-d12358655044@guest.local', '$2a$10$70Z8y/8AoWdeAgAKFAnvfO5/Rci4jMXDyYwFd2LgbfBarDOxuRN3e', '2026-04-21 01:45:35.810584+00', '2026-04-21 01:45:35.810584+00', NULL, 't', 'user', '1'),
('62e5426b-9987-4e58-abc5-98f10ec6fa8a', 'Guest_a10d2692', 'a10d2692-802c-489e-b3e3-989cf6b2aeda@guest.local', '$2a$10$YGTGqGkBy7RQ3rWzga0eKe6rCUBUcIzKFF5FOCB6z9mBjugOR0ysC', '2026-05-05 01:23:25.88105+00', '2026-05-05 01:23:25.88105+00', NULL, 't', 'user', '2'),
('c35da669-c190-4a4b-bf7c-6fb1317794f9', 'Guest_a2fb0f35', 'a2fb0f35-e717-4119-896c-ab5fdf0f4bf2@guest.local', '$2a$10$DsvBOIwtar.Ct.8YFcX9iO5l9lFy3O6AJV49YqntstNYB7ZvSjcWe', '2026-05-05 02:33:39.84581+00', '2026-05-05 02:33:39.84581+00', NULL, 't', 'user', '3'),
('18237bbe-a3e4-4871-9b89-1290c878d616', 'Guest_24b22f94', '24b22f94-02fb-42ac-93d1-dbbaf9851e8f@guest.local', '$2a$10$WUBuYzgwyudXQzxAgg6HZe17wtV5ymbCR7E6L0AmXLaA9XwSfIPmS', '2026-05-05 13:40:32.121517+00', '2026-05-05 13:40:32.121517+00', NULL, 't', 'user', '1'),
('b05216b9-8db5-46e5-b431-1b49951d6ab2', 'Guest_131392bd', '131392bd-0780-4905-928b-1ae5f159170f@guest.local', '$2a$10$Ko86vtB2TPDHPPQGB5BTUedsVMbBpTNyEL1..oka9vp/n5uUCasi.', '2026-05-06 03:12:58.653138+00', '2026-05-06 03:12:58.653138+00', NULL, 't', 'user', '3'),
('13b750ce-b9af-4732-91c8-4cd616eaad6b', 'Guest_dfa4b7b5', 'dfa4b7b5-39a5-4972-bbfb-07f6629ff349@guest.local', '$2a$10$0c/7i/6JjOm2Lt8jIsfTyODAJokDavm/hKE.wMrBEOjr2knEt86A2', '2026-05-06 03:28:40.954105+00', '2026-05-06 03:28:40.954105+00', NULL, 't', 'user', '3'),
('8bae3373-5629-4d83-baac-10039165e6cb', 'Guest_9ed7cfea', '9ed7cfea-4af7-4b71-8a6d-a30a74dc8d13@guest.local', '$2a$10$X0BuLQt9w3fcGzR9guU5DO2EODu68kBIjEEMOCPgvs5p5PHhS8i6.', '2026-05-06 03:32:47.385406+00', '2026-05-06 03:32:47.385406+00', NULL, 't', 'user', '1'),
('345d924a-f33f-490b-a737-d27caf225fbf', 'Guest_adfbac5e', 'adfbac5e-1045-4aab-9c0b-b5473b1d1978@guest.local', '$2a$10$hLYnmeWetIiFqmGHDnlT8ep6s/ApbSW9y366AkysBW/0t6Otw7CM2', '2026-05-06 03:39:45.413056+00', '2026-05-06 03:39:45.413056+00', NULL, 't', 'user', '1'),
('51539628-4ad4-497c-89b0-5e121a9630f0', 'Guest_c68fdb3a', 'c68fdb3a-16f8-4c3e-8160-4bf5c06cfe68@guest.local', '$2a$10$.mOpilJZJjc.Gne78zQ8Aew70mctuEgFqzYJGUkfXh1sdkC8sjMGG', '2026-05-06 03:45:54.368538+00', '2026-05-06 03:45:54.368538+00', NULL, 't', 'user', '3'),
('0382f5b7-7d6c-4448-89af-9fffc93523f8', 'Guest_1acf8006', '1acf8006-39c6-4482-a7d9-2a0a8d1eab45@guest.local', '$2a$10$XIdLCd1puizdAbhKmNzd/uIz6t.eEACIiB4dip9H2CwXuYSO9nT62', '2026-05-06 03:47:43.624022+00', '2026-05-06 03:47:43.624022+00', NULL, 't', 'user', '1'),
('bead34b1-2f3d-47b4-9e97-ee0d274d264a', 'Guest_846d2707', '846d2707-886d-4ef5-93bb-6ed6e996ae5a@guest.local', '$2a$10$pdL/1IS8Q768i6a8KRx12.XAEbT4z.ckFF0Rn5prgSfmOyglFMLxC', '2026-05-06 04:11:24.683359+00', '2026-05-06 04:11:24.683359+00', NULL, 't', 'user', '1'),
('dec23984-a581-4d4f-9bdf-95974935f435', 'Guest_8eb51b74', '8eb51b74-8f18-4a87-b987-b5e659b710a5@guest.local', '$2a$10$KcPWmFpfWXQhtKf3MJ76keU/5XaVh6AUtFdEl08w8rIFH0112vHc2', '2026-05-06 04:18:33.863462+00', '2026-05-06 04:18:33.863462+00', NULL, 't', 'user', '3'),
('4a2ea43e-05cf-4877-accb-c2cd995f63e5', 'Guest_66b4e4e3', '66b4e4e3-91f5-4827-89b4-52419ba7c20b@guest.local', '$2a$10$/3nVH0AwR9uaNS9LLqiGQOW5XogXlWPuiaZKkM8NYFxsE8stpjdLS', '2026-05-06 04:58:08.082123+00', '2026-05-06 04:58:08.082123+00', NULL, 't', 'user', '1'),
('50205a84-51ff-42cc-b077-7bb638b8842f', 'Guest_add09c3e', 'add09c3e-429e-4e2a-8a5c-031848198e0b@guest.local', '$2a$10$1Y8b29A8qls.qmzNCtztVOZpcimtDynrZu0i6z7keRAEwPTbtnuS.', '2026-05-06 04:59:48.680687+00', '2026-05-06 04:59:48.680687+00', NULL, 't', 'user', '3'),
('af7ffa29-bbf9-4aab-a0bb-aabdf1523c2b', 'Guest_c6d71381', 'c6d71381-6387-4e84-82b8-be55d35ac230@guest.local', '$2a$10$QkUrhtqP/aFtPspg2B45YeBLu7nrb767MakOMZWmtPYvZIIrdkKHq', '2026-05-06 05:01:33.165072+00', '2026-05-06 05:01:33.165072+00', NULL, 't', 'user', '2'),
('add56347-1dbe-4eb2-a5c8-a2cfefb3f640', 'Guest_afd8e7a5', 'afd8e7a5-305f-48df-a9a7-428bc2a4b177@guest.local', '$2a$10$pgOpG6itUjjFQ2HzluGwlOeoDyCdJg5lkGFhR0WRmz0l/IC2Qb9ve', '2026-05-06 05:08:28.724641+00', '2026-05-06 05:08:28.724641+00', NULL, 't', 'user', '3'),
('b8efdf31-cf3a-408e-a8cf-6f6889491957', 'Guest_69fd69ff', '69fd69ff-98c5-4fb1-a454-b76ad1c8bb61@guest.local', '$2a$10$KZgU/Nw/4cEei3VDsiT/reROAYo4ViGpHph7rwD7Er8/B0GbIIHGu', '2026-05-06 05:14:08.099835+00', '2026-05-06 05:14:08.099835+00', NULL, 't', 'user', '1'),
('2fc2cad4-c03e-41e5-8c30-675015ae8039', 'Guest_fa49d87e', 'fa49d87e-e839-4caa-87a1-4907812e3ebd@guest.local', '$2a$10$I.7ZDX0LY09UHjQFluS7qeN0tGEtrW4u260mSNLXiWn1U3D81Ozc6', '2026-05-06 05:21:21.19503+00', '2026-05-06 05:21:21.19503+00', NULL, 't', 'user', '1'),
('a21fa9d5-cd25-47d1-9121-9c57baee8546', 'Guest_7ed6bd10', '7ed6bd10-1bee-4380-8d3e-3eb5b15186a7@guest.local', '$2a$10$/0/rQJ3pOz49QLRoSb8LqO/K/wQchJwz.4LNJyDa48S7gwMxLshUK', '2026-05-07 01:30:07.808548+00', '2026-05-07 01:30:07.808548+00', NULL, 't', 'user', '2'),
('f5fe1643-d508-4b73-affc-8c46304f0b7b', '', '', '$2a$10$g9RWkg3xYEtCralTMUN1/eVS.7aBRj3CbJMTFetEfWZQ3prdsjgAq', '2026-05-12 21:46:50.309825+00', '2026-05-12 21:46:50.309825+00', NULL, 'f', 'user', '1'),
('bed9cc1c-aeb8-44f1-bf90-d651d2228d23', 'Guest_51d77c08', '51d77c08-8f22-4b43-85bf-d363a8fd98df@guest.local', '$2a$10$.3fZPFnQaRQwfcuMA5HSiey7lbpYQAvlM/zfPVsHMXc7YdsRHxaXW', '2026-05-12 21:52:14.803435+00', '2026-05-12 21:52:14.803435+00', NULL, 't', 'user', '2'),
('9199e056-e62a-4032-b380-00ecd2b6a85d', 'Guest_086bc7b3', '086bc7b3-a732-4e95-9df6-efd33e0dbb91@guest.local', '$2a$10$K9rbg6.LbjU/1hCbhj5VveSyFsOe6No7ZI.FDbGTbCxKQ/S4moDh6', '2026-05-13 00:42:26.533155+00', '2026-05-13 00:42:26.533155+00', NULL, 't', 'user', '1'),
('d130d73d-ff94-4ea1-ab38-d67c04f2cec2', 'Guest_7f896a2f', '7f896a2f-0b51-4998-b58c-00b4c6d119dc@guest.local', '$2a$10$ZngkifGpyLUi4aG12B2MN.faorPTI9xqxoKjCAfe0/TKvZx5mOsou', '2026-05-13 01:34:56.87038+00', '2026-05-13 01:34:56.87038+00', NULL, 't', 'user', '3'),
('33c2f625-aa58-44eb-8430-26bc0829cd1f', 'Guest_df6b11af', 'df6b11af-a19e-408a-b8d7-e75872e0e86f@guest.local', '$2a$10$mAlbZzhULMdeHWtr6fgGGe3ktpz1/0ySIqBi8ECET6uPOmcOlrwZe', '2026-05-15 02:50:18.523789+00', '2026-05-15 02:50:18.523789+00', NULL, 't', 'user', '3'),
('97db8b92-9325-4d5e-99b1-00e95f949608', 'Guest_8e4a6c31', '8e4a6c31-e9be-40f1-800b-5b37d9b3ab43@guest.local', '$2a$10$77bF5uTHvo4InT5LgRPxQuS2pvXqROjBGAaXOViJ15Hy.UKqP6Xjy', '2026-05-15 03:35:41.164197+00', '2026-05-15 03:35:41.164197+00', NULL, 't', 'user', '2'),
('b0ffce77-47fc-4484-aafc-fefef5848d61', 'Guest_d886fd2a', 'd886fd2a-4789-4631-a144-556e263a5d0c@guest.local', '$2a$10$k.vSIPBtAmxQxAHdZ23qFecLJVSnIXIpNXIte1G7NKLY4mYmtetKK', '2026-05-15 03:47:13.67719+00', '2026-05-15 03:47:13.67719+00', NULL, 't', 'user', '3'),
('c7f74a82-382c-49ee-98c9-3027a63a1265', 'Guest_07f934f4', '07f934f4-fdf9-40d5-a07f-3a8b97faeac6@guest.local', '$2a$10$Il/t4AKLItV.aIYElBpzFezzYCSYjeWi.RhxUeGQlSsj4wOPUAzuq', '2026-05-15 14:08:51.951759+00', '2026-05-15 14:08:51.951759+00', NULL, 't', 'user', '1'),
('19b048ec-74bc-42dd-b334-2ea8c7e9e320', 'Guest_c5e32f7f', 'c5e32f7f-0a22-46dc-b6f3-2a0f4f47cee3@guest.local', '$2a$10$UtlgxGfLYQhw4/2O4z1qYeiIcOvhSbmkxMtH2QNWEyWGsrSRFL.Ii', '2026-05-15 16:58:00.183648+00', '2026-05-15 16:58:00.183648+00', NULL, 't', 'user', '3'),
('ea259346-a686-420c-bfd4-48c8186ca840', 'Guest_f45e5722', 'f45e5722-75f2-4845-ab5b-7772a372037e@guest.local', '$2a$10$n/w.iaaARKsY22R0arGBRO8Xk5.B0qwbYQVYtWEgVanwFz/or4bbi', '2026-05-20 00:13:45.631723+00', '2026-05-20 00:13:45.631723+00', NULL, 't', 'user', '1'),
('1c578468-f1a6-4f1e-bd70-3011409c21b1', 'Guest_583a5eee', '583a5eee-ac31-4610-945e-ecc7c052e4fc@guest.local', '$2a$10$sleB4pCFzfBIzS2swaaQ6eutQjnYvrEOs8GGl.SWnXiBBKB68rOCi', '2026-05-20 00:21:27.346091+00', '2026-05-20 00:21:27.346091+00', NULL, 't', 'user', '1'),
('a24597cc-f8bf-4ef6-84aa-292c1af1ecea', 'Guest_1fcc3997', '1fcc3997-8a7a-4653-8680-1ff44585ddb2@guest.local', '$2a$10$9MvpXcxZ2Ne0Q.VxMSkScOB0cItvX8ydE2bgpfgfZiMDBbiR1PgAa', '2026-05-20 01:01:38.910324+00', '2026-05-20 01:01:38.910324+00', NULL, 't', 'user', '1'),
('61d397cb-40e6-4c25-9649-80888876e773', 'Guest_aa763090', 'aa763090-0c58-4235-bf78-6c889149aaf4@guest.local', '$2a$10$JIyfdKXE6CWVG0NtVDSOB.ZK4qjG6en9ZvXdRAi/s/gQpx6OEV74m', '2026-05-20 01:29:00.065584+00', '2026-05-20 01:29:00.065584+00', NULL, 't', 'user', '3'),
('e9280112-559c-4318-b5c3-b40ed0600ba8', 'Guest_37569503', '37569503-2fd3-47fc-af3e-adf6ce806657@guest.local', '$2a$10$wJDQ9NteH/caC3YZs9gjJ.DK8UJ6mDrof4pQbMLItQ3vwUPFeiJ/6', '2026-05-20 01:30:46.736713+00', '2026-05-20 01:30:46.736713+00', NULL, 't', 'user', '1'),
('1d020702-d923-4542-962f-1e697caf9265', 'Guest_c6417b3f', 'c6417b3f-8438-406c-8c71-af5e42b2d070@guest.local', '$2a$10$MkhQeAkm7/RajoNfm6fHZu3FFIPCEfx1HV0di3oiGt5ZDT3eHNamy', '2026-05-20 01:32:25.632888+00', '2026-05-20 01:32:25.632888+00', NULL, 't', 'user', '3'),
('66f1be57-b54c-4e28-85de-84b9b9d40423', 'Guest_51178e28', '51178e28-c2c7-4472-8e7c-1ea41c1468d8@guest.local', '$2a$10$w2YYBUe86LnO41KVzG3J/.yRjJ7uFXiy4fh8h09cxuMMKx2SzyZ4C', '2026-05-20 02:15:17.938604+00', '2026-05-20 02:15:17.938604+00', NULL, 't', 'user', '2'),
('90578fb0-278b-4b78-9a42-546cada8b581', 'Guest_a1c8478e', 'a1c8478e-e2d9-4455-80ef-7c4e3cea92da@guest.local', '$2a$10$woxEJoVUouxm97kVaLBmc.qVUVnzKu6ccKbPFOa9PDSKILJLcs7.m', '2026-05-20 02:15:18.978452+00', '2026-05-20 02:15:18.978452+00', NULL, 't', 'user', '1'),
('1ca85acf-b5a8-4f94-a4e2-aed53dde51ae', 'Guest_e6259fe7', 'e6259fe7-1aaa-480a-b63c-3c9333cb9b60@guest.local', '$2a$10$ymfo3SYVhDBKdaKG8scRPu9zfMZHmwunEGSjJsAhAY19JlEVEiFQS', '2026-05-20 02:26:43.524679+00', '2026-05-20 02:26:43.524679+00', NULL, 't', 'user', '2'),
('93e0c880-c10b-4733-9329-e88b511dcd74', 'Guest_ea7458e3', 'ea7458e3-61d0-44f3-80d1-701bf8802ad3@guest.local', '$2a$10$Y2CQqRxiG.FkmMCvl4gRd.w0MmTFJCg8kBlXJ6TlOMoyycrEBu7M2', '2026-05-20 02:28:22.894277+00', '2026-05-20 02:28:22.894277+00', NULL, 't', 'user', '2'),
('95206ff2-9ce7-4224-b9f1-d4c089fe3950', 'Guest_4886e6be', '4886e6be-ed0d-4578-96cd-27eb0b44fbbc@guest.local', '$2a$10$KnAuB.7iI7tv9yicYs8xHeRQ5Bk6D6biSIup4TPZXNsikJ3UkJu0e', '2026-05-20 02:47:43.215489+00', '2026-05-20 02:47:43.215489+00', NULL, 't', 'user', '1'),
('33f6cac6-0fff-4848-8962-d563d79b912f', 'Guest_a70dcfde', 'a70dcfde-a63c-4f74-b03d-f365b91845ce@guest.local', '$2a$10$4d6XargjgIU295rPoW40g.h2e0FnHmTNUBV2OBlBevaUJEcu23OCe', '2026-05-20 12:39:53.9265+00', '2026-05-20 12:39:53.9265+00', NULL, 't', 'user', '3'),
('71efe59b-c644-4be8-87e0-45d9474dc9a9', 'Guest_d68e05c8', 'd68e05c8-8644-4d74-941d-42ce0fd3b122@guest.local', '$2a$10$FfU5ButEvztPT3DC1QXj.euDf046d1wh3kUs9W9aQlxNrbfnapsPe', '2026-05-20 19:45:28.694947+00', '2026-05-20 19:45:28.694947+00', NULL, 't', 'user', '1'),
('81cc82f1-c4eb-4b65-a367-15604a618d8d', 'Guest_8fce8f32', '8fce8f32-e7ee-47ad-ba86-389610d98bf1@guest.local', '$2a$10$P/7UUDzuigjIj5cOvXRKo.Kpdwx..5Uy.YMZMESUnATqsJM4abQrO', '2026-05-20 20:30:30.221894+00', '2026-05-20 20:30:30.221894+00', NULL, 't', 'user', '3'),
('1447f0d3-5d24-48a0-91de-428f2112e616', 'Guest_551adbe9', '551adbe9-1ed9-4aae-9b41-9baf214bd757@guest.local', '$2a$10$9Zc1gsgrKIPpE19fNKZGAekwOsF5QazxghEPyE7gHZoEtetoyuAtW', '2026-05-21 02:51:48.796625+00', '2026-05-21 02:51:48.796625+00', NULL, 't', 'user', '3'),
('af5c7e86-c3b2-42d6-88b3-f37b85950aa5', 'Guest_f24dfb7b', 'f24dfb7b-abca-48a7-aa08-112278f08622@guest.local', '$2a$10$Vr4raCl./hkFqDB6hJ/xpuYwKX6MQhYVEq7Fi.7/TXY0R8t9JX.aG', '2026-05-21 14:22:21.955116+00', '2026-05-21 14:22:21.955116+00', NULL, 't', 'user', '1'),
('d608c0f5-0336-4c08-9a1c-88a1e73a2b41', 'Guest_c99dfe7a', 'c99dfe7a-bc0e-4f44-9e81-4677e747e857@guest.local', '$2a$10$vnB1E8tsToGJng7sKdYSteW9bn4IMiGTQ0AtYn.8rl1wUHkqDsF22', '2026-05-21 17:23:07.333286+00', '2026-05-21 17:23:07.333286+00', NULL, 't', 'user', '1'),
('a7b0eabf-4d33-463a-8369-e48b6763d67a', 'Guest_a337765e', 'a337765e-a4e1-44c0-94bf-f32a195505ee@guest.local', '$2a$10$dYmP4iO5bfHTS6Lnt9v9aeLcyCslev04fAdMcyKIeh/FhKW9pX5n.', '2026-05-21 19:09:05.332427+00', '2026-05-21 19:09:05.332427+00', NULL, 't', 'user', '1');
INSERT INTO "public"."words" ("id", "text", "difficulty", "phonetic", "category", "audio_url", "created_at") VALUES
(1, 'hello', 'beginner', '/həˈloʊ/', 'greetings', NULL, '2026-03-06 21:47:36.111823'),
(2, 'goodbye', 'beginner', '/ɡʊdˈbaɪ/', 'greetings', NULL, '2026-03-06 21:47:36.111833'),
(3, 'thank you', 'beginner', '/θæŋk juː/', 'greetings', NULL, '2026-03-06 21:47:36.111837'),
(4, 'please', 'beginner', '/pliːz/', 'greetings', NULL, '2026-03-06 21:47:36.11184'),
(5, 'water', 'beginner', '/ˈwɔːtər/', 'vocabulary', NULL, '2026-03-06 21:47:36.111842'),
(6, 'food', 'beginner', '/fuːd/', 'vocabulary', NULL, '2026-03-06 21:47:36.111845'),
(7, 'house', 'beginner', '/haʊs/', 'vocabulary', NULL, '2026-03-06 21:47:36.111847'),
(8, 'car', 'beginner', '/kɑːr/', 'vocabulary', NULL, '2026-03-06 21:47:36.111849'),
(9, 'book', 'beginner', '/bʊk/', 'vocabulary', NULL, '2026-03-06 21:47:36.111851'),
(10, 'school', 'beginner', '/skuːl/', 'vocabulary', NULL, '2026-03-06 21:47:36.111852'),
(11, 'happy', 'beginner', '/ˈhæpi/', 'vocabulary', NULL, '2026-03-06 21:47:36.111854'),
(12, 'friend', 'beginner', '/frɛnd/', 'vocabulary', NULL, '2026-03-06 21:47:36.111856'),
(13, 'family', 'beginner', '/ˈfæməli/', 'vocabulary', NULL, '2026-03-06 21:47:36.111858'),
(14, 'morning', 'beginner', '/ˈmɔːrnɪŋ/', 'vocabulary', NULL, '2026-03-06 21:47:36.11186'),
(15, 'night', 'beginner', '/naɪt/', 'vocabulary', NULL, '2026-03-06 21:47:36.111862'),
(16, 'yes', 'beginner', '/jɛs/', 'vocabulary', NULL, '2026-03-06 21:47:36.111864'),
(17, 'no', 'beginner', '/noʊ/', 'vocabulary', NULL, '2026-03-06 21:47:36.111866'),
(18, 'comfortable', 'intermediate', '/ˈkʌmftərbəl/', 'vocabulary', NULL, '2026-03-06 21:47:36.111868'),
(19, 'vegetable', 'intermediate', '/ˈvɛdʒtəbəl/', 'vocabulary', NULL, '2026-03-06 21:47:36.111869'),
(20, 'temperature', 'intermediate', '/ˈtɛmprətʃər/', 'vocabulary', NULL, '2026-03-06 21:47:36.111871'),
(21, 'interesting', 'intermediate', '/ˈɪntrəstɪŋ/', 'vocabulary', NULL, '2026-03-06 21:47:36.111873'),
(22, 'beautiful', 'intermediate', '/ˈbjuːtɪfəl/', 'vocabulary', NULL, '2026-03-06 21:47:36.111875'),
(23, 'restaurant', 'intermediate', '/ˈrɛstərɒnt/', 'vocabulary', NULL, '2026-03-06 21:47:36.111877'),
(24, 'environment', 'intermediate', '/ɪnˈvaɪrənmənt/', 'vocabulary', NULL, '2026-03-06 21:47:36.111878'),
(25, 'government', 'intermediate', '/ˈɡʌvərnmənt/', 'vocabulary', NULL, '2026-03-06 21:47:36.11188'),
(26, 'Tuesday', 'intermediate', '/ˈtuːzdeɪ/', 'vocabulary', NULL, '2026-03-06 21:47:36.111882'),
(27, 'Wednesday', 'intermediate', '/ˈwɛnzdeɪ/', 'vocabulary', NULL, '2026-03-06 21:47:36.111884'),
(28, 'February', 'intermediate', '/ˈfɛbruˌɛri/', 'vocabulary', NULL, '2026-03-06 21:47:36.111887'),
(29, 'library', 'intermediate', '/ˈlaɪbrɛri/', 'vocabulary', NULL, '2026-03-06 21:47:36.111888'),
(30, 'chocolate', 'intermediate', '/ˈtʃɒklət/', 'vocabulary', NULL, '2026-03-06 21:47:36.11189'),
(31, 'different', 'intermediate', '/ˈdɪfərənt/', 'vocabulary', NULL, '2026-03-06 21:47:36.111892'),
(32, 'naturally', 'intermediate', '/ˈnætʃərəli/', 'vocabulary', NULL, '2026-03-06 21:47:36.111894'),
(33, 'probably', 'intermediate', '/ˈprɒbəbli/', 'vocabulary', NULL, '2026-03-06 21:47:36.111896'),
(34, 'actually', 'intermediate', '/ˈæktʃuəli/', 'vocabulary', NULL, '2026-03-06 21:47:36.111898'),
(35, 'entrepreneurship', 'advanced', '/ˌɒntrəprəˈnɜːrʃɪp/', 'vocabulary', NULL, '2026-03-06 21:47:36.1119'),
(36, 'peculiar', 'advanced', '/pɪˈkjuːliər/', 'vocabulary', NULL, '2026-03-06 21:47:36.111902'),
(37, 'phenomenon', 'advanced', '/fɪˈnɒmɪnɒn/', 'vocabulary', NULL, '2026-03-06 21:47:36.111904'),
(38, 'particularly', 'advanced', '/pərˈtɪkjʊlərli/', 'vocabulary', NULL, '2026-03-06 21:47:36.111906'),
(39, 'thoroughly', 'advanced', '/ˈθʌrəli/', 'vocabulary', NULL, '2026-03-06 21:47:36.111908'),
(40, 'worcestershire', 'advanced', '/ˈwʊstərʃər/', 'vocabulary', NULL, '2026-03-06 21:47:36.11191'),
(41, 'colonel', 'advanced', '/ˈkɜːrnəl/', 'vocabulary', NULL, '2026-03-06 21:47:36.111912'),
(42, 'psychology', 'advanced', '/saɪˈkɒlədʒi/', 'vocabulary', NULL, '2026-03-06 21:47:36.111913'),
(43, 'hierarchy', 'advanced', '/ˈhaɪərɑːrki/', 'vocabulary', NULL, '2026-03-06 21:47:36.111915'),
(44, 'pneumonia', 'advanced', '/njuːˈmoʊniə/', 'vocabulary', NULL, '2026-03-06 21:47:36.111917'),
(45, 'queue', 'advanced', '/kjuː/', 'vocabulary', NULL, '2026-03-06 21:47:36.111919'),
(46, 'subtle', 'advanced', '/ˈsʌtəl/', 'vocabulary', NULL, '2026-03-06 21:47:36.111921'),
(47, 'conscience', 'advanced', '/ˈkɒnʃəns/', 'vocabulary', NULL, '2026-03-06 21:47:36.111923'),
(48, 'How are you doing?', 'beginner', '/haʊ ɑːr juː ˈduːɪŋ/', 'phrases', NULL, '2026-03-06 21:47:36.111925'),
(49, 'Nice to meet you', 'beginner', '/naɪs tə miːt juː/', 'phrases', NULL, '2026-03-06 21:47:36.111927'),
(50, 'What time is it?', 'beginner', '/wɒt taɪm ɪz ɪt/', 'phrases', NULL, '2026-03-06 21:47:36.111928'),
(51, 'I would like a cup of coffee', 'intermediate', '/aɪ wʊd laɪk ə kʌp ɒv ˈkɒfi/', 'phrases', NULL, '2026-03-06 21:47:36.11193'),
(52, 'Could you repeat that, please?', 'intermediate', '/kʊd juː rɪˈpiːt ðæt pliːz/', 'phrases', NULL, '2026-03-06 21:47:36.111932'),
(53, 'The weather is really nice today', 'intermediate', '/ðə ˈwɛðər ɪz ˈrɪəli naɪs təˈdeɪ/', 'phrases', NULL, '2026-03-06 21:47:36.111934'),
(54, 'I enjoy learning new languages every day', 'beginner', '/aɪ ɪnˈdʒɔɪ ˈlɜːrnɪŋ njuː ˈlæŋɡwɪdʒɪz ˈɛvri deɪ/', 'sentences', NULL, '2026-03-06 21:47:36.111936'),
(55, 'She walks to the park every morning', 'beginner', '/ʃiː wɔːks tə ðə pɑːrk ˈɛvri ˈmɔːrnɪŋ/', 'sentences', NULL, '2026-03-06 21:47:36.111938'),
(56, 'My brother is taller than me', 'beginner', '/maɪ ˈbrʌðər ɪz ˈtɔːlər ðæn miː/', 'sentences', NULL, '2026-03-06 21:47:36.11194'),
(57, 'The quick brown fox jumps over the lazy dog', 'intermediate', '/ðə kwɪk braʊn fɒks dʒʌmps ˈoʊvər ðə ˈleɪzi dɒɡ/', 'sentences', NULL, '2026-03-06 21:47:36.111941'),
(58, 'Could you tell me where the nearest hospital is?', 'intermediate', '/kʊd juː tɛl miː wɛr ðə ˈnɪərɪst ˈhɒspɪtəl ɪz/', 'sentences', NULL, '2026-03-06 21:47:36.111943'),
(59, 'I have been studying English for three years', 'intermediate', '/aɪ hæv biːn ˈstʌdiɪŋ ˈɪŋɡlɪʃ fɔːr θriː jɪərz/', 'sentences', NULL, '2026-03-06 21:47:36.111945'),
(60, 'The restaurant around the corner serves excellent Italian food', 'advanced', '/ðə ˈrɛstərɒnt əˈraʊnd ðə ˈkɔːrnər sɜːrvz ˈɛksələnt ɪˈtæliən fuːd/', 'sentences', NULL, '2026-03-06 21:47:36.111947'),
(61, 'She would have finished the project if she had had more time', 'advanced', '/ʃiː wʊd hæv ˈfɪnɪʃt ðə ˈprɒdʒɛkt ɪf ʃiː hæd hæd mɔːr taɪm/', 'sentences', NULL, '2026-03-06 21:47:36.111949'),
(62, 'Although it was raining heavily, they decided to go for a hike', 'advanced', '/ɔːlˈðoʊ ɪt wɒz ˈreɪnɪŋ ˈhɛvɪli ðeɪ dɪˈsaɪdɪd tə ɡoʊ fɔːr ə haɪk/', 'sentences', NULL, '2026-03-06 21:47:36.111951'),
(63, 'The unprecedented circumstances required extraordinary measures', 'advanced', '/ðə ʌnˈprɛsɪdɛntɪd ˈsɜːrkəmstænsɪz rɪˈkwaɪərd ɪkˈstrɔːrdɪnɛri ˈmɛʒərz/', 'sentences', NULL, '2026-03-06 21:47:36.111953');
