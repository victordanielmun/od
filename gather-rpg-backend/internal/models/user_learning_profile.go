package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

// UserLearningProfile stores the English learning profile for a user
type UserLearningProfile struct {
	ID             uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID         uuid.UUID       `gorm:"type:uuid;not null;uniqueIndex" json:"user_id"`
	EnglishLevel   DifficultyLevel `gorm:"type:varchar(20);not null;default:'beginner'" json:"english_level"`
	PreferredTags  pq.StringArray  `gorm:"type:text[];not null;default:'{}'" json:"preferred_tags"` // e.g.: ["travel","work","communication"]
	WeeklyScore    int             `gorm:"not null;default:0" json:"weekly_score"`
	WeeklyCorrect  int             `gorm:"not null;default:0" json:"weekly_correct"`
	WeeklyAttempts int             `gorm:"not null;default:0" json:"weekly_attempts"`
	WeekStart      time.Time       `gorm:"type:date" json:"week_start"`
	CurrentLevelXP int             `gorm:"not null;default:0" json:"current_level_xp"`
	TotalXP        int             `gorm:"not null;default:0" json:"total_xp"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
	DeletedAt      gorm.DeletedAt  `gorm:"index" json:"-"`

	// Relationships
	User User `gorm:"foreignKey:UserID" json:"-"`
}
