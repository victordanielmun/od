-- ============================================================================
-- Jugadores con IA (bots de charla del lobby)
-- ============================================================================
-- Tipo aparte de los NPCs: NO toca npc_definitions / npc_templates /
-- npc_room_instances ni el pipeline de misiones y diálogo. Usa los personajes de
-- JUGADOR, lo mueve el servidor y conversa por el chat privado entre usuarios.
--
-- Aplicar a mano en la BD remota (el backend arranca con AUTO_MIGRATE=false):
--   psql "$DATABASE_URL" -f ai_players_schema.sql
--
-- Es idempotente: se puede volver a lanzar sin romper nada.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_players (
    id               SERIAL PRIMARY KEY,

    -- Fila espejo en users. Es lo que permite enrutarle un mensaje privado y que
    -- su nombre salga en la ventana de chat como el de cualquier jugador.
    user_id          UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    username         VARCHAR(50) NOT NULL,
    character_id     VARCHAR(10) NOT NULL DEFAULT '1',
    scene_key        VARCHAR(100) NOT NULL DEFAULT 'lobby',

    -- Instrucciones de sistema para el LLM: quién es y cómo habla.
    personality      TEXT        NOT NULL DEFAULT '',
    -- Primera línea al abrir la conversación (vacío = espera a que hable el jugador).
    greeting         TEXT        NOT NULL DEFAULT '',

    -- text_only | audio_only | hybrid
    interaction_mode VARCHAR(20) NOT NULL DEFAULT 'text_only',
    -- Voz de Piper cuando la respuesta se reproduce en audio.
    voice_type       VARCHAR(20) NOT NULL DEFAULT 'female',

    -- Ancla del paseo. En (0,0) el bot se ancla donde aparece el primer jugador
    -- que entra a la sala, que es lo que hace que estén donde hay gente.
    spawn_x          DOUBLE PRECISION NOT NULL DEFAULT 0,
    spawn_y          DOUBLE PRECISION NOT NULL DEFAULT 0,
    wander_radius    DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Retirar un bot sin borrarlo conserva su historial de conversación.
    is_active        BOOLEAN     NOT NULL DEFAULT TRUE,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_players_scene ON ai_players (scene_key);

-- ============================================================================
-- NOTA sobre el historial de conversación
-- ============================================================================
-- No hace falta tabla nueva: como cada bot tiene su fila en `users`, sus mensajes
-- se guardan en `direct_messages` igual que los de una persona. De ahí sale tanto
-- el historial que ve el jugador al reabrir el chat como el contexto que se le
-- pasa al LLM.
-- ============================================================================
