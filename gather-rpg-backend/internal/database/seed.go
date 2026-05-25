package database

import (
	"log"

	"gather-rpg-backend/internal/models"

	"golang.org/x/crypto/bcrypt"
)

// SeedAdminUser creates the default admin user if it does not already exist.
func SeedAdminUser() {
	var count int64
	DB.Model(&models.User{}).Where("email = ?", "admin@odyssey.dev").Count(&count)
	if count > 0 {
		log.Println("[Seed] Admin user already exists, skipping")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("Admin123!"), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[Seed] Failed to hash admin password: %v", err)
		return
	}

	admin := models.User{
		Username: "Admin",
		Email:    "admin@odyssey.dev",
		Password: string(hashedPassword),
		Role:     "admin",
		IsGuest:  false,
	}

	if err := DB.Create(&admin).Error; err != nil {
		log.Printf("[Seed] Failed to create admin user: %v", err)
		return
	}

	log.Println("[Seed] ✅ Admin user seeded (admin@odyssey.dev / Admin123!)")
}

// SeedLearningChallenges populates the database with default challenges if they do not exist
func SeedLearningChallenges() {
	challenges := []models.LearningChallenge{
		{
			Type:             models.ChallengeTypePronunciation,
			Question:         "Adventure",
			Option1:          "Adventure", // Expected text
			Option2:          "",
			Option3:          "",
			CorrectOption:    1,
			ExplanationES:    "Aventura",
			Tags:             []string{"vocabulary", "rpg"},
			Difficulty:       models.DifficultyBeginner,
			LanguageLearning: "english",
			Phonetic:         "/ədˈventʃər/",
			RequiresAudio:    true,
		},
		{
			Type:             models.ChallengeTypePronunciation,
			Question:         "Odyssey",
			Option1:          "Odyssey",
			Option2:          "",
			Option3:          "",
			CorrectOption:    1,
			ExplanationES:    "Odisea, un viaje largo y lleno de aventuras",
			Tags:             []string{"vocabulary", "rpg"},
			Difficulty:       models.DifficultyIntermediate,
			LanguageLearning: "english",
			Phonetic:         "/ˈɒdəsi/",
			RequiresAudio:    true,
		},
		{
			Type:             models.ChallengeTypePronunciation,
			Question:         "Dungeon",
			Option1:          "Dungeon",
			Option2:          "",
			Option3:          "",
			CorrectOption:    1,
			ExplanationES:    "Mazmorra",
			Tags:             []string{"vocabulary", "rpg"},
			Difficulty:       models.DifficultyBeginner,
			LanguageLearning: "english",
			Phonetic:         "/ˈdʌndʒən/",
			RequiresAudio:    true,
		},
		{
			Type:             models.ChallengeTypePronunciation,
			Question:         "Welcome to the game",
			Option1:          "Welcome to the game",
			Option2:          "",
			Option3:          "",
			CorrectOption:    1,
			ExplanationES:    "Bienvenido al juego",
			Tags:             []string{"phrases", "greetings"},
			Difficulty:       models.DifficultyBeginner,
			LanguageLearning: "english",
			Phonetic:         "/ˈwelkəm tu ðə ɡeɪm/",
			RequiresAudio:    true,
		},
		{
			Type:             models.ChallengeTypeVocabulary,
			Question:         "Which item is usually found in a dungeon?",
			QuestionES:       "¿Qué objeto se encuentra usualmente en una mazmorra?",
			Option1:          "Treasure Chest",
			Option2:          "Modern Car",
			Option3:          "Office Chair",
			CorrectOption:    1,
			ExplanationES:    "Los cofres de tesoro (Treasure Chests) son clásicos en las mazmorras de RPG.",
			Tags:             []string{"vocabulary", "rpg"},
			Difficulty:       models.DifficultyBeginner,
			LanguageLearning: "english",
			RequiresAudio:    false,
		},
		{
			Type:             models.ChallengeTypeGrammar,
			Question:         "I _____ a brave warrior.",
			QuestionES:       "Yo _____ un guerrero valiente.",
			Option1:          "am",
			Option2:          "is",
			Option3:          "are",
			CorrectOption:    1,
			ExplanationES:    "Se usa 'am' con el pronombre 'I' (Verb to be).",
			Tags:             []string{"grammar", "basics"},
			Difficulty:       models.DifficultyBeginner,
			LanguageLearning: "english",
			RequiresAudio:    false,
		},
	}

	seededCount := 0
	for _, chal := range challenges {
		var count int64
		DB.Model(&models.LearningChallenge{}).Where("question = ? AND type = ?", chal.Question, chal.Type).Count(&count)
		if count == 0 {
			if err := DB.Create(&chal).Error; err != nil {
				log.Printf("[Seed] Failed to create learning challenge '%s': %v", chal.Question, err)
			} else {
				seededCount++
			}
		}
	}
	if seededCount > 0 {
		log.Printf("[Seed] ✅ Seeded %d new learning challenges", seededCount)
	} else {
		log.Println("[Seed] All learning challenges already exist, skipping")
	}
}

// SeedMotivations populates the database with initial motivators
func SeedMotivations() {
	var count int64
	DB.Model(&models.Motivation{}).Count(&count)
	if count > 0 {
		log.Println("[Seed] Motivations already exist, skipping")
		return
	}

	motivations := []models.Motivation{
		{
			Category:               models.WAMotivationCategoryAfterInactivity,
			EnglishLevel:           "beginner",
			Tone:                   models.WAMotivationToneEmpathetic,
			MessageES:              "¡Oye! Hace unos días que no te veo por acá. No pasa nada, todos tenemos esas semanas. ¿Cómo estás?",
			IncludesPracticePrompt: true,
			PracticePromptES:      "Si tienes 3 minuticos, podemos practicar una sola palabrita juntos. Sin presión 😊",
		},
		{
			Category:               models.WAMotivationCategoryStreakKeep,
			EnglishLevel:           "all",
			Tone:                   models.WAMotivationToneCelebratory,
			MessageES:              "¡Llevas {{streak}} días seguidos practicando! Eso no es suerte, eso es disciplina de verdad 🔥",
			IncludesPracticePrompt: false,
		},
		{
			Category:               models.WAMotivationCategoryAfterGoodPractice,
			EnglishLevel:           "intermediate",
			Tone:                   models.WAMotivationToneChallenging,
			MessageES:              "Ese puntaje de pronunciación estuvo muy bueno. ¿Será que puedes superar tu propio récord hoy?",
			IncludesPracticePrompt: true,
			PracticePromptES:      "¿Le damos una vuelta a algo un poco más difícil esta vez?",
		},
	}

	for _, mot := range motivations {
		if err := DB.Create(&mot).Error; err != nil {
			log.Printf("[Seed] Failed to seed motivation category '%s': %v", mot.Category, err)
		}
	}

	log.Println("[Seed] ✅ Seeded initial WhatsApp motivation catalog")
}

// SeedGuides seeds three medieval guides (Aria, Eldrin, Thorin) of type models.NPCTypeGuide if they do not exist.
func SeedGuides() {
	guides := []models.NPCDefinition{
		{
			ID:              1001, // Use fixed IDs so they don't change and are easily recognizable
			Name:            "Aria",
			Sprite:          "aria_sprite",
			Greeting:        "Hello there, traveler! I am Aria, a skilled archer, and your guide to mastering the art of English pronunciation. Shall we practice speaking?",
			Type:            models.NPCTypeGuide,
			DefaultState:    models.NPCStateIdle,
			InteractionMode: "hybrid",
			VoiceType:       "female",
		},
		{
			ID:              1002,
			Name:            "Eldrin",
			Sprite:          "eldrin_sprite",
			Greeting:        "Greetings, seeker of wisdom. I am Eldrin, master of arcane grammar. Let me aid you in weaving the complex threads of English structure into pure magic.",
			Type:            models.NPCTypeGuide,
			DefaultState:    models.NPCStateIdle,
			InteractionMode: "hybrid",
			VoiceType:       "male",
		},
		{
			ID:              1003,
			Name:            "Thorin",
			Sprite:          "thorin_sprite",
			Greeting:        "Hail, warrior! Thorin here! If you want to keep your stamina high and build an unbreakable streak, I am your dwarf. Let's conquer these language challenges together!",
			Type:            models.NPCTypeGuide,
			DefaultState:    models.NPCStateIdle,
			InteractionMode: "hybrid",
			VoiceType:       "male",
		},
	}

	seededCount := 0
	for _, guide := range guides {
		var count int64
		DB.Model(&models.NPCDefinition{}).Where("id = ? OR name = ?", guide.ID, guide.Name).Count(&count)
		if count == 0 {
			if err := DB.Create(&guide).Error; err != nil {
				log.Printf("[Seed] Failed to seed guide '%s': %v", guide.Name, err)
			} else {
				seededCount++
			}
		}
	}
	if seededCount > 0 {
		log.Printf("[Seed] ✅ Seeded %d guide NPCs", seededCount)
	} else {
		log.Println("[Seed] Guide NPCs already exist, skipping")
	}
}


