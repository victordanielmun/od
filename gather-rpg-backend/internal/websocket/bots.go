package websocket

import (
	"log"
	"math/rand"
	"os"
	"strconv"
	"time"

	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
)

// Jugadores con IA del lobby: "gente" que se pasea por el mapa para que nunca
// esté vacío.
//
// La decisión de diseño que lo hace barato: un bot NO es un *Client. No tiene
// socket, no está en room.Clients ni en el Grid ni en Redis. Es solo una
// posición que la sala difunde junto a las de los jugadores reales, y el cliente
// la pinta como a cualquier otro porque el frontend no valida identidades (ver
// PlayerManager.handlePlayersUpdate). De ahí se sigue, gratis y sin código
// defensivo, que los bots:
//
//   - no cuentan para el aforo de la sala ni impiden que se cierre al vaciarse,
//   - no entran en el reparto de objetivos de los enemigos (tickAI recorre
//     room.Clients),
//   - no aparecen en el descubrimiento de pares de voz, así que jamás dejan a
//     un jugador con una conexión WebRTC a medio abrir contra nadie.
//
// Cuando los bots tengan conversación (fase 2) harán falta dos cosas más: una
// fila en `users` y registrarlos en el índice clientsByID del hub, que es lo que
// permite enrutarles un mensaje privado.

// BotSpec es la ficha con la que la sala instancia un bot. La construye el hub a
// partir de la fila de `ai_players`, para que la sala no sepa nada de la BD.
//
// UserID es la identidad con la que sale en el juego: la misma de su fila espejo
// en `users`. Tiene que ser esa y no una inventada, porque es la que el cliente
// usará para abrirle una ventana de chat.
type BotSpec struct {
	AIPlayerID  uint
	UserID      uuid.UUID
	Username    string
	CharacterID string
	SpawnX      float64
	SpawnY      float64
}

const (
	// Radio en el que se reparten los bots alrededor del ancla de aparición.
	botSpawnSpread = 420.0
	// Velocidad de paseo en px por tick (el bucle va a 100 ms). Es deliberadamente
	// más lenta que la de un jugador: dan la sensación de estar dando una vuelta,
	// no de ir a algún sitio.
	botWanderSpeed = 3.2
	// Escena en la que viven. El resto de mapas no lleva bots.
	botScene = "lobby"
)

// LobbyBot es un jugador simulado: identidad, posición y estado del paseo.
type LobbyBot struct {
	// AIPlayerID apunta a su fila de configuración; ID es su identidad en el
	// juego (la de su fila espejo en `users`), con la que se le abre el chat.
	AIPlayerID  uint
	ID          uuid.UUID
	Username    string
	CharacterID string

	X, Y         float64
	HomeX, HomeY float64

	// Tramo de paseo en curso (misma mecánica que el deambular de los enemigos).
	VX, VY float64
	Until  time.Time

	Direction string
	Anim      string
}

// lobbyBotLimit acota cuántos bots poblar, por encima de lo que haya configurado
// en BD. AI_LOBBY_BOTS=0 los apaga por completo: es la palanca para desactivarlos
// en producción sin desplegar código ni tocar la configuración.
func lobbyBotLimit(available int) int {
	raw := os.Getenv("AI_LOBBY_BOTS")
	if raw == "" {
		return available
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return available
	}
	if n > available {
		return available
	}
	return n
}

// EnsureBots puebla la sala con los bots configurados, la primera vez que entra
// alguien. Es idempotente: las siguientes llamadas no hacen nada.
//
// Las fichas llegan ya resueltas desde el hub (que las lee de `ai_players`), para
// que la sala no tenga que saber nada de la base de datos.
func (r *Room) EnsureBots(specs []BotSpec, anchorX, anchorY float64) {
	count := lobbyBotLimit(len(specs))
	if count == 0 {
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.bots != nil {
		return
	}

	now := time.Now()
	r.bots = make([]*LobbyBot, 0, count)
	for i := 0; i < count; i++ {
		spec := specs[i]

		// Con ancla configurada (spawn_x/spawn_y) el bot aparece donde diga el
		// admin; sin ella se reparte alrededor de donde entra el jugador, que es
		// lo que hace que estén donde hay gente.
		x, y := spec.SpawnX, spec.SpawnY
		if x == 0 && y == 0 {
			x, y = r.findBotSpot(anchorX, anchorY)
		}

		bot := &LobbyBot{
			AIPlayerID:  spec.AIPlayerID,
			ID:          spec.UserID,
			Username:    spec.Username,
			CharacterID: spec.CharacterID,
			X:           x,
			Y:           y,
			HomeX:       x,
			HomeY:       y,
			Direction:   "right",
			Anim:        "idle",
		}
		// Nacen andando, no plantados, y con el tramo desfasado entre ellos para
		// que no arranquen todos a la vez como un pelotón.
		vx, vy, dur := r.pickWanderLeg(x, y, x, y, botWanderSpeed, true)
		bot.VX, bot.VY = vx, vy
		bot.Until = now.Add(dur + time.Duration(rand.Intn(700))*time.Millisecond)
		r.bots = append(r.bots, bot)
	}

	log.Printf("[Room %s] %s: %d jugadores con IA en escena", r.ID, r.SceneKey, len(r.bots))
}

// findBotSpot busca un punto libre alrededor del ancla. Debe llamarse con r.mu
// tomado. Si tras varios intentos no encuentra hueco devuelve el propio ancla:
// un bot mal colocado se recoloca solo en cuanto empieza a pasear.
func (r *Room) findBotSpot(anchorX, anchorY float64) (float64, float64) {
	for i := 0; i < 12; i++ {
		x := anchorX + (rand.Float64()*2-1)*botSpawnSpread
		y := anchorY + (rand.Float64()*2-1)*botSpawnSpread
		if r.canStandAt(x, y) {
			return x, y
		}
	}
	return anchorX, anchorY
}

// HasBots indica si la sala ya tiene bots poblados.
func (r *Room) HasBots() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.bots) > 0
}

// BotSnapshot devuelve una copia del estado de los bots (para tests y para el
// difusor, sin exponer los punteros internos).
func (r *Room) BotSnapshot() []LobbyBot {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]LobbyBot, 0, len(r.bots))
	for _, b := range r.bots {
		out = append(out, *b)
	}
	return out
}

// tickBots avanza el paseo de todos los bots y difunde sus posiciones. Se llama
// desde el mismo bucle que la IA de enemigos.
//
// Se difunde en CADA tick, también cuando el bot está en pausa, y a propósito:
// los bots no están en Redis ni en el Grid, así que no salen en el
// positions_snapshot que recibe quien acaba de entrar. Si solo emitiéramos al
// moverse, un bot parado sería invisible para el recién llegado hasta que le
// tocara reanudar el paseo.
func (r *Room) tickBots() {
	now := time.Now()

	r.mu.Lock()
	if len(r.bots) == 0 || len(r.Clients) == 0 {
		r.mu.Unlock()
		return
	}

	// Los destinatarios se capturan bajo el lock y el envío se hace fuera: así no
	// se lee r.Clients en paralelo a un Add/RemoveClient.
	clients := make([]*Client, 0, len(r.Clients))
	for c := range r.Clients {
		clients = append(clients, c)
	}

	positions := make([]models.PlayerMovedBroadcast, 0, len(r.bots))
	for _, b := range r.bots {
		if now.After(b.Until) {
			vx, vy, dur := r.pickWanderLeg(b.X, b.Y, b.HomeX, b.HomeY, botWanderSpeed, false)
			b.VX, b.VY = vx, vy
			b.Until = now.Add(dur)
		}

		moving := b.VX != 0 || b.VY != 0
		if moving {
			nx, ny := b.X+b.VX, b.Y+b.VY
			if r.canStandAt(nx, ny) {
				b.X, b.Y = nx, ny
			} else {
				// Se topó con el terreno a mitad de tramo: cortar y rectificar el
				// rumbo ya, en vez de empujar contra el vacío hasta que venza el
				// temporizador.
				vx, vy, dur := r.pickWanderLeg(b.X, b.Y, b.HomeX, b.HomeY, botWanderSpeed, true)
				b.VX, b.VY = vx, vy
				b.Until = now.Add(dur)
				moving = false
			}
		}

		b.Anim = "idle"
		if moving {
			b.Anim = "walk"
			if b.VX < 0 {
				b.Direction = "left"
			} else if b.VX > 0 {
				b.Direction = "right"
			}
		}

		positions = append(positions, models.PlayerMovedBroadcast{
			UserID:      b.ID,
			RoomID:      r.ID,
			X:           b.X,
			Y:           b.Y,
			Direction:   b.Direction,
			Anim:        b.Anim,
			IsMoving:    moving,
			Username:    b.Username,
			CharacterID: b.CharacterID,
			IsAI:        true,
			Timestamp:   now.UnixMilli(),
		})
	}
	r.mu.Unlock()

	msg := &models.WSMessage{
		Type: MsgPositionsUpdate,
		Payload: map[string]interface{}{
			"positions": positions,
		},
	}
	for _, c := range clients {
		c.SendJSON(msg)
	}
}
