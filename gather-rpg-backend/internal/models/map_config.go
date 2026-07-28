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
	// PreviewImage is the filename of this map's PNG preview (served publicly at
	// /api/world-art/<file>). Used by the world catalog and the admin map list.
	PreviewImage string `gorm:"size:255;not null;default:''" json:"preview_image"`
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
	Type     string    `json:"type"` // "melee" (default), "thrower", "fast", "boss"

	// Thrower: sprite del proyectil (icon_key de item); vacío → círculo rojo.
	ProjectileSprite string `json:"projectile_sprite"`

	// Boss: maná (regen automático; el skill requiere maná), autoregen de HP y
	// porcentaje de HP que recupera al fallar la card multijugador.
	ManaMax         int `json:"mana_max"`
	ManaRegen       int `json:"mana_regen"`        // maná por segundo
	HPRegen         int `json:"hp_regen"`          // HP por segundo (autoregen)
	CardFailHealPct int `json:"card_fail_heal_pct"` // % de HPMax al fallar la card (default 100)
}
