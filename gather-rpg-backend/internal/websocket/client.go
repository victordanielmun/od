package websocket

import (
	"encoding/json"
	"log"
	"time"

	"gather-rpg-backend/internal/models"

	"github.com/gofiber/contrib/websocket"
	"github.com/google/uuid"
	"golang.org/x/time/rate"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

type Client struct {
	Hub         *Hub
	Conn        *websocket.Conn
	ID          uuid.UUID
	Username    string
	CharacterID string
	RoomID      string
	ChallengeID string

	// Buffered channel of outbound messages.
	send chan []byte

	// Rate Limiter for position updates
	// 20 updates per second, burst of 20
	PosLimiter *rate.Limiter

	// Current position (for AI and proximity)
	X         float64
	Y         float64
	Anim      string

	// Combat (server-authoritative): HP del jugador, i-frames y muerte.
	HP           int
	HPMax        int
	IsDead       bool
	LastDamageAt time.Time
	LastHealAt   time.Time

	// Maná persistente (server-authoritative). Se carga de PlayerStats al entrar a una
	// sala y se persiste al gastarlo (hechizos/arrojadizos) — fuente única de verdad,
	// compartida con el inventario (pociones de maná) y la barra del HUD/Sidebar.
	MP    int
	MPMax int
}

func NewClient(hub *Hub, conn *websocket.Conn, id uuid.UUID, username string) *Client {
	return &Client{
		Hub:        hub,
		Conn:       conn,
		ID:         id,
		Username:   username,
		send:       make(chan []byte, 256),
		PosLimiter: rate.NewLimiter(rate.Limit(20), 20),
		HP:         100,
		HPMax:      100,
		MP:         50,
		MPMax:      50,
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error { c.Conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			} else {
				// Log normal closures too for debugging
				log.Printf("Client disconnected (normal): %v", err)
			}
			break
		}
		c.Hub.HandleMessage(c, message)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)
			w.Write([]byte{'\n'}) // Ensure newline after first message

			// Add queued chat messages to the current websocket message.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(<-c.send)
				w.Write([]byte{'\n'}) // Ensure newline after each queued message
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) SendJSON(v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("Error marshalling JSON: %v", err)
		return
	}
	select {
	case c.send <- data:
	default:
		log.Println("Client buffer full, dropping message")
	}
}

func (c *Client) SendError(msg string) {
	c.SendJSON(models.WSMessage{
		Type:    "error",
		Payload: map[string]string{"message": msg},
	})
}

func (c *Client) Close() {
	close(c.send)
}
