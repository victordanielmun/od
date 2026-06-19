package main

import (
	"fmt"
	"log"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/database"
)

func main() {
	cfg := config.LoadConfig()
	database.ConnectPostgres(cfg)

	// Query indexes for player_mission_progresses
	rows, err := database.DB.Raw(`
		SELECT indexname, indexdef 
		FROM pg_indexes 
		WHERE tablename = 'player_mission_progresses'
	`).Rows()
	if err != nil {
		log.Fatalf("Error querying indexes: %v", err)
	}
	defer rows.Close()

	fmt.Printf("=== Indexes on player_mission_progresses ===\n")
	for rows.Next() {
		var name, def string
		if err := rows.Scan(&name, &def); err != nil {
			log.Fatalf("Error scanning row: %v", err)
		}
		fmt.Printf("Index: %s\nDef: %s\n\n", name, def)
	}
}
