package services

import (
	"fmt"
	"log"
	"math/rand"
	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/utils"
	"github.com/google/uuid"
)

type WhatsAppSchedulerService struct {
	queueService  *WhatsAppQueueService
	phraseService *WAPhraseService
}

func NewWhatsAppSchedulerService(queueService *WhatsAppQueueService, phraseService *WAPhraseService) *WhatsAppSchedulerService {
	return &WhatsAppSchedulerService{queueService: queueService, phraseService: phraseService}
}

// Start starts the background scheduler goroutine loop that triggers every 1 hour
func (s *WhatsAppSchedulerService) Start() {
	go func() {
		// Run every 1 hour
		ticker := time.NewTicker(1 * time.Hour)
		log.Println("[WhatsAppScheduler] Background scheduler loop started successfully.")

		// Initial execution
		s.RunScheduler()

		for range ticker.C {
			s.RunScheduler()
		}
	}()
}

// RunScheduler queries for qualified contacts and triggers their corresponding reminders/challenges
func (s *WhatsAppSchedulerService) RunScheduler() {
	log.Println("[WhatsAppScheduler] Running WhatsApp notification scheduler...")

	var contacts []models.WhatsAppContact
	// Query contacts who have notifications enabled and are not temporarily disabled
	err := database.DB.Where("notifications_enabled = ? AND temporarily_disabled = ?", true, false).Find(&contacts).Error
	if err != nil {
		log.Printf("[WhatsAppScheduler] Error fetching active contacts from database: %v", err)
		return
	}

	now := time.Now()

	// Aleatorizar el orden de envío en cada corrida evita un patrón fijo y predecible
	// (mismos números, misma secuencia cada hora), señal típica que dispara anti-spam.
	rand.Shuffle(len(contacts), func(i, j int) {
		contacts[i], contacts[j] = contacts[j], contacts[i]
	})

	for _, contact := range contacts {
		// 1. Calculate local hour based on user's timezone
		loc, err := time.LoadLocation(contact.Timezone)
		if err != nil {
			log.Printf("[WhatsAppScheduler] Warning: Failed to load timezone %s for user %s: %v. Falling back to America/Bogota", contact.Timezone, contact.UserID, err)
			loc, _ = time.LoadLocation("America/Bogota")
		}

		localTime := now.In(loc)
		localHour := int16(localTime.Hour())

		// 2. Validate preferred hours range
		if localHour < contact.PreferredHourStart || localHour >= contact.PreferredHourEnd {
			// Outside preferred hours, skip this user
			continue
		}

		// 2b. Hora aleatoria dentro de la ventana: en vez de enviar siempre a la primera
		// hora elegible, lanzamos con probabilidad 1/horas_restantes. Esto reparte el
		// envío diario de forma uniforme y aleatoria por toda la franja del usuario; en la
		// última hora disponible la probabilidad es 1, así que el mensaje del día no se
		// pierde. Variar la hora cada día es clave para no parecer un bot.
		remainingHours := int(contact.PreferredHourEnd - localHour)
		if remainingHours < 1 {
			remainingHours = 1
		}
		if rand.Intn(remainingHours) != 0 {
			continue
		}

		// 3. Prevent duplicate notifications (18 hours cooldown)
		var lastReminder models.WhatsAppReminder
		err = database.DB.Where("user_id = ? AND sent = ? AND sent_at > ?", contact.UserID, true, now.Add(-18*time.Hour)).First(&lastReminder).Error
		if err == nil {
			// A reminder has already been sent recently, skip
			continue
		}

		// 4. Resolve user + guide for the NPC-styled invitation.
		var user models.User
		if err := database.DB.First(&user, "id = ?", contact.UserID).Error; err != nil {
			log.Printf("[WhatsAppScheduler] Warning: failed to load user %s: %v", contact.UserID, err)
			continue
		}
		guideName, _ := GuideInfo(user)
		lang := utils.NormalizeLang(user.NativeLanguage)

		displayName := contact.WhatsAppName
		if displayName == "" {
			displayName = user.Username
		}

		// 5. Build the localized greeting only (the conversation continues turn by turn:
		// el siguiente mensaje del usuario dispara la motivación + invitación en el webhook).
		greeting := s.phraseService.Phrase(PhraseGreeting, lang, displayName)
		greetingText := fmt.Sprintf("*%s:* %s", guideName, greeting)

		// 6. Start/refresh the conversation in "awaiting greeting reply" state.
		conv := StartConversation(contact.UserID, models.WAIntentAwaitingGreetingReply)

		// 7. Log the sent reminder (acts as the 18h cooldown marker). Type custom so it is
		// NOT picked up by the answer grader (que solo mira practice_suggestion).
		reminder := models.WhatsAppReminder{
			ID:           uuid.New(),
			UserID:       contact.UserID,
			ReminderType: models.WAReminderTypeCustom,
			Message:      greetingText,
			ScheduledAt:  now,
			Sent:         true,
			SentAt:       &now,
		}
		if err := database.DB.Create(&reminder).Error; err != nil {
			log.Printf("[WhatsAppScheduler] Error creating reminder log in DB for user %s: %v", contact.UserID, err)
			continue
		}

		if conv != nil {
			SaveConversationMessage(conv.ID, models.WAMessageRoleAssistant, models.WAMessageTypeOnboarding, greetingText)
		}

		// 8. Enqueue into the secure anti-ban message queue worker.
		s.queueService.Enqueue("admin_global", contact.PhoneNumber, greetingText)
		log.Printf("[WhatsAppScheduler] Enqueued greeting for User %s", contact.UserID)
	}
}
