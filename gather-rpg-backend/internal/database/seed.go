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

// SeedLearningChallenges populates the database with default pronunciation exercises if empty
func SeedLearningChallenges() {
	var count int64
	DB.Model(&models.LearningChallenge{}).Count(&count)
	if count > 0 {
		log.Println("[Seed] Learning challenges already exist, skipping")
		return
	}

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

	if err := DB.Create(&challenges).Error; err != nil {
		log.Printf("[Seed] Failed to create learning challenges: %v", err)
		return
	}

	log.Printf("[Seed] ✅ Seeded %d learning challenges", len(challenges))
}

