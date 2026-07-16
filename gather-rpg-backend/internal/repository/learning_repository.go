package repository

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/utils"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LearningRepository struct{}

func NewLearningRepository() *LearningRepository {
	return &LearningRepository{}
}

// ResetWeeklyIfNeeded zeroes the weekly counters when the profile's stored week is
// older than the current one (lazy weekly reset — no cron needed). It mutates the
// profile in memory and returns true if a reset happened; the caller is responsible
// for persisting. Always stamps WeekStart to the current week so a freshly seeded
// profile (zero WeekStart) is brought current without wiping the same-week counters.
func ResetWeeklyIfNeeded(p *models.UserLearningProfile) bool {
	current := utils.CurrentWeekStart()
	if p.WeekStart.Before(current) {
		p.WeeklyScore = 0
		p.WeeklyCorrect = 0
		p.WeeklyAttempts = 0
		p.WeekStart = current
		return true
	}
	return false
}

// GetRandomChallenge fetching a random challenge matching criteria
func (r *LearningRepository) GetRandomChallenge(challengeType string, difficulty string, tag string) (*models.LearningChallenge, error) {
	var challenge models.LearningChallenge

	query := database.DB.Model(&models.LearningChallenge{})

	if challengeType != "" {
		query = query.Where("type = ?", challengeType)
	}
	if difficulty != "" {
		query = query.Where("difficulty = ?", difficulty)
	}
	if tag != "" {
		query = query.Where("? = ANY(tags)", tag)
	}

	// PostgreSQL random order
	err := query.Order("RANDOM()").First(&challenge).Error
	if err != nil {
		return nil, err
	}

	return &challenge, nil
}

// GetChallengeMetadata retrieves distinct difficulties and tags from challenges.
// When challengeType is non-empty, tags are scoped to that type only — otherwise a
// tag that only exists for e.g. "vocabulary" (like "animals") would show up as a
// filter option while practicing "pronunciation", producing a type+tag combo with
// zero matching rows (404 from GetRandomChallenge).
func (r *LearningRepository) GetChallengeMetadata(challengeType string) ([]string, []string, error) {
	var difficulties []string
	var tags []string

	// Get distinct difficulties
	if err := database.DB.Raw("SELECT DISTINCT difficulty FROM learning_challenges WHERE difficulty IS NOT NULL").Scan(&difficulties).Error; err != nil {
		return nil, nil, err
	}

	// Get distinct tags (unnest the text array), optionally scoped to a challenge type
	tagsQuery := "SELECT DISTINCT unnest(tags) FROM learning_challenges"
	args := []interface{}{}
	if challengeType != "" {
		tagsQuery += " WHERE type = ?"
		args = append(args, challengeType)
	}
	if err := database.DB.Raw(tagsQuery, args...).Scan(&tags).Error; err != nil {
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

		// 2b. Roll over weekly counters if we've crossed into a new week.
		ResetWeeklyIfNeeded(&profile)

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
				WeekStart:      utils.CurrentWeekStart(),
			}
			if err := database.DB.Create(&profile).Error; err != nil {
				return nil, err
			}
			return &profile, nil
		}
		return nil, err
	}

	// Lazy weekly reset: if the stored week is stale, zero the weekly counters and
	// persist so reads (e.g. the dashboard) reflect the current week.
	if ResetWeeklyIfNeeded(&profile) {
		if err := database.DB.Save(&profile).Error; err != nil {
			return nil, err
		}
	}

	return &profile, nil
}

// GetLeaderboard returns the top users ranked by accumulated TotalXP (all-time).
// It joins users for the display name and skips guests and soft-deleted profiles.
// Rank is assigned 1-based in the returned order.
func (r *LearningRepository) GetLeaderboard(limit int) ([]models.LeaderboardEntry, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	// Effective weekly score: a stored value from a previous week reads as 0 here, so
	// the board shows the current week without needing every stale profile rewritten.
	weekStart := utils.CurrentWeekStart()
	weeklyExpr := "CASE WHEN p.week_start < ? THEN 0 ELSE p.weekly_score END"

	var entries []models.LeaderboardEntry
	err := database.DB.
		Table("user_learning_profiles AS p").
		Select("u.id AS user_id, u.username AS username, p.english_level AS english_level, p.total_xp AS total_xp, "+weeklyExpr+" AS weekly_score", weekStart).
		Joins("JOIN users u ON u.id = p.user_id").
		Where("p.deleted_at IS NULL AND u.deleted_at IS NULL AND u.is_guest = ?", false).
		Order("p.total_xp DESC, weekly_score DESC, u.username ASC").
		Limit(limit).
		Scan(&entries).Error
	if err != nil {
		return nil, err
	}
	for i := range entries {
		entries[i].Rank = i + 1
	}
	return entries, nil
}

// UpdateEnglishLevel updates the user's English difficulty level
func (r *LearningRepository) UpdateEnglishLevel(userID uuid.UUID, level string) error {
	var profile models.UserLearningProfile
	if err := database.DB.Where("user_id = ?", userID).First(&profile).Error; err != nil {
		return err
	}
	
	profile.EnglishLevel = models.DifficultyLevel(level)
	return database.DB.Save(&profile).Error
}

