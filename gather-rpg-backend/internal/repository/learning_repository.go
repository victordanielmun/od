package repository

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/utils"

	"github.com/google/uuid"
	"github.com/lib/pq"
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

// ChallengePool describes a scoped set of challenges — a world's normal pool or
// its exam pool. Any empty field widens the query instead of narrowing it.
type ChallengePool struct {
	Types      []string    // challenge types; empty = any
	Difficulty string      // beginner/intermediate/advanced; empty = any
	Tags       []string    // OR-ed together (array overlap); empty = any
	ExcludeIDs []uuid.UUID // already asked in this session
}

// GetRandomChallengeFromPool picks one challenge from a scoped pool, biased
// toward questions this user has previously gotten WRONG (roughly double weight)
// while staying random, so a world's exam keeps drilling weak spots without
// becoming a fixed script. Returns gorm.ErrRecordNotFound when the pool is empty
// — callers are expected to fall back to a wider pool rather than fail the card.
func (r *LearningRepository) GetRandomChallengeFromPool(userID uuid.UUID, pool ChallengePool) (*models.LearningChallenge, error) {
	var challenge models.LearningChallenge

	q := database.DB.Model(&models.LearningChallenge{}).Select("learning_challenges.*")

	if len(pool.Types) > 0 {
		q = q.Where("type IN ?", pool.Types)
	}
	if pool.Difficulty != "" {
		q = q.Where("difficulty = ?", pool.Difficulty)
	}
	if len(pool.Tags) > 0 {
		// Array overlap: matches a challenge carrying ANY of the pool's tags.
		q = q.Where("tags && ?::text[]", pq.Array(pool.Tags))
	}
	if len(pool.ExcludeIDs) > 0 {
		q = q.Where("learning_challenges.id NOT IN ?", pool.ExcludeIDs)
	}

	// Per-user history for this challenge, used only for the ordering weight.
	q = q.Joins(`LEFT JOIN LATERAL (
			SELECT count(*) FILTER (WHERE NOT a.is_correct) AS wrong
			  FROM user_challenge_attempts a
			 WHERE a.challenge_id = learning_challenges.id AND a.user_id = ?
		) s ON true`, userID).
		Order("RANDOM() * CASE WHEN COALESCE(s.wrong, 0) > 0 THEN 0.5 ELSE 1 END")

	if err := q.First(&challenge).Error; err != nil {
		return nil, err
	}
	return &challenge, nil
}

// GetChallengeMetadata retrieves distinct difficulties and tags from challenges.
// When challengeType/difficulty are non-empty, tags are scoped to that combo —
// otherwise a tag that only exists for e.g. "vocabulary" (like "animals") or for a
// different difficulty (like "doubt", which is advanced-only) would show up as a
// filter option outside its actual scope, producing a type+difficulty+tag combo with
// zero matching rows (404 from GetRandomChallenge).
func (r *LearningRepository) GetChallengeMetadata(challengeType string, difficulty string) ([]string, []string, error) {
	var difficulties []string
	var tags []string

	// Get distinct difficulties
	if err := database.DB.Raw("SELECT DISTINCT difficulty FROM learning_challenges WHERE difficulty IS NOT NULL").Scan(&difficulties).Error; err != nil {
		return nil, nil, err
	}

	// Get distinct tags (unnest the text array), optionally scoped to a challenge type/difficulty
	tagsQuery := "SELECT DISTINCT unnest(tags) FROM learning_challenges WHERE 1=1"
	args := []interface{}{}
	if challengeType != "" {
		tagsQuery += " AND type = ?"
		args = append(args, challengeType)
	}
	if difficulty != "" {
		tagsQuery += " AND difficulty = ?"
		args = append(args, difficulty)
	}
	if err := database.DB.Raw(tagsQuery, args...).Scan(&tags).Error; err != nil {
		return nil, nil, err
	}

	// Exam tags (e.g. "final_mision_1") are internal routing for a world's final
	// combat map, not a topic anyone should practice on demand — and the practice UI
	// feeds this list straight into its category picker. Filtering by whatever
	// worlds.exam_tag currently holds hides them without constraining how admins
	// name their tags. A failed read (worlds not created yet) simply skips the
	// filter instead of breaking the endpoint.
	var examTags []string
	database.DB.Raw("SELECT exam_tag FROM worlds WHERE exam_tag <> ''").Scan(&examTags)
	if len(examTags) > 0 {
		hidden := make(map[string]bool, len(examTags))
		for _, t := range examTags {
			hidden[t] = true
		}
		visible := make([]string, 0, len(tags))
		for _, t := range tags {
			if !hidden[t] {
				visible = append(visible, t)
			}
		}
		tags = visible
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
// It joins users for the display name and skips only soft-deleted profiles. Guests
// are included (flagged via IsGuest) so an early/small player base still fills the
// board; they drop off naturally once they upgrade or their profiles are cleaned up.
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
		Select("u.id AS user_id, u.username AS username, p.english_level AS english_level, p.total_xp AS total_xp, "+weeklyExpr+" AS weekly_score, u.is_guest AS is_guest", weekStart).
		Joins("JOIN users u ON u.id = p.user_id").
		Where("p.deleted_at IS NULL AND u.deleted_at IS NULL").
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

