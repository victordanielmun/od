package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/models"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

func (h *Hub) handleJoinRoom(client *Client, payload models.JoinRoomPayload) {
	roomID := payload.RoomID

	// Validate Room
	roomUUID, err := uuid.Parse(roomID)
	if err != nil {
		client.SendError("Invalid Room ID")
		return
	}

	// Get Room Info from DB (Service)
	dbRoom, err := h.RoomService.GetRoom(roomUUID)
	if err != nil {
		client.SendError("Room not found")
		return
	}

	h.mu.Lock()
	room, exists := h.Rooms[roomID]
	if !exists {
		// Parse MapData
		var mapData models.MapData
		if len(dbRoom.MapData) > 0 {
			_ = json.Unmarshal(dbRoom.MapData, &mapData)
		}
		// Defaults
		if mapData.Width == 0 {
			mapData.Width = 2000
		}
		if mapData.Height == 0 {
			mapData.Height = 2000
		}

		room = NewRoom(roomID, &mapData)

		// Fill missing fields from DB
		room.MaxUsers = dbRoom.MaxUsers
		room.SceneKey = dbRoom.SceneKey
		room.Type = dbRoom.Type

		h.Rooms[roomID] = room
	}
	h.mu.Unlock()

	if len(room.Clients) >= dbRoom.MaxUsers {
		client.SendError("Room is full")
		return
	}

	// Always broadcast user_left to the CURRENT room before rejoining, even when it's the same room.
	// This ensures other clients remove the stale ghost sprite for this user on reconnect.
	if client.RoomID != "" {
		h.mu.RLock()
		oldRoom, exists := h.Rooms[client.RoomID]
		h.mu.RUnlock()
		if exists {
			if client.RoomID != roomID {
				// Switching rooms: full cleanup
				oldRoom.RemoveClient(client)
				oldRoom.ReleaseNinjaCardsForPlayer(client.ID.String())
				oldRoom.Grid.RemoveUser(client.ID.String())
				h.MovementService.ClearPosition(context.Background(), client.RoomID, client.ID.String())

				// NEW: If the room is now empty, destroy it so it resets (crucial for missions)
				if len(oldRoom.Clients) == 0 {
					log.Printf("[Hub] Room %s is empty after client switch. Destroying.", client.RoomID)
					oldRoom.Close()
					delete(h.Rooms, client.RoomID)
				}
			}
			// Always tell the old room peers to remove this player so no ghost persists
			h.broadcastToRoomSimple(oldRoom, &models.WSMessage{
				Type: MsgUserLeft,
				Payload: models.UserLeftBroadcast{
					UserID: client.ID,
					RoomID: client.RoomID,
				},
			})
		}
	}

	client.RoomID = roomID
	room.AddClient(client)

	// Reset de combate al entrar a una sala (respawn por re-entrada).
	client.HP = client.HPMax
	client.IsDead = false
	client.LastDamageAt = time.Time{}
	h.sendPlayerHP(client)

	// Maná: a diferencia del HP, NO se resetea — se carga el valor persistente de
	// PlayerStats (fuente de verdad compartida con el inventario y el Sidebar).
	h.loadPlayerMana(client)
	h.sendPlayerMP(client)

	// Notify others that an ally has joined (System Notification)
	if room.Type == "cooperative" || room.Type == "mission" {
		h.broadcastToRoomSimple(room, &models.WSMessage{
			Type: MsgChatBroadcast,
			Payload: models.ChatMessageBroadcast{
				UserID:    uuid.Nil,
				Username:  "Sistema",
				Message:   fmt.Sprintf("¡Un aliado se ha unido al combate! Preparen sus armas, %s ha llegado.", client.Username),
				Timestamp: time.Now().Format(time.RFC3339),
				RoomID:    roomID,
			},
		})
	}

	// Fetch CharacterID from DB if not already set
	if client.CharacterID == "" {
		dbUser, err := h.PresenceService.GetByID(client.ID)
		if err == nil && dbUser != nil {
			client.CharacterID = dbUser.CharacterID
		} else {
			client.CharacterID = "1" // Fallback
		}
	}

	// Priority: 1) explicit portal coordinates, 2) last known Redis position, 3) hardcoded default
	x, y := 1000.0, 350.0
	if payload.X != nil && payload.Y != nil {
		x = *payload.X
		y = *payload.Y
	} else {
		// Try to recover last known position from Redis
		if lastPos, err := h.MovementService.GetPositionsBatch(
			context.Background(), roomID, []string{client.ID.String()},
		); err == nil && len(lastPos) > 0 {
			x = lastPos[0].X
			y = lastPos[0].Y
			log.Printf("User %s rejoining room %s — recovered last position (%.0f, %.0f)", client.ID, roomID, x, y)
		}
	}

	// Clear stale data and add fresh entry to Grid
	room.Grid.RemoveUser(client.ID.String())
	room.Grid.AddUser(client.ID.String(), x, y)

	// Track position on the client immediately (used by AI and teleport-to-friend).
	// Without this, a friend who joined but hasn't moved would report (0,0).
	client.X = x
	client.Y = y

	// Update Redis with current position
	redisPos := models.RedisPosition{
		X: x, Y: y, Direction: "down", IsMoving: false, Anim: "idle", Username: client.Username, CharacterID: client.CharacterID,
	}
	if err := h.MovementService.UpdateRedisPosition(context.Background(), roomID, client.ID.String(), redisPos); err != nil {
		log.Printf("Failed to update initial redis position: %v", err)
	}

	// Send Room Joined
	client.SendJSON(&models.WSMessage{
		Type: MsgRoomJoined,
		Payload: models.RoomJoinedPayload{
			RoomID: roomID,
		},
	})

	log.Printf("User %s joined room %s at (%.0f, %.0f) with character %s.", client.ID, roomID, x, y, client.CharacterID)

	// Send Initial Snapshot - we can now accurately tell where we are
	h.handleRequestPositions(client, &x, &y)

	// Notify nearby peers of this player's presence with full details immediately
	msg := &models.WSMessage{
		Type: MsgPlayerJoined,
		Payload: map[string]interface{}{
			"id":           client.ID,
			"username":     client.Username,
			"character_id": client.CharacterID,
			"x":            x,
			"y":            y,
			"direction":    "down",
			"anim":         "idle",
		},
	}
	h.broadcastToRoomSimple(room, msg)

	// COOPERATIVE AUDIO: connect new client with every existing peer immediately.
	// In cooperative rooms the session acts as a "meeting room" — all participants
	// hear each other at full volume regardless of their map position.
	if room.Type == "cooperative" {
		sessionID := "room:" + roomID
		room.mu.RLock()
		for existingClient := range room.Clients {
			if existingClient == client {
				continue
			}
			// Moderación: un par bloqueado no se conecta ni en el audio de reunión coop.
			if client.HasBlocked(existingClient.ID.String()) || existingClient.HasBlocked(client.ID.String()) {
				continue
			}
			// Register the peer connection on both sides
			h.PeerService.Manager.AddPeerConnection(client.ID.String(), existingClient.ID.String(), sessionID, roomID)
			h.PeerService.Manager.AddPeerConnection(existingClient.ID.String(), client.ID.String(), sessionID, roomID)

			// Deterministic initiator: lexicographically smaller ID starts the offer
			newIsInitiator := client.ID.String() < existingClient.ID.String()

			// Tell the new client to connect to each existing peer
			client.SendJSON(&models.WSMessage{
				Type: MsgStartPeerConnection,
				Payload: models.StartPeerConnectionPayload{
					PeerUserID:   existingClient.ID,
					PeerUsername: existingClient.Username,
					Distance:     0,
					Initiator:    newIsInitiator,
					SessionID:    sessionID,
				},
			})
			// Tell each existing peer to connect back to the new client
			existingClient.SendJSON(&models.WSMessage{
				Type: MsgStartPeerConnection,
				Payload: models.StartPeerConnectionPayload{
					PeerUserID:   client.ID,
					PeerUsername: client.Username,
					Distance:     0,
					Initiator:    !newIsInitiator,
					SessionID:    sessionID,
				},
			})
		}
		room.mu.RUnlock()
		log.Printf("[CoopAudio] Connected user %s with existing peers in room %s (session=%s)", client.ID, roomID, sessionID)
	}
}

func (h *Hub) handlePlayerMove(client *Client, payload models.PlayerMovePayload) {
	// Rate Limit
	if !client.PosLimiter.Allow() {
		return // Drop
	}

	roomID := client.RoomID
	if roomID == "" {
		return
	}

	room, ok := h.getRoom(roomID)
	if !ok {
		return
	}

	// Validate
	if err := h.MovementService.ValidatePosition(payload.X, payload.Y, room.MapData); err != nil {
		// Could send error, but better to ignore or rubberband
		return
	}

	// Check for Cell Change
	// We can do this by checking Grid before update?
	// Or just update Grid and broadcast to new neighbors.

	// Update Grid
	room.Grid.UpdateUserPosition(client.ID.String(), payload.X, payload.Y)

	// Update Redis
	ts := payload.Timestamp
	if ts == 0 {
		ts = time.Now().UnixMilli()
	}
	redisPos := models.RedisPosition{
		X:           payload.X,
		Y:           payload.Y,
		Direction:   payload.Direction,
		IsMoving:    payload.IsMoving,
		Anim:        payload.Anim,
		Username:    client.Username,
		CharacterID: client.CharacterID,
		Timestamp:   ts,
	}
	go h.MovementService.UpdateRedisPosition(context.Background(), roomID, client.ID.String(), redisPos)

	// Batch Update
	h.updatesMu.Lock()
	if _, ok := h.PendingUpdates[roomID]; !ok {
		h.PendingUpdates[roomID] = make(map[string]models.RedisPosition)
	}
	h.PendingUpdates[roomID][client.ID.String()] = redisPos
	h.updatesMu.Unlock()

	// Update local client position for AI
	client.X = payload.X
	client.Y = payload.Y
	client.Anim = payload.Anim

	// Trigger immediate proximity check if cell changed (or simply every move for now)
	log.Printf("[Hub] User %s moving in room %s to (%.0f, %.0f)", client.ID, roomID, payload.X, payload.Y)
	go h.checkUserProximity(roomID, client.ID.String(), payload.X, payload.Y)
}

func (h *Hub) broadcastLoop() {
	ticker := time.NewTicker(50 * time.Millisecond)
	for range ticker.C {
		h.updatesMu.Lock()
		if len(h.PendingUpdates) == 0 {
			h.updatesMu.Unlock()
			continue
		}

		// Swap
		currentUpdates := h.PendingUpdates
		h.PendingUpdates = make(map[string]map[string]models.RedisPosition)
		h.updatesMu.Unlock()

		// Process
		for roomID, userUpdates := range currentUpdates {
			h.mu.RLock()
			room, exists := h.Rooms[roomID]
			h.mu.RUnlock()
			if !exists {
				continue
			}

			batch := make([]models.PlayerMovedBroadcast, 0, len(userUpdates))
			for userID, pos := range userUpdates {
				batch = append(batch, models.PlayerMovedBroadcast{
					UserID:      uuid.MustParse(userID),
					RoomID:      roomID,
					X:           pos.X,
					Y:           pos.Y,
					Direction:   pos.Direction,
					Anim:        pos.Anim,
					IsMoving:    pos.IsMoving,
					Username:    pos.Username,
					CharacterID: pos.CharacterID,
					Timestamp:   pos.Timestamp,
				})
			}

			if len(batch) > 0 {
				log.Printf("[Hub] Broadcasting update for %d players in room %s", len(batch), roomID)
				msg := &models.WSMessage{
					Type: MsgPositionsUpdate,
					Payload: map[string]interface{}{
						"positions": batch,
					},
				}
				h.broadcastToRoomSimple(room, msg)
			}
		}
	}
}

func (h *Hub) handleRequestPositions(client *Client, forceX, forceY *float64) {
	roomID := client.RoomID
	if roomID == "" {
		log.Printf("handleRequestPositions ignored: client %s has no room", client.ID)
		return
	}
	room, ok := h.getRoom(roomID)
	if !ok {
		log.Printf("handleRequestPositions ignored: room %s not found for client %s", roomID, client.ID)
		return
	}

	var x, y float64
	if forceX != nil && forceY != nil {
		x, y = *forceX, *forceY
	} else {
		// 1. Get user's position from Redis
		positions, err := h.MovementService.GetPositionsBatch(context.Background(), roomID, []string{client.ID.String()})
		if err != nil || len(positions) == 0 {
			log.Printf("handleRequestPositions: failed to get position for user %s: %v", client.ID, err)
			return
		}
		x, y = positions[0].X, positions[0].Y
	}

	// 2. Find nearby users from Grid, then EXCLUDE self to prevent self-ghost
	allNearbyIDs := room.Grid.GetNearbyUsers(x, y)
	nearbyIDs := make([]string, 0, len(allNearbyIDs))
	for _, id := range allNearbyIDs {
		if id != client.ID.String() {
			nearbyIDs = append(nearbyIDs, id)
		}
	}
	log.Printf("handleRequestPositions: user %s at (%.0f, %.0f) has %d nearby peers (excl. self)",
		client.ID, x, y, len(nearbyIDs))

	// 3. Fetch their positions from Redis
	nearbyPositions, err := h.MovementService.GetPositionsBatch(context.Background(), roomID, nearbyIDs)
	if err != nil {
		log.Printf("handleRequestPositions: failed to get nearby positions: %v", err)
		return
	}

	log.Printf("handleRequestPositions: sending %d positions to user %s", len(nearbyPositions), client.ID)

	// 4. Send Snapshot
	client.SendJSON(&models.WSMessage{
		Type: MsgPositionsSnap,
		Payload: map[string]interface{}{
			"positions": nearbyPositions,
		},
	})
}

func (h *Hub) broadcastPositionUpdate(room *Room, userID string, x, y float64, dir string, anim string, moving bool, username string, characterID string) {
	broadcastsTotal.Inc()
	// 1. Find who needs to know (neighbors)
	nearbyIDs := room.Grid.GetNearbyUsers(x, y)

	// 2. Construct Message
	msg := &models.WSMessage{
		Type: MsgPlayerMoved,
		Payload: models.PlayerMovedBroadcast{
			UserID:      uuid.MustParse(userID),
			RoomID:      room.ID,
			X:           x,
			Y:           y,
			Direction:   dir,
			Anim:        anim,
			IsMoving:    moving,
			Username:    username,
			CharacterID: characterID,
		},
	}

	// 3. Send to specific clients
	// We need to map userID -> *Client.
	// Room has Clients map[*Client]bool.
	// We need to iterate Room.Clients and match ID? Inefficient.
	// Better: Hub or Room should maintain ID -> *Client map.
	// Or Grid stores *Client? No, Grid stores ID string.

	// Optimization: Map[ID]*Client in Room.
	// For now, iterate room clients (ok for < 100 users).

	room.mu.RLock()
	defer room.mu.RUnlock()

	// Create set of target IDs for fast lookup
	targets := make(map[string]bool)
	for _, id := range nearbyIDs {
		targets[id] = true
	}

	sentCount := 0
	for client := range room.Clients {
		if targets[client.ID.String()] {
			// Check if client is same as sender?
			// Usually sender doesn't need echo, but for authoritative it might.
			// Spec says "Broadcast a usuarios cercanos". Usually excludes sender.
			if client.ID.String() != userID {
				client.SendJSON(msg)
				sentCount++
			}
		}
	}
	// Verbose logging - consider removing later
	// log.Printf("Broadcast pos of %s to %d clients in room %s", userID, sentCount, room.ID)
}

func (h *Hub) handleChatMessage(client *Client, payload models.ChatMessagePayload) {
	// ... (Existing logic)
}

func (h *Hub) cleanupPositions() {
	ticker := time.NewTicker(5 * time.Second) // Check every 5s since TTL is 5s
	for range ticker.C {
		// Copy rooms keys to avoid holding lock for long
		h.mu.RLock()
		roomIDs := make([]string, 0, len(h.Rooms))
		for id := range h.Rooms {
			roomIDs = append(roomIDs, id)
		}
		h.mu.RUnlock()

		for _, rid := range roomIDs {
			h.mu.RLock()
			room, exists := h.Rooms[rid]
			h.mu.RUnlock()
			if !exists {
				continue
			}

			users := room.Grid.GetAllUsers()
			if len(users) == 0 {
				continue
			}

			// Check Redis
			go h.checkRoomExpiration(room, users)
		}
	}
}

func (h *Hub) checkRoomExpiration(room *Room, users []string) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	positions, err := h.MovementService.GetPositionsBatch(ctx, room.ID, users)
	if err != nil {
		return
	}

	found := make(map[string]bool)
	for _, pos := range positions {
		found[pos.UserID] = true
	}

	for _, uid := range users {
		if !found[uid] {
			// Redis position expired.
			// Check if the user is still connected to the room.
			// If they are connected, we keep them in the grid (stationary).
			room.mu.RLock()
			isConnected := false
			for client := range room.Clients {
				if client.ID.String() == uid {
					isConnected = true
					break
				}
			}
			room.mu.RUnlock()

			if isConnected {
				// User is still here, just stationary. Do not remove.
				continue
			}

			// Expired from Redis AND not connected -> Remove from Grid
			room.Grid.RemoveUser(uid)

			uUUID, err := uuid.Parse(uid)
			if err != nil {
				continue
			}

			// Broadcast UserLeft
			msg := &models.WSMessage{
				Type: MsgUserLeft,
				Payload: models.UserLeftBroadcast{
					UserID: uUUID,
					RoomID: room.ID,
				},
			}
			h.broadcastToRoomSimple(room, msg)
		}
	}
}

// generatePIN returns a zero-padded 4-digit numeric string, e.g. "0472" or "9831".
func generatePIN() string {
	return fmt.Sprintf("%04d", rand.Intn(9000)+1000)
}

// maxCoopPlayers is the hard cap for cooperative room instances (balance):
// applies both to matchmaking into existing coop rooms and to MaxUsers of
// newly created ones.
const maxCoopPlayers = 4

// handleRequestMapJoin resolves the room a client should join for a given map.
//
// PUBLIC maps:
//   - Find an existing room for that sceneKey that has space (< maxUsers).
//   - If all current rooms are full → create a new instance automatically (overflow).
//
// PRIVATE maps:
//   - If invite_code (PIN) is provided → search for a room with that exact PIN.
//     If found and not full → join it. If not found / full → send error.
//   - If no PIN provided → create a new private room instance and generate a PIN.
//     The PIN is returned in the map_join_approved payload for the client to share.
func (h *Hub) handleRequestMapJoin(client *Client, sceneKey, roomType, inviteCode string) {
	log.Printf("[Hub] handleRequestMapJoin: User %s requesting %s (hint=%s, pin=%q)",
		client.ID, sceneKey, roomType, inviteCode)
	var mapCfg *models.MapConfig
	var err error
	if h.RoomService != nil {
		mapCfg, err = h.RoomService.GetMapConfig(sceneKey)
	}
	isPublic := true // Default: treat unknown maps as public
	maxUsers := 50   // Default instance size

	if err == nil && mapCfg != nil {
		isPublic = mapCfg.IsPublic
		if mapCfg.MaxUsers > 0 {
			maxUsers = mapCfg.MaxUsers
		}
		log.Printf("[Hub] DB metadata for %s: IsPublic=%v MaxUsers=%d", sceneKey, isPublic, maxUsers)
	} else {
		log.Printf("[Hub] No DB metadata for %s, treating as public: %v", sceneKey, err)
	}

	// El backend decide si la sala es cooperativa según el Mode de la misión de
	// la escena (definido en el admin), NO según el hint del cliente: el hint se
	// perdió con el "Bug 2 fix" (el frontend siempre manda 'public') y confiar
	// en él dejaba todo el pipeline coop inalcanzable.
	isCoopScene := h.MissionService != nil && h.MissionService.SceneHasCooperativeMission(sceneKey)

	effectiveRoomType := "public"
	if !isPublic {
		effectiveRoomType = "mission"
	}
	if isCoopScene {
		effectiveRoomType = "cooperative"
		if maxUsers > maxCoopPlayers {
			maxUsers = maxCoopPlayers
		}
		log.Printf("[Hub] Scene %s has a cooperative mission → room type 'cooperative' (max %d players)", sceneKey, maxUsers)
	}

	var selectedRoom *Room

	h.mu.RLock()

	// ─ COOPERATIVE LOGIC: Find active room for same mission with < 60% progress ─────
	// Solo en mapas públicos y sin PIN: el flujo privado por PIN conserva su
	// semántica (unirse exactamente a la sala del código, nunca auto-match).
	if (isCoopScene || roomType == "cooperative") && isPublic && inviteCode == "" {
		for _, room := range h.Rooms {
			if room.SceneKey == sceneKey && room.Type == "cooperative" && len(room.Clients) < maxCoopPlayers {
				// Calculate progress based on enemies
				room.mu.RLock()
				total := len(room.ActiveEnemies)
				dead := 0
				for _, e := range room.ActiveEnemies {
					if e.FSMState == "dead" {
						dead++
					}
				}
				room.mu.RUnlock()

				progress := 0.0
				if total > 0 {
					progress = float64(dead) / float64(total)
				}

				if progress < 0.6 {
					selectedRoom = room
					log.Printf("[Hub] Joining existing cooperative instance %s (Progress: %.1f%%)", room.ID, progress*100)
					break
				}
			}
		}
	}

	if selectedRoom != nil {
		// Already found a cooperative room to join
	} else if isPublic {
		// ─ PUBLIC: find any non-full instance for this scene ───────────────────────────
		for _, room := range h.Rooms {
			if room.SceneKey == sceneKey && room.Type == "public" && len(room.Clients) < room.MaxUsers {
				selectedRoom = room
				log.Printf("[Hub] Joining existing public room %s (%d/%d)",
					room.ID, len(room.Clients), room.MaxUsers)
				break
			}
		}
		// If nil → all instances full → create overflow instance below
	} else {
		// ─ PRIVATE: match by PIN ─────────────────────────────────────
		if inviteCode != "" {
			for _, room := range h.Rooms {
				if room.SceneKey == sceneKey && room.InviteCode == inviteCode {
					if len(room.Clients) >= room.MaxUsers {
						h.mu.RUnlock()
						log.Printf("[Hub] Private room for PIN %s is full", inviteCode)
						client.SendError("La sala privada con ese PIN está llena")
						return
					}
					selectedRoom = room
					log.Printf("[Hub] Joining private room %s via PIN %s (%d/%d)",
						room.ID, inviteCode, len(room.Clients), room.MaxUsers)
					break
				}
			}
			if selectedRoom == nil {
				// PIN provided but no matching room found → reject
				h.mu.RUnlock()
				log.Printf("[Hub] PIN %q not found for map %s", inviteCode, sceneKey)
				client.SendError("PIN inválido: no se encontró ninguna sala con ese código")
				return
			}
		}
		// If inviteCode == "" → create new private room (selectedRoom stays nil)
	}

	h.mu.RUnlock()

	// 2. Create a new room instance if needed
	if selectedRoom == nil {
		// Generate PIN for private rooms
		newPIN := ""
		if !isPublic {
			newPIN = generatePIN()
		}

		var mapData models.MapData
		if mapCfg != nil && len(mapCfg.MapData) > 0 {
			_ = json.Unmarshal([]byte(mapCfg.MapData), &mapData)
		}
		if mapData.Width == 0 {
			mapData.Width = 2000
		}
		if mapData.Height == 0 {
			mapData.Height = 2000
		}

		instanceSuffix := uuid.New().String()[:4]
		var mapDataBytes []byte
		if mapCfg != nil && len(mapCfg.MapData) > 0 {
			mapDataBytes = []byte(mapCfg.MapData)
		}

		newRoom := &models.Room{
			Name:       fmt.Sprintf("%s-%s", sceneKey, instanceSuffix),
			SceneKey:   sceneKey,
			Type:       effectiveRoomType,
			InviteCode: newPIN,
			MaxUsers:   maxUsers,
			IsPublic:   isPublic,
			CreatedBy:  uuid.MustParse("00000000-0000-0000-0000-000000000000"),
			MapData:    mapDataBytes,
		}
		if err := h.RoomService.CreateRoom(newRoom); err != nil {
			log.Printf("[Hub] Failed to persist new room instance: %v", err)
			client.SendError("Error al crear sala")
			return
		}

		// Use NewRoom constructor to ensure enemies and AI loop are initialized
		newHubRoom := NewRoom(newRoom.ID.String(), &mapData)
		newHubRoom.InviteCode = newRoom.InviteCode
		newHubRoom.MaxUsers = newRoom.MaxUsers
		newHubRoom.SceneKey = newRoom.SceneKey
		newHubRoom.Type = newRoom.Type

		h.mu.Lock()
		h.Rooms[newHubRoom.ID] = newHubRoom
		h.mu.Unlock()

		selectedRoom = newHubRoom
		if isPublic {
			log.Printf("[Hub] Created overflow public instance %s for %s", newHubRoom.ID, sceneKey)
		} else {
			log.Printf("[Hub] Created private instance %s for %s with PIN=%s", newHubRoom.ID, sceneKey, newPIN)
		}
	}

	// 3. Send approval to client
	client.SendJSON(&models.WSMessage{
		Type: MsgMapJoinApproved,
		Payload: map[string]interface{}{
			"room_id":     selectedRoom.ID,
			"scene_key":   selectedRoom.SceneKey,
			"type":        selectedRoom.Type,
			"invite_code": selectedRoom.InviteCode, // empty for public, 4-digit PIN for private
		},
	})
}
func (h *Hub) handlePlayerEmoji(client *Client, payload models.PlayerEmojiPayload) {
	if payload.EmojiID == "" {
		return
	}

	room, ok := h.getRoom(client.RoomID)

	if !ok {
		return
	}

	broadcast := &models.WSMessage{
		Type: MsgEmojiBroadcast,
		Payload: models.EmojiBroadcast{
			UserID:   client.ID,
			Username: client.Username,
			EmojiID:  payload.EmojiID,
			RoomID:   client.RoomID,
		},
	}

	// Broadcast to all clients in the room
	h.broadcastToRoomSimple(room, broadcast)
}
