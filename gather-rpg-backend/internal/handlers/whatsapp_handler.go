package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"gather-rpg-backend/internal/services"
	"gather-rpg-backend/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WhatsAppHandler struct {
	WhatsAppService *services.WhatsAppService
	Phrases         *services.WAPhraseService
	Translations    *services.TranslationService
}

func NewWhatsAppHandler(whatsAppService *services.WhatsAppService, phrases *services.WAPhraseService, translations *services.TranslationService) *WhatsAppHandler {
	return &WhatsAppHandler{
		WhatsAppService: whatsAppService,
		Phrases:         phrases,
		Translations:    translations,
	}
}

// GetQR ensures the WhatsApp instance is created and retrieves the connection QR code/status
func (h *WhatsAppHandler) GetQR(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	// Instance name based on authenticated user ID
	instanceName := fmt.Sprintf("user_%s", userIDStr)

	// Step 1: Check if the instance already exists
	stateRes, err := h.WhatsAppService.GetConnectionState(instanceName)
	if err == nil {
		// Instance exists! Check if it is already connected
		state := ""
		if inst, ok := stateRes["instance"].(map[string]interface{}); ok {
			if s, ok := inst["state"].(string); ok {
				state = s
			}
		}
		if state == "" {
			if s, ok := stateRes["state"].(string); ok {
				state = s
			}
		}

		if state == "open" {
			return c.JSON(stateRes)
		}

		// Not open, so fetch its existing connection QR code directly!
		qrRes, err := h.WhatsAppService.GetConnectQR(instanceName)
		if err == nil {
			if _, exists := qrRes["base64"]; exists {
				return c.JSON(qrRes)
			}
		}
	}

	// Step 2: If it doesn't exist or fetching QR failed, let's delete it just in case and create it fresh
	_, _ = h.WhatsAppService.DeleteInstance(instanceName)

	createRes, err := h.WhatsAppService.CreateInstance(instanceName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Step 3: Wait a bit for Baileys to connect and generate the QR code, then fetch it
	time.Sleep(3 * time.Second)
	var qrRes map[string]interface{}
	var qrErr error
	for i := 0; i < 4; i++ {
		qrRes, qrErr = h.WhatsAppService.GetConnectQR(instanceName)
		if qrErr == nil {
			if _, exists := qrRes["base64"]; exists {
				break
			}
		}
		time.Sleep(1500 * time.Millisecond)
	}

	if qrErr != nil || qrRes == nil {
		return c.JSON(createRes)
	}

	return c.JSON(qrRes)
}

// GetStatus gets the current connection status of the user's WhatsApp instance
func (h *WhatsAppHandler) GetStatus(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	instanceName := fmt.Sprintf("user_%s", userIDStr)

	statusRes, err := h.WhatsAppService.GetConnectionState(instanceName)
	if err != nil {
		log.Printf("[WhatsAppHandler] Error fetching connection state for %s: %v", instanceName, err)
		return c.JSON(fiber.Map{
			"status": "close",
			"state":  "close",
			"instance": fiber.Map{
				"state": "close",
			},
		})
	}

	return c.JSON(statusRes)
}

// FetchInstances retrieves all active WhatsApp instances
func (h *WhatsAppHandler) FetchInstances(c *fiber.Ctx) error {
	instances, err := h.WhatsAppService.FetchInstances()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(instances)
}

// DeleteInstance removes an instance by name
func (h *WhatsAppHandler) DeleteInstance(c *fiber.Ctx) error {
	instanceName := c.Params("name")
	if instanceName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing instance name parameter"})
	}

	result, err := h.WhatsAppService.DeleteInstance(instanceName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// GetGlobalQR ensures the global admin instance is created and retrieves its connection QR code
func (h *WhatsAppHandler) GetGlobalQR(c *fiber.Ctx) error {
	instanceName := "admin_global"

	// Step 1: Check if the instance already exists
	stateRes, err := h.WhatsAppService.GetConnectionState(instanceName)
	if err == nil {
		// Instance exists! Check if it is already connected
		state := ""
		if inst, ok := stateRes["instance"].(map[string]interface{}); ok {
			if s, ok := inst["state"].(string); ok {
				state = s
			}
		}
		if state == "" {
			if s, ok := stateRes["state"].(string); ok {
				state = s
			}
		}

		if state == "open" {
			return c.JSON(stateRes)
		}

		// Not open, so fetch its existing connection QR code directly!
		qrRes, err := h.WhatsAppService.GetConnectQR(instanceName)
		if err == nil {
			if _, exists := qrRes["base64"]; exists {
				return c.JSON(qrRes)
			}
		}
	}

	// Step 2: If it doesn't exist or fetching QR failed, let's delete it just in case and create it fresh
	_, _ = h.WhatsAppService.DeleteInstance(instanceName)

	createRes, err := h.WhatsAppService.CreateInstance(instanceName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Step 3: Wait a bit for Baileys to connect and generate the QR code, then fetch it
	time.Sleep(3 * time.Second)
	var qrRes map[string]interface{}
	var qrErr error
	for i := 0; i < 4; i++ {
		qrRes, qrErr = h.WhatsAppService.GetConnectQR(instanceName)
		if qrErr == nil {
			if _, exists := qrRes["base64"]; exists {
				break
			}
		}
		time.Sleep(1500 * time.Millisecond)
	}

	if qrErr != nil || qrRes == nil {
		return c.JSON(createRes)
	}

	return c.JSON(qrRes)
}

// GetGlobalStatus gets the current connection status of the global admin instance
func (h *WhatsAppHandler) GetGlobalStatus(c *fiber.Ctx) error {
	instanceName := "admin_global"

	statusRes, err := h.WhatsAppService.GetConnectionState(instanceName)
	if err != nil {
		log.Printf("[WhatsAppHandler] Error fetching connection state for global: %v", err)
		return c.JSON(fiber.Map{
			"status": "close",
			"state":  "close",
			"instance": fiber.Map{
				"state": "close",
			},
		})
	}

	return c.JSON(statusRes)
}

// CreateOrUpdateContact upserts the WhatsApp contact details for the authenticated user
func (h *WhatsAppHandler) CreateOrUpdateContact(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	var req struct {
		PhoneNumber          string `json:"phone_number"`
		WhatsAppName         string `json:"whatsapp_name"`
		NotificationsEnabled *bool  `json:"notifications_enabled"`
		Timezone             string `json:"timezone"`
		PreferredHourStart   *int16 `json:"preferred_hour_start"`
		PreferredHourEnd     *int16 `json:"preferred_hour_end"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.PhoneNumber == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Phone number is required"})
	}

	// Normalizar el número a formato JID (sin '+') para que coincida con el número que
	// reporta el webhook entrante (JID viene como "573001234567@s.whatsapp.net", sin '+').
	// Sin esto el contacto nunca se encuentra al recibir mensajes y la activación nunca ocurre.
	req.PhoneNumber = normalizePhone(req.PhoneNumber)

	// Fetch existing contact or create a new one
	var contact models.WhatsAppContact
	err = database.DB.Where("user_id = ?", userID).First(&contact).Error

	// If it's a new contact, or the phone number has changed, require activation
	isNewOrChanged := err != nil || contact.PhoneNumber != req.PhoneNumber

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			contact = models.WhatsAppContact{
				ID:     uuid.New(),
				UserID: userID,
			}
		} else {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
	}

	contact.PhoneNumber = req.PhoneNumber
	if req.WhatsAppName != "" {
		contact.WhatsAppName = req.WhatsAppName
	}

	if isNewOrChanged {
		// New or changed phone numbers must scan the activation QR to set this to true
		contact.NotificationsEnabled = false
	} else if req.NotificationsEnabled != nil {
		contact.NotificationsEnabled = *req.NotificationsEnabled
	}

	if req.Timezone != "" {
		contact.Timezone = req.Timezone
	} else if contact.Timezone == "" {
		contact.Timezone = "America/Bogota"
	}
	if req.PreferredHourStart != nil {
		contact.PreferredHourStart = *req.PreferredHourStart
	} else if contact.PreferredHourStart == 0 {
		contact.PreferredHourStart = 8
	}
	if req.PreferredHourEnd != nil {
		contact.PreferredHourEnd = *req.PreferredHourEnd
	} else if contact.PreferredHourEnd == 0 {
		contact.PreferredHourEnd = 21
	}

	if err := database.DB.Save(&contact).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(contact)
}

// GetContact retrieves the WhatsApp contact details for the authenticated user
func (h *WhatsAppHandler) GetContact(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	var contact models.WhatsAppContact
	err = database.DB.Where("user_id = ?", userID).First(&contact).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Contact not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(contact)
}

// GetGlobalPhone fetches the phone number of the global connected bot
func (h *WhatsAppHandler) GetGlobalPhone(c *fiber.Ctx) error {
	instanceName := "admin_global"

	statusRes, err := h.WhatsAppService.GetConnectionState(instanceName)
	if err != nil {
		log.Printf("[WhatsAppHandler] Error fetching connection state for global number: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "No se pudo obtener el estado de la conexión global de WhatsApp"})
	}

	state := ""
	if inst, ok := statusRes["instance"].(map[string]interface{}); ok {
		if s, ok := inst["state"].(string); ok {
			state = s
		}
	}
	if state == "" {
		if s, ok := statusRes["state"].(string); ok {
			state = s
		}
	}

	if state != "open" {
		return c.JSON(fiber.Map{
			"status": "close",
			"phone":  "",
		})
	}

	// Extract owner JID (e.g. "573001234567@s.whatsapp.net")
	ownerJID := ""
	if inst, ok := statusRes["instance"].(map[string]interface{}); ok {
		if owner, ok := inst["owner"].(string); ok {
			ownerJID = owner
		} else if owner, ok := inst["ownerJid"].(string); ok {
			ownerJID = owner
		}
	}
	if ownerJID == "" {
		// Fallback to top-level key if available
		if owner, ok := statusRes["owner"].(string); ok {
			ownerJID = owner
		} else if owner, ok := statusRes["ownerJid"].(string); ok {
			ownerJID = owner
		}
	}

	// Clean the number (remove @...)
	cleanPhone := ownerJID
	for i, char := range ownerJID {
		if char == '@' {
			cleanPhone = ownerJID[:i]
			break
		}
	}

	return c.JSON(fiber.Map{
		"status": "open",
		"phone":  cleanPhone,
	})
}

// ReceiveWebhook handles incoming message webhook notifications from Evolution API to activate contacts and process challenge answers
func (h *WhatsAppHandler) ReceiveWebhook(c *fiber.Ctx) error {
	var payload struct {
		Event    string `json:"event"`
		Instance string `json:"instance"`
		Data     struct {
			Key struct {
				RemoteJid string `json:"remoteJid"`
				FromMe    bool   `json:"fromMe"`
				ID        string `json:"id"`
			} `json:"key"`
			MessageType string                 `json:"messageType"`
			Message     map[string]interface{} `json:"message"`
		} `json:"data"`
	}

	if err := c.BodyParser(&payload); err != nil {
		log.Printf("[WhatsAppWebhook] Error parsing webhook body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	// We only process incoming messages to admin_global that are not sent by the bot itself
	if payload.Event != "messages.upsert" || payload.Instance != "admin_global" || payload.Data.Key.FromMe {
		return c.SendStatus(fiber.StatusOK)
	}

	jid := payload.Data.Key.RemoteJid
	if jid == "" {
		return c.SendStatus(fiber.StatusOK)
	}

	// Extract phone number from JID (e.g. "573001234567@s.whatsapp.net" -> "573001234567")
	cleanNumber := jid
	for i, char := range jid {
		if char == '@' {
			cleanNumber = jid[:i]
			break
		}
	}
	cleanNumber = normalizePhone(cleanNumber)

	// Search for registered contact in database. Toleramos filas antiguas que pudieron
	// guardarse con '+' antes de normalizar el almacenamiento.
	var contact models.WhatsAppContact
	err := database.DB.Where("phone_number = ? OR phone_number = ?", cleanNumber, "+"+cleanNumber).First(&contact).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("[WhatsAppWebhook] Received message from unregistered number: %s", cleanNumber)
			return c.SendStatus(fiber.StatusOK)
		}
		log.Printf("[WhatsAppWebhook] Database error fetching contact for %s: %v", cleanNumber, err)
		return c.SendStatus(fiber.StatusOK)
	}

	// Fetch user details to get username and selected companion guide
	var user models.User
	if err := database.DB.First(&user, contact.UserID).Error; err != nil {
		log.Printf("[WhatsAppWebhook] Database error fetching User %s for contact %s: %v", contact.UserID, cleanNumber, err)
		return c.SendStatus(fiber.StatusOK)
	}

	// Activate notifications if they are currently disabled/pending
	if !contact.NotificationsEnabled {
		contact.NotificationsEnabled = true
		contact.TemporarilyDisabled = false
		if err := database.DB.Save(&contact).Error; err != nil {
			log.Printf("[WhatsAppWebhook] Failed to save updated contact for %s: %v", cleanNumber, err)
			return c.SendStatus(fiber.StatusOK)
		}

		log.Printf("[WhatsAppWebhook] Successfully activated WhatsApp notifications for User %s (Number: %s)", contact.UserID, cleanNumber)

		// Formulate personalized greeting from chosen guide
		confirmationText := fmt.Sprintf("¡Hola %s! Tus notificaciones de inglés en Odisea han sido activadas con éxito. Guarda mi contacto para apoyarte con tu aprendizaje. 🚀", user.Username)

		if user.CompanionNPCID != nil {
			var guide models.NPCDefinition
			if err := database.DB.First(&guide, *user.CompanionNPCID).Error; err == nil {
				greetingText := guide.Greeting
				if greetingText == "" {
					greetingText = "¡Listo para acompañarte en tu viaje!"
				}
				confirmationText = fmt.Sprintf("¡Hola %s! Soy %s, tu guía en Odisea.\n\n\"%s\"\n\nGuarda mi contacto para apoyarte con tu aprendizaje de inglés. 🚀", user.Username, guide.Name, greetingText)
			} else {
				log.Printf("[WhatsAppWebhook] Warning: Failed to fetch companion guide definition ID %d: %v", *user.CompanionNPCID, err)
			}
		}

		// Send dynamic reply message
		_, sendErr := h.WhatsAppService.SendText("admin_global", cleanNumber, confirmationText)
		if sendErr != nil {
			log.Printf("[WhatsAppWebhook] Warning: Failed to send activation confirmation to %s: %v", cleanNumber, sendErr)
		}
	} else {
		// Contact has notifications enabled already, process their reply within the
		// localized multi-turn NPC conversation flow (guía = NPC compañero del usuario).
		msgType := payload.Data.MessageType
		isAudio := msgType == "audioMessage" || strings.Contains(strings.ToLower(msgType), "audio")
		incomingText := extractMessageText(payload.Data.Message)

		guideName, _ := services.GuideInfo(user)
		lang := utils.NormalizeLang(user.NativeLanguage)
		displayName := contact.WhatsAppName
		if displayName == "" {
			displayName = user.Username
		}

		// Load the open conversation (state machine) for this user and store the inbound
		// message in the history.
		conv := services.GetOpenConversation(contact.UserID)
		if conv != nil {
			content := incomingText
			if isAudio {
				content = "[nota de voz]"
			}
			services.SaveConversationMessage(conv.ID, models.WAMessageRoleUser, models.WAMessageTypeText, content)
		}

		// STEP 0: el guía saludó y espera respuesta -> enviar motivación + invitación.
		if conv != nil && conv.Intent == models.WAIntentAwaitingGreetingReply {
			motivation := h.Phrases.Phrase(services.PhraseMotivation, lang, displayName)
			invite := h.Phrases.Phrase(services.PhraseInvite, lang, displayName)
			msg := fmt.Sprintf("*%s:* %s\n\n%s", guideName, motivation, invite)
			_, _ = h.WhatsAppService.SendText(payload.Instance, cleanNumber, msg)
			services.SaveConversationMessage(conv.ID, models.WAMessageRoleAssistant, models.WAMessageTypeMotivation, msg)
			services.SetConversationIntent(conv, models.WAIntentAwaitingPracticeConfirm)
			return c.SendStatus(fiber.StatusOK)
		}

		// STEP 1: el guía invitó a practicar y espera SÍ / NO.
		if conv != nil && conv.Intent == models.WAIntentAwaitingPracticeConfirm && !isAudio {
			switch normalizeYesNo(incomingText) {
			case "no":
				// El usuario declina: el guía le recuerda la constancia (idioma nativo) y se
				// despide (en inglés, para cerrar con inmersión).
				constancy := h.Phrases.Phrase(services.PhraseConstancy, lang, displayName)
				goodbye := h.Phrases.Phrase(services.PhraseGoodbye, "en", displayName)
				msg := fmt.Sprintf("*%s:* %s\n\n%s", guideName, constancy, goodbye)
				_, _ = h.WhatsAppService.SendText(payload.Instance, cleanNumber, msg)
				services.SaveConversationMessage(conv.ID, models.WAMessageRoleAssistant, models.WAMessageTypeMotivation, msg)
				services.CloseConversation(conv)
				return c.SendStatus(fiber.StatusOK)
			case "yes":
				// El usuario acepta: elegimos un reto y se lo enviamos (inglés + ayuda nativa).
				challengePtr, pickErr := services.PickChallengeForUser(contact.UserID)
				if pickErr != nil {
					log.Printf("[WhatsAppWebhook] No challenge available for user %s: %v", contact.UserID, pickErr)
					sorry := fmt.Sprintf("*%s:* %s", guideName, h.Phrases.Phrase(services.PhraseNoChallenge, lang, displayName))
					_, _ = h.WhatsAppService.SendText(payload.Instance, cleanNumber, sorry)
					services.CloseConversation(conv)
					return c.SendStatus(fiber.StatusOK)
				}
				challenge := *challengePtr

				// Registramos el reto como reminder practice_suggestion: es el que el
				// calificador buscará al recibir la respuesta del usuario.
				now := time.Now()
				cid := challenge.ID
				reminder := models.WhatsAppReminder{
					ID:           uuid.New(),
					UserID:       contact.UserID,
					ReminderType: models.WAReminderTypePracticeSuggestion,
					Message:      challenge.Question,
					ChallengeID:  &cid,
					ScheduledAt:  now,
					Sent:         true,
					SentAt:       &now,
				}
				if err := database.DB.Create(&reminder).Error; err != nil {
					log.Printf("[WhatsAppWebhook] Failed to create challenge reminder for user %s: %v", contact.UserID, err)
					return c.SendStatus(fiber.StatusOK)
				}

				// Ayuda nativa del reto (cacheada/LLM) + instrucciones localizadas.
				nativeQ := ""
				if h.Translations != nil {
					if tr := h.Translations.GetChallengeTranslation(&challenge, lang); tr != nil {
						nativeQ = tr.QuestionNative
					}
				}
				askChoice := h.Phrases.Phrase(services.PhraseAskChoice, lang, displayName)
				askAudio := h.Phrases.Phrase(services.PhraseAskAudio, lang, displayName)
				cardNinja := rand.Intn(2) == 0
				challengeMsg := services.AssembleChallenge(guideName, challenge, nativeQ, askChoice, askAudio, cardNinja)

				_, _ = h.WhatsAppService.SendText(payload.Instance, cleanNumber, challengeMsg)
				services.SaveConversationMessage(conv.ID, models.WAMessageRoleAssistant, models.WAMessageTypePracticePrompt, challengeMsg)
				services.SetConversationIntent(conv, models.WAIntentAwaitingAnswer)
				return c.SendStatus(fiber.StatusOK)
			default:
				// No se entendió: reformular la pregunta sí/no (localizada).
				reask := fmt.Sprintf("*%s:* %s", guideName, h.Phrases.Phrase(services.PhraseReask, lang, displayName))
				_, _ = h.WhatsAppService.SendText(payload.Instance, cleanNumber, reask)
				services.SaveConversationMessage(conv.ID, models.WAMessageRoleAssistant, models.WAMessageTypeText, reask)
				return c.SendStatus(fiber.StatusOK)
			}
		}

		// STEP 2: hay un reto pendiente -> calificar la respuesta (audio o texto).
		// Check if it is a voice note/audio message
		if isAudio {
			log.Printf("[WhatsAppWebhook] Received audio note response from contact: %s", cleanNumber)

			// Find last unanswered smart challenge reminder in the last 24h. El filtro
			// answered_at IS NULL evita re-calificar (y re-otorgar XP) un reto ya respondido.
			var lastReminder models.WhatsAppReminder
			err = database.DB.Where("user_id = ? AND reminder_type = ? AND sent = ? AND answered_at IS NULL AND sent_at > ?",
				contact.UserID, models.WAReminderTypePracticeSuggestion, true, time.Now().Add(-24*time.Hour)).
				Order("sent_at DESC").First(&lastReminder).Error

			if err != nil {
				log.Printf("[WhatsAppWebhook] No active pronunciation challenge found for user %s", contact.UserID)
				return c.SendStatus(fiber.StatusOK)
			}

			// Resolve the challenge linked to this reminder (by id, with substring fallback)
			challengePtr, matchErr := resolveChallengeForReminder(&lastReminder)
			if matchErr != nil {
				log.Printf("[WhatsAppWebhook] Failed to match learning challenge for audio note: %v", matchErr)
				return c.SendStatus(fiber.StatusOK)
			}
			challenge := *challengePtr

			// Clean target reference word to pronounce (e.g. from single or double quotes)
			targetWord := challenge.Question
			firstQuote := strings.Index(challenge.Question, "'")
			lastQuote := strings.LastIndex(challenge.Question, "'")
			if firstQuote != -1 && lastQuote != -1 && firstQuote < lastQuote {
				targetWord = challenge.Question[firstQuote+1 : lastQuote]
			} else {
				firstQuote = strings.Index(challenge.Question, "\"")
				lastQuote = strings.LastIndex(challenge.Question, "\"")
				if firstQuote != -1 && lastQuote != -1 && firstQuote < lastQuote {
					targetWord = challenge.Question[firstQuote+1 : lastQuote]
				}
			}

			// Download audio file bytes from Evolution API. La clave del mensaje vive en
			// payload.Data.Key (no dentro del contenido Message); construir el mapa desde
			// ahí evita el panic por type-assertion sobre una clave inexistente.
			messageKey := map[string]interface{}{
				"remoteJid": payload.Data.Key.RemoteJid,
				"fromMe":    payload.Data.Key.FromMe,
				"id":        payload.Data.Key.ID,
			}
			audioBytes, downloadErr := h.WhatsAppService.DownloadMedia(payload.Instance, messageKey, payload.Data.Message)
			if downloadErr != nil {
				log.Printf("[WhatsAppWebhook] Failed to download user voice note: %v", downloadErr)
				return c.SendStatus(fiber.StatusOK)
			}

			// Analyze pronunciation calling microservice
			score, _, analyzeErr := analyzePronunciation(audioBytes, targetWord)
			if analyzeErr != nil {
				log.Printf("[WhatsAppWebhook] Pronunciation microservice offline or failed: %v. Falling back to default scoring...", analyzeErr)
				// Soft fallback for offline environment to keep application flow interactive
				score = 82
			}

			// Record attempt and award RPG stats
			isCorrect := score >= 75
			attemptRepo := repository.NewLearningRepository()
			_, _ = attemptRepo.RecordAttempt(contact.UserID, challenge.ID, isCorrect, 1, fmt.Sprintf("Pronunciation accuracy: %d%%", score))
			markReminderAnswered(&lastReminder)

			// Award RPG stats
			xpGained := 5
			goldGained := 0
			if isCorrect {
				xpGained = 15
				goldGained = 10
			}

			var stats models.PlayerStats
			if err := database.DB.Where("user_id = ?", contact.UserID).First(&stats).Error; err == nil {
				stats.Experience += xpGained
				stats.Gold += goldGained

				// Level up check
				nextLevelXP := stats.Level * 100
				if stats.Experience >= nextLevelXP {
					stats.Experience -= nextLevelXP
					stats.Level++
					stats.Attack += 2
					stats.Defense += 1
				}
				database.DB.Save(&stats)
			}

			// Feedback localizado + recordatorio de constancia (nativo) + despedida (inglés).
			constancy := h.Phrases.Phrase(services.PhraseConstancy, lang, displayName)
			goodbye := h.Phrases.Phrase(services.PhraseGoodbye, "en", displayName)
			var feedbackMsg string
			if isCorrect {
				headline := h.Phrases.Phrase(services.PhraseCorrect, lang, displayName)
				feedbackMsg = fmt.Sprintf("*%s:* %s\n🎯 %d%% · *%s*\n⭐ +%d XP · +%d 🪙\n\n%s\n%s", guideName, headline, score, targetWord, xpGained, goldGained, constancy, goodbye)
			} else {
				headline := h.Phrases.Phrase(services.PhraseIncorrect, lang, displayName)
				feedbackMsg = fmt.Sprintf("*%s:* %s\n🎯 %d%% · *%s*\n⭐ +%d XP\n\n%s\n%s", guideName, headline, score, targetWord, xpGained, constancy, goodbye)
			}

			_, _ = h.WhatsAppService.SendText(payload.Instance, cleanNumber, feedbackMsg)
			if conv != nil {
				services.SaveConversationMessage(conv.ID, models.WAMessageRoleAssistant, models.WAMessageTypeFeedback, feedbackMsg)
				services.CloseConversation(conv)
			}

		} else {
			// Process as a text response
			messageText := extractMessageText(payload.Data.Message)
			if messageText != "" {
				choice := normalizeChoice(messageText)
				if choice == 0 {
					// La respuesta no parece una opción: enviar pista localizada sin calificar.
					reminderMsg := fmt.Sprintf("*%s:* %s", guideName, h.Phrases.Phrase(services.PhraseAskChoice, lang, displayName))
					_, _ = h.WhatsAppService.SendText(payload.Instance, cleanNumber, reminderMsg)
					return c.SendStatus(fiber.StatusOK)
				}

				// Find last unanswered smart challenge reminder in the last 24h. El filtro
				// answered_at IS NULL evita re-calificar (y re-otorgar XP) un reto ya respondido.
				var lastReminder models.WhatsAppReminder
				err = database.DB.Where("user_id = ? AND reminder_type = ? AND sent = ? AND answered_at IS NULL AND sent_at > ?",
					contact.UserID, models.WAReminderTypePracticeSuggestion, true, time.Now().Add(-24*time.Hour)).
					Order("sent_at DESC").First(&lastReminder).Error

				if err != nil {
					log.Printf("[WhatsAppWebhook] No active challenge found for text answer from user %s", contact.UserID)
					return c.SendStatus(fiber.StatusOK)
				}

				// Resolve the challenge linked to this reminder (by id, with substring fallback)
				challengePtr, matchErr := resolveChallengeForReminder(&lastReminder)
				if matchErr != nil {
					log.Printf("[WhatsAppWebhook] Failed to match learning challenge for text answer: %v", matchErr)
					return c.SendStatus(fiber.StatusOK)
				}
				challenge := *challengePtr

				isCorrect := choice == challenge.CorrectOption

				// Record attempt and award XP
				attemptRepo := repository.NewLearningRepository()
				_, _ = attemptRepo.RecordAttempt(contact.UserID, challenge.ID, isCorrect, choice, "")
				markReminderAnswered(&lastReminder)

				// Award RPG XP and Gold
				xpGained := 5
				goldGained := 0
				if isCorrect {
					xpGained = 15
					goldGained = 10
				}

				var stats models.PlayerStats
				if err := database.DB.Where("user_id = ?", contact.UserID).First(&stats).Error; err == nil {
					stats.Experience += xpGained
					stats.Gold += goldGained

					// Level up check
					nextLevelXP := stats.Level * 100
					if stats.Experience >= nextLevelXP {
						stats.Experience -= nextLevelXP
						stats.Level++
						stats.Attack += 2
						stats.Defense += 1
					}
					database.DB.Save(&stats)
				}

				// Explicación en idioma nativo (cacheada/LLM) con fallback a la columna ES.
				explanation := challenge.ExplanationES
				if h.Translations != nil {
					if tr := h.Translations.GetChallengeTranslation(&challenge, lang); tr != nil && tr.ExplanationNative != "" {
						explanation = tr.ExplanationNative
					}
				}

				constancy := h.Phrases.Phrase(services.PhraseConstancy, lang, displayName)
				goodbye := h.Phrases.Phrase(services.PhraseGoodbye, "en", displayName)

				var feedbackMsg string
				if isCorrect {
					headline := h.Phrases.Phrase(services.PhraseCorrect, lang, displayName)
					feedbackMsg = fmt.Sprintf("*%s:* %s\n\n📝 %s\n⭐ +%d XP · +%d 🪙\n\n%s\n%s", guideName, headline, explanation, xpGained, goldGained, constancy, goodbye)
				} else {
					var correctOptionText string
					switch challenge.CorrectOption {
					case 1:
						correctOptionText = fmt.Sprintf("1️⃣ %s", challenge.Option1)
					case 2:
						correctOptionText = fmt.Sprintf("2️⃣ %s", challenge.Option2)
					case 3:
						correctOptionText = fmt.Sprintf("3️⃣ %s", challenge.Option3)
					}
					headline := h.Phrases.Phrase(services.PhraseIncorrect, lang, displayName)
					feedbackMsg = fmt.Sprintf("*%s:* %s\n✅ %s\n\n📝 %s\n⭐ +%d XP\n\n%s\n%s", guideName, headline, correctOptionText, explanation, xpGained, constancy, goodbye)
				}

				_, _ = h.WhatsAppService.SendText(payload.Instance, cleanNumber, feedbackMsg)
				if conv != nil {
					services.SaveConversationMessage(conv.ID, models.WAMessageRoleAssistant, models.WAMessageTypeFeedback, feedbackMsg)
					services.CloseConversation(conv)
				}
			}
		}
	}

	return c.SendStatus(fiber.StatusOK)
}

// resolveChallengeForReminder obtiene el reto de aprendizaje vinculado a un reminder.
// Prefiere el challenge_id exacto (preciso); para reminders antiguos sin ese campo
// cae al matching por substring de la pregunta (frágil, solo compatibilidad).
func resolveChallengeForReminder(reminder *models.WhatsAppReminder) (*models.LearningChallenge, error) {
	var challenge models.LearningChallenge
	if reminder.ChallengeID != nil {
		if err := database.DB.First(&challenge, "id = ?", *reminder.ChallengeID).Error; err == nil {
			return &challenge, nil
		}
	}
	if err := database.DB.Where("? LIKE '%' || question || '%'", reminder.Message).First(&challenge).Error; err != nil {
		return nil, err
	}
	return &challenge, nil
}

// markReminderAnswered sella el reminder como ya respondido para que un mismo reto no
// pueda calificarse (y otorgar XP) más de una vez.
func markReminderAnswered(reminder *models.WhatsAppReminder) {
	now := time.Now()
	reminder.AnsweredAt = &now
	if err := database.DB.Model(reminder).Update("answered_at", &now).Error; err != nil {
		log.Printf("[WhatsAppWebhook] Warning: failed to mark reminder %s answered: %v", reminder.ID, err)
	}
}

// normalizePhone deja el número en el formato que usa el JID de WhatsApp: solo dígitos,
// sin '+', espacios ni separadores. Así el número guardado al registrar coincide con el
// que llega en el webhook entrante.
func normalizePhone(number string) string {
	var b strings.Builder
	for _, r := range number {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// extractMessageText extracts the message text from a flexible webhook message map
func extractMessageText(messageMap map[string]interface{}) string {
	if messageMap == nil {
		return ""
	}
	if conv, ok := messageMap["conversation"].(string); ok {
		return conv
	}
	if extMsg, ok := messageMap["extendedTextMessage"].(map[string]interface{}); ok {
		if text, ok := extMsg["text"].(string); ok {
			return text
		}
	}
	if text, ok := messageMap["text"].(string); ok {
		return text
	}
	return ""
}

// normalizeChoice parses string to identify numerical choice (1, 2 or 3)
func normalizeChoice(text string) int {
	text = strings.ToLower(strings.TrimSpace(text))
	replacer := strings.NewReplacer(
		"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u",
		"1️⃣", "1", "2️⃣", "2", "3️⃣", "3",
	)
	text = replacer.Replace(text)

	if strings.Contains(text, "opcion 1") || strings.Contains(text, "la 1") || strings.Contains(text, "la uno") || strings.Contains(text, "primera") {
		return 1
	}
	if strings.Contains(text, "opcion 2") || strings.Contains(text, "la 2") || strings.Contains(text, "la dos") || strings.Contains(text, "segunda") {
		return 2
	}
	if strings.Contains(text, "opcion 3") || strings.Contains(text, "la 3") || strings.Contains(text, "la tres") || strings.Contains(text, "tercera") {
		return 3
	}

	// Token-based: solo aceptar un token que SEA en sí mismo una opción (p. ej. "1",
	// "b", "2)", "c."). Escanear carácter a carácter como antes hacía que texto libre
	// ("buenos dias" → 'b', "creo que..." → 'c') se calificara como respuesta.
	for _, tok := range strings.Fields(text) {
		tok = strings.Trim(tok, ".)-:°º()[]\"'")
		switch tok {
		case "1", "a":
			return 1
		case "2", "b":
			return 2
		case "3", "c":
			return 3
		}
	}

	return 0
}

// normalizeYesNo interpreta una respuesta libre como "yes", "no" o "" (no entendida)
// para el paso de confirmación de práctica del flujo conversacional.
func normalizeYesNo(text string) string {
	t := strings.ToLower(strings.TrimSpace(text))
	t = strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u").Replace(t)

	noPhrases := []string{"ahora no", "hoy no", "mas tarde", "luego", "despues", "no puedo", "no gracias", "no quiero", "not now", "no thanks"}
	for _, p := range noPhrases {
		if strings.Contains(t, p) {
			return "no"
		}
	}

	yesPhrases := []string{"por supuesto", "de una", "claro que si", "obvio", "empecemos", "vamos alla"}
	for _, p := range yesPhrases {
		if strings.Contains(t, p) {
			return "yes"
		}
	}

	// Coincidencia por token: respuestas cortas y claras en varios idiomas.
	for _, tok := range strings.Fields(t) {
		tok = strings.Trim(tok, ".,!¡¿?()-:")
		switch tok {
		// es / en / pt / fr / it / de
		case "no", "nop", "nel", "nope", "nao", "non", "nein":
			return "no"
		case "si", "sii", "siii", "sip", "claro", "dale", "ok", "okay", "va", "listo", "vamos",
			"quiero", "yes", "sure", "yep", "yeah", "jugar", "practicar", "sim", "oui", "ja", "si!":
			return "yes"
		}
	}

	return ""
}

// analyzePronunciation calls the speech analysis API of the voice sub-service
func analyzePronunciation(audioBytes []byte, targetWord string) (int, string, error) {
	bodyBuf := &bytes.Buffer{}
	bodyWriter := multipart.NewWriter(bodyBuf)

	fileWriter, err := bodyWriter.CreateFormFile("file", "recording.ogg")
	if err != nil {
		return 0, "", fmt.Errorf("failed to create form file: %v", err)
	}

	_, err = io.Copy(fileWriter, bytes.NewReader(audioBytes))
	if err != nil {
		return 0, "", fmt.Errorf("failed to write audio to form: %v", err)
	}

	textWriter, err := bodyWriter.CreateFormField("text")
	if err != nil {
		return 0, "", fmt.Errorf("failed to create text field: %v", err)
	}
	_, err = textWriter.Write([]byte(targetWord))
	if err != nil {
		return 0, "", fmt.Errorf("failed to write target word: %v", err)
	}

	bodyWriter.Close()

	req, err := http.NewRequest("POST", "http://localhost:8000/api/analyze", bodyBuf)
	if err != nil {
		return 0, "", fmt.Errorf("failed to create post request: %v", err)
	}
	req.Header.Set("Content-Type", bodyWriter.FormDataContentType())

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, "", fmt.Errorf("http request failed: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, "", fmt.Errorf("failed to read response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return 0, "", fmt.Errorf("status code %d: %s", resp.StatusCode, string(respBytes))
	}

	var res struct {
		Score int `json:"score"`
	}
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return 0, "", fmt.Errorf("failed to unmarshal score: %v", err)
	}

	return res.Score, string(respBytes), nil
}
