package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"gather-rpg-backend/internal/database"
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

	// Buffered channel of outbound messages. Cerrado exactamente una vez por
	// Close(); closed+closeMu protegen cada envío para que un broadcast tardío
	// jamás escriba en un canal cerrado (esa carrera paniqueaba y tumbaba el
	// servidor entero).
	send    chan []byte
	closeMu sync.RWMutex
	closed  bool

	// IsAI marca a los jugadores gobernados por el servidor (los bots de charla
	// del lobby). No tienen socket: Conn es nil, así que NUNCA se les arrancan
	// ReadPump/WritePump ni se les manda un close frame. Se registran solo en el
	// índice clientsByID del hub —jamás en room.Clients— porque lo único que
	// necesitan es que un mensaje privado sepa encontrarlos.
	IsAI bool

	// inbox recibe lo que a un jugador normal le llegaría por el socket. Sin él,
	// un SendJSON a un bot llenaría su canal de salida (256 mensajes) y el hub
	// empezaría a soltar "Client buffer full" en bucle, porque nadie lo drena.
	inbox func(*models.WSMessage)

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

	// Tregua de entrada: hasta este instante los enemigos no lo eligen como
	// objetivo ni le hacen daño. Se fija al entrar a una sala para que nadie
	// aparezca ya rodeado (ver combatGracePeriod).
	CombatGraceUntil time.Time

	// Maná persistente (server-authoritative). Se carga de PlayerStats al entrar a una
	// sala y se persiste al gastarlo (hechizos/arrojadizos) — fuente única de verdad,
	// compartida con el inventario (pociones de maná) y la barra del HUD/Sidebar.
	MP    int
	MPMax int

	// blocked: usuarios que ESTE cliente bloqueó (moderación). Se carga de la
	// tabla user_blocks antes de registrar el cliente y se actualiza en caliente
	// desde el handler HTTP de bloqueo. Protegido porque lo leen los loops de
	// proximidad y los handlers sociales desde goroutines distintas.
	blockedMu sync.RWMutex
	blocked   map[string]bool

	// Nivel de inglés cacheado (ver getChallengeForClient en hub_combat.go): sin
	// esto, cada golpe letal pagaba una consulta a UserLearningProfile en el
	// camino caliente entre "el enemigo se congela" y "aparece la Ninja Card".
	// TTL corto (no indefinido) porque el nivel puede subir a mitad de sesión
	// (ver GetRandomChallengeFromPool / auto level-up por XP); así una subida de
	// nivel se refleja en minutos, no requiere reconectar.
	englishLevelMu        sync.RWMutex
	englishLevel          models.DifficultyLevel
	englishLevelFetchedAt time.Time
}

const englishLevelCacheTTL = 30 * time.Second

// CachedEnglishLevel devuelve el nivel cacheado si sigue vigente (dentro del TTL).
func (c *Client) CachedEnglishLevel() (models.DifficultyLevel, bool) {
	c.englishLevelMu.RLock()
	defer c.englishLevelMu.RUnlock()
	if c.englishLevelFetchedAt.IsZero() || time.Since(c.englishLevelFetchedAt) > englishLevelCacheTTL {
		return "", false
	}
	return c.englishLevel, true
}

// SetCachedEnglishLevel guarda el nivel recién leído de la DB y resetea el TTL.
func (c *Client) SetCachedEnglishLevel(level models.DifficultyLevel) {
	c.englishLevelMu.Lock()
	defer c.englishLevelMu.Unlock()
	c.englishLevel = level
	c.englishLevelFetchedAt = time.Now()
}

// HasBlocked reporta si este cliente bloqueó al usuario dado.
func (c *Client) HasBlocked(userID string) bool {
	c.blockedMu.RLock()
	defer c.blockedMu.RUnlock()
	return c.blocked[userID]
}

// SetBlocked actualiza en caliente el estado de bloqueo hacia un usuario
// (lo llama el hub cuando el handler HTTP crea/elimina un bloqueo).
func (c *Client) SetBlocked(userID string, blocked bool) {
	c.blockedMu.Lock()
	defer c.blockedMu.Unlock()
	if c.blocked == nil {
		c.blocked = make(map[string]bool)
	}
	if blocked {
		c.blocked[userID] = true
	} else {
		delete(c.blocked, userID)
	}
}

// LoadBlocks carga desde la DB el set de usuarios bloqueados por este cliente.
// Se llama de forma síncrona en HandleWS ANTES de registrar el cliente en el
// hub, así no hay carrera con los lectores (aún nadie conoce al cliente).
func (c *Client) LoadBlocks() {
	if database.DB == nil {
		return
	}
	var blocks []models.UserBlock
	if err := database.DB.Where("blocker_id = ?", c.ID).Find(&blocks).Error; err != nil {
		log.Printf("[Blocks] Failed to load blocks for user %s: %v", c.ID, err)
		return
	}
	m := make(map[string]bool, len(blocks))
	for _, b := range blocks {
		m[b.BlockedID.String()] = true
	}
	c.blockedMu.Lock()
	c.blocked = m
	c.blockedMu.Unlock()
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

// NewAIClient crea el cliente que representa a un bot. No hay socket al otro
// lado: todo lo que le "envíe" el servidor va a su inbox, que es su cerebro.
func NewAIClient(hub *Hub, id uuid.UUID, username, characterID string, inbox func(*models.WSMessage)) *Client {
	return &Client{
		Hub:         hub,
		ID:          id,
		Username:    username,
		CharacterID: characterID,
		IsAI:        true,
		inbox:       inbox,
		// Sin socket no hay canal de salida que drenar, pero se deja creado para
		// que cualquier ruta que lo toque por descuido no encuentre un nil.
		send: make(chan []byte, 1),
	}
}

func (c *Client) SendJSON(v interface{}) {
	// Los bots no tienen socket: el mensaje va a su cerebro y nunca al canal de
	// salida. En una goroutine aparte porque responder implica llamar al LLM y
	// esto se invoca desde el hilo del hub.
	if c.IsAI {
		if c.inbox != nil {
			if msg, ok := v.(*models.WSMessage); ok {
				go c.inbox(msg)
			}
		}
		return
	}

	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("Error marshalling JSON: %v", err)
		return
	}
	// El read-lock coexiste con otros envíos pero excluye a Close(): un send a
	// canal cerrado panicearía incluso dentro del select.
	c.closeMu.RLock()
	defer c.closeMu.RUnlock()
	if c.closed {
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

// Close cierra el canal de salida una sola vez. Idempotente: el write-lock
// espera a que terminen los SendJSON en curso y el flag hace que cualquier
// envío o cierre posterior sea un no-op silencioso.
func (c *Client) Close() {
	c.closeMu.Lock()
	defer c.closeMu.Unlock()
	if c.closed {
		return
	}
	c.closed = true
	close(c.send)
}

// CloseSessionReplaced es el close code (rango 4000+ reservado a la aplicación)
// que recibe una conexión cuando el mismo usuario se conecta desde otro lugar.
// El frontend NO debe auto-reconectar al verlo: si dos pestañas reconectan tras
// cada kick se patean mutuamente para siempre (ping-pong infinito).
const CloseSessionReplaced = 4001

// NotifySessionReplaced envía el close frame con ese código antes de que el hub
// desregistre la conexión pateada. WriteControl es seguro en concurrencia con
// WritePump, así que puede llamarse desde la goroutine del hub.
func (c *Client) NotifySessionReplaced() {
	deadline := time.Now().Add(writeWait)
	if err := c.Conn.WriteControl(websocket.CloseMessage,
		websocket.FormatCloseMessage(CloseSessionReplaced, "session replaced"), deadline); err != nil {
		log.Printf("[Client] Failed to send session-replaced close frame to %s: %v", c.ID, err)
	}
}
