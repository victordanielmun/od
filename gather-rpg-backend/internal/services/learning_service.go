package services

import (
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"

	"github.com/google/uuid"
)

type LearningService struct {
	Repo *repository.LearningRepository
}

func NewLearningService(repo *repository.LearningRepository) *LearningService {
	return &LearningService{Repo: repo}
}

func (s *LearningService) GetRandomChallenge(challengeType string, difficulty string, tag string) (*models.LearningChallenge, error) {
	return s.Repo.GetRandomChallenge(challengeType, difficulty, tag)
}

// RecordAttempt passes the attempt data to the repository to process and update XP.
func (s *LearningService) RecordAttempt(userID uuid.UUID, challengeID uuid.UUID, isCorrect bool, selectedOption int, feedbackAI string) (*models.UserLearningProfile, error) {
	return s.Repo.RecordAttempt(userID, challengeID, isCorrect, selectedOption, feedbackAI)
}

// GetChallengeMetadata retrieves distinct difficulties and tags from the repository.
func (s *LearningService) GetChallengeMetadata(challengeType string) ([]string, []string, error) {
	return s.Repo.GetChallengeMetadata(challengeType)
}

func (s *LearningService) GetProfileByUserID(userID uuid.UUID) (*models.UserLearningProfile, error) {
	return s.Repo.GetProfileByUserID(userID)
}

// UpdateEnglishLevel updates the user's English difficulty level
func (s *LearningService) UpdateEnglishLevel(userID uuid.UUID, level string) error {
	return s.Repo.UpdateEnglishLevel(userID, level)
}

// GetLeaderboard returns the top players ranked by accumulated XP.
func (s *LearningService) GetLeaderboard(limit int) ([]models.LeaderboardEntry, error) {
	return s.Repo.GetLeaderboard(limit)
}

