package main

import (
	"encoding/json"
	"io"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	baseURL    = "http://localhost:3000"
	wsURL      = "ws://localhost:3000/ws"
	numClients = 15
	roomID     = "8a1027ca-dd48-47a2-b58c-cbbb691028b3"
)

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

func main() {
	var wg sync.WaitGroup

	for i := 0; i < numClients; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			simulateUser(id)
		}(i)
		time.Sleep(200 * time.Millisecond) // Staggered join
	}

	wg.Wait()
}

func simulateUser(index int) {
	// 1. Login as Guest
	resp, err := http.Post(baseURL+"/auth/guest", "application/json", nil)
	if err != nil {
		log.Printf("[User %d] Login failed: %v", index, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("[User %d] Login returned unexpected status: %d", index, resp.StatusCode)
		// Attempt to read body for more context on error
		bodyBytes, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			log.Printf("[User %d] Failed to read error response body: %v", index, readErr)
		} else {
			log.Printf("[User %d] Error response body: %s", index, string(bodyBytes))
		}
		return
	}

	var loginResult struct {
		Token string `json:"token"`
		User  struct {
			ID       string `json:"id"`
			Username string `json:"username"`
		} `json:"user"`
	}
	
	// Check for JSON decoding errors with body context
	// (Actually, let's just read it manually for debugging)
	/*
	body, _ := io.ReadAll(resp.Body)
	log.Printf("[User %d] Body: %s", index, string(body))
	if err := json.Unmarshal(body, &loginResult); err != nil { ... }
	*/

	if err := json.NewDecoder(resp.Body).Decode(&loginResult); err != nil {
		log.Printf("[User %d] Decode login failed: %v", index, err)
		return
	}

	log.Printf("[User %d] Logged in as %s", index, loginResult.User.Username)

	// 2. Connect via WebSocket
	dialer := websocket.DefaultDialer
	headers := http.Header{}
	headers.Add("Authorization", "Bearer "+loginResult.Token)
	
	// Note: The actual path might differ if there's a specific route for WS
	conn, _, err := dialer.Dial(wsURL+"?token="+loginResult.Token, headers)
	if err != nil {
		log.Printf("[User %d] WS connect failed: %v", index, err)
		return
	}
	defer conn.Close()

	// 3. Join Room
	joinMsg := WSMessage{
		Type: "join_room",
		Payload: map[string]interface{}{
			"room_id": roomID,
		},
	}
	if err := conn.WriteJSON(joinMsg); err != nil {
		log.Printf("[User %d] Join room failed: %v", index, err)
		return
	}

	// 4. Send Random Movements
	x, y := 500.0+float64(index*20), 500.0+float64(index*20)
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		x += (rand.Float64() * 10) - 5
		y += (rand.Float64() * 10) - 5

		moveMsg := WSMessage{
			Type: "update_position",
			Payload: map[string]interface{}{
				"room_id":    roomID,
				"x":          x,
				"y":          y,
				"direction":  "right",
				"anim":       "walk",
				"is_moving":  true,
				"timestamp":  time.Now().UnixMilli(),
			},
		}

		if err := conn.WriteJSON(moveMsg); err != nil {
			log.Printf("[User %d] Update position failed: %v", index, err)
			return
		}
	}
}
