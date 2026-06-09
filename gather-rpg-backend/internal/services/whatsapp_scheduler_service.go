package services

import (
	"fmt"
	"log"
	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"github.com/google/uuid"
)

type WhatsAppSchedulerService struct {
	queueService *WhatsAppQueueService
}

func NewWhatsAppSchedulerService(queueService *WhatsAppQueueService) *WhatsAppSchedulerService {
	return &WhatsAppSchedulerService{queueService: queueService}
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

		// 3. Prevent duplicate notifications (18 hours cooldown)
		var lastReminder models.WhatsAppReminder
		err = database.DB.Where("user_id = ? AND sent = ? AND sent_at > ?", contact.UserID, true, now.Add(-18*time.Hour)).First(&lastReminder).Error
		if err == nil {
			// A reminder has already been sent recently, skip
			continue
		}

		// 4. Check user activity period (Active <= 24 hours, Inactive > 24 hours)
		isActive := false
		if contact.LastActiveAt != nil && now.Sub(*contact.LastActiveAt) <= 24*time.Hour {
			isActive = true
		}

		var messageText string
		var reminderType models.WAReminderType

		if isActive {
			// Fetch player's english level
			var profile models.UserLearningProfile
			level := models.DifficultyBeginner
			if err = database.DB.Where("user_id = ?", contact.UserID).First(&profile).Error; err == nil {
				level = profile.EnglishLevel
			}

			// Case A: Active User -> Fetch random Learning Challenge tagged with 'whatsapp' matching their level
			var challenge models.LearningChallenge
			err = database.DB.Where("? = ANY(tags) AND difficulty = ?", "whatsapp", level).Order("RANDOM()").First(&challenge).Error
			if err != nil {
				// Fallback 1: fetch any random learning challenge matching their level
				err = database.DB.Where("difficulty = ?", level).Order("RANDOM()").First(&challenge).Error
			}
			if err != nil {
				// Fallback 2: fetch any random learning challenge
				err = database.DB.Order("RANDOM()").First(&challenge).Error
			}

			if err != nil {
				log.Printf("[WhatsAppScheduler] Warning: Failed to fetch learning challenge for active user %s: %v", contact.UserID, err)
				continue
			}

			messageText = fmt.Sprintf("📚 *¡Desafío de Inglés de Hoy!*\n\n%s\n\n1️⃣ %s\n2️⃣ %s\n3️⃣ %s\n\n💡 *Responde con el número de la opción correcta (1, 2 o 3) para ganar XP!*", challenge.Question, challenge.Option1, challenge.Option2, challenge.Option3)
			reminderType = models.WAReminderTypePracticeSuggestion
		} else {
			// Case B: Inactive User -> Fetch random active Motivation message
			var motivation models.Motivation
			err = database.DB.Where("is_active = ?", true).Order("RANDOM()").First(&motivation).Error
			if err != nil {
				log.Printf("[WhatsAppScheduler] Warning: Failed to fetch active motivation for user %s: %v", contact.UserID, err)
				continue
			}

			messageText = fmt.Sprintf("💪 *¡Momento de Motivación!*\n\n%s", motivation.MessageES)
			reminderType = models.WAReminderTypeInactive1Day
		}

		// 5. Log the sent reminder in the database
		reminder := models.WhatsAppReminder{
			ID:           uuid.New(),
			UserID:       contact.UserID,
			ReminderType: reminderType,
			Message:      messageText,
			ScheduledAt:  now,
			Sent:         true,
			SentAt:       &now,
		}
		if err := database.DB.Create(&reminder).Error; err != nil {
			log.Printf("[WhatsAppScheduler] Error creating reminder log in DB for user %s: %v", contact.UserID, err)
			continue
		}

		// 6. Enqueue the reminder into the secure anti-ban message queue worker
		s.queueService.Enqueue("admin_global", contact.PhoneNumber, messageText)
		log.Printf("[WhatsAppScheduler] Successfully enqueued dynamic WhatsApp notification for User %s (Type: %s)", contact.UserID, reminderType)
	}
}
