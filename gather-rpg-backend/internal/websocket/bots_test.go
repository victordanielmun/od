package websocket

import (
	"encoding/json"
	"testing"
	"time"

	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// Los bots del lobby son presencia, no clientes de sala: pasean, se difunden con
// el resto de posiciones y NO participan en nada de lo que hace un jugador real
// dentro de la sala (aforo, cierre, objetivos de los enemigos, voz). Estos tests
// fijan ese contrato.
//
// Qué escena lleva bots ya NO lo decide la sala: sale de la columna scene_key de
// su configuración, que resuelve el hub antes de pasarle las fichas.

func newBotRoom(t *testing.T, sceneKey string) *Room {
	t.Helper()
	room := &Room{
		ID:            uuid.New().String(),
		SceneKey:      sceneKey,
		Clients:       make(map[*Client]bool),
		ActiveEnemies: make(map[uuid.UUID]*models.ActiveEnemy),
		stopAI:        make(chan bool),
		mapW:          2000,
		mapH:          2000,
	}
	return room
}

// testSpecs son las fichas con las que los tests pueblan una sala, en lugar de
// leerlas de `ai_players`. La sala no sabe de BD: recibe fichas ya resueltas.
func testSpecs(n int) []BotSpec {
	names := []string{"Mia", "Leo", "Sofia", "Noah", "Emma"}
	specs := make([]BotSpec, 0, n)
	for i := 0; i < n && i < len(names); i++ {
		specs = append(specs, BotSpec{
			AIPlayerID:  uint(i + 1),
			UserID:      uuid.New(),
			Username:    names[i],
			CharacterID: "1",
		})
	}
	return specs
}

func addWatcher(room *Room) *Client {
	c := &Client{
		ID:   uuid.New(),
		X:    1000,
		Y:    1000,
		Anim: "idle",
		send: make(chan []byte, 256),
	}
	room.Clients[c] = true
	return c
}

func TestNoBotsConfiguredMeansNoBots(t *testing.T) {
	room := newBotRoom(t, "mission_forest")
	room.EnsureBots(nil, 1000, 1000)
	assert.False(t, room.HasBots(), "una escena sin bots configurados se queda sin ellos")
}

func TestEnsureBotsIsIdempotent(t *testing.T) {
	room := newBotRoom(t, "lobby")
	specs := testSpecs(5)

	room.EnsureBots(specs, 1000, 1000)
	first := len(room.BotSnapshot())

	room.EnsureBots(specs, 1000, 1000)
	room.EnsureBots(specs, 1000, 1000)

	assert.Equal(t, first, len(room.BotSnapshot()), "entrar más gente no duplica los bots")
	assert.Equal(t, len(specs), first)
}

func TestBotsKeepTheirConfiguredIdentity(t *testing.T) {
	room := newBotRoom(t, "lobby")
	specs := testSpecs(3)
	room.EnsureBots(specs, 1000, 1000)

	got := room.BotSnapshot()
	assert.Len(t, got, 3)
	for i, b := range got {
		// La identidad en juego es la de su fila espejo en users: es la que el
		// cliente usará para abrirle chat, así que no puede ser inventada.
		assert.Equal(t, specs[i].UserID, b.ID, "el bot sale con su user_id, no con uno nuevo")
		assert.Equal(t, specs[i].AIPlayerID, b.AIPlayerID)
		assert.Equal(t, specs[i].Username, b.Username)
		assert.NotZero(t, b.VX+b.VY, "%s debe entrar en escena moviéndose, no plantado", b.Username)
	}
}

func TestBotsHonourConfiguredSpawnAnchor(t *testing.T) {
	room := newBotRoom(t, "lobby")
	specs := testSpecs(1)
	specs[0].SpawnX, specs[0].SpawnY = 300, 700

	room.EnsureBots(specs, 1000, 1000) // el ancla del jugador se ignora

	bot := room.BotSnapshot()[0]
	assert.Equal(t, 300.0, bot.HomeX, "con ancla configurada manda el admin")
	assert.Equal(t, 700.0, bot.HomeY)
}

func TestBotsWithoutAnchorSpawnNearThePlayer(t *testing.T) {
	room := newBotRoom(t, "lobby")
	room.EnsureBots(testSpecs(5), 1000, 1000)

	for _, b := range room.BotSnapshot() {
		dx, dy := b.HomeX-1000, b.HomeY-1000
		assert.Less(t, dx*dx+dy*dy, (botSpawnSpread*2)*(botSpawnSpread*2),
			"sin ancla configurada, %s aparece donde hay gente", b.Username)
	}
}

func TestBotsDoNotCountAsClients(t *testing.T) {
	room := newBotRoom(t, "lobby")
	room.EnsureBots(testSpecs(5), 1000, 1000)

	// Ni aforo, ni cierre de sala, ni objetivos de enemigos: todo eso se mide
	// sobre room.Clients, donde los bots no están.
	assert.Empty(t, room.Clients, "un bot no es un cliente de la sala")
	assert.Equal(t, 0, room.GetClientsCount())
}

func TestBotsAreBroadcastAsAIPlayers(t *testing.T) {
	room := newBotRoom(t, "lobby")
	watcher := addWatcher(room)
	specs := testSpecs(5)
	room.EnsureBots(specs, 1000, 1000)

	room.tickBots()

	select {
	case raw := <-watcher.send:
		var msg models.WSMessage
		assert.NoError(t, json.Unmarshal(raw, &msg))
		assert.Equal(t, MsgPositionsUpdate, msg.Type, "los bots viajan por la tubería de posiciones normal")

		payload := msg.Payload.(map[string]interface{})
		positions := payload["positions"].([]interface{})
		assert.Len(t, positions, len(specs))

		first := positions[0].(map[string]interface{})
		assert.Equal(t, true, first["is_ai"], "el cliente necesita distinguirlos de una persona real")
		assert.NotEmpty(t, first["username"])
		assert.NotEmpty(t, first["character_id"])
	default:
		t.Fatal("el jugador presente no recibió las posiciones de los bots")
	}
}

func TestBotsAreBroadcastEvenWhenPaused(t *testing.T) {
	room := newBotRoom(t, "lobby")
	watcher := addWatcher(room)
	specs := testSpecs(5)
	room.EnsureBots(specs, 1000, 1000)

	// Todos en pausa: no están en Redis ni en el Grid, así que si solo se
	// emitieran al moverse serían invisibles para quien acaba de entrar.
	for _, b := range room.bots {
		b.VX, b.VY = 0, 0
	}

	room.tickBots()

	select {
	case raw := <-watcher.send:
		var msg models.WSMessage
		assert.NoError(t, json.Unmarshal(raw, &msg))
		positions := msg.Payload.(map[string]interface{})["positions"].([]interface{})
		assert.Len(t, positions, len(specs), "un bot parado también se difunde")
	default:
		t.Fatal("un bot en pausa debe seguir difundiéndose")
	}
}

func TestBotsStayIdleWithNobodyWatching(t *testing.T) {
	room := newBotRoom(t, "lobby")
	room.EnsureBots(testSpecs(5), 1000, 1000)
	before := room.BotSnapshot()

	room.tickBots() // sala sin clientes

	after := room.BotSnapshot()
	for i := range before {
		assert.Equal(t, before[i].X, after[i].X, "sin nadie delante no hace falta simular")
		assert.Equal(t, before[i].Y, after[i].Y)
	}
}

func TestBotsWanderWithoutLeavingTheMap(t *testing.T) {
	room := newBotRoom(t, "lobby")
	addWatcher(room)
	room.EnsureBots(testSpecs(5), 1000, 1000)

	// Peor caso: un tramo larguísimo sin relevo (los ticks del test corren en
	// microsegundos, así que la caducidad por reloj no llega a saltar). Ni así
	// puede salirse del mapa.
	for i := 0; i < 600; i++ {
		room.tickBots()
	}

	for _, b := range room.BotSnapshot() {
		assert.GreaterOrEqual(t, b.X, 0.0, "%s se salió del mapa", b.Username)
		assert.LessOrEqual(t, b.X, room.mapW)
		assert.GreaterOrEqual(t, b.Y, 0.0)
		assert.LessOrEqual(t, b.Y, room.mapH)
	}
}

func TestBotsWanderStaysNearHome(t *testing.T) {
	room := newBotRoom(t, "lobby")
	addWatcher(room)
	room.EnsureBots(testSpecs(5), 1000, 1000)

	// Forzar el relevo de tramo en cada tick es lo que simula el paso del tiempo:
	// así se ejercita el retorno hacia el ancla, que es lo que impide que el paseo
	// acabe llevándolos a la otra punta del mapa.
	for i := 0; i < 400; i++ {
		for _, b := range room.bots {
			b.Until = time.Time{}
		}
		room.tickBots()
	}

	for _, b := range room.BotSnapshot() {
		dx, dy := b.X-b.HomeX, b.Y-b.HomeY
		assert.Less(t, dx*dx+dy*dy, (wanderRadius*2)*(wanderRadius*2),
			"%s se fue demasiado lejos de su punto de aparición", b.Username)
	}
}

func TestBotsAreNotTargetedByEnemies(t *testing.T) {
	room := newBotRoom(t, "lobby")
	room.EnsureBots(testSpecs(5), 1000, 1000)

	// Un enemigo pegado a los bots, sin ningún jugador real en la sala.
	bots := room.BotSnapshot()
	enemy := &models.ActiveEnemy{
		InstanceID: uuid.New(),
		X:          bots[0].X + 20, Y: bots[0].Y,
		HomeX: bots[0].X, HomeY: bots[0].Y,
		HP: 100, HPMax: 100,
		FSMState: "wander", Speed: 120, AttackRate: 1000, Damage: 10,
		Type: EnemyTypeMelee,
	}
	room.ActiveEnemies[enemy.InstanceID] = enemy

	room.tickAI()

	assert.Empty(t, enemy.TargetID, "un bot no es objetivo válido: los enemigos se eligen sobre room.Clients")
	assert.NotEqual(t, "attack", enemy.FSMState)
	assert.NotEqual(t, "chase", enemy.FSMState)
}
