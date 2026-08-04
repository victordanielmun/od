package handlers

import (
	"strconv"

	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// uuidNil deja explícito que la fila espejo la crea el servicio, no el cliente.
var uuidNil = uuid.Nil

// AdminAIPlayerHandler expone la configuración de los jugadores con IA, en el
// mismo estilo que el resto de CRUDs del panel.
//
// Ojo con una diferencia respecto a los demás: crear o borrar un bot toca también
// la tabla `users` (su fila espejo), así que todo pasa por el servicio y nunca se
// escribe la tabla a pelo.
type AdminAIPlayerHandler struct {
	Service *services.AIPlayerService
}

func NewAdminAIPlayerHandler(service *services.AIPlayerService) *AdminAIPlayerHandler {
	return &AdminAIPlayerHandler{Service: service}
}

func (h *AdminAIPlayerHandler) List(c *fiber.Ctx) error {
	bots, err := h.Service.ListAll()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(bots)
}

func (h *AdminAIPlayerHandler) Create(c *fiber.Ctx) error {
	var bot models.AIPlayer
	if err := c.BodyParser(&bot); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	// El id y la fila espejo los decide el servidor, nunca el cliente.
	bot.ID = 0
	bot.UserID = uuidNil

	if err := h.Service.Create(&bot); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(bot)
}

func (h *AdminAIPlayerHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid id"})
	}

	existing, err := h.Service.GetByID(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "AI player not found"})
	}

	// Se parsea SOBRE la fila existente para que el cuerpo no pueda reasignar el
	// user_id: perder ese enlace dejaría al bot mudo y sin historial.
	userID := existing.UserID
	if err := c.BodyParser(existing); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	existing.ID = uint(id)
	existing.UserID = userID

	if err := h.Service.Update(existing); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(existing)
}

func (h *AdminAIPlayerHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid id"})
	}
	if err := h.Service.Delete(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// SeedDefaults crea de una vez el elenco inicial del lobby, para no tener que
// escribir cinco fichas a mano la primera vez. Es idempotente por nombre: los que
// ya existan se dejan como están.
func (h *AdminAIPlayerHandler) SeedDefaults(c *fiber.Ctx) error {
	created, err := h.Service.SeedDefaults()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"created": created})
}
