package websocket

import (
	"context"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"gather-rpg-backend/internal/webrtc"
	"log"
	"time"

	"github.com/google/uuid"
)

// handleAudioMuteState broadcasts a user's self-mute state change to the entire room.
// The event is purely informational — the actual audio suppression is already handled
// by the browser (track.enabled = false on the sender's MediaStream).
func (h *Hub) handleAudioMuteState(client *Client, payload interface{}) {
	var p struct {
		IsMuted   bool   `json:"is_muted"`
		SessionID string `json:"session_id"`
	}
	parsePayload(payload, &p)

	roomID := client.RoomID
	if roomID == "" {
		return
	}

	room, ok := h.getRoom(roomID)
	if !ok {
		return
	}

	// Broadcast to every OTHER client in the room so they can update their UI
	broadcastMsg := &models.WSMessage{
		Type: MsgAudioMuteState,
		Payload: map[string]interface{}{
			"user_id":    client.ID,
			"username":   client.Username,
			"is_muted":   p.IsMuted,
			"session_id": "room:" + roomID,
		},
	}

	room.mu.RLock()
	for c := range room.Clients {
		if c == client {
			continue
		}
		c.SendJSON(broadcastMsg)
	}
	room.mu.RUnlock()

	log.Printf("[CoopAudio] User %s (%s) self-mute state → %v in room %s", client.Username, client.ID, p.IsMuted, roomID)
}

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
	room, ok := h.getRoom(roomID)
	if !ok {
		return
	}

	// Cooperative rooms use a "meeting room" audio model: every participant is
	// connected at full volume from the moment they join (see handleJoinRoom).
	// They share the same session_id ("room:"+roomID), so running proximity here
	// would attenuate volume by distance and tear down connections when players
	// walk apart — breaking the full-room audio. Skip proximity for these rooms.
	if room.Type == "cooperative" {
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

	client := h.findClientInRoom(room, userID)
	if client == nil {
		return
	}

	// Moderación: un par bloqueado (en cualquier dirección) se trata como "fuera
	// de rango": nunca se conecta (loop A) y, si ya estaba conectado cuando se
	// creó el bloqueo, cae en el teardown estándar del loop B.
	filtered := inRangeUsers[:0]
	for _, u := range inRangeUsers {
		tc := h.findClientInRoom(room, u.UserID)
		if tc != nil && (client.HasBlocked(u.UserID) || tc.HasBlocked(userID)) {
			continue
		}
		filtered = append(filtered, u)
	}
	inRangeUsers = filtered

	inRangeMap := make(map[string]services.UserDistance)
	for _, u := range inRangeUsers {
		inRangeMap[u.UserID] = u
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
