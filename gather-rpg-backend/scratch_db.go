package main

import (
	"fmt"
	"log"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
)

func main() {
	cfg := config.LoadConfig()
	database.ConnectPostgres(cfg)

	var definitions []models.NPCDefinition
	if err := database.DB.Find(&definitions).Error; err != nil {
		log.Fatalf("Error finding definitions: %v", err)
	}

	for _, d := range definitions {
		fmt.Printf("NPC Def: ID=%d, Name=%s, Sprite=%s, VoiceType=%s, InteractionMode=%s\n", d.ID, d.Name, d.Sprite, d.VoiceType, d.InteractionMode)
	}
}
