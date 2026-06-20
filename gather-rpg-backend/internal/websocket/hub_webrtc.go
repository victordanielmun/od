package websocket

import (
	"gather-rpg-backend/internal/models"
	"strings"
)

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
			"peer_user_id": disc.PeerUserID, // Fixed: was incorrectly sending client.ID instead of the peer being disconnected
			"session_id":   disc.SessionID,
		},
	})
}

// Proximity Logic

func (h *Hub) resolveSignalingTargetClient(sender *Client, sessionID string, targetUserID string) *Client {
	if sessionID != "" {
		return h.findClientByID(targetUserID)
	}

	room, ok := h.getRoom(sender.RoomID)
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
