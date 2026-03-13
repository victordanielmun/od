package handlers

import (
	"gather-rpg-backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type LearningHandler struct {
	Service *services.LearningService
}

func NewLearningHandler(service *services.LearningService) *LearningHandler {
	return &LearningHandler{Service: service}
}

func (h *LearningHandler) GetRandomChallenge(c *fiber.Ctx) error {
	// Parse optional query params
	challengeType := c.Query("type")
	difficulty := c.Query("difficulty")

	challenge, err := h.Service.GetRandomChallenge(challengeType, difficulty)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "No challenges found matching criteria"})
	}

	return c.JSON(challenge)
}

func (h *LearningHandler) GetChallengeMetadata(c *fiber.Ctx) error {
	difficulties, tags, err := h.Service.GetChallengeMetadata()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve metadata", "details": err.Error()})
	}

	return c.JSON(fiber.Map{
		"difficulties": difficulties,
		"tags":         tags,
	})
}

type RecordAttemptRequest struct {
	ChallengeID    string `json:"challenge_id"`
	SelectedOption int    `json:"selected_option"` // Default to 0 for voice/text challenges
	IsCorrect      bool   `json:"is_correct"`
	FeedbackAI     string `json:"feedback_ai"`
}

func (h *LearningHandler) RecordAttempt(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or missing user ID in token"})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	var req RecordAttemptRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	challengeID, err := uuid.Parse(req.ChallengeID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid challenge ID format"})
	}

	profile, err := h.Service.RecordAttempt(userID, challengeID, req.IsCorrect, req.SelectedOption, req.FeedbackAI)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to record attempt", "details": err.Error()})
	}

	return c.JSON(profile)
}

func (h *LearningHandler) GetMyProfile(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or missing user ID in token"})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	profile, err := h.Service.GetProfileByUserID(userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve profile", "details": err.Error()})
	}

	return c.JSON(profile)
}
