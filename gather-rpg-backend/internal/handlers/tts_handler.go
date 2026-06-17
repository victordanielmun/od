package handlers

import (
	"fmt"
	"path/filepath"
	"gather-rpg-backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"os"
	"strings"
)

type TTSHandler struct {
	Service *services.TTSService
}

func NewTTSHandler(service *services.TTSService) *TTSHandler {
	return &TTSHandler{Service: service}
}

func (h *TTSHandler) Generate(c *fiber.Ctx) error {
	var req struct {
		Text  string `json:"text"`
		Voice string `json:"voice"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	cacheKey, err := h.Service.Generate(req.Text, req.Voice)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to generate speech: %v", err),
		})
	}

	return c.JSON(fiber.Map{
		"audio_url": fmt.Sprintf("/api/tts/audio/%s", cacheKey),
		"cache_key": cacheKey,
	})
}

func (h *TTSHandler) GetAudio(c *fiber.Ctx) error {
	cacheKey := c.Params("cache_key")
	if cacheKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing cache_key"})
	}

	filePath := filepath.Join(h.Service.CacheDir, fmt.Sprintf("%s.wav", cacheKey))
	return c.SendFile(filePath)
}

func (h *TTSHandler) ListVoices(c *fiber.Ctx) error {
	files, err := os.ReadDir(h.Service.ModelsDir)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to read models directory: %v", err),
		})
	}

	var voices []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".onnx") {
			name := f.Name()
			parts := strings.Split(name, "-")
			if len(parts) >= 2 {
				// en_US-joe-medium.onnx -> "joe"
				voices = append(voices, parts[1])
			} else {
				voices = append(voices, strings.TrimSuffix(name, ".onnx"))
			}
		}
	}
	return c.JSON(voices)
}
