package database

import (
	"log"
	"time"
)

// EnsureFastSchema aplica los cambios de esquema como DDL directo al arrancar.
//
// Es el camino alternativo a AutoMigrate, y existe por una razón concreta: contra
// la base de datos remota AutoMigrate tarda MINUTOS, porque antes de decidir qué
// hacer introspecciona el esquema entero (todas las tablas, columnas, índices y
// restricciones). Por eso el servidor va con AUTO_MIGRATE=false.
//
// Aquí no hay introspección: son sentencias idempotentes que Postgres resuelve en
// milisegundos consultando su catálogo. Por eso se ejecutan SIEMPRE, con
// AutoMigrate activo o no, sin que el arranque se resienta.
//
// Reglas para todo lo que se añada a esta lista:
//   - Idempotente sin excepción (IF NOT EXISTS): corre en cada arranque.
//   - Nada destructivo: ni DROP, ni ALTER que pueda perder datos.
//   - Barato: nada de recorrer tablas grandes ni crear índices sobre millones de
//     filas, o dejaría de cumplir su única promesa, que es ser instantáneo.
func EnsureFastSchema() {
	if DB == nil {
		return
	}

	statements := []struct {
		name string
		sql  string
	}{
		{
			// Jugadores con IA (bots de charla). Ver ai_players_schema.sql, que es
			// la misma definición para aplicarla a mano si hiciera falta.
			name: "ai_players",
			sql: `
CREATE TABLE IF NOT EXISTS ai_players (
    id               SERIAL PRIMARY KEY,
    user_id          UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    username         VARCHAR(50) NOT NULL,
    character_id     VARCHAR(10) NOT NULL DEFAULT '1',
    scene_key        VARCHAR(100) NOT NULL DEFAULT 'lobby',
    personality      TEXT        NOT NULL DEFAULT '',
    greeting         TEXT        NOT NULL DEFAULT '',
    interaction_mode VARCHAR(20) NOT NULL DEFAULT 'text_only',
    voice_type       VARCHAR(20) NOT NULL DEFAULT 'female',
    spawn_x          DOUBLE PRECISION NOT NULL DEFAULT 0,
    spawn_y          DOUBLE PRECISION NOT NULL DEFAULT 0,
    wander_radius    DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
		},
		{
			name: "idx_ai_players_scene",
			sql:  `CREATE INDEX IF NOT EXISTS idx_ai_players_scene ON ai_players (scene_key)`,
		},
	}

	start := time.Now()
	applied := 0
	for _, stmt := range statements {
		if err := DB.Exec(stmt.sql).Error; err != nil {
			// No es fatal: el servidor arranca igual y la funcionalidad que dependa
			// de esa tabla se degrada sola. Pero tiene que verse en el log.
			log.Printf("[Schema] ERROR aplicando %s: %v", stmt.name, err)
			continue
		}
		applied++
	}

	log.Printf("[Schema] DDL rápido aplicado: %d/%d sentencias en %s (sin AutoMigrate)",
		applied, len(statements), time.Since(start).Round(time.Millisecond))
}
