package models

import (
	"time"

	"github.com/google/uuid"
)

// MapConfig stores the wall/obstacle configuration for a game scene.
// WallsJSON contains a JSON array of wall objects [{x, y, width, height}, ...].
type MapConfig struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SceneKey  string    `gorm:"uniqueIndex;not null" json:"scene_key"` // e.g. "lobby", "main"
	WallsJSON string    `gorm:"type:text;not null" json:"walls_json"`
	MapData   string    `gorm:"type:text" json:"map_data"` // JSON string for {width, height, etc.}
	IsPublic  bool      `gorm:"default:false" json:"is_public"`
	MaxUsers  int       `gorm:"default:50" json:"max_users"`
	UpdatedBy uuid.UUID `gorm:"type:uuid" json:"updated_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type MapData struct {
	Width   int          `json:"width"`
	Height  int          `json:"height"`
	Enemies []EnemySpawn `json:"enemies"`
}

type EnemySpawn struct {
	EnemyID uuid.UUID `json:"enemy_id"`
	SpawnX  float64   `json:"spawn_x"`
	SpawnY  float64   `json:"spawn_y"`
	WaveNum int       `json:"wave_num"`
	NPCID   string    `json:"npc_id"`
	SpriteID string   `json:"sprite_id"` // Asset ID (.1., .2., etc.)
	HP       int       `json:"hp"`
	Speed    float64   `json:"speed"`
	Damage   int       `json:"damage"`
	AttackRate int     `json:"attack_rate"`
}
