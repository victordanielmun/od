package repository

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LearningRepository struct{}

func NewLearningRepository() *LearningRepository {
	return &LearningRepository{}
}

// GetRandomChallenge fetching a random challenge matching criteria
func (r *LearningRepository) GetRandomChallenge(challengeType string, difficulty string) (*models.LearningChallenge, error) {
	var challenge models.LearningChallenge
	
	query := database.DB.Model(&models.LearningChallenge{})

	if challengeType != "" {
		query = query.Where("type = ?", challengeType)
	}
	if difficulty != "" {
		query = query.Where("difficulty = ?", difficulty)
	}

	// PostgreSQL random order
	err := query.Order("RANDOM()").First(&challenge).Error
	if err != nil {
		return nil, err
	}

	return &challenge, nil
}

// GetChallengeMetadata retrieves distinct difficulties and tags from all challenges
func (r *LearningRepository) GetChallengeMetadata() ([]string, []string, error) {
	var difficulties []string
	var tags []string

	// Get distinct difficulties
	if err := database.DB.Raw("SELECT DISTINCT difficulty FROM learning_challenges WHERE difficulty IS NOT NULL").Scan(&difficulties).Error; err != nil {
		return nil, nil, err
	}

	// Get distinct tags (unnest the text array)
	if err := database.DB.Raw("SELECT DISTINCT unnest(tags) FROM learning_challenges").Scan(&tags).Error; err != nil {
		return nil, nil, err
	}

	return difficulties, tags, nil
}

// RecordAttempt records a user's answer and updates their learning profile XP.
func (r *LearningRepository) RecordAttempt(userID uuid.UUID, challengeID uuid.UUID, isCorrect bool, selectedOption int, feedbackAI string) (*models.UserLearningProfile, error) {
	var profile models.UserLearningProfile

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Record the attempt
		attempt := models.UserChallengeAttempt{
			UserID:         userID,
			ChallengeID:    challengeID,
			SelectedOption: selectedOption,
			IsCorrect:      isCorrect,
			FeedbackAI:     feedbackAI,
		}
		if err := tx.Create(&attempt).Error; err != nil {
			return err
		}

		// 2. Find or create the user's learning profile
		err := tx.Where("user_id = ?", userID).First(&profile).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				profile = models.UserLearningProfile{
					UserID:         userID,
					EnglishLevel:   models.DifficultyBeginner,
					TotalXP:        0,
					CurrentLevelXP: 0,
					WeeklyScore:    0,
					WeeklyAttempts: 0,
					WeeklyCorrect:  0,
				}
				if err := tx.Create(&profile).Error; err != nil {
					return err
				}
			} else {
				return err
			}
		}

		// 3. Update stats
		profile.WeeklyAttempts++
		xpGained := 5 // Base XP just for attempting
		if isCorrect {
			profile.WeeklyCorrect++
			xpGained = 15 // Base XP for correct answer
		}

		profile.TotalXP += xpGained
		profile.CurrentLevelXP += xpGained
		profile.WeeklyScore += xpGained

		// 4. Check for automatic Level Up (Basic logic based on TotalXP)
		// Beginner -> Intermediate: 500 XP
		// Intermediate -> Advanced: 1500 XP
		if profile.TotalXP >= 1500 && profile.EnglishLevel != models.DifficultyAdvanced {
			profile.EnglishLevel = models.DifficultyAdvanced
		} else if profile.TotalXP >= 500 && profile.EnglishLevel == models.DifficultyBeginner {
			profile.EnglishLevel = models.DifficultyIntermediate
		}

		if err := tx.Save(&profile).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &profile, nil
}

// GetProfileByUserID retrieves the learning profile for a specific user.
// If the profile doesn't exist, it creates a new one with default values.
func (r *LearningRepository) GetProfileByUserID(userID uuid.UUID) (*models.UserLearningProfile, error) {
	var profile models.UserLearningProfile

	err := database.DB.Where("user_id = ?", userID).First(&profile).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create a default profile if not found
			profile = models.UserLearningProfile{
				UserID:         userID,
				EnglishLevel:   models.DifficultyBeginner,
				TotalXP:        0,
				CurrentLevelXP: 0,
				WeeklyScore:    0,
				WeeklyAttempts: 0,
				WeeklyCorrect:  0,
			}
			if err := database.DB.Create(&profile).Error; err != nil {
				return nil, err
			}
			return &profile, nil
		}
		return nil, err
	}

	return &profile, nil
}
