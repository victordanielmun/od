package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
)

type MovementService struct {
	// We might not need to store grids here if they are in Hub/Room,
	// but for service-oriented architecture, maybe pass the grid as arg?
	// Or MovementService manages the Redis part mainly.
	positionTTL time.Duration
}

func NewMovementService() *MovementService {
	ttlSecondsRaw := os.Getenv("POSITION_TTL_SECONDS")
	if ttlSecondsRaw == "" {
		// Default: 30 seconds. Short enough that ghost positions expire quickly
		// after a disconnect, but long enough to survive brief reconnects.
		return &MovementService{positionTTL: 30 * time.Second}
	}

	ttlSeconds, err := strconv.Atoi(ttlSecondsRaw)
	if err != nil || ttlSeconds <= 0 {
		return &MovementService{positionTTL: 30 * time.Second}
	}

	return &MovementService{positionTTL: time.Duration(ttlSeconds) * time.Second}
}

// ValidatePosition checks if the position is within map bounds
func (s *MovementService) ValidatePosition(x, y float64, mapData *models.MapData) error {
	// Simple bounds check (default 2000x1500 if mapData empty)
	width, height := 2000.0, 1500.0

	if mapData != nil {
		if mapData.Width > 0 {
			width = float64(mapData.Width)
		}
		if mapData.Height > 0 {
			height = float64(mapData.Height)
		}
	}

	if x < 0 || x > width || y < 0 || y > height {
		return fmt.Errorf("position out of bounds: %f, %f (max %f, %f)", x, y, width, height)
	}
	return nil
}

// UpdateRedisPosition updates the position in Redis with TTL
func (s *MovementService) UpdateRedisPosition(ctx context.Context, roomID, userID string, pos models.RedisPosition) error {
	key := fmt.Sprintf("position:room:%s:user:%s", roomID, userID)
	data, err := json.Marshal(pos)
	if err != nil {
		return err
	}

	return database.RedisClient.Set(ctx, key, data, s.positionTTL).Err()
}

// GetPositionsBatch retrieves positions for a list of userIDs
func (s *MovementService) GetPositionsBatch(ctx context.Context, roomID string, userIDs []string) ([]models.Position, error) {
	if len(userIDs) == 0 {
		return []models.Position{}, nil
	}

	keys := make([]string, len(userIDs))
	for i, uid := range userIDs {
		keys[i] = fmt.Sprintf("position:room:%s:user:%s", roomID, uid)
	}

	// MGET
	results, err := database.RedisClient.MGet(ctx, keys...).Result()
	if err != nil {
		log.Printf("GetPositionsBatch: MGet failed: %v", err)
		return nil, err
	}

	positions := make([]models.Position, 0)
	for i, res := range results {
		if res == nil {
			// log.Printf("GetPositionsBatch: Key %s not found", keys[i])
			continue
		}

		var redisPos models.RedisPosition
		// Redis returns string or nil
		if str, ok := res.(string); ok {
			if err := json.Unmarshal([]byte(str), &redisPos); err == nil {
				positions = append(positions, models.Position{
					UserID:    userIDs[i],
					X:         redisPos.X,
					Y:         redisPos.Y,
					Direction: redisPos.Direction,
					IsMoving:  redisPos.IsMoving,
					Anim:      redisPos.Anim,
					Username:  redisPos.Username,
				})
			} else {
				log.Printf("GetPositionsBatch: Unmarshal failed for key %s: %v", keys[i], err)
			}
		}
	}
	// log.Printf("GetPositionsBatch: Found %d positions out of %d requested", len(positions), len(userIDs))
	return positions, nil
}

// ClearPosition removes position from Redis
func (s *MovementService) ClearPosition(ctx context.Context, roomID, userID string) error {
	key := fmt.Sprintf("position:room:%s:user:%s", roomID, userID)
	return database.RedisClient.Del(ctx, key).Err()
}
