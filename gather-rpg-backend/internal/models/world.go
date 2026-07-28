package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// World groups missions into a themed curriculum unit. It is deliberately NOT a
// gate: worlds and missions are all freely playable in any order, because a
// player can already know some topics and not others. What validates learning is
// the world's FINAL mission — a combat map whose Ninja Cards are drawn only from
// ExamTag's pool. Failing a card heals the enemy (see hub_combat), so a player who
// doesn't know the material simply cannot finish the map. That is the whole gate.
type World struct {
	ID            uint   `gorm:"primaryKey" json:"id"`
	Key           string `gorm:"size:50;not null;uniqueIndex" json:"key"` // "mundo_1" — stable id, do not rename
	Name          string `gorm:"size:150;not null" json:"name"`
	DescriptionEn string `gorm:"type:text;not null;default:''" json:"description_en"`
	// Order is presentation only — it never blocks access to a world.
	Order int `gorm:"column:order;not null;default:0" json:"order"`
	// ChallengeTags is the pool for the Ninja Cards of this world's NORMAL missions
	// (e.g. {animals,food}). Empty = fall back to the player's global level pool.
	ChallengeTags pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"challenge_tags"`
	// ChallengeTypes narrows by challenge type (vocabulary/grammar/...). Empty = any.
	ChallengeTypes pq.StringArray `gorm:"type:text[];not null;default:'{}'" json:"challenge_types"`
	// ExamTag is the single tag identifying this world's EXAM pool, e.g.
	// "final_mision_1". Cards in the final mission's map are drawn only from
	// challenges carrying this tag. Stored here (never hardcoded) so admins own it.
	ExamTag    string          `gorm:"size:60;not null;default:''" json:"exam_tag"`
	Difficulty DifficultyLevel `gorm:"type:varchar(20);not null;default:'beginner'" json:"difficulty"`
	CoverImage string          `gorm:"size:255;not null;default:''" json:"cover_image"`
	Status     string          `gorm:"size:20;not null;default:'active'" json:"status"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

// PlayerWorldMastery is the per-player record of how a world's exam went. It is a
// diagnostic, not a gate: PassedAt being nil never prevents replaying the map.
// PlayerID is player_stats.id (same convention as PlayerMissionProgress).
type PlayerWorldMastery struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	PlayerID     uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_world_mastery_player_world" json:"player_id"`
	WorldID      uint      `gorm:"not null;uniqueIndex:idx_world_mastery_player_world" json:"world_id"`
	ExamAttempts int       `gorm:"not null;default:0" json:"exam_attempts"`
	LastScore    int       `gorm:"not null;default:0" json:"last_score"` // % correct on the last attempt
	BestScore    int       `gorm:"not null;default:0" json:"best_score"`
	// WeakTags: {"food": {"ok": 2, "total": 5}, "directions": {"ok": 1, "total": 4}}
	WeakTags  json.RawMessage `gorm:"type:jsonb;not null;default:'{}'" json:"weak_tags"`
	PassedAt  *time.Time      `json:"passed_at"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// WorldTranslation caches a world's player-facing text in one language. Same
// pattern as MissionTranslation: English is canonical and never stored here.
// Key and ExamTag are identifiers and are never translated.
type WorldTranslation struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	WorldID     uint      `gorm:"not null;uniqueIndex:idx_world_lang" json:"world_id"`
	Lang        string    `gorm:"type:varchar(10);not null;uniqueIndex:idx_world_lang" json:"lang"`
	Name        string    `gorm:"type:text" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TagStat is one topic's result inside an exam attempt (used to build WeakTags).
type TagStat struct {
	OK    int `json:"ok"`
	Total int `json:"total"`
}
