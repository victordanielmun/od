package websocket

import (
	"log"
	"math"
	"sort"
	"sync"
	"time"

	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/spatial"

	"github.com/google/uuid"
)

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
	Broadcast  chan *models.WSMessage // Local broadcast channel if needed, or Hub handles it

	// Combat
	ActiveEnemies map[uuid.UUID]*models.ActiveEnemy
	aiTicker      *time.Ticker
	stopAI        chan bool

	mu sync.RWMutex
}

func NewRoom(id string, mapData *models.MapData) *Room {
	r := &Room{
		ID:            id,
		Clients:       make(map[*Client]bool),
		Grid:          spatial.NewSpatialGrid(),
		MapData:       mapData,
		MaxUsers:      50, // Default
		ActiveEnemies: make(map[uuid.UUID]*models.ActiveEnemy),
		stopAI:        make(chan bool),
	}

	r.initializeEnemies()
	r.startAILoop()

	return r
}

func (r *Room) initializeEnemies() {
	if r.MapData == nil || len(r.MapData.Enemies) == 0 {
		return
	}

	for _, e := range r.MapData.Enemies {
		instanceID := uuid.New()
		
		// Use e.NPCID as the primary asset identifier for the frontend.
		// If EnemyID is Nil (not set by editor), we still have a valid instance.
		enemyID := e.EnemyID
		if enemyID == uuid.Nil {
			enemyID = uuid.New()
		}

		r.ActiveEnemies[instanceID] = &models.ActiveEnemy{
			InstanceID: instanceID,
			EnemyID:    enemyID,
			X:          e.SpawnX,
			Y:          e.SpawnY,
			HP:         100, // Default HP, could be loaded from template in the future
			HPMax:      100,
			FSMState:   "idle",
			WaveNum:    e.WaveNum,
			NPCID:      e.NPCID,
			SpriteID:   e.SpriteID,
		}
	}
	log.Printf("[Room %s] Initialized %d enemies from MapData (Enemies count: %d)", r.ID, len(r.ActiveEnemies), len(r.MapData.Enemies))
}

func (r *Room) startAILoop() {
	r.aiTicker = time.NewTicker(100 * time.Millisecond)
	go func() {
		for {
			select {
			case <-r.aiTicker.C:
				r.tickAI()
			case <-r.stopAI:
				return
			}
		}
	}()
}

func (r *Room) tickAI() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.ActiveEnemies) == 0 || len(r.Clients) == 0 {
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
	eligibleClients := make([]*Client, 0)
	for client := range r.Clients {
		if client.Anim == "die" || client.Anim == "dead" {
			continue // Ignorar jugadores muertos
		}
		if busyPlayers[client.ID.String()] {
			continue // Ignorar jugadores ocupados en cartas ninja
		}
		eligibleClients = append(eligibleClients, client)
	}

	eligibleEnemies := make([]*models.ActiveEnemy, 0)
	for _, enemy := range r.ActiveEnemies {
		if enemy.FSMState == "dead" || enemy.FSMState == "ninja_card" {
			// Enemigos muertos o en estado de carta ninja no participan en la reasignación
			continue
		}
		eligibleEnemies = append(eligibleEnemies, enemy)
	}

	// 3. Emparejamiento codicioso (Greedy) basado en distancias
	type enemyPlayerPair struct {
		enemy  *models.ActiveEnemy
		client *Client
		dist   float64
	}

	pairs := make([]enemyPlayerPair, 0)
	for _, enemy := range eligibleEnemies {
		for _, client := range eligibleClients {
			dist := math.Sqrt(math.Pow(enemy.X-client.X, 2) + math.Pow(enemy.Y-client.Y, 2))
			if dist < 500.0 { // Rango de detección de 500px
				pairs = append(pairs, enemyPlayerPair{
					enemy:  enemy,
					client: client,
					dist:   dist,
				})
			}
		}
	}

	// Ordenar pares por distancia ascendente
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].dist < pairs[j].dist
	})

	// Asignación de objetivos de forma que a lo sumo un enemigo ataque a un jugador
	assignedEnemies := make(map[uuid.UUID]bool)
	assignedClients := make(map[string]bool)
	enemyTargets := make(map[uuid.UUID]*Client)

	for _, pair := range pairs {
		if assignedEnemies[pair.enemy.InstanceID] || assignedClients[pair.client.ID.String()] {
			continue
		}
		assignedEnemies[pair.enemy.InstanceID] = true
		assignedClients[pair.client.ID.String()] = true
		enemyTargets[pair.enemy.InstanceID] = pair.client
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

		targetClient, assigned := enemyTargets[enemy.InstanceID]
		if assigned && targetClient != nil {
			enemy.FSMState = "chase"
			enemy.TargetID = targetClient.ID.String()

			// Moverse hacia el jugador (velocidad 12px por tick de 100ms)
			dx := targetClient.X - enemy.X
			dy := targetClient.Y - enemy.Y
			angle := math.Atan2(dy, dx)
			
			dist := math.Sqrt(dx*dx + dy*dy)
			speed := 12.0
			if dist > 90 { // No solapar por completo (distancia de ataque de 90px)
				enemy.X += math.Cos(angle) * speed
				enemy.Y += math.Sin(angle) * speed
			} else if !attackTargets[targetClient.ID.String()] {
				enemy.FSMState = "attack"
				attackTargets[targetClient.ID.String()] = true
			} else {
				enemy.FSMState = "idle"
			}
		} else {
			enemy.FSMState = "idle"
			enemy.TargetID = ""
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
