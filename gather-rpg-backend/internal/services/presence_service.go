package services

import (
	"context"
	"fmt"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
)

type PresenceService struct{}

func NewPresenceService() *PresenceService {
	return &PresenceService{}
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
