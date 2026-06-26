package handlers

import (
	"strings"

	"gather-rpg-backend/internal/services"

	"github.com/gofiber/fiber/v2"
)

// InfoTranslateHandler traduce el contenido (markdown) de un letrero de info al idioma
// nativo del jugador, reutilizando el TranslationService (cache por hash de texto).
type InfoTranslateHandler struct {
	Translation *services.TranslationService
}

func NewInfoTranslateHandler(t *services.TranslationService) *InfoTranslateHandler {
	return &InfoTranslateHandler{Translation: t}
}

// TranslateInfo — POST /info-translate { text, lang? }. Si lang va vacío, usa el idioma
// nativo del usuario (JWT). Inglés devuelve el texto tal cual. Cacheado por (hash, lang).
func (h *InfoTranslateHandler) TranslateInfo(c *fiber.Ctx) error {
	var body struct {
		Text string `json:"text"`
		Lang string `json:"lang"` // opcional: override del idioma destino
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "cuerpo inválido"})
	}
	if strings.TrimSpace(body.Text) == "" {
		return c.JSON(fiber.Map{"text": "", "lang": "en", "cached": false})
	}

	lang := strings.TrimSpace(body.Lang)
	if lang == "" {
		userID, _ := c.Locals("user_id").(string)
		lang = h.Translation.UserLang(userID)
	}

	translated, cached, err := h.Translation.TranslateInfo(body.Text, lang)
	if err != nil {
		// Degrada al original: un fallo de traducción no debe romper el letrero.
		return c.JSON(fiber.Map{"text": body.Text, "lang": lang, "cached": false, "error": err.Error()})
	}
	return c.JSON(fiber.Map{"text": translated, "lang": lang, "cached": cached})
}
