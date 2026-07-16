package handlers

import (
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type LearningHandler struct {
	Service     *services.LearningService
	Translation *services.TranslationService
}

func NewLearningHandler(service *services.LearningService, translation *services.TranslationService) *LearningHandler {
	return &LearningHandler{Service: service, Translation: translation}
}

func (h *LearningHandler) GetRandomChallenge(c *fiber.Ctx) error {
	// Parse optional query params
	challengeType := c.Query("type")
	difficulty := c.Query("difficulty")
	tag := c.Query("tag")

	challenge, err := h.Service.GetRandomChallenge(challengeType, difficulty, tag)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "No challenges found matching criteria"})
	}

	// Resolve the native helper language: an explicit ?lang= overrides the user's
	// stored preference, which in turn defaults to "en" (immersion, no helper).
	lang := c.Query("lang")
	if lang == "" {
		userIDStr, _ := c.Locals("user_id").(string)
		lang = h.Translation.UserLang(userIDStr)
	}
	tr := h.Translation.GetChallengeTranslation(challenge, lang)

	// Embed the challenge plus the language-agnostic native helper fields. The legacy
	// question_es/explanation_es stay on the challenge for backward compatibility.
	return c.JSON(struct {
		*models.LearningChallenge
		NativeLang        string `json:"native_lang"`
		QuestionNative    string `json:"question_native"`
		ExplanationNative string `json:"explanation_native"`
	}{
		LearningChallenge: challenge,
		NativeLang:        tr.Lang,
		QuestionNative:    tr.QuestionNative,
		ExplanationNative: tr.ExplanationNative,
	})
}

func (h *LearningHandler) GetChallengeMetadata(c *fiber.Ctx) error {
	challengeType := c.Query("type")
	difficulties, tags, err := h.Service.GetChallengeMetadata(challengeType)
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

func (h *LearningHandler) SetEnglishLevel(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or missing user ID in token"})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID format"})
	}

	var req struct {
		EnglishLevel string `json:"english_level"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.EnglishLevel != "beginner" && req.EnglishLevel != "intermediate" && req.EnglishLevel != "advanced" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid English level"})
	}

	if err := h.Service.UpdateEnglishLevel(userID, req.EnglishLevel); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update English level", "details": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "English level updated successfully"})
}

// GetLeaderboard returns the top players ranked by accumulated XP. Optional ?limit=
// (defaults to 50, capped at 100). Public so it can be shown without auth.
func (h *LearningHandler) GetLeaderboard(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 50)
	entries, err := h.Service.GetLeaderboard(limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load leaderboard", "details": err.Error()})
	}
	return c.JSON(entries)
}

