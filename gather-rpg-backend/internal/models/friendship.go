package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Friendship struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	User1ID   uuid.UUID      `gorm:"type:uuid;not null;index:idx_friendship_pair,unique" json:"user1_id"`
	User2ID   uuid.UUID      `gorm:"type:uuid;not null;index:idx_friendship_pair,unique" json:"user2_id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

