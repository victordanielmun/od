package models

import (
	"time"

	"github.com/google/uuid"
)

// ChallengeTranslation caches the native-language helper text for a LearningChallenge
// in a specific language. English is the canonical language and is NEVER stored here
// (it lives on LearningChallenge.Question/Explanation directly). Rows are generated
// lazily the first time a user with a given native language requests a challenge, then
// reused for free on subsequent reads. Uniqueness is enforced per (challenge, lang).
type ChallengeTranslation struct {
	ID                uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ChallengeID       uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_challenge_lang" json:"challenge_id"`
	Lang              string    `gorm:"type:varchar(10);not null;uniqueIndex:idx_challenge_lang" json:"lang"` // ISO-639-1, e.g. "es", "pt"
	QuestionNative    string    `gorm:"type:text" json:"question_native"`
	ExplanationNative string    `gorm:"type:text" json:"explanation_native"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
