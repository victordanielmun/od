package handlers

import (
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"gather-rpg-backend/internal/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type DialogueHandler struct {
	Service *services.DialogueService
	Hub     *websocket.Hub
}

func NewDialogueHandler(service *services.DialogueService, hub *websocket.Hub) *DialogueHandler {
	return &DialogueHandler{Service: service, Hub: hub}
}

func (h *DialogueHandler) ProcessInput(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	var req services.DialogueRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Override player_id from token for safety
	req.PlayerID = userID

	resp, err := h.Service.ProcessInput(req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to process dialogue", "details": err.Error()})
	}

	// Emit WebSocket event if mission was just completed
	if resp.MissionNewlyCompleted && h.Hub != nil && req.MissionID != nil {
		payload := models.MissionCompletedBroadcast{
			MissionID: *req.MissionID,
			RoomID:    req.RoomID.String(),
		}

		if resp.MissionDetails != nil {
			payload.Title = resp.MissionDetails.Title
			payload.DescriptionEn = resp.MissionDetails.DescriptionEn
			payload.RewardGold = resp.MissionDetails.RewardGold
		}

		h.Hub.BroadcastToRoom(req.RoomID.String(), &models.WSMessage{
			Type:    websocket.MsgMissionCompleted,
			Payload: payload,
		})
	}

	return c.JSON(resp)
}
