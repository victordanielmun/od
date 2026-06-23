// Command seedphrasal inserta por única vez los retos de phrasal verbs para las
// ninja cards (ver internal/database/seed_phrasal.go) en la tabla learning_challenges.
// NO se ejecuta en el arranque del servidor: córrelo a mano:
//
//	go run ./cmd/seedphrasal
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
	if err := database.DB.AutoMigrate(&models.LearningChallenge{}); err != nil {
		log.Fatalf("[SeedPhrasal] migrate failed: %v", err)
	}

	database.SeedPhrasalVerbChallenges()
	log.Println("[SeedPhrasal] Done.")
}
