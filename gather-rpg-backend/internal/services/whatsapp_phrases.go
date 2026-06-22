package services

import (
	"fmt"
	"strings"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/utils"
)

// Claves de frase del guía. El texto canónico está en inglés; se traduce al idioma del
// usuario y se cachea en wa_conversation_phrases la primera vez que se usa.
const (
	PhraseGreeting    = "greeting"
	PhraseMotivation  = "motivation"
	PhraseInvite      = "invite"
	PhraseReask       = "reask"
	PhraseAskChoice   = "ask_choice"
	PhraseAskAudio    = "ask_audio"
	PhraseCorrect     = "correct"
	PhraseIncorrect   = "incorrect"
	PhraseConstancy   = "constancy"
	PhraseGoodbye     = "goodbye"
	PhraseNoChallenge = "no_challenge"
)

// canonicalPhrases son las plantillas en inglés. El marcador {name} se conserva intacto
// a través de las traducciones y se reemplaza al enviar.
var canonicalPhrases = map[string]string{
	PhraseGreeting:    "Hey {name}! 👋 Great to see you again. How are you doing today?",
	PhraseMotivation:  "Remember: a little English practice every day builds an unstoppable streak. 🔥",
	PhraseInvite:      "Do you want to take today's English challenge? Reply *YES* to start, or *NO* if now isn't a good time.",
	PhraseReask:       "I didn't quite catch that 😅. Do you want to practice today? Reply *YES* or *NO*.",
	PhraseAskChoice:   "💡 Reply with the number of the correct option (1, 2 or 3) to earn XP!",
	PhraseAskAudio:    "🎙️ Send me a voice note pronouncing it in English to earn XP!",
	PhraseCorrect:     "✅ Correct, {name}! Excellent work. 🎉",
	PhraseIncorrect:   "❌ Good try, {name}! Don't worry — every mistake is a chance to learn.",
	PhraseConstancy:   "Consistency beats talent — even one minute a day counts. Don't give up! 🌱",
	PhraseGoodbye:     "See you next time, {name}! Keep moving forward and never give up. 🚀",
	PhraseNoChallenge: "Oops, {name}! I don't have a challenge ready right now. Let's try again later, okay? 🙏",
}

// WAPhraseService entrega frases del guía localizadas, traduciendo con el LLM y cacheando.
type WAPhraseService struct {
	ai LLMClient
}

func NewWAPhraseService(ai LLMClient) *WAPhraseService {
	return &WAPhraseService{ai: ai}
}

// Phrase devuelve la frase `key` en el idioma `lang`, con {name} reemplazado. Si la
// traducción falla o no hay IA, cae al inglés canónico.
func (s *WAPhraseService) Phrase(key, lang, name string) string {
	tmpl := s.template(key, lang)
	if name == "" {
		name = "traveler"
	}
	return strings.ReplaceAll(tmpl, "{name}", name)
}

// template resuelve la plantilla (sin reemplazar {name}) cacheando por idioma.
func (s *WAPhraseService) template(key, lang string) string {
	canonical, ok := canonicalPhrases[key]
	if !ok {
		return ""
	}

	lang = utils.NormalizeLang(lang)
	if utils.IsEnglish(lang) {
		return canonical
	}

	// Cache hit.
	var row models.WAConversationPhrase
	if err := database.DB.Where("phrase_key = ? AND lang = ?", key, lang).First(&row).Error; err == nil {
		return row.Content
	}

	// Traducir vía LLM y cachear.
	translated, err := s.translate(canonical, lang)
	if err != nil || strings.TrimSpace(translated) == "" {
		fmt.Printf("[WAPhraseService] translate failed key=%s lang=%s: %v\n", key, lang, err)
		return canonical // fallback inglés
	}

	row = models.WAConversationPhrase{PhraseKey: key, Lang: lang, Content: translated}
	if err := database.DB.Create(&row).Error; err != nil {
		// Conflicto por concurrencia: re-leer al ganador.
		var winner models.WAConversationPhrase
		if e := database.DB.Where("phrase_key = ? AND lang = ?", key, lang).First(&winner).Error; e == nil {
			return winner.Content
		}
	}
	return translated
}

func (s *WAPhraseService) translate(text, lang string) (string, error) {
	if s.ai == nil {
		return "", fmt.Errorf("no AI client configured")
	}
	langName := utils.LanguageName(lang)
	systemPrompt := fmt.Sprintf(`You localize short chat messages from a friendly RPG language guide into %s.
Rules:
- Translate naturally and warmly for a %s speaker who is learning English.
- Keep every emoji exactly as in the original.
- Keep the placeholder {name} EXACTLY as-is (never translate or remove it).
- Keep WhatsApp markup like *bold*.
- If the words YES or NO appear, translate them to the natural %s equivalents (the user will reply in %s).
- Reply with ONLY the translated message — no quotes, no notes.`, langName, langName, langName, langName)

	out, err := s.ai.SendPrompt(systemPrompt, text)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}
