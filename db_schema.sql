--
-- PostgreSQL database dump
--

\restrict gvvcT57tZnh925HdOcLCCIsNbRDh9i0Gzu7WetHZEBoEDWNRSIezlWOMBCNnXdp

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.achievements (
    id integer NOT NULL,
    key character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(300) NOT NULL,
    icon character varying(10) NOT NULL,
    category character varying(50),
    threshold integer
);


ALTER TABLE public.achievements OWNER TO postgres;

--
-- Name: achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.achievements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.achievements_id_seq OWNER TO postgres;

--
-- Name: achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.achievements_id_seq OWNED BY public.achievements.id;


--
-- Name: enemies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.enemies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    level bigint,
    hp_max bigint,
    mp_max bigint,
    attack bigint,
    defense bigint,
    speed bigint,
    exp_reward bigint,
    gold_reward bigint,
    ai_behavior text,
    skill_ids jsonb,
    sprite_key text,
    created_at timestamp with time zone
);


ALTER TABLE public.enemies OWNER TO postgres;

--
-- Name: friend_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.friend_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


ALTER TABLE public.friend_requests OWNER TO postgres;

--
-- Name: friendships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user1_id uuid NOT NULL,
    user2_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


ALTER TABLE public.friendships OWNER TO postgres;

--
-- Name: inventories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id text,
    item_id text,
    quantity bigint,
    slot_index bigint,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.inventories OWNER TO postgres;

--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    description text,
    item_type text,
    effect_type text,
    effect_value bigint,
    price bigint,
    max_stack bigint,
    icon_key text,
    created_at timestamp with time zone
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: learning_challenges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.learning_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying(30) NOT NULL,
    question text NOT NULL,
    option1 text NOT NULL,
    option2 text NOT NULL,
    option3 text NOT NULL,
    correct_option bigint NOT NULL,
    explanation_es text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    difficulty character varying(20) DEFAULT 'beginner'::character varying NOT NULL,
    language_learning character varying(20) DEFAULT 'english'::character varying NOT NULL,
    requires_audio boolean DEFAULT false NOT NULL,
    audio_url character varying(500),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


ALTER TABLE public.learning_challenges OWNER TO postgres;

--
-- Name: map_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.map_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scene_key text NOT NULL,
    walls_json text NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    map_data text,
    is_public boolean DEFAULT false,
    max_users bigint DEFAULT 50
);


ALTER TABLE public.map_configs OWNER TO postgres;

--
-- Name: player_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_skills (
    player_id text NOT NULL,
    skill_id text NOT NULL,
    unlocked_at timestamp with time zone
);


ALTER TABLE public.player_skills OWNER TO postgres;

--
-- Name: player_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    class text DEFAULT 'warrior'::text,
    level bigint DEFAULT 1,
    experience bigint DEFAULT 0,
    hp_current bigint,
    hp_max bigint DEFAULT 100,
    mp_current bigint,
    mp_max bigint DEFAULT 50,
    attack bigint DEFAULT 10,
    defense bigint DEFAULT 5,
    speed bigint DEFAULT 10,
    skill_points bigint DEFAULT 0,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.player_stats OWNER TO postgres;

--
-- Name: recordings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recordings (
    id integer NOT NULL,
    user_id uuid,
    word_id integer NOT NULL,
    audio_path character varying(500),
    transcription text,
    confidence_score double precision,
    pronunciation_score double precision,
    feedback json,
    created_at timestamp without time zone
);


ALTER TABLE public.recordings OWNER TO postgres;

--
-- Name: recordings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.recordings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.recordings_id_seq OWNER TO postgres;

--
-- Name: recordings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.recordings_id_seq OWNED BY public.recordings.id;


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rooms (
    id uuid NOT NULL,
    name character varying(50) NOT NULL,
    max_users bigint DEFAULT 50,
    map_data jsonb,
    is_public boolean DEFAULT true,
    created_by uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    type character varying(20) DEFAULT 'public'::character varying,
    scene_key character varying(50) NOT NULL,
    parent_id uuid,
    invite_code character varying(10)
);


ALTER TABLE public.rooms OWNER TO postgres;

--
-- Name: skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    description text,
    skill_type text,
    mp_cost bigint,
    power bigint,
    target_type text,
    required_level bigint,
    animation_key text,
    created_at timestamp with time zone
);


ALTER TABLE public.skills OWNER TO postgres;

--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_achievements (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    achievement_id integer NOT NULL,
    unlocked_at timestamp without time zone
);


ALTER TABLE public.user_achievements OWNER TO postgres;

--
-- Name: user_achievements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_achievements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_achievements_id_seq OWNER TO postgres;

--
-- Name: user_achievements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_achievements_id_seq OWNED BY public.user_achievements.id;


--
-- Name: user_challenge_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_challenge_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    selected_option bigint NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    feedback_ai text,
    answered_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_challenge_attempts OWNER TO postgres;

--
-- Name: user_learning_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_learning_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    english_level character varying(20) DEFAULT 'beginner'::character varying NOT NULL,
    preferred_tags text[] DEFAULT '{}'::text[] NOT NULL,
    weekly_score bigint DEFAULT 0 NOT NULL,
    weekly_correct bigint DEFAULT 0 NOT NULL,
    weekly_attempts bigint DEFAULT 0 NOT NULL,
    week_start date,
    current_level_xp bigint DEFAULT 0 NOT NULL,
    total_xp bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


ALTER TABLE public.user_learning_profiles OWNER TO postgres;

--
-- Name: user_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_progress (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    word_id integer NOT NULL,
    attempts integer,
    best_score double precision,
    last_practice timestamp without time zone,
    mastered boolean
);


ALTER TABLE public.user_progress OWNER TO postgres;

--
-- Name: user_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_progress_id_seq OWNER TO postgres;

--
-- Name: user_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_progress_id_seq OWNED BY public.user_progress.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    password text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    is_guest boolean DEFAULT false NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    character_id text DEFAULT '1'::text NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: words; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.words (
    id integer NOT NULL,
    text character varying(200) NOT NULL,
    difficulty character varying(20),
    phonetic character varying(200),
    category character varying(50),
    audio_url character varying(500),
    created_at timestamp without time zone
);


ALTER TABLE public.words OWNER TO postgres;

--
-- Name: words_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.words_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.words_id_seq OWNER TO postgres;

--
-- Name: words_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.words_id_seq OWNED BY public.words.id;


--
-- Name: achievements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements ALTER COLUMN id SET DEFAULT nextval('public.achievements_id_seq'::regclass);


--
-- Name: recordings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings ALTER COLUMN id SET DEFAULT nextval('public.recordings_id_seq'::regclass);


--
-- Name: user_achievements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements ALTER COLUMN id SET DEFAULT nextval('public.user_achievements_id_seq'::regclass);


--
-- Name: user_progress id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress ALTER COLUMN id SET DEFAULT nextval('public.user_progress_id_seq'::regclass);


--
-- Name: words id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.words ALTER COLUMN id SET DEFAULT nextval('public.words_id_seq'::regclass);


--
-- Name: achievements achievements_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_key_key UNIQUE (key);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: enemies enemies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enemies
    ADD CONSTRAINT enemies_pkey PRIMARY KEY (id);


--
-- Name: friend_requests friend_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: inventories inventories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventories
    ADD CONSTRAINT inventories_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: learning_challenges learning_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.learning_challenges
    ADD CONSTRAINT learning_challenges_pkey PRIMARY KEY (id);


--
-- Name: map_configs map_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.map_configs
    ADD CONSTRAINT map_configs_pkey PRIMARY KEY (id);


--
-- Name: player_skills player_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_skills
    ADD CONSTRAINT player_skills_pkey PRIMARY KEY (player_id, skill_id);


--
-- Name: player_stats player_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT player_stats_pkey PRIMARY KEY (id);


--
-- Name: recordings recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: player_stats uni_player_stats_user_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_stats
    ADD CONSTRAINT uni_player_stats_user_id UNIQUE (user_id);


--
-- Name: users uni_users_email; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uni_users_email UNIQUE (email);


--
-- Name: users uni_users_username; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uni_users_username UNIQUE (username);


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- Name: user_challenge_attempts user_challenge_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_challenge_attempts
    ADD CONSTRAINT user_challenge_attempts_pkey PRIMARY KEY (id);


--
-- Name: user_learning_profiles user_learning_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_learning_profiles
    ADD CONSTRAINT user_learning_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_progress user_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: words words_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.words
    ADD CONSTRAINT words_pkey PRIMARY KEY (id);


--
-- Name: idx_friend_request_pair; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_friend_request_pair ON public.friend_requests USING btree (requester_id, addressee_id);


--
-- Name: idx_friend_requests_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friend_requests_deleted_at ON public.friend_requests USING btree (deleted_at);


--
-- Name: idx_friend_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friend_requests_status ON public.friend_requests USING btree (status);


--
-- Name: idx_friendship_pair; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_friendship_pair ON public.friendships USING btree (user1_id, user2_id);


--
-- Name: idx_friendships_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_friendships_deleted_at ON public.friendships USING btree (deleted_at);


--
-- Name: idx_learning_challenges_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_learning_challenges_deleted_at ON public.learning_challenges USING btree (deleted_at);


--
-- Name: idx_map_configs_scene_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_map_configs_scene_key ON public.map_configs USING btree (scene_key);


--
-- Name: idx_rooms_invite_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rooms_invite_code ON public.rooms USING btree (invite_code);


--
-- Name: idx_rooms_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_rooms_name ON public.rooms USING btree (name);


--
-- Name: idx_user_challenge_attempts_challenge_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_challenge_attempts_challenge_id ON public.user_challenge_attempts USING btree (challenge_id);


--
-- Name: idx_user_challenge_attempts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_challenge_attempts_user_id ON public.user_challenge_attempts USING btree (user_id);


--
-- Name: idx_user_learning_profiles_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_learning_profiles_deleted_at ON public.user_learning_profiles USING btree (deleted_at);


--
-- Name: idx_user_learning_profiles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_user_learning_profiles_user_id ON public.user_learning_profiles USING btree (user_id);


--
-- Name: idx_users_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at);


--
-- Name: ix_achievements_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_achievements_id ON public.achievements USING btree (id);


--
-- Name: ix_recordings_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_recordings_id ON public.recordings USING btree (id);


--
-- Name: ix_user_achievements_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_user_achievements_id ON public.user_achievements USING btree (id);


--
-- Name: ix_user_progress_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_user_progress_id ON public.user_progress USING btree (id);


--
-- Name: ix_words_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_words_id ON public.words USING btree (id);


--
-- Name: user_challenge_attempts fk_learning_challenges_attempts; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_challenge_attempts
    ADD CONSTRAINT fk_learning_challenges_attempts FOREIGN KEY (challenge_id) REFERENCES public.learning_challenges(id);


--
-- Name: user_challenge_attempts fk_user_challenge_attempts_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_challenge_attempts
    ADD CONSTRAINT fk_user_challenge_attempts_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_learning_profiles fk_user_learning_profiles_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_learning_profiles
    ADD CONSTRAINT fk_user_learning_profiles_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: recordings recordings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: recordings recordings_word_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_word_id_fkey FOREIGN KEY (word_id) REFERENCES public.words(id);


--
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id);


--
-- Name: user_achievements user_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_progress user_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_progress user_progress_word_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_word_id_fkey FOREIGN KEY (word_id) REFERENCES public.words(id);


--
-- PostgreSQL database dump complete
--

\unrestrict gvvcT57tZnh925HdOcLCCIsNbRDh9i0Gzu7WetHZEBoEDWNRSIezlWOMBCNnXdp

