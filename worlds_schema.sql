-- ============================================================================
-- Odyssey — MUNDOS (agrupación de misiones + examen final por combate)
-- ----------------------------------------------------------------------------
-- Modelo:
--   world  1─N  mission  1─N  task
--   world.exam_tag ("final_mision_1") apunta al pool de learning_challenges
--   que la Ninja Card usará en el MAPA FINAL del mundo.
--
-- Reglas de negocio (aprobadas):
--   * NO hay prerequisitos: cualquier misión y cualquier mundo se juega libre.
--   * Aprobar el mundo = MATAR AL BOSS del mapa final (boss = última wave).
--   * En cooperativo el examen es en equipo (todos deben acertar la card).
--
-- IDEMPOTENTE: se puede ejecutar varias veces sin romper nada.
-- Prod usa AUTO_MIGRATE=false → este archivo es la única fuente del esquema.
-- ============================================================================

BEGIN;

-- ─── 1. Mundos ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worlds (
    id              SERIAL PRIMARY KEY,
    key             VARCHAR(50)  NOT NULL UNIQUE,   -- "mundo_1" — estable, no renombrar
    name            VARCHAR(150) NOT NULL,
    description_en  TEXT         NOT NULL DEFAULT '',
    "order"         INT          NOT NULL DEFAULT 0, -- SOLO presentación, no bloquea
    challenge_tags  TEXT[]       NOT NULL DEFAULT '{}',   -- pool de cards normales: {animals,food}
    challenge_types TEXT[]       NOT NULL DEFAULT '{}',   -- {vocabulary,grammar}; vacío = todos
    exam_tag        VARCHAR(60)  NOT NULL DEFAULT '',     -- "final_mision_1" → pool del examen
    difficulty      VARCHAR(20)  NOT NULL DEFAULT 'beginner',
    cover_image     VARCHAR(255) NOT NULL DEFAULT '',     -- PNG de portada del mundo
    status          VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Un exam_tag no puede repetirse entre mundos (los vacíos sí).
CREATE UNIQUE INDEX IF NOT EXISTS idx_worlds_exam_tag
    ON worlds (exam_tag) WHERE exam_tag <> '';

CREATE INDEX IF NOT EXISTS idx_worlds_status_order ON worlds (status, "order");

-- ─── 2. Vínculo misión → mundo ──────────────────────────────────────────────
ALTER TABLE missions ADD COLUMN IF NOT EXISTS world_id       INT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS is_final       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS order_in_world INT     NOT NULL DEFAULT 0;
-- Override opcional del pool por misión; vacío = hereda worlds.challenge_tags
ALTER TABLE missions ADD COLUMN IF NOT EXISTS challenge_tags TEXT[]  NOT NULL DEFAULT '{}';

DO $$ BEGIN
    ALTER TABLE missions
        ADD CONSTRAINT fk_missions_world
        FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_missions_world ON missions (world_id);

-- Un solo mapa final por mundo (evita ambigüedad al resolver el pool de examen).
CREATE UNIQUE INDEX IF NOT EXISTS idx_missions_one_final_per_world
    ON missions (world_id) WHERE is_final AND world_id IS NOT NULL;

-- ─── 3. PNG por mapa individual ─────────────────────────────────────────────
-- Se sirve por /api/world-art/<archivo> (público, sin auth, para el <img>).
ALTER TABLE map_configs ADD COLUMN IF NOT EXISTS preview_image VARCHAR(255) NOT NULL DEFAULT '';

-- ─── 4. Dominio del mundo por jugador (diagnóstico + badge) ─────────────────
-- player_id = player_stats.id (mismo criterio que player_mission_progresses:
-- sin FK declarada para no acoplar el borrado de stats).
CREATE TABLE IF NOT EXISTS player_world_masteries (
    id            SERIAL PRIMARY KEY,
    player_id     UUID  NOT NULL,
    world_id      INT   NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    exam_attempts INT   NOT NULL DEFAULT 0,
    last_score    INT   NOT NULL DEFAULT 0,  -- % de aciertos del último intento
    best_score    INT   NOT NULL DEFAULT 0,
    -- weak_tags: {"food": {"ok": 2, "total": 5}, "directions": {"ok": 1, "total": 4}}
    weak_tags     JSONB NOT NULL DEFAULT '{}'::jsonb,
    passed_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (player_id, world_id)
);

CREATE INDEX IF NOT EXISTS idx_world_mastery_player ON player_world_masteries (player_id);

-- ─── 5. Traducciones del mundo (mismo patrón que mission_translations) ──────
CREATE TABLE IF NOT EXISTS world_translations (
    id          SERIAL PRIMARY KEY,
    world_id    INT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    lang        VARCHAR(10) NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (world_id, lang)
);

-- ─── 6. Mundo de ejemplo (idempotente) ──────────────────────────────────────
-- Sirve para validar el pipeline completo sin tocar el admin todavía.
INSERT INTO worlds (key, name, description_en, "order", challenge_tags, challenge_types, exam_tag, difficulty)
VALUES ('mundo_1', 'World 1', 'First world: everyday vocabulary.', 1,
        '{animals,food}', '{vocabulary}', 'final_mision_1', 'beginner')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (correr después; no forma parte de la transacción)
-- ============================================================================
-- \echo '── Mundos ──'
-- SELECT id, key, name, exam_tag, challenge_tags, difficulty FROM worlds ORDER BY "order";
--
-- \echo '── Misiones por mundo (NULL = sueltas, siguen visibles) ──'
-- SELECT COALESCE(w.key,'(sin mundo)') AS mundo, count(*) AS misiones,
--        count(*) FILTER (WHERE m.is_final) AS finales
--   FROM missions m LEFT JOIN worlds w ON w.id = m.world_id
--  GROUP BY 1 ORDER BY 1;
--
-- \echo '── Salud del pool de examen (0 = el examen caería a random global) ──'
-- SELECT w.key, w.exam_tag,
--        (SELECT count(*) FROM learning_challenges c WHERE w.exam_tag = ANY(c.tags)) AS preguntas_examen,
--        (SELECT count(*) FROM learning_challenges c WHERE c.tags && w.challenge_tags) AS preguntas_normales
--   FROM worlds w WHERE w.status = 'active' ORDER BY w."order";
