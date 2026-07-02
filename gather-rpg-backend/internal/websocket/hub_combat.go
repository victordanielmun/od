package websocket

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

// ninjaCardTimeout es el tiempo máximo que un enemigo permanece bloqueado
// esperando la respuesta de una carta ninja antes de liberarse automáticamente.
const ninjaCardTimeout = 60 * time.Second

// playerIFrames: ventana de invulnerabilidad tras recibir daño (server-side).
const playerIFrames = 700 * time.Millisecond

// Curación por poción (server-side): cantidad fija y cooldown para acotar abuso.
const (
	playerHealAmount   = 30
	playerHealCooldown = 8 * time.Second
)

// Stagger: al ser golpeado el enemigo queda aturdido (no se mueve ni ataca) un
// breve tiempo. Golpes fuertes (>= strongHitDamage, p. ej. el finisher) provocan
// un "knocked" más largo.
const (
	hurtStunDuration    = 300 * time.Millisecond
	knockedStunDuration = 500 * time.Millisecond
	strongHitDamage     = 20
)

// attackDamage define el daño autoritativo por tipo de ataque. El servidor NO
// confía en ningún valor de daño enviado por el cliente (evita cheats); solo
// acepta el tipo de ataque y aplica el daño correspondiente de esta tabla.
var attackDamage = map[string]int{
	"basic":           10,
	"combo1":          10,
	"combo2":          12,
	"combo3_finisher": 20,
	"spell":           25, // genérico (fallback si el cliente no manda el subtipo)
	"fire_rain":       12, // hechizos: daño por tipo (coincide con los perfiles del cliente)
	"wave":            25,
	"nova":            40,
	"throw":           15,
}

// damageForAttack devuelve el daño autoritativo para un tipo de ataque dado.
// Tipos desconocidos o vacíos usan el daño base.
func damageForAttack(attackType string) int {
	if d, ok := attackDamage[attackType]; ok {
		return d
	}
	return 10
}

// throwDamageForItem busca server-side el daño de un arma arrojable a partir del
// ID del item (plantilla). El daño lo define el admin en effect_value; el cliente
// solo informa QUÉ item lanzó, nunca el valor del daño (sigue siendo autoritativo
// en el servidor y acotado a valores configurados por el admin). Devuelve 0 si el
// item no existe o no es un arrojable válido, para que el llamador use el default.
func throwDamageForItem(itemID string) int {
	if itemID == "" {
		return 0
	}
	id, err := uuid.Parse(itemID)
	if err != nil {
		return 0
	}
	var item models.Item
	if err := database.DB.First(&item, "id = ?", id).Error; err != nil {
		return 0
	}
	if item.ItemType != "throwable" || item.EffectValue <= 0 {
		return 0
	}
	return item.EffectValue
}

func (h *Hub) handleSelectClass(client *Client, payload interface{}) {
	var p struct {
		Class string `json:"character_class"`
	}
	parsePayload(payload, &p)

	stats, err := h.CombatService.SetClass(client.ID.String(), p.Class)
	if err != nil {
		client.SendError("Failed to set class: " + err.Error())
		return
	}

	client.SendJSON(&models.WSMessage{
		Type: MsgCharacterSelected,
		Payload: map[string]interface{}{
			"user_id": client.ID,
			"class":   stats.Class,
			"stats":   stats,
		},
	})
}

// processEnemyKill ejecuta toda la lógica de progreso de misiones tras la muerte
// de un enemigo: kills individuales (defeat_enemy / kill_boss) y kill_all,
// emitiendo los eventos WS correspondientes (enemy_kill_progress / mission_completed).
// Es compartida por la muerte normal y por la Ninja Card para que ambos caminos
// avancen el progreso de forma idéntica. Pensada para ejecutarse en su propio
// goroutine; gestiona internamente los locks de la sala.
func (h *Hub) processEnemyKill(killerUUID uuid.UUID, enemyTemplateID uuid.UUID, room *Room, roomID string, isBoss bool) {
	killerID := killerUUID.String()
	// El progreso de misión se scope por escena (no por la sala efímera).
	sceneKey := room.SceneKey
	log.Printf("[Combat] processEnemyKill | killer=%s | enemyTemplateID=%s | room=%s | scene=%s | boss=%v", killerID, enemyTemplateID, roomID, sceneKey, isBoss)

	// 1. Kills individuales (defeat_enemy / kill_boss).
	// Un boss es una pelea compartida: el crédito (kill_boss) va a TODOS los
	// jugadores del room. Un mob normal solo acredita al que lo mató.
	killCreditIDs := []uuid.UUID{killerUUID}
	isCoopRoom := room.Type == "cooperative"
	if isBoss || isCoopRoom {
		// Sala cooperativa: cualquier kill acredita a todo el equipo (el filtro
		// de asistencia en UpdateKillProgress limita eso a misiones coop).
		room.mu.RLock()
		killCreditIDs = make([]uuid.UUID, 0, len(room.Clients))
		for c := range room.Clients {
			killCreditIDs = append(killCreditIDs, c.ID)
		}
		room.mu.RUnlock()
	}
	for _, cid := range killCreditIDs {
		// Un boss sigue siendo pelea compartida en cualquier sala (isAssist=false
		// para todos); en coop, los no-killers son asistentes.
		isAssist := cid != killerUUID && !isBoss
		progressResults, err := h.MissionService.UpdateKillProgress(cid, enemyTemplateID, sceneKey, isBoss, isAssist)
		if err != nil {
			log.Printf("[Combat] UpdateKillProgress ERROR for user %s: %v", cid, err)
		}
		for _, res := range progressResults {
			if res.MissionDone {
				if mission, dbErr := h.MissionService.Repo.GetMissionByID(res.MissionID); dbErr == nil {
					h.SendToUser(cid.String(), &models.WSMessage{
						Type: MsgMissionCompleted,
						Payload: map[string]interface{}{
							"mission_id": res.MissionID,
							"title":      mission.Title,
						},
					})
				}
			} else {
				h.SendToUser(cid.String(), &models.WSMessage{
					Type: MsgEnemyKillProgress,
					Payload: map[string]interface{}{
						"mission_id":     res.MissionID,
						"task_id":        res.TaskID,
						"kills_done":     res.KillsDone,
						"required_kills": res.RequiredKills,
						"task_completed": res.TaskCompleted,
					},
				})
			}
		}
	}

	// 2. kill_all: contar enemigos muertos en la sala
	room.mu.RLock()
	allDead := true
	totalEnemies := len(room.ActiveEnemies)
	deadEnemies := 0
	for _, e := range room.ActiveEnemies {
		if e.FSMState == "dead" {
			deadEnemies++
		} else {
			allDead = false
		}
	}
	moreWavesPending := len(room.PendingSpawns) > 0
	room.mu.RUnlock()

	// El nivel solo está limpiado si la oleada actual está muerta Y no quedan
	// oleadas por aparecer. Limpiar una oleada intermedia NO completa el kill_all;
	// tickAI spawneará la siguiente.
	levelCleared := allDead && !moreWavesPending

	log.Printf("[Combat] Room %s enemy status: %d/%d dead | allDead=%v | morePending=%v | levelCleared=%v",
		roomID, deadEnemies, totalEnemies, allDead, moreWavesPending, levelCleared)

	if !levelCleared {
		// Progreso incremental para que el HUD muestre kills en tiempo real.
		results, _ := h.MissionService.GetKillAllProgress(killerUUID, sceneKey)
		for _, res := range results {
			h.SendToUser(killerID, &models.WSMessage{
				Type: MsgEnemyKillProgress,
				Payload: map[string]interface{}{
					"mission_id":     res.MissionID,
					"task_id":        res.TaskID,
					"kills_done":     deadEnemies,
					"required_kills": totalEnemies,
					"task_completed": false,
				},
			})
		}
		return
	}

	// 3. Sala despejada: completar misiones kill_all de todos los clientes.
	log.Printf("[Combat] Room %s fully cleared! Updating 'kill_all' missions.", roomID)
	room.mu.RLock()
	clientIDs := make([]uuid.UUID, 0, len(room.Clients))
	for c := range room.Clients {
		clientIDs = append(clientIDs, c.ID)
	}
	room.mu.RUnlock()

	for _, cid := range clientIDs {
		killAllResults, err := h.MissionService.UpdateKillAllProgress(cid, sceneKey)
		if err != nil {
			log.Printf("[Combat] KillAll progress error for user %s: %v", cid, err)
			continue
		}
		for _, res := range killAllResults {
			if res.MissionDone {
				if mission, dbErr := h.MissionService.Repo.GetMissionByID(res.MissionID); dbErr == nil {
					h.SendToUser(cid.String(), &models.WSMessage{
						Type: MsgMissionCompleted,
						Payload: map[string]interface{}{
							"mission_id": res.MissionID,
							"title":      mission.Title,
						},
					})
					log.Printf("[Combat] mission_completed sent to user %s for mission %d (kill_all)", cid, res.MissionID)
				}
			}
		}
	}
}

// sendPlayerHP envía al cliente su HP autoritativo actual.
func (h *Hub) sendPlayerHP(client *Client) {
	client.SendJSON(&models.WSMessage{
		Type: MsgPlayerHP,
		Payload: map[string]interface{}{
			"hp":     client.HP,
			"hp_max": client.HPMax,
		},
	})
}

// sendPlayerMP envía al cliente su maná autoritativo actual.
func (h *Hub) sendPlayerMP(client *Client) {
	client.SendJSON(&models.WSMessage{
		Type: MsgPlayerMP,
		Payload: map[string]interface{}{
			"mp":     client.MP,
			"mp_max": client.MPMax,
		},
	})
}

// loadPlayerMana carga el maná persistente del jugador desde PlayerStats (fuente de
// verdad), con defaults sensatos si no hay registro o valores en 0.
func (h *Hub) loadPlayerMana(client *Client) {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", client.ID).Error; err == nil {
		client.MPMax = stats.MPMax
		client.MP = stats.MPCurrent
	}
	if client.MPMax <= 0 {
		client.MPMax = 50
	}
	if client.MP < 0 {
		client.MP = 0
	}
	if client.MP > client.MPMax {
		client.MP = client.MPMax
	}
}

// handleSpendMana descuenta maná de forma autoritativa (hechizos/arrojadizos) y lo
// persiste en PlayerStats. Si no alcanza, no descuenta y solo re-sincroniza al cliente.
func (h *Hub) handleSpendMana(client *Client, payload interface{}) {
	var p struct {
		Amount int `json:"amount"`
	}
	parsePayload(payload, &p)
	if p.Amount <= 0 {
		return
	}

	if client.MP >= p.Amount {
		client.MP -= p.Amount
		database.DB.Model(&models.PlayerStats{}).
			Where("user_id = ?", client.ID).
			Update("mp_current", client.MP)
	}
	// En ambos casos devolvemos el valor autoritativo para que el cliente reconcilie.
	h.sendPlayerMP(client)
}

// handleRefreshMana recarga el maná desde BD y lo reenvía. Lo llama el cliente tras usar
// una poción de maná en el inventario (REST), para que el HUD de combate se sincronice.
func (h *Hub) handleRefreshMana(client *Client, _ interface{}) {
	h.loadPlayerMana(client)
	h.sendPlayerMP(client)
}

// applyDamageToPlayer resta daño server-side respetando i-frames y emite el HP.
// Devuelve true si el daño se aplicó (no estaba en i-frames ni muerto).
func (h *Hub) applyDamageToPlayer(client *Client, dmg int, respectIFrames bool) bool {
	if client.IsDead || dmg <= 0 {
		return false
	}
	now := time.Now()
	if respectIFrames && now.Sub(client.LastDamageAt) < playerIFrames {
		return false
	}
	client.LastDamageAt = now

	client.HP -= dmg
	if client.HP < 0 {
		client.HP = 0
	}
	h.sendPlayerHP(client)

	if client.HP == 0 && !client.IsDead {
		client.IsDead = true
		client.SendJSON(&models.WSMessage{Type: MsgPlayerDied, Payload: map[string]interface{}{}})
	}
	return true
}

// handlePlayerHit: el cliente reporta que un enemigo lo golpeó. El servidor
// valida el enemigo y aplica SU daño (no el del cliente), con i-frames.
func (h *Hub) handlePlayerHit(client *Client, payload interface{}) {
	if client.IsDead {
		return
	}
	var p struct {
		EnemyInstanceID string `json:"enemy_instance_id"`
	}
	parsePayload(payload, &p)

	roomID := client.RoomID
	if roomID == "" {
		return
	}
	room, ok := h.getRoom(roomID)
	if !ok {
		return
	}

	instanceUUID, err := uuid.Parse(p.EnemyInstanceID)
	if err != nil {
		return
	}

	room.mu.RLock()
	enemy, exists := room.ActiveEnemies[instanceUUID]
	dmg := 0
	if exists && enemy.FSMState != "dead" {
		dmg = enemy.Damage
		if dmg <= 0 {
			dmg = 10
		}
	}
	room.mu.RUnlock()

	if dmg == 0 {
		return // enemigo inexistente o muerto
	}
	h.applyDamageToPlayer(client, dmg, true)
}

// handlePlayerRespawn: el cliente solicita revivir; reset de HP server-side.
func (h *Hub) handlePlayerRespawn(client *Client) {
	client.HP = client.HPMax
	client.IsDead = false
	client.LastDamageAt = time.Time{}
	h.sendPlayerHP(client)
	// El maná NO se resetea (persiste); reenviamos el valor autoritativo para que el
	// HUD no quede con el 100 local de resetDeathState tras revivir.
	h.sendPlayerMP(client)
}

// handlePlayerHeal: cura server-side al usar una poción de vida. Cantidad fija y
// cooldown para acotar abuso; el HP queda autoritativo en el servidor.
func (h *Hub) handlePlayerHeal(client *Client) {
	if client.IsDead || client.HP >= client.HPMax {
		return
	}
	now := time.Now()
	if now.Sub(client.LastHealAt) < playerHealCooldown {
		return
	}
	client.LastHealAt = now

	client.HP += playerHealAmount
	if client.HP > client.HPMax {
		client.HP = client.HPMax
	}
	h.sendPlayerHP(client)
}

func (h *Hub) handlePlayerAttack(client *Client, payload interface{}) {
	var p struct {
		TargetInstanceID string `json:"target_instance_id"`
		AttackType       string `json:"attack_type"`
		ItemID           string `json:"item_id"`
	}
	parsePayload(payload, &p)

	// El daño lo decide el servidor según el tipo de ataque, nunca el cliente.
	dmg := damageForAttack(p.AttackType)

	// Para arrojables, el daño puede provenir del effect_value del item (definido
	// por el admin en la BD). Si el item es un arrojable válido, su valor sustituye
	// al daño base de la tabla; si no, se mantiene el default de "throw".
	if p.AttackType == "throw" {
		if d := throwDamageForItem(p.ItemID); d > 0 {
			dmg = d
		}
	}

	roomID := client.RoomID
	if roomID == "" {
		return
	}

	room, ok := h.getRoom(roomID)
	if !ok {
		return
	}

	instanceUUID, err := uuid.Parse(p.TargetInstanceID)
	if err != nil {
		return
	}

	room.mu.Lock()
	enemy, exists := room.ActiveEnemies[instanceUUID]
	if !exists || enemy.FSMState == "dead" {
		room.mu.Unlock()
		return
	}

	// Mientras la Ninja Card este pendiente, cualquier golpe adicional debe ignorarse.
	// Esto evita que ataques en vuelo maten al enemigo antes de responder la tarjeta.
	if enemy.FSMState == "ninja_card" {
		room.mu.Unlock()
		return
	}

	// Ninja Cards logic: If this blow would kill the enemy.
	// El boss NO usa la card de un solo jugador (su muerte la decide una card
	// multijugador — E4). Por ahora muere directo al llegar a 0 HP.
	if enemy.HP-dmg <= 0 && enemy.FSMState != "ninja_card" && enemy.Type != EnemyTypeBoss {
		log.Printf("[NinjaCard] Enemy %s is about to die from player %s. Triggering Ninja Card.", instanceUUID, client.ID)
		enemy.FSMState = "ninja_card"
		enemy.PendingNinjaCard = client.ID.String()
		room.mu.Unlock()

		// Reto acorde al nivel de inglés del jugador (con fallbacks).
		challenge := h.getChallengeForClient(client)

		if challenge != nil {
			// Recordar el reto emitido en el enemigo (bajo lock) para evaluar la respuesta
			// contra él y no contra el challenge_id que envíe el cliente.
			room.mu.Lock()
			if e, ok := room.ActiveEnemies[instanceUUID]; ok && e.FSMState == "ninja_card" && e.PendingNinjaCard == client.ID.String() {
				e.NinjaCardChallengeID = challenge.ID.String()
			}
			room.mu.Unlock()

			client.SendJSON(&models.WSMessage{
				Type: MsgNinjaCardTriggered,
				Payload: map[string]interface{}{
					"target_instance_id": instanceUUID,
					"challenge":          challenge,
				},
			})

			// Safety timeout: si el jugador nunca responde la carta, liberar al
			// enemigo para que no quede bloqueado e inmatable de forma permanente.
			playerID := client.ID.String()
			go func() {
				time.Sleep(ninjaCardTimeout)
				if room.ReleaseStaleNinjaCard(instanceUUID, playerID) {
					// Cerrar el modal del jugador si sigue conectado (no-op si se fue).
					h.SendToUser(playerID, &models.WSMessage{
						Type: MsgNinjaCardResult,
						Payload: map[string]interface{}{
							"correct": false,
							"effect":  "expired",
						},
					})
				}
			}()
			return
		}
		// Fallback to normal death if challenge fails
		room.mu.Lock()
	}

	// Boss: el golpe mortal dispara una card multijugador (una por jugador vivo).
	// El boss muere solo si TODOS aciertan; si alguno falla/expira, se cura y sigue.
	if enemy.HP-dmg <= 0 && enemy.Type == EnemyTypeBoss {
		enemy.FSMState = "ninja_card"
		enemy.BossCardRequired = make(map[string]bool)
		enemy.BossCardResults = make(map[string]bool)
		enemy.BossCardChallenge = make(map[string]string)
		required := make([]*Client, 0, len(room.Clients))
		for c := range room.Clients {
			if c.IsDead {
				continue
			}
			enemy.BossCardRequired[c.ID.String()] = true
			required = append(required, c)
		}
		room.mu.Unlock()

		if len(required) == 0 {
			room.mu.Lock()
			enemy.FSMState = "chase"
			enemy.BossCardRequired = nil
			enemy.BossCardResults = nil
			enemy.BossCardChallenge = nil
			room.mu.Unlock()
			return
		}

		log.Printf("[BossCard] Boss %s lethal blow → card to %d players", instanceUUID, len(required))
		issued := make(map[string]string, len(required))
		for _, c := range required {
			challenge := h.getChallengeForClient(c)
			if challenge != nil {
				issued[c.ID.String()] = challenge.ID.String()
				c.SendJSON(&models.WSMessage{
					Type: MsgNinjaCardTriggered,
					Payload: map[string]interface{}{
						"target_instance_id": instanceUUID,
						"challenge":          challenge,
					},
				})
			}
		}

		// Recordar (bajo lock) qué reto recibió cada jugador para evaluar su respuesta
		// contra él y no contra el challenge_id que envíe el cliente.
		room.mu.Lock()
		if e, ok := room.ActiveEnemies[instanceUUID]; ok && e.FSMState == "ninja_card" && e.BossCardChallenge != nil {
			for pid, chid := range issued {
				e.BossCardChallenge[pid] = chid
			}
		}
		room.mu.Unlock()

		// Safety timeout: si no todos responden, resolver como fallo (boss se cura).
		go func() {
			time.Sleep(ninjaCardTimeout)
			h.resolveBossCardTimeout(room, instanceUUID)
		}()
		return
	}

	enemy.HP -= dmg
	log.Printf("[Combat] Enemy %s took %d damage (%s) from %s. HP: %d", instanceUUID, dmg, p.AttackType, client.ID, enemy.HP)

	if enemy.HP <= 0 {
		enemy.HP = 0
		enemy.FSMState = "dead"
		enemyTemplateID := enemy.EnemyID
		room.mu.Unlock()

		// Broadcast death
		deathMsg := &models.WSMessage{
			Type: MsgEnemyDied,
			Payload: models.EnemyDiedBroadcast{
				InstanceID: instanceUUID,
				RoomID:     roomID,
				KilledBy:   client.ID.String(),
			},
		}
		room.broadcastToAll(deathMsg)

		// Update Mission Progress (kills individuales + kill_all). Muerte normal = no-boss.
		go h.processEnemyKill(client.ID, enemyTemplateID, room, roomID, false)

	} else {
		// Stagger: el enemigo se traba brevemente al recibir el golpe. El tick de
		// IA respeta HurtUntil y no lo mueve ni lo deja atacar hasta que expire.
		if dmg >= strongHitDamage {
			enemy.FSMState = "knocked"
			enemy.HurtUntil = time.Now().Add(knockedStunDuration)
		} else {
			enemy.FSMState = "hurt"
			enemy.HurtUntil = time.Now().Add(hurtStunDuration)
		}
		room.mu.Unlock()
	}
}

func (h *Hub) handleNinjaCardAnswer(client *Client, payload interface{}) {
	var p struct {
		TargetInstanceID string `json:"target_instance_id"`
		ChallengeID      string `json:"challenge_id"`
		SelectedOption   int    `json:"selected_option"`
	}
	parsePayload(payload, &p)

	roomID := client.RoomID
	if roomID == "" {
		return
	}

	room, ok := h.getRoom(roomID)
	if !ok {
		return
	}

	instanceUUID, err := uuid.Parse(p.TargetInstanceID)
	if err != nil {
		return
	}

	room.mu.Lock()
	enemy, exists := room.ActiveEnemies[instanceUUID]
	if !exists || enemy.FSMState == "dead" {
		room.mu.Unlock()
		return
	}

	// Boss: card multijugador. Cada jugador responde; se resuelve cuando todos lo
	// hacen (todos aciertan → muere; alguno falla → se cura). Mantiene el lock.
	if enemy.Type == EnemyTypeBoss && enemy.BossCardResults != nil {
		h.handleBossCardAnswerLocked(client, room, enemy, instanceUUID, roomID, p.ChallengeID, p.SelectedOption)
		return
	}

	if enemy.FSMState != "ninja_card" || enemy.PendingNinjaCard != client.ID.String() {
		room.mu.Unlock()
		return
	}

	// Evaluar SIEMPRE contra el reto emitido por el servidor. Solo si no se guardó
	// (caso heredado/raro) se cae al challenge_id del cliente.
	challengeIDStr := enemy.NinjaCardChallengeID
	if challengeIDStr == "" {
		challengeIDStr = p.ChallengeID
	}
	challengeUUID, _ := uuid.Parse(challengeIDStr)
	var chal models.LearningChallenge
	database.DB.First(&chal, "id = ?", challengeUUID)

	isCorrect := (chal.CorrectOption == p.SelectedOption)
	log.Printf("[NinjaCard] Answer evaluated: %v (Selected: %d, Correct: %d)", isCorrect, p.SelectedOption, chal.CorrectOption)

	if _, err := h.LearningService.RecordAttempt(client.ID, challengeUUID, isCorrect, p.SelectedOption, ""); err != nil {
		log.Printf("[NinjaCard] WARN: failed to record attempt for %s: %v", client.ID, err)
	}

	if isCorrect {
		enemy.HP = 0
		enemy.FSMState = "dead"
		enemyTemplateID := enemy.EnemyID
		room.mu.Unlock()

		client.SendJSON(&models.WSMessage{
			Type: MsgNinjaCardResult,
			Payload: map[string]interface{}{
				"correct": true,
				"effect":  "enemy_eliminated",
			},
		})

		deathMsg := &models.WSMessage{
			Type: MsgEnemyDied,
			Payload: models.EnemyDiedBroadcast{
				InstanceID: instanceUUID,
				RoomID:     roomID,
				KilledBy:   client.ID.String(),
			},
		}
		room.broadcastToAll(deathMsg)

		// Mismo progreso de misiones que la muerte normal (single ninja card = no-boss).
		go h.processEnemyKill(client.ID, enemyTemplateID, room, roomID, false)
	} else {
		// Elegir efecto aleatorio entre 3 posibles efectos
		// 0: enemy_heals, 1: player_takes_damage, 2: player_is_stunned
		randEffect := rand.Intn(3)
		var effectType string
		damage := 0
		duration := 0

		log.Printf("[NinjaCard Debug] Incorrect answer from user %s (ID: %s). Choosing random penalty effect. Index: %d", client.Username, client.ID, randEffect)

		if randEffect == 0 {
			effectType = "enemy_heals"
			enemy.HP = enemy.HPMax
			log.Printf("[NinjaCard Debug] Penalty selected: enemy_heals. Enemy %s HP fully restored to %d/%d", instanceUUID, enemy.HP, enemy.HPMax)
		} else if randEffect == 1 {
			effectType = "player_takes_damage"
			damage = 30
			// Curar al enemigo al 50% para que el jugador no lo derrote inmediatamente en el próximo golpe
			enemy.HP = enemy.HPMax / 2
			if enemy.HP < 1 {
				enemy.HP = 1
			}
			log.Printf("[NinjaCard Debug] Penalty selected: player_takes_damage. Damage: %d. Enemy %s partially healed to %d/%d", damage, instanceUUID, enemy.HP, enemy.HPMax)
		} else {
			effectType = "player_is_stunned"
			duration = 3000 // 3 segundos
			// Curar al enemigo al 50%
			enemy.HP = enemy.HPMax / 2
			if enemy.HP < 1 {
				enemy.HP = 1
			}
			log.Printf("[NinjaCard Debug] Penalty selected: player_is_stunned. Duration: %dms. Enemy %s partially healed to %d/%d", duration, instanceUUID, enemy.HP, enemy.HPMax)
		}

		enemy.FSMState = "chase"
		enemy.PendingNinjaCard = ""
		enemy.NinjaCardChallengeID = ""
		room.mu.Unlock()

		// El daño de la penalización se aplica server-side (sin i-frames).
		if damage > 0 {
			h.applyDamageToPlayer(client, damage, false)
		}

		log.Printf("[NinjaCard Debug] Broadcasting NinjaCard result to client %s: correct=false, effect=%s, damage=%d, duration=%d", client.ID, effectType, damage, duration)
		client.SendJSON(&models.WSMessage{
			Type: MsgNinjaCardResult,
			Payload: map[string]interface{}{
				"correct":  false,
				"effect":   effectType,
				"damage":   damage,
				"duration": duration,
			},
		})
	}
}

// getChallengeForClient obtiene un reto acorde al nivel de inglés del jugador,
// con fallbacks. Usado por la card de un jugador y por la del boss.
func (h *Hub) getChallengeForClient(client *Client) *models.LearningChallenge {
	var profile models.UserLearningProfile
	level := models.DifficultyBeginner
	if database.DB != nil {
		if dbErr := database.DB.Where("user_id = ?", client.ID).First(&profile).Error; dbErr == nil {
			level = profile.EnglishLevel
		}
	}
	challenge, err := h.LearningService.GetRandomChallenge("vocabulary", string(level), "")
	if err != nil || challenge == nil {
		challenge, err = h.LearningService.GetRandomChallenge("", string(level), "")
	}
	if err != nil || challenge == nil {
		challenge, _ = h.LearningService.GetRandomChallenge("", "", "")
	}
	return challenge
}

// bossCardFailHP calcula el HP al que se recupera el boss cuando falla la card
// multijugador, según su CardFailHealPct (% de HPMax; default 100, mín 1).
func bossCardFailHP(enemy *models.ActiveEnemy) int {
	pct := enemy.CardFailHealPct
	if pct <= 0 {
		pct = 100
	}
	hp := enemy.HPMax * pct / 100
	if hp < 1 {
		hp = 1
	}
	if hp > enemy.HPMax {
		hp = enemy.HPMax
	}
	return hp
}

// broadcastBossCardResult notifica a toda la sala el desenlace de la card del boss.
func (h *Hub) broadcastBossCardResult(room *Room, success bool) {
	effect := "enemy_heals"
	if success {
		effect = "enemy_eliminated"
	}
	room.broadcastToAll(&models.WSMessage{
		Type: MsgNinjaCardResult,
		Payload: map[string]interface{}{
			"correct": success,
			"effect":  effect,
		},
	})
}

// handleBossCardAnswerLocked procesa la respuesta de UN jugador a la card del boss.
// Se entra con room.mu BLOQUEADO y esta función libera el lock.
// Cuando todos los requeridos respondieron: todos aciertan → boss muere;
// alguno falla → el boss se cura y sigue.
func (h *Hub) handleBossCardAnswerLocked(client *Client, room *Room, enemy *models.ActiveEnemy, instanceUUID uuid.UUID, roomID, challengeID string, selectedOption int) {
	cid := client.ID.String()
	if enemy.BossCardRequired == nil || !enemy.BossCardRequired[cid] {
		room.mu.Unlock()
		return
	}
	if _, answered := enemy.BossCardResults[cid]; answered {
		room.mu.Unlock()
		return
	}

	// Evaluar contra el reto que el servidor emitió a este jugador, no el del cliente.
	challengeIDStr := ""
	if enemy.BossCardChallenge != nil {
		challengeIDStr = enemy.BossCardChallenge[cid]
	}
	if challengeIDStr == "" {
		challengeIDStr = challengeID
	}
	challengeUUID, _ := uuid.Parse(challengeIDStr)
	var chal models.LearningChallenge
	database.DB.First(&chal, "id = ?", challengeUUID)
	isCorrect := chal.CorrectOption == selectedOption
	enemy.BossCardResults[cid] = isCorrect
	log.Printf("[BossCard] %s answered boss %s: correct=%v (%d/%d answered)", cid, instanceUUID, isCorrect, len(enemy.BossCardResults), len(enemy.BossCardRequired))

	answeredAll := true
	allCorrect := true
	for pid := range enemy.BossCardRequired {
		res, ok := enemy.BossCardResults[pid]
		if !ok {
			answeredAll = false
			break
		}
		if !res {
			allCorrect = false
		}
	}

	if !answeredAll {
		room.mu.Unlock()
		if _, err := h.LearningService.RecordAttempt(client.ID, challengeUUID, isCorrect, selectedOption, ""); err != nil {
			log.Printf("[BossCard] WARN: failed to record attempt for %s: %v", client.ID, err)
		}
		return // el modal del jugador espera a los demás
	}

	var enemyTemplateID uuid.UUID
	if allCorrect {
		enemy.HP = 0
		enemy.FSMState = "dead"
		enemyTemplateID = enemy.EnemyID
	} else {
		enemy.HP = bossCardFailHP(enemy)
		enemy.FSMState = "chase"
	}
	enemy.BossCardRequired = nil
	enemy.BossCardResults = nil
	enemy.BossCardChallenge = nil
	room.mu.Unlock()

	if _, err := h.LearningService.RecordAttempt(client.ID, challengeUUID, isCorrect, selectedOption, ""); err != nil {
		log.Printf("[BossCard] WARN: failed to record attempt for %s: %v", client.ID, err)
	}

	if allCorrect {
		log.Printf("[BossCard] Boss %s defeated — all players correct", instanceUUID)
		h.broadcastBossCardResult(room, true)
		room.broadcastToAll(&models.WSMessage{
			Type: MsgEnemyDied,
			Payload: models.EnemyDiedBroadcast{
				InstanceID: instanceUUID,
				RoomID:     roomID,
				KilledBy:   cid,
			},
		})
		// Muerte del boss → isBoss=true (completa tareas kill_boss por tipo).
		go h.processEnemyKill(client.ID, enemyTemplateID, room, roomID, true)
	} else {
		log.Printf("[BossCard] Boss %s recovered — at least one player failed", instanceUUID)
		h.broadcastBossCardResult(room, false)
	}
}

// resolveBossCardTimeout libera la card del boss si no todos respondieron a tiempo
// (p. ej. una desconexión). Trata lo no respondido como fallo: el boss se cura.
func (h *Hub) resolveBossCardTimeout(room *Room, instanceUUID uuid.UUID) {
	room.mu.Lock()
	enemy, ok := room.ActiveEnemies[instanceUUID]
	if !ok || enemy.Type != EnemyTypeBoss || enemy.BossCardResults == nil || enemy.FSMState != "ninja_card" {
		room.mu.Unlock()
		return
	}
	enemy.HP = bossCardFailHP(enemy)
	enemy.FSMState = "chase"
	enemy.BossCardRequired = nil
	enemy.BossCardResults = nil
	enemy.BossCardChallenge = nil
	room.mu.Unlock()

	log.Printf("[BossCard] Timeout — boss %s recovered (not all answered)", instanceUUID)
	h.broadcastBossCardResult(room, false)
}
