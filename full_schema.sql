CREATE TABLE achievements (
	id SERIAL NOT NULL, 
	key VARCHAR(50) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description VARCHAR(300) NOT NULL, 
	icon VARCHAR(10) NOT NULL, 
	category VARCHAR(50), 
	threshold INTEGER, 
	CONSTRAINT achievements_pkey PRIMARY KEY (id), 
	CONSTRAINT achievements_key_key UNIQUE NULLS DISTINCT (key)
);

CREATE TABLE enemies (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	name TEXT, 
	level BIGINT, 
	hp_max BIGINT, 
	mp_max BIGINT, 
	attack BIGINT, 
	defense BIGINT, 
	speed BIGINT, 
	exp_reward BIGINT, 
	gold_reward BIGINT, 
	ai_behavior TEXT, 
	skill_ids JSONB, 
	sprite_key TEXT, 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT enemies_pkey PRIMARY KEY (id)
);

CREATE TABLE friend_requests (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	requester_id UUID NOT NULL, 
	addressee_id UUID NOT NULL, 
	status VARCHAR(16) DEFAULT 'pending'::character varying NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT friend_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE friendships (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user1_id UUID NOT NULL, 
	user2_id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT friendships_pkey PRIMARY KEY (id)
);

CREATE TABLE inventories (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	player_id TEXT, 
	item_id TEXT, 
	quantity BIGINT, 
	slot_index BIGINT, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT inventories_pkey PRIMARY KEY (id)
);

CREATE TABLE items (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	name TEXT, 
	description TEXT, 
	item_type TEXT, 
	effect_type TEXT, 
	effect_value BIGINT, 
	price BIGINT, 
	max_stack BIGINT, 
	icon_key TEXT, 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT items_pkey PRIMARY KEY (id)
);

CREATE TABLE learning_challenges (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	type VARCHAR(30) NOT NULL, 
	question TEXT NOT NULL, 
	option1 TEXT NOT NULL, 
	option2 TEXT NOT NULL, 
	option3 TEXT NOT NULL, 
	correct_option BIGINT NOT NULL, 
	explanation_es TEXT, 
	tags TEXT[] DEFAULT '{}'::text[] NOT NULL, 
	difficulty VARCHAR(20) DEFAULT 'beginner'::character varying NOT NULL, 
	language_learning VARCHAR(20) DEFAULT 'english'::character varying NOT NULL, 
	phonetic VARCHAR(100), 
	requires_audio BOOLEAN DEFAULT false NOT NULL, 
	audio_url VARCHAR(500), 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT learning_challenges_pkey PRIMARY KEY (id)
);

CREATE TABLE map_configs (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	scene_key TEXT NOT NULL, 
	walls_json TEXT NOT NULL, 
	updated_by UUID, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	map_data TEXT, 
	is_public BOOLEAN DEFAULT false, 
	max_users BIGINT DEFAULT 50, 
	CONSTRAINT map_configs_pkey PRIMARY KEY (id)
);

CREATE TABLE player_skills (
	player_id TEXT NOT NULL, 
	skill_id TEXT NOT NULL, 
	unlocked_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT player_skills_pkey PRIMARY KEY (player_id, skill_id)
);

CREATE TABLE player_stats (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	class TEXT DEFAULT 'warrior'::text, 
	level BIGINT DEFAULT 1, 
	experience BIGINT DEFAULT 0, 
	hp_current BIGINT, 
	hp_max BIGINT DEFAULT 100, 
	mp_current BIGINT, 
	mp_max BIGINT DEFAULT 50, 
	attack BIGINT DEFAULT 10, 
	defense BIGINT DEFAULT 5, 
	speed BIGINT DEFAULT 10, 
	skill_points BIGINT DEFAULT 0, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT player_stats_pkey PRIMARY KEY (id), 
	CONSTRAINT uni_player_stats_user_id UNIQUE NULLS DISTINCT (user_id)
);

CREATE TABLE rooms (
	id UUID NOT NULL, 
	name VARCHAR(50) NOT NULL, 
	max_users BIGINT DEFAULT 50, 
	map_data JSONB, 
	is_public BOOLEAN DEFAULT true, 
	created_by UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	type VARCHAR(20) DEFAULT 'public'::character varying, 
	scene_key VARCHAR(50) NOT NULL, 
	parent_id UUID, 
	invite_code VARCHAR(10), 
	CONSTRAINT rooms_pkey PRIMARY KEY (id)
);

CREATE TABLE skills (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	name TEXT, 
	description TEXT, 
	skill_type TEXT, 
	mp_cost BIGINT, 
	power BIGINT, 
	target_type TEXT, 
	required_level BIGINT, 
	animation_key TEXT, 
	created_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT skills_pkey PRIMARY KEY (id)
);

CREATE TABLE users (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	username TEXT NOT NULL, 
	email TEXT NOT NULL, 
	password TEXT, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	is_guest BOOLEAN DEFAULT false NOT NULL, 
	role TEXT DEFAULT 'user'::text NOT NULL, 
	character_id TEXT DEFAULT '1'::text NOT NULL, 
	CONSTRAINT users_pkey PRIMARY KEY (id), 
	CONSTRAINT uni_users_email UNIQUE NULLS DISTINCT (email), 
	CONSTRAINT uni_users_username UNIQUE NULLS DISTINCT (username)
);

CREATE TABLE words (
	id SERIAL NOT NULL, 
	text VARCHAR(200) NOT NULL, 
	difficulty VARCHAR(20), 
	phonetic VARCHAR(200), 
	category VARCHAR(50), 
	audio_url VARCHAR(500), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	CONSTRAINT words_pkey PRIMARY KEY (id)
);

CREATE TABLE recordings (
	id SERIAL NOT NULL, 
	user_id UUID, 
	word_id INTEGER NOT NULL, 
	audio_path VARCHAR(500), 
	transcription TEXT, 
	confidence_score DOUBLE PRECISION, 
	pronunciation_score DOUBLE PRECISION, 
	feedback JSON, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	CONSTRAINT recordings_pkey PRIMARY KEY (id), 
	CONSTRAINT recordings_user_id_fkey FOREIGN KEY(user_id) REFERENCES users (id), 
	CONSTRAINT recordings_word_id_fkey FOREIGN KEY(word_id) REFERENCES words (id)
);

CREATE TABLE user_achievements (
	id SERIAL NOT NULL, 
	user_id UUID NOT NULL, 
	achievement_id INTEGER NOT NULL, 
	unlocked_at TIMESTAMP WITHOUT TIME ZONE, 
	CONSTRAINT user_achievements_pkey PRIMARY KEY (id), 
	CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY(achievement_id) REFERENCES achievements (id), 
	CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE user_challenge_attempts (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	challenge_id UUID NOT NULL, 
	selected_option BIGINT NOT NULL, 
	is_correct BOOLEAN DEFAULT false NOT NULL, 
	feedback_ai TEXT, 
	answered_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT user_challenge_attempts_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_learning_challenges_attempts FOREIGN KEY(challenge_id) REFERENCES learning_challenges (id), 
	CONSTRAINT fk_user_challenge_attempts_user FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE user_learning_profiles (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	english_level VARCHAR(20) DEFAULT 'beginner'::character varying NOT NULL, 
	preferred_tags TEXT[] DEFAULT '{}'::text[] NOT NULL, 
	weekly_score BIGINT DEFAULT 0 NOT NULL, 
	weekly_correct BIGINT DEFAULT 0 NOT NULL, 
	weekly_attempts BIGINT DEFAULT 0 NOT NULL, 
	week_start DATE, 
	current_level_xp BIGINT DEFAULT 0 NOT NULL, 
	total_xp BIGINT DEFAULT 0 NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE, 
	updated_at TIMESTAMP WITH TIME ZONE, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT user_learning_profiles_pkey PRIMARY KEY (id), 
	CONSTRAINT fk_user_learning_profiles_user FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE user_progress (
	id SERIAL NOT NULL, 
	user_id UUID NOT NULL, 
	word_id INTEGER NOT NULL, 
	attempts INTEGER, 
	best_score DOUBLE PRECISION, 
	last_practice TIMESTAMP WITHOUT TIME ZONE, 
	mastered BOOLEAN, 
	CONSTRAINT user_progress_pkey PRIMARY KEY (id), 
	CONSTRAINT user_progress_user_id_fkey FOREIGN KEY(user_id) REFERENCES users (id), 
	CONSTRAINT user_progress_word_id_fkey FOREIGN KEY(word_id) REFERENCES words (id)
);

