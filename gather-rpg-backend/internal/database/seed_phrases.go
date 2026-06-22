package database

import (
	"log"

	"gather-rpg-backend/internal/models"
)

// seededConversationPhrases son traducciones hechas a mano de las frases del guía para los
// idiomas más comunes, de modo que esos idiomas no necesiten una llamada al LLM en runtime.
// Las claves DEBEN coincidir con las constantes Phrase* de services/whatsapp_phrases.go.
// El inglés no se incluye: el servicio devuelve el texto canónico directamente.
// El marcador {name} se conserva y se reemplaza al enviar.
var seededConversationPhrases = map[string]map[string]string{
	"es": {
		"greeting":     "¡Hola {name}! 👋 ¡Qué bueno verte de nuevo! ¿Cómo va tu día?",
		"motivation":   "Recuerda: un poco de práctica de inglés cada día crea una racha imparable. 🔥",
		"invite":       "¿Quieres hacer el reto de inglés de hoy? Responde *SÍ* para empezar, o *NO* si no es buen momento.",
		"reask":        "No te entendí bien 😅. ¿Quieres practicar hoy? Responde *SÍ* o *NO*.",
		"ask_choice":   "💡 ¡Responde con el número de la opción correcta (1, 2 o 3) para ganar XP!",
		"ask_audio":    "🎙️ ¡Envíame una nota de voz pronunciándolo en inglés para ganar XP!",
		"correct":      "✅ ¡Correcto, {name}! Excelente trabajo. 🎉",
		"incorrect":    "❌ ¡Buen intento, {name}! No te preocupes, cada error es una oportunidad para aprender.",
		"constancy":    "La constancia vence al talento — hasta un minuto al día cuenta. ¡No te rindas! 🌱",
		"goodbye":      "¡Nos vemos pronto, {name}! Sigue avanzando y nunca te rindas. 🚀",
		"no_challenge": "¡Uy, {name}! No tengo un reto listo ahora mismo. Intentémoslo más tarde, ¿va? 🙏",
	},
}

// SeedConversationPhrases inserta las frases pre-traducidas en wa_conversation_phrases.
// Es idempotente: omite las filas (clave, idioma) que ya existen. Está pensada para
// ejecutarse UNA sola vez de forma manual (ver cmd/seedphrases), no en cada arranque.
func SeedConversationPhrases() {
	inserted := 0
	skipped := 0
	for lang, phrases := range seededConversationPhrases {
		for key, content := range phrases {
			var count int64
			DB.Model(&models.WAConversationPhrase{}).
				Where("phrase_key = ? AND lang = ?", key, lang).Count(&count)
			if count > 0 {
				skipped++
				continue
			}
			row := models.WAConversationPhrase{PhraseKey: key, Lang: lang, Content: content}
			if err := DB.Create(&row).Error; err != nil {
				log.Printf("[SeedPhrases] Failed to insert %s/%s: %v", key, lang, err)
				continue
			}
			inserted++
		}
	}
	log.Printf("[SeedPhrases] ✅ Conversation phrases seeded (inserted=%d, skipped=%d)", inserted, skipped)
}
