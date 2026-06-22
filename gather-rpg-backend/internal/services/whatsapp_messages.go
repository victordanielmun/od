package services

import (
	"fmt"
	"strings"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
)

// GuideInfo resuelve el nombre y saludo del guía (NPC compañero) del usuario, con
// valores por defecto si no tiene uno asignado o no se puede cargar.
func GuideInfo(user models.User) (name, greeting string) {
	name = "Guide"
	greeting = ""
	if user.CompanionNPCID != nil {
		var guide models.NPCDefinition
		if err := database.DB.First(&guide, *user.CompanionNPCID).Error; err == nil {
			if guide.Name != "" {
				name = guide.Name
			}
			greeting = guide.Greeting
		}
	}
	return name, greeting
}

// PickChallengeForUser elige un reto de aprendizaje adecuado al nivel del usuario,
// priorizando los etiquetados con 'whatsapp' y cayendo a retos generales si no hay.
func PickChallengeForUser(userID uuid.UUID) (*models.LearningChallenge, error) {
	var profile models.UserLearningProfile
	level := models.DifficultyBeginner
	if err := database.DB.Where("user_id = ?", userID).First(&profile).Error; err == nil {
		level = profile.EnglishLevel
	}

	var challenge models.LearningChallenge
	err := database.DB.Where("? = ANY(tags) AND difficulty = ?", "whatsapp", level).Order("RANDOM()").First(&challenge).Error
	if err != nil {
		err = database.DB.Where("difficulty = ?", level).Order("RANDOM()").First(&challenge).Error
	}
	if err != nil {
		err = database.DB.Order("RANDOM()").First(&challenge).Error
	}
	if err != nil {
		return nil, err
	}
	return &challenge, nil
}

// AssembleChallenge arma el mensaje del reto: la pregunta/palabra en inglés (canónico) +
// ayuda en el idioma nativo + opciones, con la instrucción ya localizada. Pronunciación/
// listening piden nota de voz; el resto usa opciones, con variante "Card Ninja".
func AssembleChallenge(guideName string, ch models.LearningChallenge, questionNative, askChoice, askAudio string, cardNinja bool) string {
	isPronunciation := ch.Type == models.ChallengeTypePronunciation ||
		ch.Type == models.ChallengeTypeListening ||
		ch.RequiresAudio

	if isPronunciation {
		phonetic := ""
		if ch.Phonetic != "" {
			phonetic = "  _" + ch.Phonetic + "_"
		}
		hint := ""
		if questionNative != "" && !strings.EqualFold(strings.TrimSpace(questionNative), strings.TrimSpace(ch.Question)) {
			hint = "\n_" + questionNative + "_"
		}
		return fmt.Sprintf("*%s* 🎤\n\n👉 *%s*%s%s\n\n%s", guideName, ch.Question, phonetic, hint, askAudio)
	}

	native := ""
	if questionNative != "" && !strings.EqualFold(strings.TrimSpace(questionNative), strings.TrimSpace(ch.Question)) {
		native = "\n_" + questionNative + "_"
	}

	header := fmt.Sprintf("*%s* 📚", guideName)
	if cardNinja {
		header = fmt.Sprintf("*%s* 🃏 *CARD NINJA!* ⚡", guideName)
	}

	return fmt.Sprintf("%s\n\n%s%s\n\n1️⃣ %s\n2️⃣ %s\n3️⃣ %s\n\n%s",
		header, ch.Question, native, ch.Option1, ch.Option2, ch.Option3, askChoice)
}
