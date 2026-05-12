package models

import (
	"time"
)

// NPCDialogueCache stores pre-computed AI responses for common pedagogical interactions.
// This significantly reduces API costs and latency by reusing identical context queries.
type NPCDialogueCache struct {
	ID              uint   `gorm:"primaryKey"`
	NPCTemplateID   uint   `gorm:"index;not null"`
	MissionID       *uint  `gorm:"index"`
	TaskID          *uint  `gorm:"index"`
	NormalizedInput string `gorm:"type:text;index;not null"`
	ConditionMet    bool   `gorm:"index;not null"`
	ResponseJSON    string `gorm:"type:text;not null"` // Stores the raw JSON DialogueResponse
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
