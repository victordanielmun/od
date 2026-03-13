package websocket

import (
	"encoding/json"
	"testing"
	"time"

	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestHandleRequestMapJoin_ExistingRoom(t *testing.T) {
	// Setup Hub (no services needed for this specific path check)
	hub := &Hub{
		Rooms: make(map[string]*Room),
	}

	// 1. Create an existing room manually
	existingRoomID := uuid.New().String()
	sceneKey := "shop_weapon"
	roomType := "public"

	existingRoom := NewRoom(existingRoomID, &models.MapData{Width: 1000, Height: 1000})
	existingRoom.SceneKey = sceneKey
	existingRoom.Type = roomType
	existingRoom.MaxUsers = 10

	hub.Rooms[existingRoomID] = existingRoom

	// 2. Client Setup
	clientID := uuid.New()
	client := &Client{
		Hub:  hub,
		ID:   clientID,
		send: make(chan []byte, 10),
	}

	// 3. Trigger HandleRequestMapJoin directly
	// We bypass the readPump loop and call the handler
	hub.handleRequestMapJoin(client, sceneKey, roomType, "")

	// 4. Verify Response
	select {
	case msgBytes := <-client.send:
		var wsMsg models.WSMessage
		err := json.Unmarshal(msgBytes, &wsMsg)
		assert.NoError(t, err)

		assert.Equal(t, "map_join_approved", wsMsg.Type)

		payload, ok := wsMsg.Payload.(map[string]interface{})
		assert.True(t, ok)

		assert.Equal(t, existingRoomID, payload["room_id"])
		assert.Equal(t, sceneKey, payload["scene_key"])
		assert.Equal(t, roomType, payload["type"])

	case <-time.After(1 * time.Second):
		t.Fatal("Timeout waiting for map_join_approved response")
	}
}

func TestHandleRequestMapJoin_RoomFull(t *testing.T) {
	// Setup Hub
	hub := &Hub{
		Rooms: make(map[string]*Room),
		// RoomService is nil, so creation will panic if it tries to create.
		// We want to ensure it skips the FULL room.
		// Since creation would fail/panic, we can only test that it DOES NOT return the full room.
	}

	// 1. Create a FULL room
	fullRoomID := uuid.New().String()
	sceneKey := "tiny_hut"
	roomType := "public"

	fullRoom := NewRoom(fullRoomID, nil)
	fullRoom.SceneKey = sceneKey
	fullRoom.Type = roomType
	fullRoom.MaxUsers = 1

	// Add 1 client to max-1 room
	dummyClient := &Client{ID: uuid.New()}
	fullRoom.Clients[dummyClient] = true

	hub.Rooms[fullRoomID] = fullRoom

	// 2. Client Setup
	client := &Client{
		Hub:  hub,
		ID:   uuid.New(),
		send: make(chan []byte, 10),
	}

	// 3. Trigger
	// This should try to find a room, see the existing one is full, and fall through to Creation.
	// Since RoomService is nil, it will panic or error.
	// We can catch panic or just assert it didn't return the full room.

	assert.Panics(t, func() {
		hub.handleRequestMapJoin(client, sceneKey, roomType, "")
	}, "Should panic because RoomService is nil, meaning it tried to create a new room (correct beahvior)")
}
