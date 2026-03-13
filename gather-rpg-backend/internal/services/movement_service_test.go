package services

import (
	"context"
	"testing"
	"time"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
)

func TestUpdateRedisPositionTTL(t *testing.T) {
	// Setup
	// Load .env from root (since test runs in internal/services)
	_ = godotenv.Load("../../.env")
	t.Setenv("POSITION_TTL_SECONDS", "5")

	cfg := config.LoadConfig()
	database.ConnectRedis(cfg)

	service := NewMovementService()
	ctx := context.Background()
	roomID := "test-room-ttl"
	userID := "test-user-ttl"

	pos := models.RedisPosition{
		X: 100, Y: 100, Direction: "down", IsMoving: false,
	}

	// 1. Set Position
	err := service.UpdateRedisPosition(ctx, roomID, userID, pos)
	assert.NoError(t, err)

	// 2. Verify it exists immediately
	// Using service to verify existence (GetPositionsBatch)
	positions, err := service.GetPositionsBatch(ctx, roomID, []string{userID})
	assert.NoError(t, err)
	assert.NotEmpty(t, positions)
	assert.Equal(t, userID, positions[0].UserID)

	// 3. Wait for TTL (5 seconds) + buffer
	t.Log("Waiting 6 seconds for TTL expiration...")
	time.Sleep(6 * time.Second)

	// 4. Verify it is gone
	positionsAfter, err := service.GetPositionsBatch(ctx, roomID, []string{userID})
	assert.NoError(t, err)
	// Should be empty or contain zero-value if not found?
	// GetPositionsBatch returns list of FOUND positions.
	assert.Empty(t, positionsAfter, "Position should be expired after TTL")
}
