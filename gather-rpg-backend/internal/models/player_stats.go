package models

import (
	"time"

	"github.com/google/uuid"
)

type PlayerStats struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID      uuid.UUID `gorm:"type:uuid;unique;not null" json:"user_id"`
	Class       string    `gorm:"default:'warrior'" json:"class"` // warrior, mage, archer
	Level       int       `gorm:"default:1" json:"level"`
	Experience  int       `gorm:"default:0" json:"experience"`
	HPCurrent   int       `json:"hp_current"`
	HPMax       int       `gorm:"default:100" json:"hp_max"`
	MPCurrent   int       `json:"mp_current"`
	MPMax       int       `gorm:"default:50" json:"mp_max"`
	Attack      int       `gorm:"default:10" json:"attack"`
	Defense     int       `gorm:"default:5" json:"defense"`
	Speed       int       `gorm:"default:10" json:"speed"`
	Gold        int       `gorm:"default:100" json:"gold"`
	SkillPoints int       `gorm:"default:0" json:"skill_points"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Skill struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	SkillType     string    `json:"skill_type"` // "attack", "heal", "buff"
	MPCost        int       `json:"mp_cost"`
	Power         int       `json:"power"`
	TargetType    string    `json:"target_type"` // "enemy", "self"
	RequiredLevel int       `json:"required_level"`
	AnimationKey  string    `json:"animation_key"`
	CreatedAt     time.Time `json:"created_at"`
}

type PlayerSkill struct {
	PlayerID   uuid.UUID `gorm:"primaryKey" json:"player_id"`
	SkillID    uuid.UUID `gorm:"primaryKey" json:"skill_id"`
	UnlockedAt time.Time `json:"unlocked_at"`
}

type Item struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	ItemType     string    `json:"item_type"`   // "consumable", "equipment", "throwable", "weapon", "defense", "mission_item"
	EffectType   string    `json:"effect_type"` // "heal_hp", "restore_mp", "revive", "none"
	EffectValue  int       `json:"effect_value"`
	AttackBonus  int       `json:"attack_bonus"`
	DefenseBonus int       `json:"defense_bonus"`
	RequiredLevel int      `json:"required_level"`
	Price        int       `json:"price"`
	MaxStack     int       `json:"max_stack"`
	IconKey      string    `json:"icon_key"`
	CreatedAt    time.Time `json:"created_at"`
}

type Inventory struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	PlayerID  uuid.UUID `json:"player_id"`
	ItemID    uuid.UUID `json:"item_id"`
	Item      Item      `gorm:"foreignKey:ItemID" json:"item"`
	Quantity  int       `json:"quantity"`
	SlotIndex int       `json:"slot_index"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
