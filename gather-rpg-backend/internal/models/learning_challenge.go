package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

// ChallengeType represents the type of learning challenge
type ChallengeType string

const (
	ChallengeTypeVocabulary    ChallengeType = "vocabulary"
	ChallengeTypeGrammar       ChallengeType = "grammar"
	ChallengeTypePronunciation ChallengeType = "pronunciation"
	ChallengeTypeListening     ChallengeType = "listening"
)

// DifficultyLevel represents the difficulty of a challenge
type DifficultyLevel string

const (
	DifficultyBeginner     DifficultyLevel = "beginner"
	DifficultyIntermediate DifficultyLevel = "intermediate"
	DifficultyAdvanced     DifficultyLevel = "advanced"
)

// LearningChallenge represents an English learning challenge/question
type LearningChallenge struct {
	ID               uuid.UUID       `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Type             ChallengeType   `gorm:"type:varchar(30);not null" json:"type"`
	Question         string          `gorm:"type:text;not null" json:"question"`
	Option1          string          `gorm:"type:text;not null" json:"option_1"`
	Option2          string          `gorm:"type:text;not null" json:"option_2"`
	Option3          string          `gorm:"type:text;not null" json:"option_3"`
	CorrectOption    int             `gorm:"not null" json:"correct_option"` // 1, 2 or 3
	ExplanationES    string          `gorm:"type:text" json:"explanation_es"`
	QuestionES       string          `gorm:"type:text" json:"question_es"`
	Tags             pq.StringArray  `gorm:"type:text[];not null;default:'{}'" json:"tags"`
	Difficulty       DifficultyLevel `gorm:"type:varchar(20);not null;default:'beginner'" json:"difficulty"`
	LanguageLearning string          `gorm:"type:varchar(20);not null;default:'english'" json:"language_learning"`
	Phonetic         string          `gorm:"type:varchar(100)" json:"phonetic"`
	RequiresAudio    bool            `gorm:"not null;default:false" json:"requires_audio"`
	AudioURL         string          `gorm:"type:varchar(500)" json:"audio_url,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	DeletedAt        gorm.DeletedAt  `gorm:"index" json:"-"`

	// Relationships
	Attempts []UserChallengeAttempt `gorm:"foreignKey:ChallengeID" json:"-"`
}
