package websocket

import (
	"testing"
	"time"

	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// El ciclo de un enemigo es: deambula → persigue al acercarse el jugador →
// golpea en rango → mientras dura el golpe NO se desplaza → al terminar vuelve a
// perseguir. Y con varios enemigos, solo uno tiene el turno sobre un jugador: el
// resto deambula en vez de amontonarse encima. Estos tests fijan ese contrato.

// newAIRoom crea una sala vacía (sin bucle de IA propio: los tests llaman a
// tickAI a mano) con un cliente colocado en (x, y).
func newAIRoom(t *testing.T, clientX, clientY float64) (*Room, *Client) {
	t.Helper()
	room := &Room{
		ID:            uuid.New().String(),
		Clients:       make(map[*Client]bool),
		ActiveEnemies: make(map[uuid.UUID]*models.ActiveEnemy),
		stopAI:        make(chan bool),
	}
	client := &Client{
		ID:   uuid.New(),
		X:    clientX,
		Y:    clientY,
		Anim: "idle",
		send: make(chan []byte, 256),
	}
	room.Clients[client] = true
	return room, client
}

func addEnemy(room *Room, x, y float64) *models.ActiveEnemy {
	e := &models.ActiveEnemy{
		InstanceID: uuid.New(),
		EnemyID:    uuid.New(),
		X:          x, Y: y,
		HomeX: x, HomeY: y,
		HP: 100, HPMax: 100,
		FSMState:   "wander",
		Speed:      120,
		AttackRate: 1000,
		Damage:     10,
		Type:       EnemyTypeMelee,
	}
	room.beginWanderLeg(e, time.Now(), true)
	room.ActiveEnemies[e.InstanceID] = e
	return e
}

func TestEnemySpawnsWandering(t *testing.T) {
	room := NewRoom(uuid.New().String(), &models.MapData{
		Width: 2000, Height: 2000,
		Enemies: []models.EnemySpawn{{SpawnX: 500, SpawnY: 500, HP: 50, Type: EnemyTypeMelee}},
	})
	defer room.Close()

	assert.Len(t, room.ActiveEnemies, 1)
	for _, e := range room.ActiveEnemies {
		assert.Equal(t, "wander", e.FSMState, "un enemigo recién aparecido debe estar deambulando, no plantado")
		assert.Equal(t, 500.0, e.HomeX)
		assert.NotZero(t, e.WanderVX+e.WanderVY, "el primer tramo del paseo debe ser de avance")
	}
}

func TestEnemyWandersWhileNoPlayerIsNear(t *testing.T) {
	room, _ := newAIRoom(t, 5000, 5000) // jugador lejísimos (fuera de detectRange)
	enemy := addEnemy(room, 500, 500)

	room.tickAI()

	assert.Contains(t, []string{"wander", "idle"}, enemy.FSMState)
	assert.Empty(t, enemy.TargetID, "sin jugador cerca no debe fijar objetivo")
}

func TestEnemyWanderStaysNearHome(t *testing.T) {
	room, _ := newAIRoom(t, 5000, 5000)
	enemy := addEnemy(room, 500, 500)

	// Muchos ticks seguidos: el paseo no puede alejarlo del mapa.
	for i := 0; i < 400; i++ {
		enemy.WanderUntil = time.Time{} // fuerza tramo nuevo en cada tick
		room.tickAI()
	}

	dx, dy := enemy.X-enemy.HomeX, enemy.Y-enemy.HomeY
	dist := dx*dx + dy*dy
	assert.Less(t, dist, (wanderRadius*2)*(wanderRadius*2),
		"el paseo debe mantenerse en el entorno del punto de aparición")
}

func TestEnemyChasesThenAttacksAndStaysPutDuringSwing(t *testing.T) {
	room, client := newAIRoom(t, 1000, 1000)
	enemy := addEnemy(room, 700, 1000) // a 300px: dentro de detectRange, fuera de rango de golpe

	// 1. Persecución: se acerca al jugador.
	room.tickAI()
	assert.Equal(t, "chase", enemy.FSMState)
	assert.Greater(t, enemy.X, 700.0, "en chase debe avanzar hacia el jugador")

	// 2. Pegado al jugador → golpea.
	enemy.X = 950
	room.tickAI()
	assert.Equal(t, "attack", enemy.FSMState)
	assert.True(t, enemy.AttackUntil.After(time.Now()), "el golpe debe abrir una ventana de compromiso")

	// 3. Mientras dura la animación del golpe no se mueve ni cambia de estado,
	//    aunque el jugador se aleje.
	posX, posY := enemy.X, enemy.Y
	client.X = 1600 // el jugador se retira en mitad del swing
	room.tickAI()
	assert.Equal(t, "attack", enemy.FSMState)
	assert.Equal(t, posX, enemy.X, "no debe desplazarse mientras ejecuta el golpe")
	assert.Equal(t, posY, enemy.Y)
}

func TestEnemyResumesChaseAfterSwing(t *testing.T) {
	room, client := newAIRoom(t, 1000, 1000)
	enemy := addEnemy(room, 950, 1000)

	room.tickAI() // entra en attack
	assert.Equal(t, "attack", enemy.FSMState)

	// El jugador se aleja y el compromiso caduca: debe volver a perseguir.
	client.X = 1300
	enemy.AttackUntil = time.Now().Add(-time.Millisecond)
	room.tickAI()

	assert.Equal(t, "chase", enemy.FSMState, "terminada la animación vuelve a perseguir")
	assert.Greater(t, enemy.X, 950.0)
}

func TestOnlyOneEnemyEngagesAPlayerTheRestWander(t *testing.T) {
	room, _ := newAIRoom(t, 1000, 1000)
	a := addEnemy(room, 950, 1000)
	b := addEnemy(room, 960, 1010)
	c := addEnemy(room, 940, 990)

	room.tickAI()

	attackers := 0
	wanderers := 0
	for _, e := range []*models.ActiveEnemy{a, b, c} {
		switch e.FSMState {
		case "attack", "chase":
			attackers++
		case "wander", "idle":
			wanderers++
			assert.Empty(t, e.TargetID, "el que no tiene el turno no debe conservar objetivo")
		}
	}
	assert.Equal(t, 1, attackers, "solo un enemigo puede engancharse a un jugador")
	assert.Equal(t, 2, wanderers, "los demás se retiran a deambular")
}

func TestEngagedPlayerIsNotReassignedMidSwing(t *testing.T) {
	room, _ := newAIRoom(t, 1000, 1000)
	a := addEnemy(room, 950, 1000)
	b := addEnemy(room, 960, 1010)

	room.tickAI() // uno de los dos entra en attack y queda comprometido

	var attacker, other *models.ActiveEnemy
	if a.FSMState == "attack" {
		attacker, other = a, b
	} else {
		attacker, other = b, a
	}
	assert.Equal(t, "attack", attacker.FSMState)

	// Durante el swing del primero, el segundo no puede tomar al mismo jugador.
	room.tickAI()
	assert.Equal(t, "attack", attacker.FSMState)
	assert.NotEqual(t, "attack", other.FSMState, "no pueden pegarle dos a la vez al mismo jugador")
	assert.NotEqual(t, "chase", other.FSMState, "el que espera turno deambula, no se queda encima")
}

func TestEnemyIgnoresPlayerDuringEntryGrace(t *testing.T) {
	room, client := newAIRoom(t, 1000, 1000)
	client.CombatGraceUntil = time.Now().Add(5 * time.Second)
	enemy := addEnemy(room, 950, 1000)

	room.tickAI()

	assert.Contains(t, []string{"wander", "idle"}, enemy.FSMState,
		"durante la tregua de entrada el jugador no es objetivo válido")
	assert.Empty(t, enemy.TargetID)
}

func TestAttackCommitmentIsAFractionOfTheCadence(t *testing.T) {
	// Nunca el ciclo entero: si no, el enemigo se quedaría plantado entre golpes.
	assert.Equal(t, attackCommitMax, attackCommitment(0), "sin cadencia definida usa el máximo")
	assert.Equal(t, attackCommitMin, attackCommitment(100), "cadencias muy rápidas tienen suelo")
	assert.Equal(t, attackCommitMax, attackCommitment(5000), "cadencias lentas tienen techo")
	assert.Equal(t, 600*time.Millisecond, attackCommitment(1000))
}

// ── Cadencia real entre golpes ──────────────────────────────────────────────
// AttackUntil solo cubre lo que dura el swing (una fracción, con tope de 600ms).
// Sin un cooldown aparte el enemigo reatacaba en cuanto acababa la animación,
// así que un enemigo configurado a 2000ms golpeaba cada 600ms: el AttackRate del
// admin no significaba nada.

func TestEnemyDoesNotReattackUntilItsCadenceElapses(t *testing.T) {
	room, _ := newAIRoom(t, 1000, 1000)
	enemy := addEnemy(room, 950, 1000) // en rango de golpe
	enemy.AttackRate = 2000

	room.tickAI()
	assert.Equal(t, "attack", enemy.FSMState)
	assert.True(t, enemy.NextAttackAt.After(time.Now().Add(1500*time.Millisecond)),
		"la recarga debe durar el AttackRate completo, no lo que dura el swing")

	// Terminada la animación pero aún recargando: NO vuelve a atacar.
	enemy.AttackUntil = time.Now().Add(-time.Millisecond)
	room.tickAI()
	assert.Equal(t, "chase", enemy.FSMState, "durante la recarga persigue, no golpea")

	// Vencida la recarga, vuelve a golpear.
	enemy.NextAttackAt = time.Now().Add(-time.Millisecond)
	room.tickAI()
	assert.Equal(t, "attack", enemy.FSMState)
}

func TestEnemyBacksOffWhileReloading(t *testing.T) {
	room, _ := newAIRoom(t, 1000, 1000)
	enemy := addEnemy(room, 950, 1000)
	enemy.AttackRate = 2000

	room.tickAI() // ataca
	enemy.AttackUntil = time.Now().Add(-time.Millisecond)

	before := enemy.X
	room.tickAI() // recargando: debe separarse
	assert.Equal(t, "chase", enemy.FSMState)
	assert.Less(t, enemy.X, before, "en la recarga se aparta en vez de quedarse pegado")
}

// ── El deambular respeta el terreno ─────────────────────────────────────────
// El servidor decide la posición de los enemigos, así que si no conoce los
// vacíos del editor los pasea por encima del agujero y fuera del mapa.

func TestWanderStaysInsideTheMap(t *testing.T) {
	room, _ := newAIRoom(t, 5000, 5000) // jugador lejísimos: nadie persigue
	room.SetLayout(`{"width":400,"height":400,"voids":[],"walls":[],"colliders":[]}`)
	enemy := addEnemy(room, 350, 350)

	for i := 0; i < 200; i++ {
		room.tickAI()
		assert.GreaterOrEqual(t, enemy.X, 0.0)
		assert.GreaterOrEqual(t, enemy.Y, 0.0)
		assert.LessOrEqual(t, enemy.X, 400.0)
		assert.LessOrEqual(t, enemy.Y, 400.0)
	}
}

func TestWanderNeverStepsOnAVoid(t *testing.T) {
	room, _ := newAIRoom(t, 5000, 5000)
	// Celda (1,1) —el bloque que va de 100 a 200 en ambos ejes— es un vacío.
	room.SetLayout(`{"width":600,"height":600,"voids":[{"x":150,"y":150}],"walls":[],"colliders":[]}`)
	enemy := addEnemy(room, 250, 150) // justo al lado del agujero

	for i := 0; i < 300; i++ {
		room.tickAI()
		assert.False(t, cellOf(enemy.X, enemy.Y) == [2]int{1, 1},
			"deambuló sobre el vacío en (%.0f, %.0f)", enemy.X, enemy.Y)
	}
}

func TestLayoutIsOptional(t *testing.T) {
	// Sin SetLayout (mapas antiguos o walls_json ilegible) el paseo sigue
	// funcionando: solo pierde la comprobación de terreno.
	room, _ := newAIRoom(t, 5000, 5000)
	enemy := addEnemy(room, 300, 300)

	assert.NotPanics(t, func() {
		for i := 0; i < 50; i++ {
			room.tickAI()
		}
	})
	assert.Contains(t, []string{"wander", "idle"}, enemy.FSMState)
}

// ── Briefing: el mapa se queda quieto mientras se lee el letrero ────────────
// No basta con que el enemigo no te apunte: seguía deambulando por encima
// mientras el jugador leía la misión.

func TestEnemiesFreezeDuringEntryGrace(t *testing.T) {
	room, client := newAIRoom(t, 5000, 5000) // jugador lejos: nadie persigue
	client.CombatGraceUntil = time.Now().Add(5 * time.Second)
	enemy := addEnemy(room, 300, 300)

	x, y := enemy.X, enemy.Y
	for i := 0; i < 30; i++ {
		room.tickAI()
	}

	assert.Equal(t, "idle", enemy.FSMState, "durante el briefing el enemigo está quieto")
	assert.Equal(t, x, enemy.X, "no debe desplazarse mientras dura la tregua")
	assert.Equal(t, y, enemy.Y)
}

func TestEnemiesResumeAfterTheGrace(t *testing.T) {
	room, client := newAIRoom(t, 5000, 5000)
	client.CombatGraceUntil = time.Now().Add(5 * time.Second)
	enemy := addEnemy(room, 300, 300)

	room.tickAI()
	assert.Equal(t, "idle", enemy.FSMState)

	// Terminada la tregua vuelve a deambular.
	client.CombatGraceUntil = time.Now().Add(-time.Millisecond)
	room.tickAI()
	assert.Contains(t, []string{"wander", "idle"}, enemy.FSMState)
}

// En cooperativo, alguien que entra tarde NO debe congelar el combate en curso.
func TestALateJoinerDoesNotFreezeAnOngoingFight(t *testing.T) {
	room, veteran := newAIRoom(t, 1000, 1000)
	veteran.CombatGraceUntil = time.Now().Add(-time.Second) // ya lleva rato dentro

	newcomer := &Client{
		ID: uuid.New(), X: 1005, Y: 1005, Anim: "idle",
		send:             make(chan []byte, 256),
		CombatGraceUntil: time.Now().Add(5 * time.Second),
	}
	room.Clients[newcomer] = true

	enemy := addEnemy(room, 950, 1000)
	room.tickAI()

	assert.NotEqual(t, "idle", enemy.FSMState, "el combate del veterano sigue vivo")
	assert.Equal(t, veteran.ID.String(), enemy.TargetID, "y apunta al que ya no está en tregua")
}
