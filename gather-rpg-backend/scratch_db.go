package main

import (
	"fmt"
	"log"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
)

func main() {
	cfg := config.LoadConfig()
	database.ConnectPostgres(cfg)

	id := "9700f41f-236a-4989-8d30-3d20d1d7aa4c"
	u, err := uuid.Parse(id)
	if err != nil {
		log.Fatalf("Invalid uuid: %v", err)
	}

	var enemy models.Enemy
	if err := database.DB.Where("id = ?", u).First(&enemy).Error; err != nil {
		log.Fatalf("Error finding enemy: %v", err)
	}

	fmt.Printf("Enemy: Name=%s, SpriteKey=%s, HP=%d\n", enemy.Name, enemy.SpriteKey, enemy.HPMax)
}
