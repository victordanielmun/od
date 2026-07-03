package websocket

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"

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
	Clients     map[*Client]bool
	clientsByID map[uuid.UUID]*Client // índice O(1) para buscar un cliente por su ID (mantenido bajo mu)
	Rooms       map[string]*Room
	Register    chan *Client
	Unregister  chan *Client
	Broadcast   chan *models.WSMessage
	Challenges  map[string]map[*Client]bool

	PresenceService *services.PresenceService
	RoomService     *services.RoomService
	MovementService *services.MovementService
	PeerService     *services.PeerService
	CombatService   *services.CombatService
	MissionService  *services.MissionService
	LearningService *services.LearningService

	// Batching
	PendingUpdates map[string]map[string]models.RedisPosition
	updatesMu      sync.Mutex

	mu sync.RWMutex
}

func (h *Hub) SendToUser(userID string, msg *models.WSMessage) {
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return
	}
	h.mu.RLock()
	client := h.clientsByID[parsedID]
	h.mu.RUnlock()
	if client != nil {
		client.SendJSON(msg)
	}
}

func (h *Hub) IsUserOnline(userID string) bool {
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return false
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.clientsByID[parsedID] != nil
}

// trackClient registra un cliente en ambos mapas (Clients y el índice clientsByID),
// manteniéndolos como una única fuente de verdad. El llamador debe sostener h.mu.
// El índice se inicializa de forma perezosa para soportar Hubs construidos a mano
// (p. ej. en tests) sin pasar por NewHub.
func (h *Hub) trackClient(client *Client) {
	h.Clients[client] = true
	if h.clientsByID == nil {
		h.clientsByID = make(map[uuid.UUID]*Client)
	}
	h.clientsByID[client.ID] = client
}

func NewHub(presence *services.PresenceService, roomService *services.RoomService, movement *services.MovementService, peer *services.PeerService, combat *services.CombatService, mission *services.MissionService, learning *services.LearningService) *Hub {
	return &Hub{
		Broadcast:       make(chan *models.WSMessage),
		Register:        make(chan *Client),
		Unregister:      make(chan *Client),
		Clients:         make(map[*Client]bool),
		clientsByID:     make(map[uuid.UUID]*Client),
		Rooms:           make(map[string]*Room),
		Challenges:      make(map[string]map[*Client]bool),
		PresenceService: presence,
		RoomService:     roomService,
		MovementService: movement,
		PeerService:     peer,
		CombatService:   combat,
		MissionService:  mission,
		LearningService: learning,
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
			h.trackClient(client)
			h.mu.Unlock()
			log.Printf("Client registered: %s", client.ID)
			h.notifyFriendsOnlineStatus(client.ID.String())

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
			h.closeRoomVoicePeersLocked(client, client.RoomID, "disconnected")

			if room, ok := h.Rooms[client.RoomID]; ok {
				room.RemoveClient(client)
				// Liberar enemigos bloqueados por una carta ninja sin responder de
				// este jugador, para que no queden inmatables.
				room.ReleaseNinjaCardsForPlayer(client.ID.String())
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
		// Solo borrar del índice si aún apunta a ESTE cliente (evita que un
		// unregister tardío elimine la entrada de una reconexión más nueva).
		if h.clientsByID[client.ID] == client {
			delete(h.clientsByID, client.ID)
		}
		client.Close()
	}
	log.Printf("Client unregistered: %s", client.ID)
	h.notifyFriendsOnlineStatus(client.ID.String())
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

	// Character class selection
	case MsgSelectClass:
		h.handleSelectClass(client, wsMsg.Payload)

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

	case MsgPlayerHit:
		h.handlePlayerHit(client, wsMsg.Payload)

	case MsgPlayerRespawn:
		h.handlePlayerRespawn(client)

	case MsgPlayerHeal:
		h.handlePlayerHeal(client)

	case MsgSpendMana:
		h.handleSpendMana(client, wsMsg.Payload)

	case MsgRefreshMana:
		h.handleRefreshMana(client, wsMsg.Payload)

	case MsgNinjaCardAnswer:
		h.handleNinjaCardAnswer(client, wsMsg.Payload)

	case MsgAudioMuteState:
		h.handleAudioMuteState(client, wsMsg.Payload)

	case MsgTeleportToFriend:
		var payload struct {
			TargetUserID string `json:"target_user_id"`
		}
		parsePayload(wsMsg.Payload, &payload)
		h.handleTeleportToFriend(client, payload.TargetUserID)

	case MsgSendRoomInvite:
		var payload struct {
			TargetUserID string `json:"target_user_id"`
		}
		parsePayload(wsMsg.Payload, &payload)
		h.handleSendRoomInvite(client, payload.TargetUserID)
	}
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
	room, ok := h.getRoom(roomID)
	if ok {
		h.broadcastToRoomSimple(room, msg)
	}
}

// Helper
// parsePayload re-decodifica un payload genérico hacia un struct tipado. Un fallo
// deja output en su valor cero; lo logueamos para no procesar mensajes malformados
// en silencio (antes el error se descartaba por completo).
func parsePayload(input interface{}, output interface{}) {
	bytes, _ := json.Marshal(input)
	if err := json.Unmarshal(bytes, output); err != nil {
		log.Printf("[Hub] parsePayload: failed to decode payload into %T: %v", output, err)
	}
}

// WebRTC Handlers

// closeRoomVoicePeersLocked cierra todas las conexiones de voz que el cliente
// tenga en la sesión de la sala dada ("room:"+roomID) y avisa a ambos lados con
// close_peer_connection. Las conexiones WebRTC son P2P: sobreviven a un cambio
// de sala si nadie las cierra, así que esto corre tanto al desconectarse como al
// cambiar de sala. Requiere h.mu tomado (basta lectura: solo consulta clientsByID).
func (h *Hub) closeRoomVoicePeersLocked(client *Client, roomID, reason string) {
	sessionID := "room:" + roomID
	conns := h.PeerService.Manager.GetPeerConnectionsForSession(client.ID.String(), sessionID)
	for _, conn := range conns {
		h.PeerService.Manager.RemovePeerConnection(client.ID.String(), conn.PeerID, sessionID)
		h.PeerService.Manager.RemovePeerConnection(conn.PeerID, client.ID.String(), sessionID)

		peerUUID, err := uuid.Parse(conn.PeerID)
		if err != nil {
			continue
		}
		client.SendJSON(&models.WSMessage{
			Type: MsgClosePeerConnection,
			Payload: models.ClosePeerConnectionPayload{
				PeerUserID: peerUUID,
				Reason:     reason,
				SessionID:  sessionID,
			},
		})
		if targetClient := h.clientsByID[peerUUID]; targetClient != nil {
			targetClient.SendJSON(&models.WSMessage{
				Type: MsgClosePeerConnection,
				Payload: models.ClosePeerConnectionPayload{
					PeerUserID: client.ID,
					Reason:     reason,
					SessionID:  sessionID,
				},
			})
		}
	}
}

func (h *Hub) findClientByID(userID string) *Client {
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return nil
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.clientsByID[parsedID]
}

// getRoom devuelve la sala con el ID dado tomando h.mu en modo lectura.
func (h *Hub) getRoom(roomID string) (*Room, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	room, ok := h.Rooms[roomID]
	return room, ok
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
