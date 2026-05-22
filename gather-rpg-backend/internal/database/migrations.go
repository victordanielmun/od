package database

import (
	"fmt"
	"log"
)

// EnsureEnumValues ensures that the PostgreSQL ENUMs contain all required values.
func EnsureEnumValues() {
	if DB == nil {
		return
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Printf("[Migration] CRITICAL: Could not get raw DB for enum migration: %v", err)
		return
	}

	// Helper to ensure values in an enum
	ensureEnum := func(typeName string, values []string) {
		var typeExists bool
		DB.Raw("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = ?)", typeName).Scan(&typeExists)

		if !typeExists {
			log.Printf("[Migration] Creating ENUM %s with values: %v", typeName, values)
			var valsStr string
			for i, val := range values {
				if i > 0 {
					valsStr += ", "
				}
				valsStr += fmt.Sprintf("'%s'", val)
			}
			query := fmt.Sprintf("CREATE TYPE %s AS ENUM (%s)", typeName, valsStr)
			if _, err := sqlDB.Exec(query); err != nil {
				log.Printf("[Migration] Error creating ENUM %s: %v", typeName, err)
			}
			return
		}

		for _, val := range values {
			var exists bool
			DB.Raw(fmt.Sprintf(`
				SELECT EXISTS (
					SELECT 1 
					FROM pg_enum e 
					JOIN pg_type t ON e.enumtypid = t.oid 
					WHERE t.typname = '%s' AND e.enumlabel = ?
				)`, typeName), val).Scan(&exists)
			
			if !exists {
				log.Printf("[Migration] Adding value '%s' to ENUM %s", val, typeName)
				_, err := sqlDB.Exec(fmt.Sprintf("ALTER TYPE %s ADD VALUE IF NOT EXISTS '%s'", typeName, val))
				if err != nil {
					log.Printf("[Migration] Error adding value %s to %s: %v", val, typeName, err)
				}
			}
		}
	}

	ensureEnum("npc_type", []string{"quest_giver", "merchant", "guide", "other", "quest_master"})
	ensureEnum("mission_type", []string{
		"find_item", "find_items", "defeat_enemy", "kill_all", 
		"kill_boss", "talk_to_npc", "deliver_message", "pronunciation_challenge",
	})
	ensureEnum("task_type", []string{
		"bring_item", "find_item", "collect_items", "defeat_enemy", 
		"kill_all", "kill_boss", "talk_to_npc", "deliver_message", "pronunciation_threshold",
	})
}
