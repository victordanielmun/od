package websocket

import (
	"gather-rpg-backend/internal/models"
	"time"
)

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

	if len(session) >= 5 {
		client.SendError("La sala de voz / juego está llena (máximo 5 personas)")
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

	if room, ok := h.Rooms[client.RoomID]; ok {
		h.broadcastToRoomSimple(room, &models.WSMessage{
			Type: "challenge_capacity_update",
			Payload: map[string]interface{}{
				"challenge_id": payload.ChallengeID,
				"count":        len(session),
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

	if room, ok := h.Rooms[client.RoomID]; ok {
		h.broadcastToRoomSimple(room, &models.WSMessage{
			Type: "challenge_capacity_update",
			Payload: map[string]interface{}{
				"challenge_id": challengeID,
				"count":        len(session),
			},
		})
	}

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
