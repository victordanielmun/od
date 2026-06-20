package handlers

import (
	"gather-rpg-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

type AdminHandler struct {
	NPCService *services.NPCService
}

func NewAdminHandler(npcService *services.NPCService) *AdminHandler {
	return &AdminHandler{NPCService: npcService}
}

func (h *AdminHandler) SendStatus(c *fiber.Ctx) error {
	return c.SendStatus(204)
}
