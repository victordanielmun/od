package repository

import (
	"context"
	"database/sql"
	"gather-rpg-backend/internal/models"
)

// Repository interface for Enemy configuration
type EnemyRepository interface {
	GetByLevel(ctx context.Context, levelID string) ([]models.EnemyConfig, error)
}

// Postgres implementation
type postgresEnemyRepo struct {
	db *sql.DB
}

func NewEnemyRepository(db *sql.DB) EnemyRepository {
	return &postgresEnemyRepo{db: db}
}

func (r *postgresEnemyRepo) GetByLevel(ctx context.Context, levelID string) ([]models.EnemyConfig, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT 
			e.npc_id, e.texture_key, e.default_frame,
			e.hp, e.speed, e.damage, e.attack_rate,
			e.attack_range, e.detect_range, e.knock_threshold,
			es.level_id, es.spawn_x, es.spawn_y, es.wave_num
		FROM enemies e
		JOIN enemy_spawns es ON es.enemy_id = e.id
		WHERE es.level_id = $1
		ORDER BY es.wave_num, es.spawn_x
	`, levelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var configs []models.EnemyConfig
	for rows.Next() {
		var c models.EnemyConfig
		err := rows.Scan(
			&c.NpcID, &c.TextureKey, &c.DefaultFrame,
			&c.HP, &c.Speed, &c.Damage, &c.AttackRate,
			&c.AttackRange, &c.DetectRange, &c.KnockThreshold,
			&c.Level, &c.SpawnX, &c.SpawnY, &c.WaveNum,
		)
		if err != nil {
			return nil, err
		}
		configs = append(configs, c)
	}
	return configs, nil
}
