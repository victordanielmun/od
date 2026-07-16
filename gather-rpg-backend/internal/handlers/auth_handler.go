package handlers

import (
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

type AuthHandler struct {
	Service *services.AuthService
}

func NewAuthHandler(service *services.AuthService) *AuthHandler {
	return &AuthHandler{Service: service}
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req models.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	res, err := h.Service.Register(req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(res)
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req models.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	res, err := h.Service.Login(req)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(res)
}

func (h *AuthHandler) GuestLogin(c *fiber.Ctx) error {
	var req struct {
		CharacterIDs   []string `json:"character_ids"`
		NativeLanguage string   `json:"native_language"`
		DeviceID       string   `json:"device_id"`
	}
	// Parse optionally provided character_ids, native_language, and device_id from the body
	_ = c.BodyParser(&req)

	res, err := h.Service.LoginGuest(req.CharacterIDs, req.NativeLanguage, req.DeviceID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(res)
}

func (h *AuthHandler) UpgradeGuest(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req models.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	res, err := h.Service.UpgradeGuest(userIDStr, req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(res)
}

func (h *AuthHandler) GetPlayerStats(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	stats, err := h.Service.GetPlayerStats(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(stats)
}

// SetCompanion saves the companion selection for the current authenticated user
func (h *AuthHandler) SetCompanion(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		CompanionNPCID uint `json:"companion_npc_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := h.Service.UpdateCompanion(userIDStr, req.CompanionNPCID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Companion companion selected successfully"})
}

// AcceptTerms marks the onboarding terms as accepted for the current user
func (h *AuthHandler) AcceptTerms(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		TermsAccepted bool `json:"terms_accepted"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if !req.TermsAccepted {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Terms must be accepted"})
	}

	if err := h.Service.AcceptTerms(userIDStr); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Terms accepted successfully"})
}

// SetNativeLanguage saves the player's native language (ISO-639-1) for the current user.
// This is what makes all helper translations resolve into that language.
func (h *AuthHandler) SetNativeLanguage(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		NativeLanguage string `json:"native_language"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.NativeLanguage == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "native_language is required"})
	}

	if err := h.Service.UpdateNativeLanguage(userIDStr, req.NativeLanguage); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Native language updated successfully"})
}

// SetSprite allows the user to choose their character sprite once
func (h *AuthHandler) SetSprite(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		CharacterID string `json:"character_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.CharacterID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Character ID is required"})
	}

	if err := h.Service.UpdateSprite(userIDStr, req.CharacterID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Sprite updated successfully"})
}

