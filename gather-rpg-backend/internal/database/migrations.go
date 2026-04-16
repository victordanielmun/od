package database

import (
	"fmt"
	"log"
)

// EnsureEnumValues ensures that the PostgreSQL ENUM npc_type contains all required values.
func EnsureEnumValues() {
	if DB == nil {
		return
	}

	// PostgreSQL ADD VALUE cannot run inside a transaction block.
	// We get the raw *sql.DB and ensure we execute it directly.
	sqlDB, err := DB.DB()
	if err != nil {
		log.Printf("[Migration] CRITICAL: Could not get raw DB for enum migration: %v", err)
		return
	}

	newValues := []string{"quest_giver", "merchant", "guide", "other"}

	for _, val := range newValues {
		// 1. Check if value exists in ENUM
		var exists bool
		DB.Raw(`
			SELECT EXISTS (
				SELECT 1 
				FROM pg_enum e 
				JOIN pg_type t ON e.enumtypid = t.oid 
				WHERE t.typname = 'npc_type' AND e.enumlabel = ?
			)`, val).Scan(&exists)
		
		if !exists {
			log.Printf("[Migration] Adding value '%s' to ENUM npc_type", val)
			// Execute ALTER TYPE outside GORM's transaction context
			_, err := sqlDB.Exec(fmt.Sprintf("ALTER TYPE npc_type ADD VALUE IF NOT EXISTS '%s'", val))
			if err != nil {
				log.Printf("[Migration] Error adding value %s: %v (Ignore if already exists or PG < 12)", val, err)
			}
		}
	}
}
