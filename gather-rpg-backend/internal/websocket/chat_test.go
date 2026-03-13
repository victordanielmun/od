package websocket

import (
	"encoding/json"
	"testing"
	"time"

	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestChatFlow(t *testing.T) {
	hub := &Hub{
		Clients: make(map[*Client]bool),
	}

	// Create Clients
	id1 := uuid.New()
	client1 := &Client{
		Hub:      hub,
		ID:       id1,
		Username: "User1",
		send:     make(chan []byte, 10),
	}
	hub.Clients[client1] = true

	id2 := uuid.New()
	client2 := &Client{
		Hub:      hub,
		ID:       id2,
		Username: "User2",
		send:     make(chan []byte, 10),
	}
	hub.Clients[client2] = true

	// 1. Chat Request (User1 -> User2)
	reqPayload := models.ChatRequestPayload{
		TargetID: id2.String(),
	}
	hub.handleChatRequest(client1, reqPayload)

	// Check User2 received request
	select {
	case msg := <-client2.send:
		var wsMsg models.WSMessage
		err := json.Unmarshal(msg, &wsMsg)
		assert.NoError(t, err)
		assert.Equal(t, MsgChatRequestBcast, wsMsg.Type)
		
		payload, ok := wsMsg.Payload.(map[string]interface{})
		assert.True(t, ok)
		assert.Equal(t, id1.String(), payload["requester_id"])
	case <-time.After(1 * time.Second):
		t.Fatal("User2 did not receive chat request")
	}

	// 2. Chat Accept (User2 -> User1)
	respPayload := models.ChatResponsePayload{
		TargetID: id1.String(),
		Accepted: true,
	}
	hub.handleChatResponse(client2, respPayload)

	// Check User1 received session start
	select {
	case msg := <-client1.send:
		var wsMsg models.WSMessage
		err := json.Unmarshal(msg, &wsMsg)
		assert.NoError(t, err)
		assert.Equal(t, MsgChatSessionStart, wsMsg.Type)
		
		payload, ok := wsMsg.Payload.(map[string]interface{})
		assert.True(t, ok)
		assert.Equal(t, id2.String(), payload["partner_id"])
	case <-time.After(1 * time.Second):
		t.Fatal("User1 did not receive session start")
	}

	// Check User2 also received session start
	select {
	case msg := <-client2.send:
		var wsMsg models.WSMessage
		err := json.Unmarshal(msg, &wsMsg)
		assert.NoError(t, err)
		assert.Equal(t, MsgChatSessionStart, wsMsg.Type)
	case <-time.After(1 * time.Second):
		t.Fatal("User2 did not receive session start")
	}

	// 3. Private Message (User1 -> User2)
	msgPayload := models.PrivateMessagePayload{
		TargetID: id2.String(),
		Message:  "Hello!",
	}
	hub.handlePrivateMessage(client1, msgPayload)

	// Check User2 received message
	select {
	case msg := <-client2.send:
		var wsMsg models.WSMessage
		err := json.Unmarshal(msg, &wsMsg)
		assert.NoError(t, err)
		assert.Equal(t, MsgPrivateMessage, wsMsg.Type)
		
		payload, ok := wsMsg.Payload.(map[string]interface{})
		assert.True(t, ok)
		assert.Equal(t, "Hello!", payload["message"])
		assert.Equal(t, id1.String(), payload["sender_id"])
	case <-time.After(1 * time.Second):
		t.Fatal("User2 did not receive private message")
	}
}
