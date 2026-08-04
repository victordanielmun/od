package websocket

import (
	"encoding/json"
	"testing"

	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// Los canales de grupo (voz en malla y chat de sala) existen solo en las salas
// donde la gente ha venido junta: cooperativas e instancias privadas. En un mapa
// público la conversación es 1:1, así que un chat_message ahí se rechaza. Estos
// tests fijan ese contrato y el filtrado por bloqueos.

func newChatRoom(roomType string, isPublic bool) (*Hub, *Room) {
	room := &Room{
		ID:       uuid.New().String(),
		Clients:  make(map[*Client]bool),
		Type:     roomType,
		IsPublic: isPublic,
	}
	hub := &Hub{
		Clients: make(map[*Client]bool),
		Rooms:   map[string]*Room{room.ID: room},
	}
	return hub, room
}

func addChatClient(hub *Hub, room *Room, name string) *Client {
	c := &Client{
		Hub:      hub,
		ID:       uuid.New(),
		Username: name,
		RoomID:   room.ID,
		send:     make(chan []byte, 16),
	}
	hub.trackClient(c)
	room.Clients[c] = true
	return c
}

// nextMessage saca el siguiente mensaje del canal de salida del cliente.
func nextMessage(t *testing.T, c *Client) models.WSMessage {
	t.Helper()
	select {
	case raw := <-c.send:
		var msg models.WSMessage
		assert.NoError(t, json.Unmarshal(raw, &msg))
		return msg
	default:
		t.Fatalf("%s no recibió ningún mensaje", c.Username)
		return models.WSMessage{}
	}
}

func assertSilent(t *testing.T, c *Client) {
	t.Helper()
	select {
	case raw := <-c.send:
		t.Fatalf("%s no debía recibir nada, recibió: %s", c.Username, raw)
	default:
	}
}

func TestIsGroupInstance(t *testing.T) {
	cases := []struct {
		name     string
		roomType string
		isPublic bool
		want     bool
	}{
		{"lobby público: conversación 1:1, sin canales de grupo", roomTypePublic, true, false},
		{"instancia privada por PIN: quien entra viene con su gente", "mission", false, true},
		{"cooperativa: equipo con objetivo común", roomTypeCooperative, true, true},
		{"competitiva: comparten mapa pero corren una carrera", roomTypeCompetitive, false, false},
		{"individual privada (irrelevante: solo hay un jugador)", roomTypeSolo, false, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			room := &Room{Type: tc.roomType, IsPublic: tc.isPublic}
			assert.Equal(t, tc.want, room.IsGroupInstance())
		})
	}
}

func TestRoomChatReachesEveryoneIncludingSender(t *testing.T) {
	hub, room := newChatRoom("mission", false)
	sender := addChatClient(hub, room, "Ana")
	peer := addChatClient(hub, room, "Beto")

	hub.handleChatMessage(sender, models.ChatMessagePayload{Message: "¡vamos al boss!"})

	for _, c := range []*Client{sender, peer} {
		msg := nextMessage(t, c)
		assert.Equal(t, MsgChatBroadcast, msg.Type, "%s debe recibir el mensaje de sala", c.Username)

		payload, ok := msg.Payload.(map[string]interface{})
		assert.True(t, ok)
		assert.Equal(t, "¡vamos al boss!", payload["message"])
		assert.Equal(t, "Ana", payload["username"], "el mensaje viaja con el nombre del emisor")
	}
}

func TestRoomChatRejectedInPublicRoom(t *testing.T) {
	hub, room := newChatRoom(roomTypePublic, true)
	sender := addChatClient(hub, room, "Ana")
	peer := addChatClient(hub, room, "Beto")

	hub.handleChatMessage(sender, models.ChatMessagePayload{Message: "hola a todos"})

	msg := nextMessage(t, sender)
	assert.Equal(t, "error", msg.Type, "en un mapa público no hay chat de sala")
	assertSilent(t, peer)
}

func TestRoomChatSkipsBlockedPeers(t *testing.T) {
	hub, room := newChatRoom("mission", false)
	sender := addChatClient(hub, room, "Ana")
	blocker := addChatClient(hub, room, "Beto")
	bystander := addChatClient(hub, room, "Caro")

	// Beto bloqueó a Ana: no recibe sus mensajes, y a Ana no se le avisa.
	blocker.SetBlocked(sender.ID.String(), true)

	hub.handleChatMessage(sender, models.ChatMessagePayload{Message: "hola"})

	assertSilent(t, blocker)
	assert.Equal(t, MsgChatBroadcast, nextMessage(t, bystander).Type, "el resto sí lo recibe")
	assert.Equal(t, MsgChatBroadcast, nextMessage(t, sender).Type, "el emisor recibe su propio eco, sin señal del bloqueo")
}

func TestRoomChatIgnoresBlankMessages(t *testing.T) {
	hub, room := newChatRoom("mission", false)
	sender := addChatClient(hub, room, "Ana")
	peer := addChatClient(hub, room, "Beto")

	hub.handleChatMessage(sender, models.ChatMessagePayload{Message: "   \t\n  "})

	assertSilent(t, sender)
	assertSilent(t, peer)
}

func TestRoomChatIgnoredWhenClientHasNoRoom(t *testing.T) {
	hub, room := newChatRoom("mission", false)
	orphan := addChatClient(hub, room, "Ana")
	orphan.RoomID = "" // aún no ha entrado a ninguna sala

	hub.handleChatMessage(orphan, models.ChatMessagePayload{Message: "hola"})

	assertSilent(t, orphan)
}
