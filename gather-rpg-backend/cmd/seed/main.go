// Command seed ejecuta TODOS los seeds estáticos del backend por única vez.
// Antes corrían en cada arranque del servidor; ahora se ejecutan a mano:
//
//	go run ./cmd/seed
//
// Todos los seeds son idempotentes, así que volver a correrlo no duplica datos.
// IMPORTANTE: en una base de datos nueva, corre este comando UNA vez después de
// que el servidor migre (o deja que migre aquí), si no faltarán el usuario admin,
// los retos, skills e items base.
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

	// Asegura que existan las tablas que tocan los seeds (por si se corre antes
	// del primer arranque del server).
	if err := database.DB.AutoMigrate(
		&models.User{},
		&models.Skill{},
		&models.Item{},
		&models.LearningChallenge{},
		&models.NPCDefinition{},
		&models.Motivation{},
		&models.WAConversationPhrase{},
	); err != nil {
		log.Fatalf("[Seed] migrate failed: %v", err)
	}

	// Seeds que antes corrían en el arranque (cmd/server/main.go).
	database.SeedAdminUser()
	database.SeedLearningChallenges()
	database.SeedMotivations()
	database.SeedGuides()
	database.SeedSkillsAndItems()

	// Seeds de contenido de inglés (antes ya eran de ejecución única).
	database.SeedConversationPhrases()
	database.SeedPhrasalVerbChallenges()

	log.Println("[Seed] Done.")
}
