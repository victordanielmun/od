package handlers

import (
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type RoomHandler struct {
	Service *services.RoomService
}

func NewRoomHandler(service *services.RoomService) *RoomHandler {
	return &RoomHandler{Service: service}
}

func (h *RoomHandler) GetPublicRooms(c *fiber.Ctx) error {
	rooms, err := h.Service.GetPublicRooms()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(rooms)
}

func (h *RoomHandler) GetRoom(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid room ID"})
	}

	room, err := h.Service.GetRoom(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Room not found"})
	}
	return c.JSON(room)
}

func (h *RoomHandler) CreateRoom(c *fiber.Ctx) error {
	var req models.CreateRoomRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate input (basic)
	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Room name is required"})
	}
	if req.MaxUsers <= 0 {
		req.MaxUsers = 50 // Default
	}

	// Get user ID from context (set by middleware)
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user ID in token"})
	}

	room := &models.Room{
		Name:      req.Name,
		MaxUsers:  req.MaxUsers,
		IsPublic:  req.IsPublic,
		MapData:   req.MapData,
		CreatedBy: userID,
	}

	if err := h.Service.CreateRoom(room); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(room)
}
