package websocket

import (
	"encoding/json"
	"testing"
	"time"

	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"gather-rpg-backend/internal/webrtc"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestPeerManager_TracksConnectionsAndCleanup(t *testing.T) {
	pm := webrtc.NewPeerManager()

	userID := uuid.NewString()
	peerID := uuid.NewString()
	roomID := "test-room"
	sessionID := "room:" + roomID

	pm.AddPeerConnection(userID, peerID, sessionID, roomID)
	assert.True(t, pm.IsConnected(userID, peerID, sessionID))
	assert.Equal(t, "connecting", pm.GetConnectionState(userID, peerID, sessionID))

	pm.UpdateLastPing(userID, peerID, sessionID)
	assert.Equal(t, "connected", pm.GetConnectionState(userID, peerID, sessionID))

	removed := pm.CleanupStaleConnections(-1 * time.Second)
	assert.Len(t, removed, 1)
	assert.False(t, pm.IsConnected(userID, peerID, sessionID))
}

func TestWebRTCPayloadCompatibility(t *testing.T) {
	offerPayload := models.WebRTCOfferPayload{
		TargetUserID: uuid.NewString(),
		SDP:          "mock-sdp-offer",
		Type:         "offer",
		SessionID:    "room:test",
	}

	offerBytes, err := json.Marshal(offerPayload)
	assert.NoError(t, err)
	var offerDecoded map[string]any
	assert.NoError(t, json.Unmarshal(offerBytes, &offerDecoded))
	assert.Equal(t, offerPayload.TargetUserID, offerDecoded["target_user_id"])
	assert.Equal(t, offerPayload.SDP, offerDecoded["sdp"])
	assert.Equal(t, offerPayload.Type, offerDecoded["type"])
	assert.Equal(t, offerPayload.SessionID, offerDecoded["session_id"])

	broadcast := models.WebRTCOfferBroadcast{
		FromUserID: uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		Username:   "GuestUser",
		SDP:        "sdp-data",
		Type:       "offer",
		SessionID:  "room:test",
	}

	data, err := json.Marshal(broadcast)
	assert.NoError(t, err)
	asMap := make(map[string]interface{})
	assert.NoError(t, json.Unmarshal(data, &asMap))

	assert.Equal(t, "00000000-0000-0000-0000-000000000001", asMap["from_user_id"])
	assert.Equal(t, "sdp-data", asMap["sdp"])
	assert.Equal(t, "offer", asMap["type"])
	assert.Equal(t, "room:test", asMap["session_id"])
}

func TestProximityHelpers(t *testing.T) {
	dist := webrtc.CalculateDistance(100, 100, 150, 100)
	assert.InDelta(t, 50.0, dist, 0.0001)
	assert.True(t, webrtc.IsInAudioRange(dist))

	volNear := webrtc.CalculateAudioVolume(0)
	volFar := webrtc.CalculateAudioVolume(webrtc.AudioRange)
	assert.InDelta(t, 1.0, volNear, 0.0001)
	assert.InDelta(t, 0.0, volFar, 0.0001)
}

func TestWebRTCSignalingRequiresSessionID(t *testing.T) {
	hub := &Hub{
		Clients:    make(map[*Client]bool),
		Rooms:      make(map[string]*Room),
		Challenges: make(map[string]map[*Client]bool),
		PeerService: &services.PeerService{
			Manager: webrtc.NewPeerManager(),
		},
	}

	roomID := uuid.NewString()
	room := NewRoom(roomID, nil)
	hub.Rooms[roomID] = room

	client1 := &Client{Hub: hub, ID: uuid.New(), Username: "User1", RoomID: roomID, send: make(chan []byte, 10)}
	client2 := &Client{Hub: hub, ID: uuid.New(), Username: "User2", RoomID: roomID, send: make(chan []byte, 10)}
	hub.trackClient(client1)
	hub.trackClient(client2)
	room.AddClient(client1)
	room.AddClient(client2)

	hub.handleWebRTCOffer(client1, models.WebRTCOfferPayload{
		TargetUserID: client2.ID.String(),
		SDP:          "sdp",
		Type:         "offer",
	})

	select {
	case msg := <-client1.send:
		var wsMsg models.WSMessage
		assert.NoError(t, json.Unmarshal(msg, &wsMsg))
		assert.Equal(t, "error", wsMsg.Type)
	default:
		t.Fatal("expected error response")
	}
}

func TestWebRTCSignalingRoomSessionAllowsOnlyPairedPeers(t *testing.T) {
	hub := &Hub{
		Clients:    make(map[*Client]bool),
		Rooms:      make(map[string]*Room),
		Challenges: make(map[string]map[*Client]bool),
		PeerService: &services.PeerService{
			Manager: webrtc.NewPeerManager(),
		},
	}

	roomID := uuid.NewString()
	room := NewRoom(roomID, nil)
	hub.Rooms[roomID] = room

	client1 := &Client{Hub: hub, ID: uuid.New(), Username: "User1", RoomID: roomID, send: make(chan []byte, 10)}
	client2 := &Client{Hub: hub, ID: uuid.New(), Username: "User2", RoomID: roomID, send: make(chan []byte, 10)}
	hub.trackClient(client1)
	hub.trackClient(client2)
	room.AddClient(client1)
	room.AddClient(client2)

	sessionID := "room:" + roomID
	hub.PeerService.Manager.AddPeerConnection(client1.ID.String(), client2.ID.String(), sessionID, roomID)
	hub.PeerService.Manager.AddPeerConnection(client2.ID.String(), client1.ID.String(), sessionID, roomID)

	hub.handleWebRTCOffer(client1, models.WebRTCOfferPayload{
		TargetUserID: client2.ID.String(),
		SDP:          "sdp",
		Type:         "offer",
		SessionID:    sessionID,
	})

	select {
	case msg := <-client2.send:
		var wsMsg models.WSMessage
		assert.NoError(t, json.Unmarshal(msg, &wsMsg))
		assert.Equal(t, MsgWebRTCOffer, wsMsg.Type)
	default:
		t.Fatal("expected offer forwarded to target")
	}
}

// drainMessageTypes vacía el canal de salida de un cliente y devuelve los tipos
// de mensaje recibidos, para poder afirmar presencia/ausencia de eventos.
func drainMessageTypes(t *testing.T, c *Client) []string {
	t.Helper()
	var types []string
	for {
		select {
		case raw := <-c.send:
			var msg models.WSMessage
			assert.NoError(t, json.Unmarshal(raw, &msg))
			types = append(types, msg.Type)
		default:
			return types
		}
	}
}

func TestRoomSwitchClosesOldRoomVoicePeers(t *testing.T) {
	hub := &Hub{
		Clients:    make(map[*Client]bool),
		Rooms:      make(map[string]*Room),
		Challenges: make(map[string]map[*Client]bool),
		PeerService: &services.PeerService{
			Manager: webrtc.NewPeerManager(),
		},
	}

	roomID := uuid.NewString()
	room := NewRoom(roomID, nil)
	hub.Rooms[roomID] = room

	client1 := &Client{Hub: hub, ID: uuid.New(), Username: "User1", RoomID: roomID, send: make(chan []byte, 10)}
	client2 := &Client{Hub: hub, ID: uuid.New(), Username: "User2", RoomID: roomID, send: make(chan []byte, 10)}
	hub.trackClient(client1)
	hub.trackClient(client2)
	room.AddClient(client1)
	room.AddClient(client2)

	sessionID := "room:" + roomID
	hub.PeerService.Manager.AddPeerConnection(client1.ID.String(), client2.ID.String(), sessionID, roomID)
	hub.PeerService.Manager.AddPeerConnection(client2.ID.String(), client1.ID.String(), sessionID, roomID)

	hub.closeRoomVoicePeersLocked(client1, roomID, "room_switch")

	assert.False(t, hub.PeerService.Manager.IsConnected(client1.ID.String(), client2.ID.String(), sessionID))
	assert.False(t, hub.PeerService.Manager.IsConnected(client2.ID.String(), client1.ID.String(), sessionID))
	assert.Contains(t, drainMessageTypes(t, client1), MsgClosePeerConnection)
	assert.Contains(t, drainMessageTypes(t, client2), MsgClosePeerConnection)
}

func TestChallengeJoinSkipsBlockedPairs(t *testing.T) {
	hub := &Hub{
		Clients:    make(map[*Client]bool),
		Rooms:      make(map[string]*Room),
		Challenges: make(map[string]map[*Client]bool),
		PeerService: &services.PeerService{
			Manager: webrtc.NewPeerManager(),
		},
	}

	roomID := uuid.NewString()
	room := NewRoom(roomID, nil)
	hub.Rooms[roomID] = room

	client1 := &Client{Hub: hub, ID: uuid.New(), Username: "User1", RoomID: roomID, send: make(chan []byte, 10)}
	client2 := &Client{Hub: hub, ID: uuid.New(), Username: "User2", RoomID: roomID, send: make(chan []byte, 10)}
	hub.trackClient(client1)
	hub.trackClient(client2)
	room.AddClient(client1)
	room.AddClient(client2)

	challengeID := "challenge-1"
	hub.Challenges[challengeID] = map[*Client]bool{client1: true}
	client1.ChallengeID = challengeID
	client1.SetBlocked(client2.ID.String(), true)

	hub.handleJoinChallenge(client2, models.JoinChallengePayload{ChallengeID: challengeID})

	// Ambos quedan en la sesión (chat/juego), pero sin voz entre ellos.
	assert.True(t, hub.Challenges[challengeID][client2])
	assert.False(t, hub.PeerService.Manager.IsConnected(client1.ID.String(), client2.ID.String(), challengeID))
	assert.False(t, hub.PeerService.Manager.IsConnected(client2.ID.String(), client1.ID.String(), challengeID))
	assert.NotContains(t, drainMessageTypes(t, client1), MsgStartPeerConnection)
	assert.NotContains(t, drainMessageTypes(t, client2), MsgStartPeerConnection)
}

func TestWebRTCSignalingChallengeSessionAllowsOnlyPairedMembers(t *testing.T) {
	hub := &Hub{
		Clients:    make(map[*Client]bool),
		Rooms:      make(map[string]*Room),
		Challenges: make(map[string]map[*Client]bool),
		PeerService: &services.PeerService{
			Manager: webrtc.NewPeerManager(),
		},
	}

	roomID := uuid.NewString()
	room := NewRoom(roomID, nil)
	hub.Rooms[roomID] = room

	client1 := &Client{Hub: hub, ID: uuid.New(), Username: "User1", RoomID: roomID, send: make(chan []byte, 10)}
	client2 := &Client{Hub: hub, ID: uuid.New(), Username: "User2", RoomID: roomID, send: make(chan []byte, 10)}
	hub.trackClient(client1)
	hub.trackClient(client2)
	room.AddClient(client1)
	room.AddClient(client2)

	challengeID := "challenge-1"
	hub.Challenges[challengeID] = map[*Client]bool{client1: true, client2: true}
	hub.PeerService.Manager.AddPeerConnection(client1.ID.String(), client2.ID.String(), challengeID, roomID)
	hub.PeerService.Manager.AddPeerConnection(client2.ID.String(), client1.ID.String(), challengeID, roomID)

	hub.handleWebRTCOffer(client1, models.WebRTCOfferPayload{
		TargetUserID: client2.ID.String(),
		SDP:          "sdp",
		Type:         "offer",
		SessionID:    challengeID,
	})

	select {
	case msg := <-client2.send:
		var wsMsg models.WSMessage
		assert.NoError(t, json.Unmarshal(msg, &wsMsg))
		assert.Equal(t, MsgWebRTCOffer, wsMsg.Type)
	default:
		t.Fatal("expected offer forwarded to target")
	}
}
