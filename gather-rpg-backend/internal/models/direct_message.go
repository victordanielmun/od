package models

import (
	"time"

	"github.com/google/uuid"
)

// DirectMessage is a persisted private (1:1) message between two users.
// Messages are stored regardless of whether the recipient is online, so they
// can be delivered as history when the conversation is next opened.
type DirectMessage struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	SenderID    uuid.UUID `gorm:"type:uuid;not null;index:idx_dm_sender_recipient" json:"sender_id"`
	RecipientID uuid.UUID `gorm:"type:uuid;not null;index:idx_dm_sender_recipient" json:"recipient_id"`
	Content     string    `gorm:"type:text;not null" json:"content"`
	CreatedAt   time.Time `gorm:"index" json:"created_at"`
}
