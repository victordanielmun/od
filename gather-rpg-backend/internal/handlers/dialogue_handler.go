package handlers

import (
	"gather-rpg-backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type DialogueHandler struct {
	Service *services.DialogueService
}

func NewDialogueHandler(service *services.DialogueService) *DialogueHandler {
	return &DialogueHandler{Service: service}
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

	return c.JSON(resp)
}
