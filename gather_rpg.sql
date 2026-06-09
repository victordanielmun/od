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
    "id" int8 NOT NULL DEFAULT nextval('conversation_messages_id_seq'::regclass),
    "conversation_id" int8,
    "player_input" text,
    "pronunciation_score" numeric,
    "npc_response" text,
    "npc_response_es" text,
    "npc_state" "public"."npc_state" DEFAULT 'talking'::npc_state,
    "pronunciation_eval" "public"."pronunciation_eval" DEFAULT 'none'::pronunciation_eval,
    "pronunciation_msg" text,
    "feedback_suggestion" text,
    "task_completed" bool DEFAULT false,
    "created_at" timestamptz,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."conversations";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS conversations_id_seq;

-- Table Definition
CREATE TABLE "public"."conversations" (
    "id" int8 NOT NULL DEFAULT nextval('conversations_id_seq'::regclass),
    "player_id" uuid NOT NULL,
    "npc_instance_id" int8,
    "mission_id" int8,
    "session_id" varchar(100),
    "created_at" timestamptz,
    PRIMARY KEY ("id")
);

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
    "attack_bonus" int8,
    "defense_bonus" int8,
    "required_level" int8,
    "price" int8,
    "max_stack" int8,
    "icon_key" text,
    "created_at" timestamptz,
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
    "question_es" text,
    "tags" _text NOT NULL DEFAULT '{}'::text[],
    "difficulty" varchar(20) NOT NULL DEFAULT 'beginner'::character varying,
    "language_learning" varchar(20) NOT NULL DEFAULT 'english'::character varying,
    "phonetic" varchar(100),
    "requires_audio" bool NOT NULL DEFAULT false,
    "audio_url" varchar(500),
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "deleted_at" timestamptz,
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
    "map_data" text,
    "is_public" bool DEFAULT false,
    "max_users" int8 DEFAULT 50,
    "updated_by" uuid,
    "created_at" timestamptz,
    "updated_at" timestamptz,
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
CREATE TYPE "public"."task_type" AS ENUM ('bring_item', 'find_item', 'collect_items', 'defeat_enemy', 'kill_all', 'kill_boss', 'talk_to_npc', 'deliver_message', 'pronunciation_threshold');

-- Table Definition
CREATE TABLE "public"."mission_tasks" (
    "id" int8 NOT NULL DEFAULT nextval('mission_tasks_id_seq'::regclass),
    "mission_id" int8,
    "type" "public"."task_type",
    "order" int8,
    "description_en" text,
    "target_npc_template_id" int8,
    "required_item" varchar(100),
    "required_enemy" varchar(100),
    "required_kills" int8 DEFAULT 0,
    "pronunciation_min_score" int8 DEFAULT 80,
    "target_phrase_en" text,
    "message_to_deliver" text,
    "created_at" timestamptz,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."missions";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS missions_id_seq;
DROP TYPE IF EXISTS "public"."mission_type";
CREATE TYPE "public"."mission_type" AS ENUM ('find_item', 'find_items', 'defeat_enemy', 'kill_all', 'kill_boss', 'talk_to_npc', 'deliver_message', 'pronunciation_challenge');

-- Table Definition
CREATE TABLE "public"."missions" (
    "id" int8 NOT NULL DEFAULT nextval('missions_id_seq'::regclass),
    "scene_key" varchar(100) NOT NULL,
    "title" varchar(200) NOT NULL,
    "description_en" text,
    "objective_en" text,
    "type" "public"."mission_type",
    "status" varchar(20) DEFAULT 'active'::character varying,
    "mode" varchar(20) DEFAULT 'individual'::character varying,
    "objective_target" varchar(200),
    "reward_item_id" uuid,
    "reward_quantity" int8 DEFAULT 0,
    "reward_gold" int8 DEFAULT 0,
    "reward_xp" int8 DEFAULT 0,
    "difficulty" varchar(20) NOT NULL DEFAULT 'beginner'::character varying,
    "created_at" timestamptz,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."npc_definitions";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS npc_definitions_id_seq;
DROP TYPE IF EXISTS "public"."npc_type";
CREATE TYPE "public"."npc_type" AS ENUM ('quest_giver', 'merchant', 'guide', 'other', 'quest_master');
DROP TYPE IF EXISTS "public"."npc_state";
CREATE TYPE "public"."npc_state" AS ENUM ('idle', 'talking', 'happy', 'angry', 'sad', 'surprised', 'thinking', 'grateful', 'waiting');

-- Table Definition
CREATE TABLE "public"."npc_definitions" (
    "id" int8 NOT NULL DEFAULT nextval('npc_definitions_id_seq'::regclass),
    "name" varchar(100) NOT NULL,
    "sprite" varchar(100) NOT NULL,
    "greeting" text,
    "type" "public"."npc_type" DEFAULT 'other'::npc_type,
    "default_state" "public"."npc_state" DEFAULT 'idle'::npc_state,
    "interaction_mode" varchar(20) DEFAULT 'hybrid'::character varying,
    "voice_type" varchar(20) DEFAULT 'male'::character varying,
    "shop_id" int8,
    "gift_item_id" uuid,
    "gift_quantity" int8 DEFAULT 0,
    "created_at" timestamptz,
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
CREATE INDEX idx_npc_dialogue_caches_task_id ON public.npc_dialogue_caches USING btree (task_id);
CREATE INDEX idx_npc_dialogue_caches_mission_id ON public.npc_dialogue_caches USING btree (mission_id);
CREATE INDEX idx_npc_dialogue_caches_npc_template_id ON public.npc_dialogue_caches USING btree (npc_template_id);
CREATE INDEX idx_npc_dialogue_caches_condition_met ON public.npc_dialogue_caches USING btree (condition_met);
CREATE INDEX idx_npc_dialogue_caches_normalized_input ON public.npc_dialogue_caches USING btree (normalized_input);

DROP TABLE IF EXISTS "public"."npc_mission_roles";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS npc_mission_roles_id_seq;
DROP TYPE IF EXISTS "public"."npc_role";
CREATE TYPE "public"."npc_role" AS ENUM ('task_npc', 'informational_npc');

-- Table Definition
CREATE TABLE "public"."npc_mission_roles" (
    "id" int8 NOT NULL DEFAULT nextval('npc_mission_roles_id_seq'::regclass),
    "npc_template_id" int8,
    "mission_id" int8,
    "role" "public"."npc_role",
    "task_description" text,
    "knowledge_summary" text,
    "created_at" timestamptz,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."npc_room_instances";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS npc_room_instances_id_seq;
DROP TYPE IF EXISTS "public"."npc_state";
CREATE TYPE "public"."npc_state" AS ENUM ('idle', 'talking', 'happy', 'angry', 'sad', 'surprised', 'thinking', 'grateful', 'waiting');

-- Table Definition
CREATE TABLE "public"."npc_room_instances" (
    "id" int8 NOT NULL DEFAULT nextval('npc_room_instances_id_seq'::regclass),
    "room_id" uuid NOT NULL,
    "npc_template_id" int8,
    "current_state" "public"."npc_state" DEFAULT 'idle'::npc_state,
    "task_completed" bool DEFAULT false,
    "updated_at" timestamptz,
    CONSTRAINT "fk_npc_room_instances_npc_template" FOREIGN KEY ("npc_template_id") REFERENCES "public"."npc_templates"("id"),
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."npc_templates";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS npc_templates_id_seq;

-- Table Definition
CREATE TABLE "public"."npc_templates" (
    "id" int8 NOT NULL DEFAULT nextval('npc_templates_id_seq'::regclass),
    "scene_key" varchar(100) NOT NULL,
    "npc_definition_id" int8,
    "position_x" int8,
    "position_y" int8,
    "facing_direction" varchar(10) DEFAULT 'south'::character varying,
    "interaction_radius" int8 DEFAULT 64,
    "movement_type" varchar(20) DEFAULT 'static'::character varying,
    "movement_range" int8 DEFAULT 0,
    "movement_speed" int8 DEFAULT 50,
    "instructions" text,
    "success_message" text,
    "greeting" text,
    "created_at" timestamptz,
    CONSTRAINT "fk_npc_templates_npc_definition" FOREIGN KEY ("npc_definition_id") REFERENCES "public"."npc_definitions"("id"),
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."player_learning_stats";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS player_learning_stats_id_seq;

-- Table Definition
CREATE TABLE "public"."player_learning_stats" (
    "id" int8 NOT NULL DEFAULT nextval('player_learning_stats_id_seq'::regclass),
    "player_id" uuid NOT NULL,
    "avg_pronunciation_score" numeric DEFAULT 0,
    "total_conversations" int8 DEFAULT 0,
    "weak_phonemes" jsonb,
    "updated_at" timestamptz,
    PRIMARY KEY ("id")
);


-- Indices
CREATE UNIQUE INDEX uni_player_learning_stats_player_id ON public.player_learning_stats USING btree (player_id);

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
    "kill_counts" jsonb,
    "started_at" timestamptz,
    "completed_at" timestamptz,
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
    "gold" int8 DEFAULT 100,
    "skill_points" int8 DEFAULT 0,
    "created_at" timestamptz,
    "updated_at" timestamptz,
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
    "type" varchar(20) DEFAULT 'public'::character varying,
    "scene_key" varchar(50) NOT NULL,
    "invite_code" varchar(10),
    "parent_id" uuid,
    "created_by" uuid NOT NULL,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    PRIMARY KEY ("id")
);


-- Indices
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
CREATE INDEX idx_user_challenge_attempts_challenge_id ON public.user_challenge_attempts USING btree (challenge_id);
CREATE INDEX idx_user_challenge_attempts_user_id ON public.user_challenge_attempts USING btree (user_id);

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
    "role" text NOT NULL DEFAULT 'user'::text,
    "is_guest" bool NOT NULL DEFAULT false,
    "character_id" text NOT NULL DEFAULT '1'::text,
    "created_at" timestamptz,
    "updated_at" timestamptz,
    "deleted_at" timestamptz,
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



INSERT INTO "public"."friend_requests" ("id", "requester_id", "addressee_id", "status", "created_at", "updated_at", "deleted_at") VALUES
('a9b29565-c151-4715-867e-85bb271c3de8', 'a22e894f-c41e-428f-a342-b4e34bb59c73', '504066a6-1abc-40c1-ae96-8c005971a49a', 'accepted', '2026-05-22 19:26:21.159713+00', '2026-05-22 19:26:28.700771+00', NULL);
INSERT INTO "public"."friendships" ("id", "user1_id", "user2_id", "created_at", "updated_at", "deleted_at") VALUES
('5dd274a9-1664-43a1-8963-dc3166b657ee', '504066a6-1abc-40c1-ae96-8c005971a49a', 'a22e894f-c41e-428f-a342-b4e34bb59c73', '2026-05-22 19:26:28.504856+00', '2026-05-22 19:26:28.504856+00', NULL);


INSERT INTO "public"."learning_challenges" ("id", "type", "question", "option1", "option2", "option3", "correct_option", "explanation_es", "question_es", "tags", "difficulty", "language_learning", "phonetic", "requires_audio", "audio_url", "created_at", "updated_at", "deleted_at") VALUES
('d3e5c38a-89ff-4dcb-886c-6120a1c7a2cf', 'pronunciation', 'Adventure', 'Adventure', '', '', 1, 'Aventura', '', '{vocabulary,rpg}', 'beginner', 'english', '/ədˈventʃər/', 't', '', '2026-05-22 03:33:12.574945+00', '2026-05-22 03:33:12.574945+00', NULL),
('e765de6b-3144-472d-825d-fcf7d9f3e0c8', 'pronunciation', 'Odyssey', 'Odyssey', '', '', 1, 'Odisea, un viaje largo y lleno de aventuras', '', '{vocabulary,rpg}', 'intermediate', 'english', '/ˈɒdəsi/', 't', '', '2026-05-22 03:33:12.577912+00', '2026-05-22 03:33:12.577912+00', NULL),
('97333c3d-c2fc-4ae3-88d0-9430338b6215', 'pronunciation', 'Dungeon', 'Dungeon', '', '', 1, 'Mazmorra', '', '{vocabulary,rpg}', 'beginner', 'english', '/ˈdʌndʒən/', 't', '', '2026-05-22 03:33:12.580244+00', '2026-05-22 03:33:12.580244+00', NULL),
('1ab2ade4-5c2c-4a70-b59b-424843d7f291', 'pronunciation', 'Welcome to the game', 'Welcome to the game', '', '', 1, 'Bienvenido al juego', '', '{phrases,greetings}', 'beginner', 'english', '/ˈwelkəm tu ðə ɡeɪm/', 't', '', '2026-05-22 03:33:12.582693+00', '2026-05-22 03:33:12.582693+00', NULL),
('23e74558-0840-4606-b696-0561c921ec79', 'vocabulary', 'Which item is usually found in a dungeon?', 'Treasure Chest', 'Modern Car', 'Office Chair', 1, 'Los cofres de tesoro (Treasure Chests) son clásicos en las mazmorras de RPG.', '¿Qué objeto se encuentra usualmente en una mazmorra?', '{vocabulary,rpg}', 'beginner', 'english', '', 'f', '', '2026-05-22 03:33:12.585233+00', '2026-05-22 03:33:12.585233+00', NULL),
('3326db3e-d86b-44a8-bffc-246aa6a43ca7', 'grammar', 'I _____ a brave warrior.', 'am', 'is', 'are', 1, 'Se usa ''am'' con el pronombre ''I'' (Verb to be).', 'Yo _____ un guerrero valiente.', '{grammar,basics}', 'beginner', 'english', '', 'f', '', '2026-05-22 03:33:12.587722+00', '2026-05-22 03:33:12.587722+00', NULL);
INSERT INTO "public"."map_configs" ("id", "scene_key", "walls_json", "map_data", "is_public", "max_users", "updated_by", "created_at", "updated_at") VALUES
('af6a6e21-a366-4a2f-bf1c-7894c9abd56e', 'lobby', '{"width":3200,"height":3200,"defaultSpawnX":1600,"defaultSpawnY":1600,"walls":[],"floors":[],"forest":[],"builds":[],"spawns":[],"npcZones":[],"pickups":[],"voids":[],"colliders":[],"enemySpawns":[]}', '{"bgmTrack":"lobby-bgm","defaultSpawnX":1600,"defaultSpawnY":1600,"height":3200,"width":3200}', 't', 50, '504066a6-1abc-40c1-ae96-8c005971a49a', '2026-05-25 14:26:55.62292+00', '2026-05-25 14:26:55.62292+00');












INSERT INTO "public"."player_stats" ("id", "user_id", "class", "level", "experience", "hp_current", "hp_max", "mp_current", "mp_max", "attack", "defense", "speed", "gold", "skill_points", "created_at", "updated_at") VALUES
('6262a718-60d7-4232-8c1a-7c3e6c2888ff', 'e6afbd81-3244-405e-8061-ab53572e92c5', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 100, 0, '2026-05-22 04:21:35.481122+00', '2026-05-22 04:21:35.481122+00'),
('92e7cf64-19e6-4967-a36f-a38c96dac761', '339aad37-6183-4e84-8037-ab24ccbd1986', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 100, 0, '2026-05-22 04:21:59.683664+00', '2026-05-22 04:21:59.683664+00'),
('b44b7e39-5e35-42ef-93e7-f9f740c6abc8', '9aefef8d-6f7b-453c-84fa-ccd85f65bd49', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 100, 0, '2026-05-22 16:27:13.207117+00', '2026-05-22 16:27:13.207117+00'),
('bce90a24-7819-4058-84c6-345e7906792f', 'a22e894f-c41e-428f-a342-b4e34bb59c73', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 100, 0, '2026-05-22 16:28:51.144938+00', '2026-05-22 16:28:51.144938+00'),
('9ab67f7f-31d8-4c87-82cb-83a60c3814ff', '504066a6-1abc-40c1-ae96-8c005971a49a', 'warrior', 1, 0, 0, 100, 0, 50, 10, 5, 10, 100, 0, '2026-05-25 14:27:01.766847+00', '2026-05-25 14:27:01.766847+00');

INSERT INTO "public"."rooms" ("id", "name", "max_users", "map_data", "is_public", "type", "scene_key", "invite_code", "parent_id", "created_by", "created_at", "updated_at") VALUES
('777afca6-96b3-4f92-86f1-9ecd29a4fcce', 'Main Lobby', 50, '{}', 't', 'public', '', '', NULL, 'e6afbd81-3244-405e-8061-ab53572e92c5', '2026-05-22 04:21:37.871333+00', '2026-05-22 04:21:37.871333+00');




INSERT INTO "public"."user_challenge_attempts" ("id", "user_id", "challenge_id", "selected_option", "is_correct", "feedback_ai", "answered_at") VALUES
('8815e17a-47dc-40a3-a757-feaed002969a', '9aefef8d-6f7b-453c-84fa-ccd85f65bd49', 'd3e5c38a-89ff-4dcb-886c-6120a1c7a2cf', 1, 't', 'Aventura', '2026-05-22 16:27:39.849398+00'),
('65eb809d-d878-45f7-acec-ec1e3a4accac', 'a22e894f-c41e-428f-a342-b4e34bb59c73', '23e74558-0840-4606-b696-0561c921ec79', 2, 'f', 'Los cofres de tesoro (Treasure Chests) son clásicos en las mazmorras de RPG.', '2026-05-22 17:04:34.114971+00');
INSERT INTO "public"."user_learning_profiles" ("id", "user_id", "english_level", "preferred_tags", "weekly_score", "weekly_correct", "weekly_attempts", "week_start", "current_level_xp", "total_xp", "created_at", "updated_at", "deleted_at") VALUES
('03b020c1-a3eb-420f-bebe-223bb7559e20', '9aefef8d-6f7b-453c-84fa-ccd85f65bd49', 'beginner', '{}', 15, 1, 1, '0001-01-01', 15, 15, '2026-05-22 16:27:39.85335+00', '2026-05-22 16:27:39.85495+00', NULL),
('da0d762d-47d0-482d-b463-aba3c0e8531d', 'a22e894f-c41e-428f-a342-b4e34bb59c73', 'beginner', '{}', 5, 0, 1, '0001-01-01', 5, 5, '2026-05-22 16:28:51.344026+00', '2026-05-22 17:04:33.727802+00', NULL),
('287f4da3-6eb5-46d0-9a31-a8952b1cc149', '504066a6-1abc-40c1-ae96-8c005971a49a', 'beginner', '{}', 0, 0, 0, '0001-01-01', 0, 0, '2026-05-22 17:29:26.116101+00', '2026-05-22 17:29:26.116101+00', NULL);

INSERT INTO "public"."users" ("id", "username", "email", "password", "role", "is_guest", "character_id", "created_at", "updated_at", "deleted_at") VALUES
('504066a6-1abc-40c1-ae96-8c005971a49a', 'Admin', 'admin@odyssey.dev', '$2a$10$VWO6LwoKXHwwE2ml.Lo.VOAKlK6prz3SfWn8cqahSHtOmH2vUO3DW', 'admin', 'f', '1', '2026-05-22 03:33:12.571078+00', '2026-05-22 03:33:12.571078+00', NULL),
('e6afbd81-3244-405e-8061-ab53572e92c5', 'Guest_baf7b9c5', 'baf7b9c5-c081-45ac-9fa1-df9598cf6be0@guest.local', '$2a$10$Cw38v1QYynRmZdittWbUJ.RsOK9eJROgsJzjEn40su77HofG4xe4a', 'user', 't', '1', '2026-05-22 04:21:35.479194+00', '2026-05-22 04:21:35.479194+00', NULL),
('339aad37-6183-4e84-8037-ab24ccbd1986', 'Guest_e1b6b13e', 'e1b6b13e-191e-485a-b677-e8265e1f2727@guest.local', '$2a$10$8dUu9zzsjyMxl6yUQkMu9Ota2gpR/1pMi4EzWpNhbzI.xtGVGfutq', 'user', 't', '2', '2026-05-22 04:21:59.68227+00', '2026-05-22 04:21:59.68227+00', NULL),
('9aefef8d-6f7b-453c-84fa-ccd85f65bd49', 'Guest_5d7db450', '5d7db450-0e4b-40fa-a5eb-c0ec76a0a263@guest.local', '$2a$10$hT.kAkg6BDBoUjh2qrmfxO0I8H41CViQbauYvdVca5OxRHYmpXG/.', 'user', 't', '1', '2026-05-22 16:27:13.206424+00', '2026-05-22 16:27:13.206424+00', NULL),
('a22e894f-c41e-428f-a342-b4e34bb59c73', 'victordanielmun', 'victordanielmun@gmail.com', '$2a$10$88vd7WJV6TfDmcMBp8bIUOjpCttJ0TTe1ZASx8oAFcTnZNyTuBJF6', 'user', 'f', '1', '2026-05-22 16:28:51.144254+00', '2026-05-22 16:28:51.144254+00', NULL);
INSERT INTO "public"."words" ("id", "text", "difficulty", "phonetic", "category", "audio_url", "created_at") VALUES
(1, 'hello', 'beginner', '/həˈloʊ/', 'greetings', NULL, '2026-05-22 03:07:09.496559'),
(2, 'goodbye', 'beginner', '/ɡʊdˈbaɪ/', 'greetings', NULL, '2026-05-22 03:07:09.49657'),
(3, 'thank you', 'beginner', '/θæŋk juː/', 'greetings', NULL, '2026-05-22 03:07:09.496571'),
(4, 'please', 'beginner', '/pliːz/', 'greetings', NULL, '2026-05-22 03:07:09.496571'),
(5, 'water', 'beginner', '/ˈwɔːtər/', 'vocabulary', NULL, '2026-05-22 03:07:09.496576'),
(6, 'food', 'beginner', '/fuːd/', 'vocabulary', NULL, '2026-05-22 03:07:09.496578'),
(7, 'house', 'beginner', '/haʊs/', 'vocabulary', NULL, '2026-05-22 03:07:09.496635'),
(8, 'car', 'beginner', '/kɑːr/', 'vocabulary', NULL, '2026-05-22 03:07:09.496637'),
(9, 'book', 'beginner', '/bʊk/', 'vocabulary', NULL, '2026-05-22 03:07:09.496638'),
(10, 'school', 'beginner', '/skuːl/', 'vocabulary', NULL, '2026-05-22 03:07:09.496638'),
(11, 'happy', 'beginner', '/ˈhæpi/', 'vocabulary', NULL, '2026-05-22 03:07:09.496639'),
(12, 'friend', 'beginner', '/frɛnd/', 'vocabulary', NULL, '2026-05-22 03:07:09.49664'),
(13, 'family', 'beginner', '/ˈfæməli/', 'vocabulary', NULL, '2026-05-22 03:07:09.496641'),
(14, 'morning', 'beginner', '/ˈmɔːrnɪŋ/', 'vocabulary', NULL, '2026-05-22 03:07:09.496641'),
(15, 'night', 'beginner', '/naɪt/', 'vocabulary', NULL, '2026-05-22 03:07:09.496642'),
(16, 'yes', 'beginner', '/jɛs/', 'vocabulary', NULL, '2026-05-22 03:07:09.496643'),
(17, 'no', 'beginner', '/noʊ/', 'vocabulary', NULL, '2026-05-22 03:07:09.496643'),
(18, 'comfortable', 'intermediate', '/ˈkʌmftərbəl/', 'vocabulary', NULL, '2026-05-22 03:07:09.496644'),
(19, 'vegetable', 'intermediate', '/ˈvɛdʒtəbəl/', 'vocabulary', NULL, '2026-05-22 03:07:09.496645'),
(20, 'temperature', 'intermediate', '/ˈtɛmprətʃər/', 'vocabulary', NULL, '2026-05-22 03:07:09.496646'),
(21, 'interesting', 'intermediate', '/ˈɪntrəstɪŋ/', 'vocabulary', NULL, '2026-05-22 03:07:09.496647'),
(22, 'beautiful', 'intermediate', '/ˈbjuːtɪfəl/', 'vocabulary', NULL, '2026-05-22 03:07:09.496647'),
(23, 'restaurant', 'intermediate', '/ˈrɛstərɒnt/', 'vocabulary', NULL, '2026-05-22 03:07:09.496648'),
(24, 'environment', 'intermediate', '/ɪnˈvaɪrənmənt/', 'vocabulary', NULL, '2026-05-22 03:07:09.496649'),
(25, 'government', 'intermediate', '/ˈɡʌvərnmənt/', 'vocabulary', NULL, '2026-05-22 03:07:09.496649'),
(26, 'Tuesday', 'intermediate', '/ˈtuːzdeɪ/', 'vocabulary', NULL, '2026-05-22 03:07:09.49665'),
(27, 'Wednesday', 'intermediate', '/ˈwɛnzdeɪ/', 'vocabulary', NULL, '2026-05-22 03:07:09.496651'),
(28, 'February', 'intermediate', '/ˈfɛbruˌɛri/', 'vocabulary', NULL, '2026-05-22 03:07:09.496652'),
(29, 'library', 'intermediate', '/ˈlaɪbrɛri/', 'vocabulary', NULL, '2026-05-22 03:07:09.496652'),
(30, 'chocolate', 'intermediate', '/ˈtʃɒklət/', 'vocabulary', NULL, '2026-05-22 03:07:09.496653'),
(31, 'different', 'intermediate', '/ˈdɪfərənt/', 'vocabulary', NULL, '2026-05-22 03:07:09.496654'),
(32, 'naturally', 'intermediate', '/ˈnætʃərəli/', 'vocabulary', NULL, '2026-05-22 03:07:09.496655'),
(33, 'probably', 'intermediate', '/ˈprɒbəbli/', 'vocabulary', NULL, '2026-05-22 03:07:09.496655'),
(34, 'actually', 'intermediate', '/ˈæktʃuəli/', 'vocabulary', NULL, '2026-05-22 03:07:09.496656'),
(35, 'entrepreneurship', 'advanced', '/ˌɒntrəprəˈnɜːrʃɪp/', 'vocabulary', NULL, '2026-05-22 03:07:09.496657'),
(36, 'peculiar', 'advanced', '/pɪˈkjuːliər/', 'vocabulary', NULL, '2026-05-22 03:07:09.496657'),
(37, 'phenomenon', 'advanced', '/fɪˈnɒmɪnɒn/', 'vocabulary', NULL, '2026-05-22 03:07:09.496658'),
(38, 'particularly', 'advanced', '/pərˈtɪkjʊlərli/', 'vocabulary', NULL, '2026-05-22 03:07:09.496658'),
(39, 'thoroughly', 'advanced', '/ˈθʌrəli/', 'vocabulary', NULL, '2026-05-22 03:07:09.496659'),
(40, 'worcestershire', 'advanced', '/ˈwʊstərʃər/', 'vocabulary', NULL, '2026-05-22 03:07:09.49666'),
(41, 'colonel', 'advanced', '/ˈkɜːrnəl/', 'vocabulary', NULL, '2026-05-22 03:07:09.49666'),
(42, 'psychology', 'advanced', '/saɪˈkɒlədʒi/', 'vocabulary', NULL, '2026-05-22 03:07:09.496661'),
(43, 'hierarchy', 'advanced', '/ˈhaɪərɑːrki/', 'vocabulary', NULL, '2026-05-22 03:07:09.496662'),
(44, 'pneumonia', 'advanced', '/njuːˈmoʊniə/', 'vocabulary', NULL, '2026-05-22 03:07:09.496662'),
(45, 'queue', 'advanced', '/kjuː/', 'vocabulary', NULL, '2026-05-22 03:07:09.496663'),
(46, 'subtle', 'advanced', '/ˈsʌtəl/', 'vocabulary', NULL, '2026-05-22 03:07:09.496664'),
(47, 'conscience', 'advanced', '/ˈkɒnʃəns/', 'vocabulary', NULL, '2026-05-22 03:07:09.496664'),
(48, 'How are you doing?', 'beginner', '/haʊ ɑːr juː ˈduːɪŋ/', 'phrases', NULL, '2026-05-22 03:07:09.496665'),
(49, 'Nice to meet you', 'beginner', '/naɪs tə miːt juː/', 'phrases', NULL, '2026-05-22 03:07:09.496665'),
(50, 'What time is it?', 'beginner', '/wɒt taɪm ɪz ɪt/', 'phrases', NULL, '2026-05-22 03:07:09.496666'),
(51, 'I would like a cup of coffee', 'intermediate', '/aɪ wʊd laɪk ə kʌp ɒv ˈkɒfi/', 'phrases', NULL, '2026-05-22 03:07:09.496667'),
(52, 'Could you repeat that, please?', 'intermediate', '/kʊd juː rɪˈpiːt ðæt pliːz/', 'phrases', NULL, '2026-05-22 03:07:09.496668'),
(53, 'The weather is really nice today', 'intermediate', '/ðə ˈwɛðər ɪz ˈrɪəli naɪs təˈdeɪ/', 'phrases', NULL, '2026-05-22 03:07:09.496669'),
(54, 'I enjoy learning new languages every day', 'beginner', '/aɪ ɪnˈdʒɔɪ ˈlɜːrnɪŋ njuː ˈlæŋɡwɪdʒɪz ˈɛvri deɪ/', 'sentences', NULL, '2026-05-22 03:07:09.496669'),
(55, 'She walks to the park every morning', 'beginner', '/ʃiː wɔːks tə ðə pɑːrk ˈɛvri ˈmɔːrnɪŋ/', 'sentences', NULL, '2026-05-22 03:07:09.49667'),
(56, 'My brother is taller than me', 'beginner', '/maɪ ˈbrʌðər ɪz ˈtɔːlər ðæn miː/', 'sentences', NULL, '2026-05-22 03:07:09.496671'),
(57, 'The quick brown fox jumps over the lazy dog', 'intermediate', '/ðə kwɪk braʊn fɒks dʒʌmps ˈoʊvər ðə ˈleɪzi dɒɡ/', 'sentences', NULL, '2026-05-22 03:07:09.496671'),
(58, 'Could you tell me where the nearest hospital is?', 'intermediate', '/kʊd juː tɛl miː wɛr ðə ˈnɪərɪst ˈhɒspɪtəl ɪz/', 'sentences', NULL, '2026-05-22 03:07:09.496672'),
(59, 'I have been studying English for three years', 'intermediate', '/aɪ hæv biːn ˈstʌdiɪŋ ˈɪŋɡlɪʃ fɔːr θriː jɪərz/', 'sentences', NULL, '2026-05-22 03:07:09.496673'),
(60, 'The restaurant around the corner serves excellent Italian food', 'advanced', '/ðə ˈrɛstərɒnt əˈraʊnd ðə ˈkɔːrnər sɜːrvz ˈɛksələnt ɪˈtæliən fuː