package websocket

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"sort"
	"sync"
	"time"

	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/spatial"

	"github.com/google/uuid"
)

// Arquetipos de enemigo. La regla de exclusividad ("un solo enemigo ataca a
// cada jugador a la vez") aplica a melee y fast; el thrower (a distancia) y el
// boss (su propio state machine en tickBossLocked, fuera de este mecanismo)
// pueden atacar en paralelo con quien tenga el turno.
const (
	EnemyTypeMelee   = "melee"
	EnemyTypeThrower = "thrower"
	EnemyTypeFast    = "fast"
	EnemyTypeBoss    = "boss"
)

// needsAttackExclusivity indica si el enemigo usa la regla de exclusividad (un
// atacante por jugador). Melee y fast la aplican (y el valor vacío por
// compatibilidad); thrower queda exceptuado a propósito (ataca a distancia,
// no le "quita el turno" a nadie cuerpo a cuerpo).
func needsAttackExclusivity(t string) bool {
	return t == EnemyTypeMelee || t == EnemyTypeFast || t == ""
}

type Room struct {
	ID         string
	Clients    map[*Client]bool
	Grid       *spatial.SpatialGrid
	MapData    *models.MapData
	SceneKey   string
	Type       string
	InviteCode string
	MaxUsers   int
	MissionID  uint
	// IsPublic replica el campo homónimo de la fila de BD. Hace falta en memoria
	// porque de él cuelga el canal de grupo (ver IsGroupInstance): el PIN no sirve
	// como señal de privacidad, ya que una sala rehidratada desde BD podría no
	// traerlo. Por defecto true, igual que la columna.
	IsPublic bool
	Broadcast  chan *models.WSMessage // Local broadcast channel if needed, or Hub handles it

	// Combat
	ActiveEnemies map[uuid.UUID]*models.ActiveEnemy
	aiTicker      *time.Ticker
	stopAI        chan bool

	// Waves (oleadas): los enemigos se spawnean por oleada. La wave N+1 aparece
	// cuando todos los enemigos de la wave N han muerto.
	CurrentWave   int                   // número de la oleada activa (1-based); 0 = sin iniciar
	MaxWave       int                   // mayor wave_num presente en el mapa
	PendingSpawns []models.EnemySpawn   // enemigos de oleadas futuras, aún no spawneados
	NextWaveAt    time.Time             // si no es cero, momento en que aparece la siguiente oleada

	// Sesión de retos (Ninja Cards) por jugador. Vive en memoria mientras dura la
	// sala: las salas de combate son efímeras, así que la "sesión" es la estancia.
	askedChallenges map[string][]uuid.UUID          // playerID → retos ya emitidos (no repetir)
	examWorldID     map[string]uint                 // playerID → mundo que está examinando (0/ausente = no es examen)
	examStats       map[string]map[string]models.TagStat // playerID → tag temático → aciertos/total

	// Jugadores con IA que pueblan el lobby (ver bots.go). No son clientes: no
	// ocupan plaza, no son objetivo de los enemigos y no entran en la voz.
	bots []*LobbyBot

	// Terreno para el deambular. El cliente ya impide que el JUGADOR pise vacíos
	// y muros (ver PlayerManager.isBlockedAt); el servidor necesita lo mismo o
	// pasea a los enemigos por encima del vacío y fuera del mapa, porque es él
	// quien decide su posición. Se rellena con SetLayout al crear la sala.
	blockedCells map[[2]int]bool
	mapW, mapH   float64

	mu sync.RWMutex
}

func NewRoom(id string, mapData *models.MapData) *Room {
	r := &Room{
		ID:            id,
		Clients:       make(map[*Client]bool),
		Grid:          spatial.NewSpatialGrid(),
		MapData:       mapData,
		MaxUsers:      50,   // Default
		IsPublic:      true, // Default, igual que la columna de BD
		ActiveEnemies: make(map[uuid.UUID]*models.ActiveEnemy),
		stopAI:        make(chan bool),

		askedChallenges: make(map[string][]uuid.UUID),
		examWorldID:     make(map[string]uint),
		examStats:       make(map[string]map[string]models.TagStat),
	}

	r.initializeEnemies()
	r.startAILoop()

	return r
}

// IsGroupInstance distingue las salas donde la gente ha venido JUNTA a lo suyo de
// los mapas abiertos por los que cualquiera pasa. De este único predicado cuelgan
// los dos canales de grupo, y por eso van siempre de la mano:
//
//   - Voz en malla ("sala de reuniones"): todos se oyen a volumen máximo sin
//     importar la distancia, en vez de por proximidad.
//   - Chat de sala: un mensaje llega a todos los presentes (ver handleChatMessage).
//
// Son de grupo las cooperativas y CUALQUIER instancia privada: quien entra con un
// PIN viene con su gente. En un mapa público la conversación es 1:1 a propósito —
// ni voz de sala ni chat abierto — para que un sitio por el que pasan desconocidos
// no se convierta en un canal donde todos escriben a todos.
//
// Competitivo queda fuera aunque sea privado: comparten mapa, pero están corriendo
// una carrera el uno contra el otro, no celebrando una reunión.
func (r *Room) IsGroupInstance() bool {
	if r.Type == roomTypeCompetitive {
		return false
	}
	return r.Type == roomTypeCooperative || !r.IsPublic
}

func (r *Room) initializeEnemies() {
	if r.MapData == nil || len(r.MapData.Enemies) == 0 {
		return
	}

	// Copiar los spawns como pendientes, normalizando wave_num (0/sin asignar → 1)
	// y calculando la wave mínima y máxima del mapa.
	r.PendingSpawns = make([]models.EnemySpawn, 0, len(r.MapData.Enemies))
	minWave, maxWave := 0, 0
	for _, e := range r.MapData.Enemies {
		if e.WaveNum < 1 {
			e.WaveNum = 1
		}
		if minWave == 0 || e.WaveNum < minWave {
			minWave = e.WaveNum
		}
		if e.WaveNum > maxWave {
			maxWave = e.WaveNum
		}
		r.PendingSpawns = append(r.PendingSpawns, e)
	}
	if minWave == 0 {
		minWave = 1
	}
	r.MaxWave = maxWave

	// Spawnear solo la primera oleada; el resto queda en PendingSpawns.
	spawned := r.spawnWave(minWave)
	r.CurrentWave = minWave
	log.Printf("[Room %s] Waves init: spawned wave %d/%d (%d enemies); %d pending",
		r.ID, r.CurrentWave, r.MaxWave, spawned, len(r.PendingSpawns))
}

// spawnWave instancia los enemigos cuya wave_num coincide y los retira de
// PendingSpawns. Devuelve cuántos spawneó. Debe llamarse con r.mu bloqueado
// (o durante init, sin concurrencia).
func (r *Room) spawnWave(waveNum int) int {
	count := 0
	kept := make([]models.EnemySpawn, 0, len(r.PendingSpawns))
	for _, e := range r.PendingSpawns {
		if e.WaveNum != waveNum {
			kept = append(kept, e)
			continue
		}

		instanceID := uuid.New()
		enemyID := e.EnemyID
		if enemyID == uuid.Nil {
			enemyID = uuid.New()
		}
		// Fallbacks si el editor no fijó stats (evita enemigos con 0 daño/HP).
		hp := e.HP
		if hp <= 0 {
			hp = 100
		}
		damage := e.Damage
		if damage <= 0 {
			damage = 10
		}
		speed := e.Speed
		if speed <= 0 {
			speed = 90
		}
		attackRate := e.AttackRate
		if attackRate <= 0 {
			attackRate = 1200
		}
		enemyType := e.Type
		if enemyType == "" {
			enemyType = EnemyTypeMelee
		}

		// El tipo 'fast' garantiza ataques y movimiento más rápidos que el melee,
		// aunque el editor no haya afinado los valores.
		if enemyType == EnemyTypeFast {
			if attackRate > 500 {
				attackRate = 500
			}
			if speed < 150 {
				speed = 150
			}
		}

		// El boss es un jefe: HP mínimo alto si el editor no lo afinó.
		if enemyType == EnemyTypeBoss && hp < 300 {
			hp = 300
		}

		// Defaults de boss para maná / regen / heal de card.
		manaMax := e.ManaMax
		manaRegen := e.ManaRegen
		hpRegen := e.HPRegen
		cardFailHealPct := e.CardFailHealPct
		if enemyType == EnemyTypeBoss {
			if manaMax <= 0 {
				manaMax = 100
			}
			if manaRegen <= 0 {
				manaRegen = 10
			}
			if cardFailHealPct <= 0 {
				cardFailHealPct = 100
			}
		}

		enemy := &models.ActiveEnemy{
			InstanceID: instanceID,
			EnemyID:    enemyID,
			X:          e.SpawnX,
			Y:          e.SpawnY,
			HomeX:      e.SpawnX,
			HomeY:      e.SpawnY,
			HP:         hp,
			HPMax:      hp,
			// Nace deambulando, no plantado: el primer tramo es de avance.
			FSMState:   "wander",
			WaveNum:    waveNum,
			NPCID:      e.NPCID,
			SpriteID:   e.SpriteID,
			Damage:     damage,
			Speed:      speed,
			AttackRate: attackRate,
			Type:       enemyType,
			ProjectileSprite: e.ProjectileSprite,
			ManaMax:          manaMax,
			Mana:             manaMax, // empieza con maná lleno
			ManaRegen:        manaRegen,
			HPRegen:          hpRegen,
			CardFailHealPct:  cardFailHealPct,
		}
		r.beginWanderLeg(enemy, time.Now(), true)
		r.ActiveEnemies[instanceID] = enemy
		count++
	}
	r.PendingSpawns = kept
	return count
}

// waveSpawnDelay es la pausa entre que se limpia una oleada y aparece la siguiente.
const waveSpawnDelay = 2 * time.Second

// Ventana en la que un enemigo queda clavado tras iniciar un ataque (lo que dura
// el swing en el cliente). Es una FRACCIÓN de su cadencia, nunca el ciclo entero:
// si durase todo el AttackRate el enemigo se quedaría plantado entre golpe y
// golpe en vez de reposicionarse. Los límites evitan que los lentos se congelen
// y que los rápidos alcancen a moverse en mitad de la animación.
const (
	attackCommitMin = 250 * time.Millisecond
	attackCommitMax = 600 * time.Millisecond
)

func attackCommitment(attackRateMs int) time.Duration {
	if attackRateMs <= 0 {
		return attackCommitMax
	}
	d := time.Duration(float64(attackRateMs)*0.6) * time.Millisecond
	if d < attackCommitMin {
		return attackCommitMin
	}
	if d > attackCommitMax {
		return attackCommitMax
	}
	return d
}

// Deambular: un enemigo sin objetivo no se queda plantado, se pasea alrededor de
// su punto de aparición en tramos cortos de avance y pausa. Es el estado por
// defecto (al aparecer y al perder/ceder el objetivo), y a lo que vuelven los
// enemigos que no tienen el turno de ataque sobre un jugador.
const (
	wanderRadius     = 160.0 // px máximos de separación respecto a HomeX/HomeY
	wanderSpeedRatio = 0.35  // fracción de su velocidad de persecución
	// Rejilla del editor de mapas: los tiles se colocan en 50, 150, 250… es decir
	// celdas de 100px cuyo centro cae en el múltiplo + 50. Mismo criterio que
	// snapToGrid en PlayerManager del cliente.
	terrainGrid = 100.0
)

// cellOf devuelve la celda de rejilla que ocupa una posición.
func cellOf(x, y float64) [2]int {
	return [2]int{int(math.Floor(x / terrainGrid)), int(math.Floor(y / terrainGrid))}
}

// mapLayout es el subconjunto de walls_json que le importa al servidor: el
// tamaño del mapa y las capas que bloquean el paso. `forest` NO bloquea (es
// decoración), igual que en el cliente.
type mapLayout struct {
	Width     float64     `json:"width"`
	Height    float64     `json:"height"`
	Voids     []tileCoord `json:"voids"`
	Walls     []tileCoord `json:"walls"`
	Colliders []tileCoord `json:"colliders"`
}

type tileCoord struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// SetLayout carga los límites y las celdas intransitables del mapa desde el
// walls_json del editor. Sin esto el deambular ignora el terreno.
func (r *Room) SetLayout(wallsJSON string) {
	if wallsJSON == "" {
		return
	}
	var layout mapLayout
	if err := json.Unmarshal([]byte(wallsJSON), &layout); err != nil {
		log.Printf("[Room %s] walls_json ilegible, el deambular no respetará el terreno: %v", r.ID, err)
		return
	}

	blocked := make(map[[2]int]bool)
	for _, group := range [][]tileCoord{layout.Voids, layout.Walls, layout.Colliders} {
		for _, t := range group {
			blocked[cellOf(t.X, t.Y)] = true
		}
	}

	r.mu.Lock()
	r.blockedCells = blocked
	if layout.Width > 0 {
		r.mapW = layout.Width
	}
	if layout.Height > 0 {
		r.mapH = layout.Height
	}
	r.mu.Unlock()

	log.Printf("[Room %s] Terreno cargado: %.0fx%.0f, %d celdas bloqueadas", r.ID, layout.Width, layout.Height, len(blocked))
}

// canStandAt indica si un enemigo puede ocupar esa posición: dentro del mapa y
// fuera de las celdas bloqueadas. Debe llamarse con r.mu tomado (el tick de IA
// ya lo está). Sin terreno cargado solo comprueba los límites.
func (r *Room) canStandAt(x, y float64) bool {
	if r.mapW > 0 && (x < 0 || x > r.mapW) {
		return false
	}
	if r.mapH > 0 && (y < 0 || y > r.mapH) {
		return false
	}
	if r.blockedCells == nil {
		return true
	}
	return !r.blockedCells[cellOf(x, y)]
}

// pickWanderLeg elige el siguiente tramo del paseo para algo que se pasea
// alrededor de un ancla: devuelve su velocidad (0,0 = pausa) y cuánto dura.
// La geometría es la misma para los enemigos y para los jugadores con IA del
// lobby, así que vive aquí una sola vez.
//
// forceMove garantiza un tramo de avance (se usa al aparecer, para entrar en
// escena moviéndose). Un tramo se descarta si lleva contra un vacío o fuera del
// mapa: se prueban ocho direcciones y, si ninguna sirve (arrinconado), sale una
// pausa. Debe llamarse con r.mu tomado (canStandAt lee el terreno).
func (r *Room) pickWanderLeg(x, y, homeX, homeY, speed float64, forceMove bool) (vx, vy float64, dur time.Duration) {
	pause := func() (float64, float64, time.Duration) {
		return 0, 0, time.Duration(600+rand.Intn(1000)) * time.Millisecond
	}

	// 40% de los tramos son pausas: sin ellas el paseo parece una patrulla mecánica.
	if !forceMove && rand.Float64() < 0.4 {
		return pause()
	}

	if speed <= 0 {
		speed = 4.0
	}

	// Si se ha alejado de casa, el tramo apunta de vuelta (con algo de dispersión)
	// para que el paseo no lo lleve hasta la otra punta del mapa.
	baseAngle := rand.Float64() * 2 * math.Pi
	dx, dy := x-homeX, y-homeY
	if math.Sqrt(dx*dx+dy*dy) > wanderRadius {
		baseAngle = math.Atan2(-dy, -dx) + (rand.Float64()-0.5)*math.Pi/2
	}

	// Se mira un poco por delante (no solo el píxel siguiente) para no empezar un
	// tramo que choque de inmediato contra el borde de un vacío.
	const lookahead = terrainGrid / 2

	for i := 0; i < 8; i++ {
		angle := baseAngle + float64(i)*(math.Pi/4)
		if r.canStandAt(x+math.Cos(angle)*lookahead, y+math.Sin(angle)*lookahead) {
			return math.Cos(angle) * speed,
				math.Sin(angle) * speed,
				time.Duration(800+rand.Intn(1000)) * time.Millisecond
		}
	}

	// Rodeado de vacío por los ocho lados: quedarse quieto es mejor que colarse.
	return pause()
}

// beginWanderLeg aplica el siguiente tramo del paseo a un enemigo.
func (r *Room) beginWanderLeg(e *models.ActiveEnemy, now time.Time, forceMove bool) {
	vx, vy, dur := r.pickWanderLeg(e.X, e.Y, e.HomeX, e.HomeY, e.Speed*0.1*wanderSpeedRatio, forceMove)
	e.WanderVX, e.WanderVY = vx, vy
	e.WanderUntil = now.Add(dur)
}

// tickWanderLocked avanza el paseo de un enemigo sin objetivo. Debe llamarse con
// r.mu bloqueado. Devuelve el FSMState que corresponde: "wander" mientras avanza
// e "idle" en las pausas, para que el cliente anime caminar o reposo.
func (r *Room) tickWanderLocked(e *models.ActiveEnemy, now time.Time) string {
	if now.After(e.WanderUntil) {
		r.beginWanderLeg(e, now, false)
	}
	if e.WanderVX == 0 && e.WanderVY == 0 {
		return "idle"
	}

	nx, ny := e.X+e.WanderVX, e.Y+e.WanderVY
	if !r.canStandAt(nx, ny) {
		// Se topó con el terreno a mitad de tramo: cortar y elegir otro rumbo ya,
		// en vez de empujar contra el vacío hasta que venza el temporizador.
		r.beginWanderLeg(e, now, true)
		return "idle"
	}

	e.X, e.Y = nx, ny
	return "wander"
}

// advanceWavesLocked spawnea la siguiente oleada cuando la actual está limpia.
// Debe llamarse con r.mu bloqueado.
func (r *Room) advanceWavesLocked() {
	if r.MaxWave == 0 {
		return // sin enemigos/waves en este mapa
	}
	// ¿Quedan oleadas por spawnear?
	if len(r.PendingSpawns) == 0 {
		return
	}

	// ¿Todos los enemigos de la oleada actual están muertos?
	for _, e := range r.ActiveEnemies {
		if e.FSMState != "dead" {
			// Aún hay enemigos vivos; cancelar cualquier temporizador pendiente.
			r.NextWaveAt = time.Time{}
			return
		}
	}

	// Oleada limpia y quedan más. Esperar el delay antes de spawnear.
	now := time.Now()
	if r.NextWaveAt.IsZero() {
		r.NextWaveAt = now.Add(waveSpawnDelay)
		return
	}
	if now.Before(r.NextWaveAt) {
		return
	}
	r.NextWaveAt = time.Time{}

	// Purgar enemigos muertos de la oleada anterior (el cliente ya los quitó).
	for id, e := range r.ActiveEnemies {
		if e.FSMState == "dead" {
			delete(r.ActiveEnemies, id)
		}
	}

	next := r.nextPendingWaveAfter(r.CurrentWave)
	if next == 0 {
		return
	}
	spawned := r.spawnWave(next)
	r.CurrentWave = next
	log.Printf("[Room %s] Wave %d/%d spawned (%d enemies)", r.ID, r.CurrentWave, r.MaxWave, spawned)
	r.broadcastWaveStarted()
}

// nextPendingWaveAfter devuelve la menor wave_num pendiente mayor que current, o 0.
func (r *Room) nextPendingWaveAfter(current int) int {
	next := 0
	for _, e := range r.PendingSpawns {
		if e.WaveNum > current && (next == 0 || e.WaveNum < next) {
			next = e.WaveNum
		}
	}
	return next
}

// broadcastWaveStarted notifica a la sala que empezó una nueva oleada.
// Debe llamarse con r.mu bloqueado (consistente con el resto del tick).
func (r *Room) broadcastWaveStarted() {
	r.broadcastToAll(&models.WSMessage{
		Type: MsgWaveStarted,
		Payload: map[string]interface{}{
			"room_id":      r.ID,
			"current_wave": r.CurrentWave,
			"max_wave":     r.MaxWave,
		},
	})
}

func (r *Room) startAILoop() {
	r.aiTicker = time.NewTicker(100 * time.Millisecond)
	go func() {
		for {
			select {
			case <-r.aiTicker.C:
				r.tickAI()
				r.tickBots()
			case <-r.stopAI:
				return
			}
		}
	}()
}

// tickBossLocked decide el estado del boss según distancia y cooldowns.
// Debe llamarse con r.mu bloqueado (desde tickAI). El boss alterna persecución,
// combo melee (cerca), arrojadizo (rango medio) y una habilidad AoE (skill) con
// telegraph. El daño/efectos los aplica el cliente según fsm_state.
func (r *Room) tickBossLocked(e *models.ActiveEnemy, dist, angle, speed float64) {
	const bossMeleeRange = 120.0
	const bossThrowRange = 420.0
	const chargeCooldown = 5 * time.Second
	const skillTelegraph = 900 * time.Millisecond
	const bossSkillManaCost = 30

	const chargeDuration = 600 * time.Millisecond
	const chargeSpeed = 45.0 // px/tick — embestida rápida

	now := time.Now()

	// Regeneración automática de maná/HP (cadencia de 1s). El maná habilita el
	// skill; el autoregen de HP es para bosses avanzados.
	if e.LastRegenAt.IsZero() {
		e.LastRegenAt = now
	}
	if secs := int(now.Sub(e.LastRegenAt) / time.Second); secs > 0 {
		if e.ManaRegen > 0 {
			e.Mana += e.ManaRegen * secs
			if e.Mana > e.ManaMax {
				e.Mana = e.ManaMax
			}
		}
		if e.HPRegen > 0 && e.HP < e.HPMax {
			e.HP += e.HPRegen * secs
			if e.HP > e.HPMax {
				e.HP = e.HPMax
			}
		}
		e.LastRegenAt = e.LastRegenAt.Add(time.Duration(secs) * time.Second)
	}

	// Si está ejecutando una acción en curso (skill o charge), mantenerla.
	// Durante el charge sigue avanzando en la dirección fijada al iniciarlo.
	if now.Before(e.BusyUntil) {
		if e.FSMState == "charge" {
			e.X += e.ChargeVX
			e.Y += e.ChargeVY
		}
		return
	}

	if dist > bossThrowRange {
		e.FSMState = "chase"
		e.X += math.Cos(angle) * speed
		e.Y += math.Sin(angle) * speed
		return
	}

	// Skill (AoE): gateado por MANÁ. Si no hay maná suficiente, no castea.
	if dist <= bossMeleeRange && e.Mana >= bossSkillManaCost {
		e.Mana -= bossSkillManaCost
		e.FSMState = "skill"
		e.BusyUntil = now.Add(skillTelegraph)
		return
	}

	// Tacleo (charge): gateado por cooldown, cuando el jugador está a media/larga.
	if dist > bossMeleeRange && now.After(e.NextAbilityAt) {
		e.FSMState = "charge"
		e.ChargeVX = math.Cos(angle) * chargeSpeed
		e.ChargeVY = math.Sin(angle) * chargeSpeed
		e.BusyUntil = now.Add(chargeDuration)
		e.NextAbilityAt = now.Add(chargeCooldown)
		return
	}

	// Recargando entre golpes: se reposiciona en vez de encadenar swings. Sin este
	// gate el boss reatacaba en cuanto acababa la animación, ignorando su cadencia.
	if now.Before(e.NextAttackAt) {
		e.FSMState = "chase"
		return
	}

	// Tiro y combo melee del boss: también se ejecutan clavado en el sitio (el
	// desplazamiento es cosa de chase/charge, no de los golpes).
	if dist > bossMeleeRange {
		e.FSMState = "throw"
	} else {
		e.FSMState = "attack" // combo melee
	}
	e.AttackUntil = now.Add(attackCommitment(e.AttackRate))
	e.NextAttackAt = now.Add(time.Duration(e.AttackRate) * time.Millisecond)
}

func (r *Room) tickAI() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.Clients) == 0 {
		return
	}

	// Avance de oleadas: si la wave actual está limpia y quedan más, spawnear la
	// siguiente (tras un breve delay). Va antes del early-return por si entre
	// oleadas no quedan enemigos vivos.
	r.advanceWavesLocked()

	if len(r.ActiveEnemies) == 0 {
		return
	}

	// 1. Identificar qué jugadores están ocupados con cartas ninja
	busyPlayers := make(map[string]bool)
	for _, enemy := range r.ActiveEnemies {
		if enemy.FSMState == "ninja_card" && enemy.PendingNinjaCard != "" {
			busyPlayers[enemy.PendingNinjaCard] = true
		}
	}

	// 2. Filtrar clientes y enemigos elegibles
	now := time.Now()
	eligibleClients := make([]*Client, 0)
	for client := range r.Clients {
		if client.Anim == "die" || client.Anim == "dead" {
			continue // Ignorar jugadores muertos
		}
		if busyPlayers[client.ID.String()] {
			continue // Ignorar jugadores ocupados en cartas ninja
		}
		if now.Before(client.CombatGraceUntil) {
			continue // Tregua de entrada: aún no es objetivo válido
		}
		eligibleClients = append(eligibleClients, client)
	}

	// Briefing: mientras TODOS los presentes están en su tregua de entrada, el
	// mapa se queda quieto. No basta con no asignarles objetivo —eso ya se hacía
	// arriba— porque los enemigos seguían deambulando mientras el jugador leía el
	// letrero de la misión. Se exige que estén todos: en cooperativo, alguien que
	// entra tarde no debe congelar un combate en curso.
	//
	// OJO: se comprueba la tregua explícitamente y NO "eligibleClients vacío".
	// Ese atajo también se cumplía con el jugador respondiendo una Ninja Card
	// (un jugador ocupado tampoco es elegible), y entonces esta rama tomaba el
	// control y dejaba fuera del broadcast al enemigo en 'ninja_card' → el
	// cliente lo daba por desaparecido ("Removing stale enemy") en mitad de la
	// pregunta.
	allInGrace := len(r.Clients) > 0
	for client := range r.Clients {
		if !now.Before(client.CombatGraceUntil) {
			allInGrace = false
			break
		}
	}

	if allInGrace {
		frozen := make([]models.ActiveEnemy, 0, len(r.ActiveEnemies))
		for _, enemy := range r.ActiveEnemies {
			// Muertos y cards se reenvían tal cual: si se omiten, el cliente los
			// elimina por ausencia.
			if enemy.FSMState == "dead" || enemy.FSMState == "ninja_card" {
				frozen = append(frozen, *enemy)
				continue
			}
			enemy.FSMState = "idle"
			enemy.TargetID = ""
			// Se aplaza el paseo para que al terminar el briefing arranque con un
			// tramo nuevo en vez de continuar uno vencido hace rato.
			enemy.WanderUntil = now
			frozen = append(frozen, *enemy)
		}
		if len(frozen) > 0 {
			r.broadcastToAll(&models.WSMessage{
				Type:    MsgEnemyUpdate,
				Payload: models.EnemyUpdateBroadcast{RoomID: r.ID, Enemies: frozen},
			})
		}
		return
	}

	// engagedClients: jugadores que ya tienen encima a un enemigo a media
	// estocada. Ese enemigo no entra en el reparto (está ocupado), así que sin
	// esto el reparto le adjudicaría el jugador a OTRO enemigo y acabarían
	// pegándole dos a la vez. Marcándolo, el segundo se queda deambulando hasta
	// que el primero termine.
	engagedClients := make(map[string]bool)
	eligibleEnemies := make([]*models.ActiveEnemy, 0)
	for _, enemy := range r.ActiveEnemies {
		if enemy.FSMState == "dead" || enemy.FSMState == "ninja_card" {
			// Enemigos muertos o en estado de carta ninja no participan en la reasignación
			continue
		}
		if now.Before(enemy.HurtUntil) {
			// Enemigo aturdido (hurt/knocked): no participa en la asignación de objetivos.
			continue
		}
		if now.Before(enemy.AttackUntil) {
			// Ejecutando un golpe: ocupado, y su objetivo sigue "cogido".
			if needsAttackExclusivity(enemy.Type) && enemy.TargetID != "" {
				engagedClients[enemy.TargetID] = true
			}
			continue
		}
		eligibleEnemies = append(eligibleEnemies, enemy)
	}

	// 3. Asignación de objetivos:
	//    - melee/fast: emparejamiento codicioso 1:1 (a lo sumo uno por jugador).
	//    - thrower/boss: cada uno persigue al jugador más cercano, SIN
	//      exclusividad (pueden engancharse al mismo jugador en simultáneo).
	enemyTargets := make(map[uuid.UUID]*Client)
	const detectRange = 500.0

	// 3a. Melee/fast — greedy 1:1.
	type enemyPlayerPair struct {
		enemy  *models.ActiveEnemy
		client *Client
		dist   float64
	}
	pairs := make([]enemyPlayerPair, 0)
	for _, enemy := range eligibleEnemies {
		if !needsAttackExclusivity(enemy.Type) {
			continue
		}
		for _, client := range eligibleClients {
			dist := math.Sqrt(math.Pow(enemy.X-client.X, 2) + math.Pow(enemy.Y-client.Y, 2))
			if dist < detectRange {
				pairs = append(pairs, enemyPlayerPair{enemy: enemy, client: client, dist: dist})
			}
		}
	}
	sort.Slice(pairs, func(i, j int) bool { return pairs[i].dist < pairs[j].dist })

	assignedEnemies := make(map[uuid.UUID]bool)
	// Los jugadores que ya están recibiendo un golpe arrancan como "cogidos":
	// mientras dure esa estocada nadie más se les asigna (los demás deambulan).
	assignedClients := engagedClients
	for _, pair := range pairs {
		if assignedEnemies[pair.enemy.InstanceID] || assignedClients[pair.client.ID.String()] {
			continue
		}
		assignedEnemies[pair.enemy.InstanceID] = true
		assignedClients[pair.client.ID.String()] = true
		enemyTargets[pair.enemy.InstanceID] = pair.client
	}

	// 3b. Thrower/boss — cada uno al jugador más cercano, sin exclusividad.
	for _, enemy := range eligibleEnemies {
		if needsAttackExclusivity(enemy.Type) {
			continue
		}
		var nearest *Client
		nearestDist := detectRange
		for _, client := range eligibleClients {
			dist := math.Sqrt(math.Pow(enemy.X-client.X, 2) + math.Pow(enemy.Y-client.Y, 2))
			if dist < nearestDist {
				nearest = client
				nearestDist = dist
			}
		}
		if nearest != nil {
			enemyTargets[enemy.InstanceID] = nearest
		}
	}

	// 4. Actualizar movimiento y FSM de todos los enemigos
	updates := make([]models.ActiveEnemy, 0)
	attackTargets := make(map[string]bool)

	for _, enemy := range r.ActiveEnemies {
		if enemy.FSMState == "dead" {
			continue
		}

		if enemy.FSMState == "ninja_card" {
			// Mantener estado y añadir a actualizaciones sin modificar posición
			updates = append(updates, *enemy)
			continue
		}

		// Stagger: mientras esté aturdido (hurt/knocked) no se mueve ni ataca;
		// se mantiene el estado para que el cliente reproduzca la animación.
		if now.Before(enemy.HurtUntil) {
			updates = append(updates, *enemy)
			continue
		}
		// El stun expiró: si seguía en hurt/knocked, limpiar para reanudar IA.
		if enemy.FSMState == "hurt" || enemy.FSMState == "knocked" {
			enemy.HurtUntil = time.Time{}
		}

		// Compromiso de ataque: el swing se ejecuta en el sitio. Mientras dura no
		// se reasigna objetivo ni se mueve, así el cliente no ve al enemigo
		// deslizándose con la animación de golpe puesta.
		if now.Before(enemy.AttackUntil) {
			// Sigue ocupando el turno de ataque sobre su objetivo: si no, otro melee/fast
			// podría colarse a golpear al mismo jugador durante el swing y se rompe
			// la regla de "un atacante por jugador".
			if enemy.FSMState == "attack" && needsAttackExclusivity(enemy.Type) && enemy.TargetID != "" {
				attackTargets[enemy.TargetID] = true
			}
			updates = append(updates, *enemy)
			continue
		}

		targetClient, assigned := enemyTargets[enemy.InstanceID]
		if assigned && targetClient != nil {
			enemy.FSMState = "chase"
			enemy.TargetID = targetClient.ID.String()

			dx := targetClient.X - enemy.X
			dy := targetClient.Y - enemy.Y
			angle := math.Atan2(dy, dx)
			dist := math.Sqrt(dx*dx + dy*dy)

			// Velocidad por tick (100ms) a partir de Speed (px/s); fallback 12px/tick.
			speed := enemy.Speed * 0.1
			if speed <= 0 {
				speed = 12.0
			}

			if enemy.Type == EnemyTypeBoss {
				r.tickBossLocked(enemy, dist, angle, speed)
			} else if enemy.Type == EnemyTypeThrower {
				// A distancia: si está lejos se acerca, si está demasiado cerca
				// retrocede (kiting), y en rango medio lanza proyectiles.
				const throwRange = 350.0
				const tooClose = 160.0
				if dist > throwRange {
					enemy.X += math.Cos(angle) * speed
					enemy.Y += math.Sin(angle) * speed
				} else if dist < tooClose {
					enemy.X -= math.Cos(angle) * speed
					enemy.Y -= math.Sin(angle) * speed
				} else if now.Before(enemy.NextAttackAt) {
					// Recargando: se mantiene a distancia en vez de disparar.
					enemy.FSMState = "chase"
				} else {
					// El lanzamiento también se ejecuta en el sitio: si no, el
					// thrower kitea mientras el cliente anima el tiro.
					enemy.FSMState = "throw"
					enemy.AttackUntil = now.Add(attackCommitment(enemy.AttackRate))
					enemy.NextAttackAt = now.Add(time.Duration(enemy.AttackRate) * time.Millisecond)
				}
			} else {
				const attackRange = 90.0
				// Retroceso durante la recarga: sin él el enemigo se queda pegado al
				// jugador con la animación de andar. Separarse y volver a acercarse es
				// lo que hace visible el ciclo perseguir → atacar → perseguir.
				const recoverRange = attackRange + 40.0

				switch {
				case dist > attackRange:
					enemy.X += math.Cos(angle) * speed
					enemy.Y += math.Sin(angle) * speed

				case now.Before(enemy.NextAttackAt):
					// En rango pero recargando: NO ataca. Cede el turno para que otro
					// melee/fast pueda entrar, y se aparta hasta la distancia de recuperación.
					enemy.FSMState = "chase"
					if dist < recoverRange {
						enemy.X -= math.Cos(angle) * speed
						enemy.Y -= math.Sin(angle) * speed
					}

				case needsAttackExclusivity(enemy.Type):
					// Melee/fast: a lo sumo un atacante por jugador a la vez (el thrower y
					// el boss quedan fuera de esta rama, ver comentario de la constante).
					// El que no tiene el turno no se queda plantado encima del jugador —
					// se retira a deambular hasta que le toque.
					if !attackTargets[targetClient.ID.String()] {
						enemy.FSMState = "attack"
						enemy.AttackUntil = now.Add(attackCommitment(enemy.AttackRate))
						enemy.NextAttackAt = now.Add(time.Duration(enemy.AttackRate) * time.Millisecond)
						attackTargets[targetClient.ID.String()] = true
					} else {
						enemy.TargetID = ""
						enemy.FSMState = r.tickWanderLocked(enemy, now)
					}

				default:
					// Ningún tipo actual cae aquí (thrower/boss se resuelven antes de
					// este switch, melee/fast entran al case de arriba): fallback
					// defensivo por si aparece un arquetipo nuevo sin clasificar.
					enemy.FSMState = "attack"
					enemy.AttackUntil = now.Add(attackCommitment(enemy.AttackRate))
					enemy.NextAttackAt = now.Add(time.Duration(enemy.AttackRate) * time.Millisecond)
				}
			}
		} else {
			// Sin objetivo (nadie cerca, o el jugador ya lo tiene cogido otro):
			// deambula alrededor de su punto de aparición.
			enemy.TargetID = ""
			enemy.FSMState = r.tickWanderLocked(enemy, now)
		}

		updates = append(updates, *enemy)
	}

	if len(updates) > 0 {
		log.Printf("[Room %s] Broadcasting updates for %d enemies to %d clients", r.ID, len(updates), len(r.Clients))
		msg := &models.WSMessage{
			Type: MsgEnemyUpdate,
			Payload: models.EnemyUpdateBroadcast{
				RoomID:  r.ID,
				Enemies: updates,
			},
		}
		r.broadcastToAll(msg)
	}
}

func (r *Room) broadcastToAll(msg *models.WSMessage) {
	// This is slightly inefficient if called every tick, 
	// but ok for room-scoped events
	for client := range r.Clients {
		client.SendJSON(msg)
	}
}

func (r *Room) Close() {
	if r.aiTicker != nil {
		r.aiTicker.Stop()
	}
	close(r.stopAI)
}

func (r *Room) AddClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Clients[client] = true
}

func (r *Room) RemoveClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Clients, client)
	// Also remove from Grid
	r.Grid.RemoveUser(client.ID.String())
}

func (r *Room) GetClientsCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Clients)
}

// releaseNinjaCardEnemy resetea un enemigo que estaba esperando la respuesta de
// una carta ninja para que vuelva a ser atacable. El golpe mortal nunca se
// aplicó, así que el enemigo conserva su HP actual (>0) y vuelve a perseguir.
// DEBE llamarse con r.mu ya bloqueado.
func (r *Room) releaseNinjaCardEnemy(enemy *models.ActiveEnemy) {
	enemy.FSMState = "idle"
	enemy.PendingNinjaCard = ""
	enemy.NinjaCardChallengeID = ""
	enemy.TargetID = ""
	if enemy.HP <= 0 {
		enemy.HP = 1
	}
}

// ReleaseNinjaCardsForPlayer libera todos los enemigos cuya carta ninja estaba
// pendiente para playerID (p. ej. al desconectarse o salir de la sala), evitando
// que queden bloqueados e inmatables para siempre.
func (r *Room) ReleaseNinjaCardsForPlayer(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, enemy := range r.ActiveEnemies {
		if enemy.FSMState == "ninja_card" && enemy.PendingNinjaCard == playerID {
			log.Printf("[NinjaCard] Releasing enemy %s locked by departed player %s", enemy.InstanceID, playerID)
			r.releaseNinjaCardEnemy(enemy)
		}
		// Boss card: quitar al jugador que se fue de los requeridos para que las
		// respuestas de los presentes puedan completar la card (si no, el backstop
		// de timeout la resuelve).
		if enemy.Type == EnemyTypeBoss && enemy.BossCardRequired != nil {
			delete(enemy.BossCardRequired, playerID)
			delete(enemy.BossCardResults, playerID)
		}
	}
}

// ReleaseStaleNinjaCard libera un enemigo concreto si sigue esperando la carta
// ninja del mismo jugador tras vencer el timeout. Devuelve true si lo liberó.
func (r *Room) ReleaseStaleNinjaCard(instanceID uuid.UUID, playerID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	enemy, ok := r.ActiveEnemies[instanceID]
	if !ok {
		return false
	}
	if enemy.FSMState == "ninja_card" && enemy.PendingNinjaCard == playerID {
		log.Printf("[NinjaCard] Timeout: releasing enemy %s after unanswered card from %s", instanceID, playerID)
		r.releaseNinjaCardEnemy(enemy)
		return true
	}
	return false
}
