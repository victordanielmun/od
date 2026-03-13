package websocket

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
)

func setupTestRedis() {
	// Assuming local redis default port
	database.RedisClient = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "redis_password",
	})
}

func TestHandleRequestPositions(t *testing.T) {
	setupTestRedis()

	// Services
	movementService := services.NewMovementService()
	// We don't need other services for this specific test if we construct Hub manually

	hub := &Hub{
		Rooms:           make(map[string]*Room),
		MovementService: movementService,
		// Initialize mutex to avoid panics if methods use it
		// But here we construct struct literal, so mu is zero value (unlocked mutex), which is fine.
	}

	// Create Room
	roomID := uuid.New().String()
	// NewRoom initializes the Grid
	room := NewRoom(roomID, nil)
	hub.Rooms[roomID] = room

	// Create Clients
	id1 := uuid.New()
	client1 := &Client{
		Hub:      hub,
		ID:       id1,
		Username: "User1",
		RoomID:   roomID,
		send:     make(chan []byte, 10),
	}

	id2 := uuid.New()
	// client2 := &Client{
	// 	Hub:      hub,
	// 	ID:       id2,
	// 	Username: "User2",
	// 	RoomID:   roomID,
	// 	send:     make(chan []byte, 10),
	// }

	// Add to Grid
	room.Grid.AddUser(id1.String(), 100, 100)
	room.Grid.AddUser(id2.String(), 100, 100) // Same cell

	// Update Redis
	ctx := context.Background()
	pos1 := models.RedisPosition{X: 100, Y: 100, Username: "User1"}
	pos2 := models.RedisPosition{X: 100, Y: 100, Username: "User2"}

	err1 := movementService.UpdateRedisPosition(ctx, roomID, id1.String(), pos1)
	assert.NoError(t, err1)
	err2 := movementService.UpdateRedisPosition(ctx, roomID, id2.String(), pos2)
	assert.NoError(t, err2)

	// Test: Client 1 requests positions
	hub.handleRequestPositions(client1)

	// Verify response
	select {
	case msg := <-client1.send:
		var wsMsg models.WSMessage
		err := json.Unmarshal(msg, &wsMsg)
		assert.NoError(t, err)
		assert.Equal(t, "positions_snapshot", wsMsg.Type)

		payloadMap, ok := wsMsg.Payload.(map[string]interface{})
		assert.True(t, ok)

		positionsRaw := payloadMap["positions"]
		// It might be []interface{} after unmarshal
		positionsList, ok := positionsRaw.([]interface{})
		assert.True(t, ok)

		assert.Equal(t, 2, len(positionsList), "Should receive 2 positions")

		// Optional: Print positions to debug
		// for _, p := range positionsList {
		// 	t.Logf("Position: %+v", p)
		// }

	case <-time.After(1 * time.Second):
		t.Fatal("Timeout waiting for response")
	}
}
