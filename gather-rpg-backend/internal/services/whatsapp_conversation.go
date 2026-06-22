package services

import (
	"log"
	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
)

// GetOpenConversation devuelve la conversación no cerrada más reciente del usuario, o nil.
func GetOpenConversation(userID uuid.UUID) *models.WhatsAppConversation {
	var conv models.WhatsAppConversation
	err := database.DB.Where("user_id = ? AND status <> ?", userID, models.WAConversationStatusClosed).
		Order("last_message_at DESC NULLS LAST").First(&conv).Error
	if err != nil {
		return nil
	}
	return &conv
}

// StartConversation reutiliza o crea una conversación en el `intent` dado (p. ej. el guía
// acaba de saludar). Devuelve la conversación para poder registrar mensajes en ella.
func StartConversation(userID uuid.UUID, intent string) *models.WhatsAppConversation {
	now := time.Now()
	conv := GetOpenConversation(userID)
	if conv == nil {
		nc := models.WhatsAppConversation{
			ID:            uuid.New(),
			UserID:        userID,
			Channel:       "whatsapp",
			Status:        models.WAConversationStatusWaitingReply,
			Intent:        intent,
			LastMessageAt: &now,
		}
		if err := database.DB.Create(&nc).Error; err != nil {
			log.Printf("[WhatsAppConversation] Warning: failed to create conversation for user %s: %v", userID, err)
			return nil
		}
		return &nc
	}
	conv.Intent = intent
	conv.Status = models.WAConversationStatusWaitingReply
	conv.LastMessageAt = &now
	conv.ClosedAt = nil
	database.DB.Model(conv).Updates(map[string]interface{}{
		"intent":          intent,
		"status":          models.WAConversationStatusWaitingReply,
		"last_message_at": &now,
		"closed_at":       nil,
	})
	return conv
}

// SetConversationIntent actualiza el paso actual del diálogo.
func SetConversationIntent(conv *models.WhatsAppConversation, intent string) {
	if conv == nil {
		return
	}
	now := time.Now()
	conv.Intent = intent
	conv.Status = models.WAConversationStatusWaitingReply
	conv.LastMessageAt = &now
	database.DB.Model(conv).Updates(map[string]interface{}{
		"intent":          intent,
		"status":          models.WAConversationStatusWaitingReply,
		"last_message_at": &now,
	})
}

// CloseConversation marca la conversación como cerrada (diálogo terminado).
func CloseConversation(conv *models.WhatsAppConversation) {
	if conv == nil {
		return
	}
	now := time.Now()
	conv.Status = models.WAConversationStatusClosed
	conv.ClosedAt = &now
	database.DB.Model(conv).Updates(map[string]interface{}{
		"status":          models.WAConversationStatusClosed,
		"closed_at":       &now,
		"last_message_at": &now,
	})
}

// SaveConversationMessage persiste un mensaje del historial (best-effort).
func SaveConversationMessage(convID uuid.UUID, role models.WAMessageRole, msgType models.WAMessageType, content string) {
	msg := models.WhatsAppMessage{
		ID:             uuid.New(),
		ConversationID: convID,
		Role:           role,
		MessageType:    msgType,
		Content:        content,
		SentAt:         time.Now(),
	}
	if err := database.DB.Create(&msg).Error; err != nil {
		log.Printf("[WhatsAppConversation] Warning: failed to persist message: %v", err)
	}
}
