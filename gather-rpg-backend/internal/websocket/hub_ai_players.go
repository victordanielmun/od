package websocket

import (
	"log"
	"math/rand"
	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"

	"github.com/google/uuid"
)

// Enganche de los jugadores con IA al hub: de dónde salen sus fichas, cómo se
// les hace localizables para un mensaje privado y cómo contestan.
//
// Es un camino paralelo al de los NPC, no una variante suya: aquí no hay
// instancias de sala, ni misiones, ni tareas, ni evaluación de pronunciación.
// Un bot recibe un mensaje privado y devuelve otro, como haría una persona.

// botTypingDelay es la pausa antes de contestar, además de lo que tarde el LLM.
// Sin ella la respuesta llega instantánea y delata a la máquina: nadie teclea a
// esa velocidad.
func botTypingDelay(reply string) time.Duration {
	base := 700 * time.Millisecond
	perChar := time.Duration(len(reply)*22) * time.Millisecond
	total := base + perChar
	if total > 4*time.Second {
		total = 4 * time.Second
	}
	return total + time.Duration(rand.Intn(400))*time.Millisecond
}

// ensureLobbyBots carga los bots configurados para la escena de la sala y los
// pone en juego. Idempotente y silencioso si no hay ninguno configurado.
func (h *Hub) ensureLobbyBots(room *Room, anchorX, anchorY float64) {
	if h.AIPlayerService == nil || room.HasBots() {
		return
	}

	configured, err := h.AIPlayerService.ListActive(room.SceneKey)
	if err != nil {
		log.Printf("[AIPlayers] No se pudieron cargar los bots de %s: %v", room.SceneKey, err)
		return
	}
	if len(configured) == 0 {
		return
	}

	specs := make([]BotSpec, 0, len(configured))
	for _, bot := range configured {
		specs = append(specs, BotSpec{
			AIPlayerID:  bot.ID,
			UserID:      bot.UserID,
			Username:    bot.Username,
			CharacterID: bot.CharacterID,
			SpawnX:      bot.SpawnX,
			SpawnY:      bot.SpawnY,
		})
	}

	room.EnsureBots(specs, anchorX, anchorY)

	// Registrar a cada bot en el índice de clientes. NO entran en room.Clients:
	// solo necesitan que findClientByID sepa encontrarlos para entregarles un
	// mensaje privado. Todo lo que se mide sobre room.Clients (aforo, cierre de
	// sala, objetivos de los enemigos, voz de proximidad) los sigue ignorando.
	for _, b := range room.BotSnapshot() {
		h.registerBotClient(b, room.ID)
	}
}

// registerBotClient crea el *Client del bot y lo indexa. Su "socket" es un inbox
// que despacha lo que le llegue al cerebro conversacional.
func (h *Hub) registerBotClient(bot LobbyBot, roomID string) {
	h.mu.Lock()
	if h.clientsByID == nil {
		h.clientsByID = make(map[uuid.UUID]*Client)
	}
	if existing := h.clientsByID[bot.ID]; existing != nil && existing.IsAI {
		h.mu.Unlock()
		return
	}
	h.mu.Unlock()

	aiPlayerID := bot.AIPlayerID
	botUserID := bot.ID

	client := NewAIClient(h, bot.ID, bot.Username, bot.CharacterID, func(msg *models.WSMessage) {
		h.handleBotInbox(aiPlayerID, botUserID, msg)
	})
	client.RoomID = roomID

	h.mu.Lock()
	h.clientsByID[bot.ID] = client
	h.mu.Unlock()
}

// unregisterBotClientsLocked retira del índice a los bots de una sala que se
// cierra; sin esto quedarían localizables para siempre aunque su sala ya no
// exista. DEBE llamarse con h.mu tomado en escritura (handleUnregister lo está).
func (h *Hub) unregisterBotClientsLocked(room *Room) {
	for _, b := range room.BotSnapshot() {
		if c := h.clientsByID[b.ID]; c != nil && c.IsAI {
			delete(h.clientsByID, b.ID)
		}
	}
}

// isAIPlayer indica si ese usuario es un bot conectado.
func (h *Hub) isAIPlayer(userID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	c := h.clientsByID[userID]
	return c != nil && c.IsAI
}

// openAIPlayerChat abre la ventana de conversación con un bot en el acto y, si
// tiene saludo configurado, lo suelta como si acabara de escribirlo.
func (h *Hub) openAIPlayerChat(client *Client, botUserID uuid.UUID) {
	h.mu.RLock()
	botClient := h.clientsByID[botUserID]
	h.mu.RUnlock()
	if botClient == nil {
		return
	}

	client.SendJSON(&models.WSMessage{
		Type: MsgChatSessionStart,
		Payload: map[string]string{
			"partner_id":   botUserID.String(),
			"partner_name": botClient.Username,
		},
	})

	if h.AIPlayerService == nil {
		return
	}
	bot, err := h.AIPlayerService.GetByUserID(botUserID)
	if err != nil || bot.Greeting == "" {
		return
	}

	// Solo saluda la primera vez: si ya habíais hablado, retomar la conversación
	// con el mismo "hola" de la primera vez rompe la ilusión.
	if h.hasBotHistory(botUserID, client.ID) {
		return
	}

	go func() {
		time.Sleep(botTypingDelay(bot.Greeting))
		if database.DB != nil {
			database.DB.Create(&models.DirectMessage{
				SenderID: botUserID, RecipientID: client.ID, Content: bot.Greeting,
			})
		}
		client.SendJSON(&models.WSMessage{
			Type: MsgPrivateMessage,
			Payload: map[string]string{
				"sender_id":   botUserID.String(),
				"sender_name": bot.Username,
				"message":     bot.Greeting,
			},
		})
	}()
}

// hasBotHistory indica si ese jugador y ese bot ya han hablado alguna vez.
func (h *Hub) hasBotHistory(botUserID, playerID uuid.UUID) bool {
	if database.DB == nil {
		return false
	}
	var count int64
	database.DB.Model(&models.DirectMessage{}).
		Where("(sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)",
			botUserID, playerID, playerID, botUserID).
		Count(&count)
	return count > 0
}

// handleBotInbox es lo que "oye" un bot. De todo lo que el servidor le enviaría a
// un jugador solo le interesa un mensaje privado; el resto (posiciones, combate,
// avisos) se descarta sin más.
func (h *Hub) handleBotInbox(aiPlayerID uint, botUserID uuid.UUID, msg *models.WSMessage) {
	if msg == nil || msg.Type != MsgPrivateMessage {
		return
	}

	payload, ok := msg.Payload.(map[string]string)
	if !ok {
		return
	}
	senderID, err := uuid.Parse(payload["sender_id"])
	if err != nil {
		return
	}

	h.replyAsBot(aiPlayerID, botUserID, senderID, payload["sender_name"], payload["message"])
}

// replyAsBot genera y entrega la respuesta del bot al jugador.
func (h *Hub) replyAsBot(aiPlayerID uint, botUserID, playerID uuid.UUID, playerName, input string) {
	if h.AIPlayerService == nil {
		return
	}

	bot, err := h.AIPlayerService.GetByID(aiPlayerID)
	if err != nil {
		log.Printf("[AIPlayers] Bot %d no encontrado: %v", aiPlayerID, err)
		return
	}

	if playerName == "" {
		playerName = "the player"
	}

	history := h.botConversationHistory(botUserID, playerID)
	nativeLang := playerNativeLanguage(playerID)

	reply, err := h.AIPlayerService.Reply(bot, playerName, nativeLang, input, history)
	if err != nil {
		log.Printf("[AIPlayers] %s no pudo responder: %v", bot.Username, err)
		return
	}
	if reply == "" {
		return
	}

	// Persistir la respuesta como un mensaje directo más: así el jugador la
	// reencuentra al reabrir el chat, igual que con una persona.
	if database.DB != nil {
		dm := &models.DirectMessage{SenderID: botUserID, RecipientID: playerID, Content: reply}
		if err := database.DB.Create(dm).Error; err != nil {
			log.Printf("[AIPlayers] No se pudo guardar la respuesta de %s: %v", bot.Username, err)
		}
	}

	// Pausa de tecleo antes de entregar: una respuesta instantánea delata a la
	// máquina.
	time.Sleep(botTypingDelay(reply))

	target := h.findClientByID(playerID.String())
	if target == nil {
		return // se fue mientras el bot pensaba; el mensaje queda en el historial
	}
	target.SendJSON(&models.WSMessage{
		Type: MsgPrivateMessage,
		Payload: map[string]string{
			"sender_id":   botUserID.String(),
			"sender_name": bot.Username,
			"message":     reply,
		},
	})
}

// botConversationHistory recupera los últimos turnos entre ese bot y ese jugador
// para dárselos al LLM como contexto. Sale de direct_messages, la misma tabla que
// guarda las conversaciones entre personas.
func (h *Hub) botConversationHistory(botUserID, playerID uuid.UUID) []services.ConversationTurn {
	if database.DB == nil {
		return nil
	}

	var rows []models.DirectMessage
	err := database.DB.
		Where("(sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)",
			botUserID, playerID, playerID, botUserID).
		Order("created_at desc").
		Limit(20).
		Find(&rows).Error
	if err != nil {
		return nil
	}

	// Vienen del más reciente al más antiguo; el LLM los necesita en orden natural.
	turns := make([]services.ConversationTurn, 0, len(rows))
	for i := len(rows) - 1; i >= 0; i-- {
		turns = append(turns, services.ConversationTurn{
			FromPlayer: rows[i].SenderID == playerID,
			Content:    rows[i].Content,
		})
	}
	return turns
}

// playerNativeLanguage resuelve el idioma del jugador para que el bot sepa con
// quién habla. Ante la duda, inglés.
func playerNativeLanguage(playerID uuid.UUID) string {
	if database.DB == nil {
		return "en"
	}
	var user models.User
	if err := database.DB.Select("native_language").First(&user, "id = ?", playerID).Error; err != nil {
		return "en"
	}
	if user.NativeLanguage == "" {
		return "en"
	}
	return user.NativeLanguage
}
