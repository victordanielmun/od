package models

import "time"

// MissionTranslation caches the native-language version of a Mission's player-facing
// text (title / description / objective) for one language. English is canonical and is
// never stored here. Generated lazily once per (mission, lang) via the LLM, then reused.
type MissionTranslation struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	MissionID   uint      `gorm:"not null;uniqueIndex:idx_mission_lang" json:"mission_id"`
	Lang        string    `gorm:"type:varchar(10);not null;uniqueIndex:idx_mission_lang" json:"lang"`
	Title       string    `gorm:"type:text" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	Objective   string    `gorm:"type:text" json:"objective"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TaskTranslation caches the native-language description of a MissionTask for one
// language. The English learning targets (target_phrase_en, message_to_deliver) are
// intentionally NOT translated — they are what the player must produce in English.
type TaskTranslation struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	TaskID      uint      `gorm:"not null;uniqueIndex:idx_task_lang" json:"task_id"`
	Lang        string    `gorm:"type:varchar(10);not null;uniqueIndex:idx_task_lang" json:"lang"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
