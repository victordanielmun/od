package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"sync"
	"time"

	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"gather-rpg-backend/internal/webrtc"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	broadcastsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "websocket_broadcasts_total",
		Help: "The total number of position broadcasts sent",
	})
)

type Hub struct {
	Clients    map[*Client]bool
	Rooms      map[string]*Room
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan *models.WSMessage
	Challenges map[string]map[*Client]bool

	PresenceService *services.PresenceService
	RoomService     *services.RoomService
	MovementService *services.MovementService
	PeerService     *services.PeerService
	CombatService   *services.CombatService
	MissionService  *services.MissionService

	// Batching
	PendingUpdates map[string]map[string]models.RedisPosition
	updatesMu      sync.Mutex

	mu sync.RWMutex
}

func (h *Hub) SendToUser(userID string, msg *models.WSMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.Clients {
		if client.ID.String() == userID {
			client.SendJSON(msg)
			// Don't break, user might have multiple connections (tabs)
		}
	}
}

func NewHub(presence *services.PresenceService, roomService *services.RoomService, movement *services.MovementService, peer *services.PeerService, combat *services.CombatService, mission *services.MissionService) *Hub {
	return &Hub{
		Broadcast:       make(chan *models.WSMessage),
		Register:        make(chan *Client),
		Unregister:      make(chan *Client),
		Clients:         make(map[*Client]bool),
		Rooms:           make(map[string]*Room),
		Challenges:      make(map[string]map[*Client]bool),
		PresenceService: presence,
		RoomService:     roomService,
		MovementService: movement,
		PeerService:     peer,
		CombatService:   combat,
		MissionService:  mission,
		PendingUpdates:  make(map[string]map[string]models.RedisPosition),
	}
}

func (h *Hub) Run() {
	// Start cleanup ticker
	go h.cleanupPositions()
	// Start batch broadcast ticker
	go h.broadcastLoop()
	// Start proximity monitor
	go h.proximityLoop()

	for {
		select {
		case client := <-h.Register:
			// Enforce single session per user: find existing clients to disconnect
			h.mu.Lock()
			var toRemove []*Client
			for existingClient := range h.Clients {
				if existingClient.ID == client.ID {
					toRemove = append(toRemove, existingClient)
				}
			}
			h.mu.Unlock()

			// Disconnect existing clients (outside lock to avoid deadlock with handleUnregister)
			for _, oldClient := range toRemove {
				log.Printf("Kicking existing connection for user: %s", oldClient.ID)
				oldClient.SendError("Sessión cerrada: Has iniciado sesión en otro lugar.")
				h.handleUnregister(oldClient)
			}

			h.mu.Lock()
			h.Clients[client] = true
			h.mu.Unlock()
			log.Printf("Client registered: %s", client.ID)

		case client := <-h.Unregister:
			h.handleUnregister(client)

		case message := <-h.Broadcast:
			// Global broadcast (rarely used)
			log.Println("Global broadcast:", message)
		}
	}
}

func (h *Hub) handleUnregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.Clients[client]; ok {
		h.leaveChallengeLocked(client, client.ChallengeID, "disconnected")
		if client.RoomID != "" {
			sessionID := "room:" + client.RoomID
			conns := h.PeerService.Manager.GetPeerConnectionsForSession(client.ID.String(), sessionID)
			for _, conn := range conns {
				h.PeerService.Manager.RemovePeerConnection(client.ID.String(), conn.PeerID, sessionID)
				h.PeerService.Manager.RemovePeerConnection(conn.PeerID, client.ID.String(), sessionID)

				peerUUID, err := uuid.Parse(conn.PeerID)
				if err != nil {
					peerUUID = uuid.Nil
				}
				var targetClient *Client
				for c := range h.Clients {
					if c.ID.String() == conn.PeerID {
						targetClient = c
						break
					}
				}
				if targetClient == nil {
					continue
				}
				targetClient.SendJSON(&models.WSMessage{
					Type: MsgClosePeerConnection,
					Payload: models.ClosePeerConnectionPayload{
						PeerUserID: client.ID,
						Reason:     "disconnected",
						SessionID:  sessionID,
					},
				})
				if peerUUID != uuid.Nil {
					client.SendJSON(&models.WSMessage{
						Type: MsgClosePeerConnection,
						Payload: models.ClosePeerConnectionPayload{
							PeerUserID: peerUUID,
							Reason:     "disconnected",
							SessionID:  sessionID,
						},
					})
				}
			}

			if room, ok := h.Rooms[client.RoomID]; ok {
				room.RemoveClient(client)
				// Also remove from Redis
				err := h.MovementService.ClearPosition(context.Background(), client.RoomID, client.ID.String())
				if err != nil {
					log.Printf("[Hub] Failed to clear Redis position for %s: %v", client.ID, err)
				} else {
					log.Printf("[Hub] Cleared Redis position for %s in room %s", client.ID, client.RoomID)
				}

				// Notify others (simplified for now, ideally only nearby)
				// For "user_left", we might want to broadcast to room or nearby
				// Spec says: "Notifica a usuarios cercanos con user_left"
				// But since we removed from grid, we can't easily find "nearby" unless we knew where they were.
				// We could track last pos. For now, room broadcast is safe fallback for small rooms.
				// Or better: SpatialGrid could return neighbors BEFORE removing?
				// Let's stick to Room broadcast for leave events for simplicity/robustness
				h.broadcastToRoomSimple(room, &models.WSMessage{
					Type: MsgUserLeft,
					Payload: models.UserLeftBroadcast{
						UserID: client.ID,
						RoomID: client.RoomID,
					},
				})

				if len(room.Clients) == 0 {
					room.Close()
					delete(h.Rooms, client.RoomID)
				}
			}
		}

		delete(h.Clients, client)
		client.Close()
	}
	log.Printf("Client unregistered: %s", client.ID)
}

func (h *Hub) HandleMessage(client *Client, message []byte) {
	var wsMsg models.WSMessage
	if err := json.Unmarshal(message, &wsMsg); err != nil {
		log.Printf("Invalid message format: %v", err)
		return
	}

	switch wsMsg.Type {
	case MsgJoinRoom:
		var payload models.JoinRoomPayload
		parsePayload(wsMsg.Payload, &payload)
		h.handleJoinRoom(client, payload)

	case MsgPlayerMove:
		var payload models.PlayerMovePayload
		parsePayload(wsMsg.Payload, &payload)
		h.handlePlayerMove(client, payload)

	case MsgReqPositions:
		h.handleRequestPositions(client, nil, nil)

	case MsgRequestMapJoin: // New event
		var payload struct {
			SceneKey   string `json:"scene_key"`
			Type       string `json:"type"`
			InviteCode string `json:"invite_code"`
			MaxUsers   int    `json:"max_users"`
		}
		parsePayload(wsMsg.Payload, &payload)
		h.handleRequestMapJoin(client, payload.SceneKey, payload.Type, payload.InviteCode)

	case MsgChatMessage:
		var payload models.ChatMessagePayload
		parsePayload(wsMsg.Payload, &payload)
		h.handleChatMessage(client, payload)

	// WebRTC Signaling Handlers
	case MsgWebRTCOffer:
		h.handleWebRTCOffer(client, wsMsg.Payload)
	case MsgWebRTCAnswer:
		h.handleWebRTCAnswer(client, wsMsg.Payload)
	case MsgWebRTCIceCandidate:
		h.handleWebRTCIceCandidate(client, wsMsg.Payload)
	case MsgWebRTCDisconnect:
		h.handleWebRTCDisconnect(client, wsMsg.Payload)

	// Combat Handlers
	case MsgSelectClass:
		h.handleSelectClass(client, wsMsg.Payload)
	case MsgEncounterEnemy:
		h.handleEncounterEnemy(client, wsMsg.Payload)
	case MsgCombatAction:
		h.handleCombatAction(client, wsMsg.Payload)

	// Chat Handlers
	case MsgChatRequest:
		var payload models.ChatRequestPayload
		parsePayload(wsMsg.Payload, &payload)
		h.handleChatRequest(client, payload)

	case MsgChatAccept:
		var payload models.ChatResponsePayload
		parsePayload(wsMsg.Payload, &payload)
		h.handleChatResponse(client, payload)

	case MsgPrivateMessage:
		var payload models.PrivateMessagePayload
		parsePayload(wsMsg.Payload, &payload)
		h.handlePrivateMessage(client, payload)

	case MsgJoinChallenge:
		var payload models.JoinChallengePayload
		parsePayload(wsMsg.Payload, &payload)
		h.handleJoinChallenge(client, payload)

	case MsgLeaveChallenge:
		var payload models.LeaveChallengePayload
		parsePayload(wsMsg.Payload, &payload)
		h.handleLeaveChallenge(client, payload)

	case MsgChallengeChatMessage:
		var payload models.ChallengeChatMessagePayload
		parsePayload(wsMsg.Payload, &payload)
		h.handleChallengeChatMessage(client, payload)

	case MsgPlayerEmoji:
		var payload models.PlayerEmojiPayload
		parsePayload(wsMsg.Payload, &payload)
		h.handlePlayerEmoji(client, payload)

	case MsgPlayerAttack:
		h.handlePlayerAttack(client, wsMsg.Payload)
	}
}

func (h *Hub) handleJoinChallenge(client *Client, payload models.JoinChallengePayload) {
	if payload.ChallengeID == "" {
		client.SendError("challenge_id is required")
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if client.ChallengeID != "" && client.ChallengeID != payload.ChallengeID {
		h.leaveChallengeLocked(client, client.ChallengeID, "switched")
	}

	session, ok := h.Challenges[payload.ChallengeID]
	if !ok {
		session = make(map[*Client]bool)
		h.Challenges[payload.ChallengeID] = session
	}

	if session[client] {
		return
	}

	for other := range session {
		if other == client {
			continue
		}
		h.PeerService.Manager.AddPeerConnection(other.ID.String(), client.ID.String(), payload.ChallengeID, other.RoomID)
		h.PeerService.Manager.AddPeerConnection(client.ID.String(), other.ID.String(), payload.ChallengeID, client.RoomID)
		other.SendJSON(&models.WSMessage{
			Type: MsgStartPeerConnection,
			Payload: models.StartPeerConnectionPayload{
				PeerUserID:   client.ID,
				PeerUsername: client.Username,
				Distance:     0,
				Initiator:    other.ID.String() < client.ID.String(),
				SessionID:    payload.ChallengeID,
			},
		})
		client.SendJSON(&models.WSMessage{
			Type: MsgStartPeerConnection,
			Payload: models.StartPeerConnectionPayload{
				PeerUserID:   other.ID,
				PeerUsername: other.Username,
				Distance:     0,
				Initiator:    client.ID.String() < other.ID.String(),
				SessionID:    payload.ChallengeID,
			},
		})
	}

	session[client] = true
	client.ChallengeID = payload.ChallengeID

	participants := make([]models.ChallengeParticipant, 0, len(session))
	for c := range session {
		participants = append(participants, models.ChallengeParticipant{UserID: c.ID, Username: c.Username})
	}

	client.SendJSON(&models.WSMessage{
		Type: MsgChallengeJoined,
		Payload: models.ChallengeJoinedPayload{
			ChallengeID:  payload.ChallengeID,
			Participants: participants,
		},
	})

	for other := range session {
		if other == client {
			continue
		}
		other.SendJSON(&models.WSMessage{
			Type: MsgChallengeUserJoined,
			Payload: models.ChallengeUserJoinedPayload{
				ChallengeID: payload.ChallengeID,
				UserID:      client.ID,
				Username:    client.Username,
			},
		})
	}
}

func (h *Hub) handleLeaveChallenge(client *Client, payload models.LeaveChallengePayload) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.leaveChallengeLocked(client, payload.ChallengeID, "left")
}

func (h *Hub) leaveChallengeLocked(client *Client, challengeID string, reason string) {
	if challengeID == "" {
		return
	}
	session, ok := h.Challenges[challengeID]
	if !ok {
		client.ChallengeID = ""
		return
	}
	if !session[client] {
		if client.ChallengeID == challengeID {
			client.ChallengeID = ""
		}
		return
	}

	delete(session, client)
	client.ChallengeID = ""

	for other := range session {
		h.PeerService.Manager.RemovePeerConnection(other.ID.String(), client.ID.String(), challengeID)
		h.PeerService.Manager.RemovePeerConnection(client.ID.String(), other.ID.String(), challengeID)
		other.SendJSON(&models.WSMessage{
			Type: MsgClosePeerConnection,
			Payload: models.ClosePeerConnectionPayload{
				PeerUserID: client.ID,
				Reason:     reason,
				SessionID:  challengeID,
			},
		})
		client.SendJSON(&models.WSMessage{
			Type: MsgClosePeerConnection,
			Payload: models.ClosePeerConnectionPayload{
				PeerUserID: other.ID,
				Reason:     reason,
				SessionID:  challengeID,
			},
		})

		other.SendJSON(&models.WSMessage{
			Type: MsgChallengeUserLeft,
			Payload: models.ChallengeUserLeftPayload{
				ChallengeID: challengeID,
				UserID:      client.ID,
			},
		})
	}

	client.SendJSON(&models.WSMessage{
		Type: MsgChallengeLeft,
		Payload: models.ChallengeLeftPayload{
			ChallengeID: challengeID,
		},
	})

	if len(session) == 0 {
		delete(h.Challenges, challengeID)
	}
}

func (h *Hub) handleChallengeChatMessage(client *Client, payload models.ChallengeChatMessagePayload) {
	if payload.ChallengeID == "" || payload.Message == "" {
		return
	}

	h.mu.RLock()
	session, ok := h.Challenges[payload.ChallengeID]
	inSession := ok && session[client]
	h.mu.RUnlock()
	if !inSession {
		return
	}

	msg := &models.WSMessage{
		Type: MsgChallengeChatBroadcast,
		Payload: models.ChallengeChatBroadcast{
			ChallengeID: payload.ChallengeID,
			UserID:      client.ID,
			Username:    client.Username,
			Message:     payload.Message,
			Timestamp:   time.Now().Format(time.RFC3339),
		},
	}

	h.mu.RLock()
	for c := range session {
		c.SendJSON(msg)
	}
	h.mu.RUnlock()
}

func (h *Hub) handleChatRequest(client *Client, payload models.ChatRequestPayload) {
	targetID, err := uuid.Parse(payload.TargetID)
	if err != nil {
		return
	}

	// Find target client
	var targetClient *Client
	for c := range h.Clients {
		if c.ID == targetID {
			targetClient = c
			break
		}
	}

	if targetClient != nil {
		targetClient.SendJSON(&models.WSMessage{
			Type: MsgChatRequestBcast,
			Payload: map[string]string{
				"requester_id":   client.ID.String(),
				"requester_name": client.Username,
			},
		})
	}
}

func (h *Hub) handleChatResponse(client *Client, payload models.ChatResponsePayload) {
	targetID, err := uuid.Parse(payload.TargetID)
	if err != nil {
		return
	}

	var targetClient *Client
	for c := range h.Clients {
		if c.ID == targetID {
			targetClient = c
			break
		}
	}

	if targetClient != nil {
		if payload.Accepted {
			// Notify both to start session
			msg := &models.WSMessage{
				Type: MsgChatSessionStart,
				Payload: map[string]string{
					"partner_id":   client.ID.String(),
					"partner_name": client.Username,
				},
			}
			targetClient.SendJSON(msg)

			client.SendJSON(&models.WSMessage{
				Type: MsgChatSessionStart,
				Payload: map[string]string{
					"partner_id":   targetClient.ID.String(),
					"partner_name": targetClient.Username,
				},
			})
		} else {
			targetClient.SendJSON(&models.WSMessage{
				Type: MsgChatReject,
				Payload: map[string]string{
					"rejecter_id":   client.ID.String(),
					"rejecter_name": client.Username,
				},
			})
		}
	}
}

func (h *Hub) handlePrivateMessage(client *Client, payload models.PrivateMessagePayload) {
	targetID, err := uuid.Parse(payload.TargetID)
	if err != nil {
		return
	}

	var targetClient *Client
	for c := range h.Clients {
		if c.ID == targetID {
			targetClient = c
			break
		}
	}

	if targetClient != nil {
		targetClient.SendJSON(&models.WSMessage{
			Type: MsgPrivateMessage,
			Payload: map[string]string{
				"sender_id":   client.ID.String(),
				"sender_name": client.Username,
				"message":     payload.Message,
			},
		})
	}
}

func (h *Hub) handleSelectClass(client *Client, payload interface{}) {
	var p struct {
		Class string `json:"character_class"`
	}
	parsePayload(payload, &p)

	stats, err := h.CombatService.SetClass(client.ID.String(), p.Class)
	if err != nil {
		client.SendError("Failed to set class: " + err.Error())
		return
	}

	client.SendJSON(&models.WSMessage{
		Type: MsgCharacterSelected,
		Payload: map[string]interface{}{
			"user_id": client.ID,
			"class":   stats.Class,
			"stats":   stats,
		},
	})
}

func (h *Hub) handleEncounterEnemy(client *Client, payload interface{}) {
	var p struct {
		EnemyID  string `json:"enemy_id"`
		Position struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
		} `json:"position"`
	}
	parsePayload(payload, &p)

	// Start Combat
	state, err := h.CombatService.StartCombat(client.ID.String(), p.EnemyID, client.RoomID)
	if err != nil {
		client.SendError("Failed to start combat: " + err.Error())
		return
	}

	// Need Enemy details for payload
	// In a real app, we would fetch it again or StartCombat returns it fully populated
	// State has EnemyState (HP/MP), but not Name/SpriteKey which are static.
	// Ideally StartCombat returns a struct with both state and static info, or we fetch static info here.
	// For now, we assume client knows who it collided with or we fetch minimal info.

	// Send Combat Started
	client.SendJSON(&models.WSMessage{
		Type: MsgCombatStarted,
		Payload: map[string]interface{}{
			"combat_id": state.CombatID,
			"enemy": map[string]interface{}{
				"id": p.EnemyID,
				// "name": "Goblin", // Ideally fetched
				"hp_current": state.EnemyState.HPCurrent,
				"hp_max":     state.EnemyState.HPMax,
			},
			"player": map[string]interface{}{
				"hp_current": state.PlayerState.HPCurrent,
				"hp_max":     state.PlayerState.HPMax,
				"mp_current": state.PlayerState.MPCurrent,
				"mp_max":     state.PlayerState.MPMax,
			},
			"current_turn": state.CurrentTurn,
		},
	})
}

func (h *Hub) handleCombatAction(client *Client, payload interface{}) {
	var p struct {
		CombatID   string `json:"combat_id"`
		ActionType string `json:"action_type"`
		SkillID    string `json:"skill_id"`
		ItemID     string `json:"item_id"`
	}
	parsePayload(payload, &p)

	// Process Player Action
	state, logEntry, err := h.CombatService.ProcessAction(p.CombatID, p.ActionType, p.SkillID)
	if err != nil {
		client.SendError(err.Error())
		return
	}

	// Broadcast Turn Result (Player)
	client.SendJSON(&models.WSMessage{
		Type: MsgTurnResult,
		Payload: map[string]interface{}{
			"combat_id":    state.CombatID,
			"turn_number":  state.TurnNumber,
			"actions":      []*models.CombatLogEntry{logEntry},
			"player_state": state.PlayerState,
			"enemy_state":  state.EnemyState,
			"next_turn":    state.CurrentTurn,
		},
	})

	if state.Status != "active" {
		h.handleCombatEnd(client, state)
		return
	}

	// If next turn is Enemy, process it immediately (or delay slightly for UX)
	if state.CurrentTurn == "enemy" {
		go func() {
			// Simulate think time
			time.Sleep(1 * time.Second)

			enemyState, enemyLog, err := h.CombatService.ProcessEnemyTurn(p.CombatID)
			if err != nil {
				return
			}

			client.SendJSON(&models.WSMessage{
				Type: MsgTurnResult,
				Payload: map[string]interface{}{
					"combat_id":    enemyState.CombatID,
					"turn_number":  enemyState.TurnNumber,
					"actions":      []*models.CombatLogEntry{enemyLog},
					"player_state": enemyState.PlayerState,
					"enemy_state":  enemyState.EnemyState,
					"next_turn":    enemyState.CurrentTurn,
				},
			})

			if enemyState.Status != "active" {
				h.handleCombatEnd(client, enemyState)
			}
		}()
	}
}

func (h *Hub) handleCombatEnd(client *Client, state *models.CombatState) {
	client.SendJSON(&models.WSMessage{
		Type: MsgCombatEnded,
		Payload: map[string]interface{}{
			"combat_id": state.CombatID,
			"result":    state.Status,
			// Rewards would be calculated here
		},
	})
}

func (h *Hub) handlePlayerAttack(client *Client, payload interface{}) {
	var p struct {
		TargetInstanceID string `json:"target_instance_id"`
		Damage           int    `json:"damage"`
	}
	parsePayload(payload, &p)

	roomID := client.RoomID
	if roomID == "" {
		return
	}

	h.mu.RLock()
	room, ok := h.Rooms[roomID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	instanceUUID, err := uuid.Parse(p.TargetInstanceID)
	if err != nil {
		return
	}

	room.mu.Lock()
	enemy, exists := room.ActiveEnemies[instanceUUID]
	if !exists || enemy.FSMState == "dead" {
		room.mu.Unlock()
		return
	}

	enemy.HP -= p.Damage
	log.Printf("[Combat] Enemy %s took %d damage from %s. HP: %d", instanceUUID, p.Damage, client.ID, enemy.HP)

	if enemy.HP <= 0 {
		enemy.HP = 0
		enemy.FSMState = "dead"
		room.mu.Unlock()

		// Broadcast death
		deathMsg := &models.WSMessage{
			Type: MsgEnemyDied,
			Payload: models.EnemyDiedBroadcast{
				InstanceID: instanceUUID,
				RoomID:     roomID,
				KilledBy:   client.ID.String(),
			},
		}
		room.broadcastToAll(deathMsg)

		// Update Mission Progress
		go func() {
			err := h.MissionService.UpdateKillProgress(client.ID, enemy.EnemyID, roomID)
			if err != nil {
				log.Printf("[Combat] Failed to update kill progress for user %s: %v", client.ID, err)
			}

			// Special case for "Kill All": check if all enemies are dead in this room
			room.mu.RLock()
			allDead := true
			for _, e := range room.ActiveEnemies {
				if e.FSMState != "dead" {
					allDead = false
					break
				}
			}
			room.mu.RUnlock()

			if allDead {
				log.Printf("[Combat] Room %s fully cleared! Updating 'kill_all' missions.", roomID)
				// Find and complete "kill_all" tasks for ALL players in the room
				room.mu.RLock()
				for c := range room.Clients {
					// We reuse UpdateKillProgress which might need a special flag or we just trigger another check
					// A more direct way:
					h.MissionService.UpdateKillAllProgress(c.ID, roomID)
				}
				room.mu.RUnlock()
			}
		}()
	} else {
		room.mu.Unlock()
	}
}

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

	h.mu.RLock()
	room, ok := h.Rooms[roomID]
	h.mu.RUnlock()
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
					UserID:    uuid.MustParse(userID),
					RoomID:    roomID,
					X:         pos.X,
					Y:         pos.Y,
					Direction: pos.Direction,
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
	h.mu.RLock()
	room, ok := h.Rooms[roomID]
	h.mu.RUnlock()
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
			UserID:    uuid.MustParse(userID),
			RoomID:    room.ID,
			X:         x,
			Y:         y,
			Direction: dir,
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

func (h *Hub) broadcastToRoomSimple(room *Room, msg *models.WSMessage) {
	room.mu.RLock()
	defer room.mu.RUnlock()
	for client := range room.Clients {
		client.SendJSON(msg)
	}
}

// BroadcastToRoom is a public wrapper to allow other services to broadcast messages
func (h *Hub) BroadcastToRoom(roomID string, msg *models.WSMessage) {
	h.mu.RLock()
	room, ok := h.Rooms[roomID]
	h.mu.RUnlock()
	if ok {
		h.broadcastToRoomSimple(room, msg)
	}
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

// Helper
func parsePayload(input interface{}, output interface{}) {
	bytes, _ := json.Marshal(input)
	json.Unmarshal(bytes, output)
}

// WebRTC Handlers

func (h *Hub) handleWebRTCOffer(client *Client, payload interface{}) {
	var offer models.WebRTCOfferPayload
	parsePayload(payload, &offer)
	if offer.SessionID == "" {
		client.SendError("session_id is required")
		return
	}

	targetClient := h.resolveSignalingTargetClient(client, offer.SessionID, offer.TargetUserID)
	if targetClient != nil {
		if !h.isSignalingAllowedInSession(client, targetClient, offer.SessionID) {
			return
		}
		targetClient.SendJSON(&models.WSMessage{
			Type: MsgWebRTCOffer,
			Payload: models.WebRTCOfferBroadcast{
				FromUserID: client.ID,
				Username:   client.Username,
				SDP:        offer.SDP,
				Type:       "offer",
				SessionID:  offer.SessionID,
			},
		})
	}
}

func (h *Hub) handleWebRTCAnswer(client *Client, payload interface{}) {
	var answer models.WebRTCAnswerPayload
	parsePayload(payload, &answer)
	if answer.SessionID == "" {
		client.SendError("session_id is required")
		return
	}

	targetClient := h.resolveSignalingTargetClient(client, answer.SessionID, answer.TargetUserID)
	if targetClient != nil {
		if !h.isSignalingAllowedInSession(client, targetClient, answer.SessionID) {
			return
		}
		targetClient.SendJSON(&models.WSMessage{
			Type: MsgWebRTCAnswer,
			Payload: models.WebRTCAnswerBroadcast{
				FromUserID: client.ID,
				SDP:        answer.SDP,
				Type:       "answer",
				SessionID:  answer.SessionID,
			},
		})
	}
}

func (h *Hub) handleWebRTCIceCandidate(client *Client, payload interface{}) {
	var candidate models.WebRTCIceCandidatePayload
	parsePayload(payload, &candidate)
	if candidate.SessionID == "" {
		client.SendError("session_id is required")
		return
	}

	targetClient := h.resolveSignalingTargetClient(client, candidate.SessionID, candidate.TargetUserID)
	if targetClient != nil {
		if !h.isSignalingAllowedInSession(client, targetClient, candidate.SessionID) {
			return
		}
		targetClient.SendJSON(&models.WSMessage{
			Type: MsgWebRTCIceCandidate,
			Payload: models.WebRTCIceCandidateBroadcast{
				FromUserID:    client.ID,
				Candidate:     candidate.Candidate,
				SDPMid:        candidate.SDPMid,
				SDPMLineIndex: candidate.SDPMLineIndex,
				SessionID:     candidate.SessionID,
			},
		})
	}
}

func (h *Hub) handleWebRTCDisconnect(client *Client, payload interface{}) {
	var disc models.WebRTCDisconnectPayload
	parsePayload(payload, &disc)
	if disc.PeerUserID == "" {
		return
	}
	if disc.SessionID == "" {
		client.SendError("session_id is required")
		return
	}
	h.PeerService.Manager.RemovePeerConnection(client.ID.String(), disc.PeerUserID, disc.SessionID)
	h.PeerService.Manager.RemovePeerConnection(disc.PeerUserID, client.ID.String(), disc.SessionID)

	targetClient := h.resolveSignalingTargetClient(client, disc.SessionID, disc.PeerUserID)
	if targetClient == nil {
		return
	}
	if !h.isSignalingAllowedInSession(client, targetClient, disc.SessionID) {
		return
	}
	targetClient.SendJSON(&models.WSMessage{
		Type: MsgWebRTCDisconnect,
		Payload: map[string]string{
			"from_user_id": client.ID.String(),
			"peer_user_id": client.ID.String(),
			"session_id":   disc.SessionID,
		},
	})
}

// Proximity Logic

func (h *Hub) proximityLoop() {
	ticker := time.NewTicker(2 * time.Second)
	for range ticker.C {
		h.mu.RLock()
		rooms := make([]*Room, 0, len(h.Rooms))
		for _, r := range h.Rooms {
			rooms = append(rooms, r)
		}
		h.mu.RUnlock()

		for _, room := range rooms {
			room.mu.RLock()
			clients := make([]*Client, 0, len(room.Clients))
			for c := range room.Clients {
				clients = append(clients, c)
			}
			room.mu.RUnlock()

			users := make([]string, 0, len(clients))
			for _, c := range clients {
				users = append(users, c.ID.String())
			}
			if len(users) == 0 {
				continue
			}

			positions, err := h.MovementService.GetPositionsBatch(context.Background(), room.ID, users)
			if err != nil {
				continue
			}
			posMap := make(map[string]models.Position)
			for _, p := range positions {
				posMap[p.UserID] = p
			}

			for _, client := range clients {
				if pos, ok := posMap[client.ID.String()]; ok {
					h.checkUserProximity(room.ID, client.ID.String(), pos.X, pos.Y)
				}
			}
		}
	}
}

func (h *Hub) checkUserProximity(roomID, userID string, x, y float64) {
	h.mu.RLock()
	room, ok := h.Rooms[roomID]
	h.mu.RUnlock()
	if !ok {
		return
	}

	nearbyIDs := room.Grid.GetNearbyUsers(x, y)
	inRangeUsers, err := h.PeerService.GetUsersInAudioRange(context.Background(), roomID, userID, x, y, nearbyIDs)
	if err != nil {
		return
	}

	sessionID := "room:" + roomID
	currentConns := h.PeerService.Manager.GetPeerConnectionsForSession(userID, sessionID)
	connectedPeers := make(map[string]bool)
	for _, c := range currentConns {
		connectedPeers[c.PeerID] = true
	}

	inRangeMap := make(map[string]services.UserDistance)
	for _, u := range inRangeUsers {
		inRangeMap[u.UserID] = u
	}

	client := h.findClientInRoom(room, userID)
	if client == nil {
		return
	}

	// A. Connect / Update Volume
	for _, target := range inRangeUsers {
		if !connectedPeers[target.UserID] {
			if userID > target.UserID {
				continue
			}

			targetClient := h.findClientInRoom(room, target.UserID)
			if targetClient == nil {
				continue
			}

			h.PeerService.Manager.AddPeerConnection(userID, target.UserID, sessionID, roomID)
			h.PeerService.Manager.AddPeerConnection(target.UserID, userID, sessionID, roomID)

			client.SendJSON(&models.WSMessage{
				Type: MsgStartPeerConnection,
				Payload: models.StartPeerConnectionPayload{
					PeerUserID:   uuid.MustParse(target.UserID),
					PeerUsername: targetClient.Username,
					Distance:     target.Distance,
					Initiator:    userID < target.UserID,
					SessionID:    sessionID,
				},
			})
			targetClient.SendJSON(&models.WSMessage{
				Type: MsgStartPeerConnection,
				Payload: models.StartPeerConnectionPayload{
					PeerUserID:   client.ID,
					PeerUsername: client.Username,
					Distance:     target.Distance,
					Initiator:    target.UserID < userID,
					SessionID:    sessionID,
				},
			})
		} else {
			client.SendJSON(&models.WSMessage{
				Type: MsgAudioVolumeUpdate,
				Payload: models.AudioVolumeUpdatePayload{
					PeerUserID: uuid.MustParse(target.UserID),
					Volume:     webrtc.CalculateAudioVolume(target.Distance),
					Distance:   target.Distance,
					SessionID:  sessionID,
				},
			})
		}
	}

	// B. Disconnect out of range
	for peerID := range connectedPeers {
		if _, stillInRange := inRangeMap[peerID]; stillInRange {
			continue
		}
		if userID > peerID {
			continue
		}

		h.PeerService.Manager.RemovePeerConnection(userID, peerID, sessionID)
		h.PeerService.Manager.RemovePeerConnection(peerID, userID, sessionID)

		targetClient := h.findClientInRoom(room, peerID)
		client.SendJSON(&models.WSMessage{
			Type: MsgClosePeerConnection,
			Payload: models.ClosePeerConnectionPayload{
				PeerUserID: uuid.MustParse(peerID),
				Reason:     "out_of_range",
				SessionID:  sessionID,
			},
		})
		if targetClient != nil {
			targetClient.SendJSON(&models.WSMessage{
				Type: MsgClosePeerConnection,
				Payload: models.ClosePeerConnectionPayload{
					PeerUserID: client.ID,
					Reason:     "out_of_range",
					SessionID:  sessionID,
				},
			})
		}
	}
}

func (h *Hub) resolveSignalingTargetClient(sender *Client, sessionID string, targetUserID string) *Client {
	if sessionID != "" {
		return h.findClientByID(targetUserID)
	}

	h.mu.RLock()
	room, ok := h.Rooms[sender.RoomID]
	h.mu.RUnlock()
	if !ok {
		return nil
	}

	return h.findClientInRoom(room, targetUserID)
}

func (h *Hub) isSignalingAllowedInSession(sender *Client, target *Client, sessionID string) bool {
	if sender == nil || target == nil {
		return false
	}

	if sessionID == "" {
		return true
	}

	if strings.HasPrefix(sessionID, "room:") {
		expected := "room:" + sender.RoomID
		if sessionID != expected {
			return false
		}
		if sender.RoomID == "" || target.RoomID != sender.RoomID {
			return false
		}
		return h.PeerService.Manager.IsConnected(sender.ID.String(), target.ID.String(), sessionID) || h.PeerService.Manager.IsConnected(target.ID.String(), sender.ID.String(), sessionID)
	}

	h.mu.RLock()
	session, ok := h.Challenges[sessionID]
	h.mu.RUnlock()
	if !ok {
		return false
	}
	if !session[sender] || !session[target] {
		return false
	}
	return h.PeerService.Manager.IsConnected(sender.ID.String(), target.ID.String(), sessionID) || h.PeerService.Manager.IsConnected(target.ID.String(), sender.ID.String(), sessionID)
}

func (h *Hub) findClientByID(userID string) *Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.Clients {
		if c.ID.String() == userID {
			return c
		}
	}
	return nil
}

func (h *Hub) findClientInRoom(room *Room, userID string) *Client {
	room.mu.RLock()
	defer room.mu.RUnlock()
	for client := range room.Clients {
		if client.ID.String() == userID {
			return client
		}
	}
	return nil
}

// generatePIN returns a zero-padded 4-digit numeric string, e.g. "0472" or "9831".
func generatePIN() string {
	return fmt.Sprintf("%04d", rand.Intn(9000)+1000)
}

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

	effectiveRoomType := "public"
	if !isPublic {
		effectiveRoomType = "mission"
	}

	var selectedRoom *Room

	h.mu.RLock()

	// ─ COOPERATIVE LOGIC: Find active room for same mission with < 60% progress ─────
	if roomType == "cooperative" {
		maxCoopPlayers := 4 // Hard limit for coop balance
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

	h.mu.RLock()
	room, ok := h.Rooms[client.RoomID]
	h.mu.RUnlock()

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
