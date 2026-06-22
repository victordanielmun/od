// Command seedphrases inserta por única vez las frases conversacionales del guía
// pre-traducidas (ver internal/database/seed_phrases.go) en la tabla
// wa_conversation_phrases. NO se ejecuta en el arranque del servidor: córrelo a mano:
//
//	go run ./cmd/seedphrases
//
// Es idempotente, así que volver a correrlo no duplica filas.
package main

import (
	"log"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
)

func main() {
	cfg := config.LoadConfig()

	database.ConnectPostgres(cfg)

	// Asegura que la tabla exista (por si se corre antes del primer arranque del server).
	if err := database.DB.AutoMigrate(&models.WAConversationPhrase{}); err != nil {
		log.Fatalf("[SeedPhrases] migrate failed: %v", err)
	}

	database.SeedConversationPhrases()
	log.Println("[SeedPhrases] Done.")
}
