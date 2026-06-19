package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Enemy struct {
	ID          uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string          `json:"name"`
	Level       int             `json:"level"`
	HPMax       int             `json:"hp_max"`
	MPMax       int             `json:"mp_max"`
	Attack      int             `json:"attack"`
	Defense     int             `json:"defense"`
	Speed       int             `json:"speed"`
	EXPReward   int             `json:"exp_reward"`
	GoldReward  int             `json:"gold_reward"`
	AIBehavior  string          `json:"ai_behavior"` // "aggressive", "defensive", "random"
	SkillIDs    json.RawMessage `gorm:"type:jsonb" json:"skill_ids"`
	SpriteKey   string          `json:"sprite_key"`
	CreatedAt   time.Time       `json:"created_at"`
}

// Helper to save/load JSON skills for Enemy
func (e *Enemy) BeforeCreate(tx *gorm.DB) (err error) {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return
}

// EnemyConfig es lo que el frontend necesita para montar el pool
// y configurar la FSM de cada tipo de enemigo
type EnemyConfig struct {
	// Identificación — conecta con el sistema NPC existente
	NpcID        string `json:"npcId"`       // "guardia_1", "boss_dragon"
	TextureKey   string `json:"textureKey"`  // clave del atlas en Phaser
	DefaultFrame string `json:"defaultFrame"` // frame inicial

	// Stats de combate — alimentan la FSM
	HP             int     `json:"hp"`
	Speed          float64 `json:"speed"`          // px/s
	Damage         int     `json:"damage"`          // daño por ataque
	AttackRate     int     `json:"attackRate"`      // ms entre ataques
	AttackRange    float64 `json:"attackRange"`     // px de rango de ataque
	DetectRange    float64 `json:"detectRange"`     // px para activar chase
	KnockThreshold int     `json:"knockThreshold"`  // daño mínimo para knocked

	// Spawneo — dónde y cuándo aparece en el nivel
	Level   string  `json:"level"`
	SpawnX  float64 `json:"spawnX"`
	SpawnY  float64 `json:"spawnY"`
	WaveNum int     `json:"waveNum"` // en qué oleada aparece
	SpawnHP     *int     `json:"spawnHp,omitempty"`
	SpawnSpeed  *float64 `json:"spawnSpeed,omitempty"`
	SpawnDamage *int     `json:"spawnDamage,omitempty"`
	SpawnAttackRate *int `json:"spawnAttackRate,omitempty"`
}
// Real-time Combat Models (Websocket)

type ActiveEnemy struct {
	InstanceID uuid.UUID `json:"instance_id"`
	EnemyID    uuid.UUID `json:"enemy_id"`
	X          float64   `json:"x"`
	Y          float64   `json:"y"`
	HP         int       `json:"hp"`
	HPMax      int       `json:"hp_max"`
	FSMState   string    `json:"fsm_state"` // "idle", "chase", "attack", "dead", "ninja_card"
	TargetID   string    `json:"target_id"` // UserID of the targeted player
	PendingNinjaCard string `json:"pending_ninja_card,omitempty"` // Player ID that triggered the ninja card
	WaveNum    int       `json:"wave_num"`
	NPCID      string    `json:"npc_id"`    // From template config
	SpriteID   string    `json:"sprite_id"` // Asset ID ('1', '2', etc.)
}

type EnemyUpdateBroadcast struct {
	RoomID  string        `json:"room_id"`
	Enemies []ActiveEnemy `json:"enemies"`
}

type EnemyDiedBroadcast struct {
	InstanceID uuid.UUID `json:"instance_id"`
	RoomID     string    `json:"room_id"`
	KilledBy   string    `json:"killed_by"` // UserID
}
