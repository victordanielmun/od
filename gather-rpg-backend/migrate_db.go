package main

import (
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=18.221.199.221 user=postgres password=postgres dbname=gather_rpg port=5433 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}
	db.Exec("ALTER TABLE mission_tasks ADD COLUMN IF NOT EXISTS required_items jsonb;")
	db.Exec("ALTER TABLE npc_templates ADD COLUMN IF NOT EXISTS waypoints jsonb DEFAULT '[]'::jsonb;")
	fmt.Println("Migration successful")
}
