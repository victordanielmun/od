package services

import (
	"context"
	"fmt"
	"github.com/google/uuid"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
)

type PresenceService struct {
	UserRepo *repository.UserRepository
}

func NewPresenceService(userRepo *repository.UserRepository) *PresenceService {
	return &PresenceService{UserRepo: userRepo}
}

func (s *PresenceService) UpdateUserPosition(userID, roomID string, pos models.UserPosition) error {
	// This might be redundant with MovementService, but kept for compatibility
	return nil
}

func (s *PresenceService) RemoveUserFromRoom(userID, roomID string) error {
	ctx := context.Background()
	key := fmt.Sprintf("room:%s:participants", roomID)
	return database.RedisClient.HDel(ctx, key, userID).Err()
}

func (s *PresenceService) GetRoomParticipants(roomID string) (map[string]models.UserPosition, error) {
	// Simplified
	return make(map[string]models.UserPosition), nil
}

func (s *PresenceService) GetByID(id uuid.UUID) (*models.User, error) {
	return s.UserRepo.FindByID(id.String())
}
