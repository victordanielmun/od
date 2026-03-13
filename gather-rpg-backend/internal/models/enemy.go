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

// Combat State Models (Redis/Memory)

type CombatState struct {
	CombatID    string                 `json:"combat_id"`
	PlayerID    string                 `json:"player_id"`
	EnemyID     string                 `json:"enemy_id"`
	RoomID      string                 `json:"room_id"`
	Status      string                 `json:"status"` // "active", "victory", "defeat", "fled"
	CurrentTurn string                 `json:"current_turn"`
	TurnNumber  int                    `json:"turn_number"`
	PlayerState CombatEntityState      `json:"player_state"`
	EnemyState  CombatEntityState      `json:"enemy_state"`
	CombatLog   []CombatLogEntry       `json:"combat_log"`
	StartedAt   time.Time              `json:"started_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

type CombatEntityState struct {
	HPCurrent int            `json:"hp_current"`
	HPMax     int            `json:"hp_max"`
	MPCurrent int            `json:"mp_current"`
	MPMax     int            `json:"mp_max"`
	Buffs     []CombatEffect `json:"buffs"`
	Debuffs   []CombatEffect `json:"debuffs"`
}

type CombatEffect struct {
	Type      string `json:"type"`
	Value     int    `json:"value"`
	TurnsLeft int    `json:"turns_left"`
}

type CombatLogEntry struct {
	Turn     int    `json:"turn"`
	Actor    string `json:"actor"`
	Action   string `json:"action"`
	Damage   int    `json:"damage"`
	Target   string `json:"target"`
	Critical bool   `json:"critical"`
}

// Helper to save/load JSON skills for Enemy
func (e *Enemy) BeforeCreate(tx *gorm.DB) (err error) {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	return
}
