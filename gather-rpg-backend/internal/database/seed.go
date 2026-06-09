package database

import (
	"log"

	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
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

// SeedSkillsAndItems populates the database with initial skills and corresponding scroll items.
func SeedSkillsAndItems() {
	// 1. Seed initial skills
	fireRainID := uuid.MustParse("f1a8c3d8-88ff-4dcb-886c-6120a1c7a2cf")
	fireRainSkill := models.Skill{
		ID:            fireRainID,
		Name:          "Fire Rain",
		Description:   "Conjura una lluvia de fuego del cielo que daña a todos los enemigos.",
		SkillType:     "attack",
		MPCost:        15,
		Power:         120,
		TargetType:    "enemy",
		RequiredLevel: 1,
		AnimationKey:  "special",
	}
	var count int64
	DB.Model(&models.Skill{}).Where("id = ?", fireRainID).Count(&count)
	if count == 0 {
		DB.Create(&fireRainSkill)
		log.Println("[Seed] Seeded skill 'Fire Rain'")
	}

	waveID := uuid.MustParse("f1a8c3d8-88ff-4dcb-886c-6120a1c7a2d0")
	waveSkill := models.Skill{
		ID:            waveID,
		Name:          "Wave",
		Description:   "Conjura una ola mágica horizontal que empuja y barre a los enemigos.",
		SkillType:     "attack",
		MPCost:        25,
		Power:         250,
		TargetType:    "enemy",
		RequiredLevel: 1,
		AnimationKey:  "special",
	}
	DB.Model(&models.Skill{}).Where("id = ?", waveID).Count(&count)
	if count == 0 {
		DB.Create(&waveSkill)
		log.Println("[Seed] Seeded skill 'Wave'")
	}

	novaID := uuid.MustParse("f1a8c3d8-88ff-4dcb-886c-6120a1c7a2d1")
	novaSkill := models.Skill{
		ID:            novaID,
		Name:          "Nova",
		Description:   "Conjura una explosión radial de energía desde el jugador.",
		SkillType:     "attack",
		MPCost:        40,
		Power:         400,
		TargetType:    "enemy",
		RequiredLevel: 1,
		AnimationKey:  "special",
	}
	DB.Model(&models.Skill{}).Where("id = ?", novaID).Count(&count)
	if count == 0 {
		DB.Create(&novaSkill)
		log.Println("[Seed] Seeded skill 'Nova'")
	}

	// 2. Seed corresponding scroll items
	scrollID := uuid.MustParse("bfd1359a-b574-45a1-9b55-adc7330a788c")
	fireRainScroll := models.Item{
		ID:            scrollID,
		Name:          "Scroll of Fire Rain",
		Description:   "Un pergamino antiguo que contiene el hechizo Lluvia de Fuego. Úsalo para aprender la habilidad.",
		ItemType:      "scroll",
		EffectType:    "grant_skill",
		EffectValue:   0,
		Price:         50,
		MaxStack:      10,
		IconKey:       "3.png",
		GrantsSkillID: &fireRainID,
	}
	DB.Model(&models.Item{}).Where("id = ?", scrollID).Count(&count)
	if count == 0 {
		DB.Create(&fireRainScroll)
		log.Println("[Seed] Seeded item 'Scroll of Fire Rain'")
	}

	waveScrollID := uuid.MustParse("bfd1359a-b574-45a1-9b55-adc7330a788d")
	waveScroll := models.Item{
		ID:            waveScrollID,
		Name:          "Scroll of Wave",
		Description:   "Un pergamino antiguo que contiene el hechizo Ola Mágica. Úsalo para aprender la habilidad.",
		ItemType:      "scroll",
		EffectType:    "grant_skill",
		EffectValue:   0,
		Price:         75,
		MaxStack:      10,
		IconKey:       "3.png",
		GrantsSkillID: &waveID,
	}
	DB.Model(&models.Item{}).Where("id = ?", waveScrollID).Count(&count)
	if count == 0 {
		DB.Create(&waveScroll)
		log.Println("[Seed] Seeded item 'Scroll of Wave'")
	}

	novaScrollID := uuid.MustParse("bfd1359a-b574-45a1-9b55-adc7330a788e")
	novaScroll := models.Item{
		ID:            novaScrollID,
		Name:          "Scroll of Nova",
		Description:   "Un pergamino antiguo que contiene el hechizo Nova Radial. Úsalo para aprender la habilidad.",
		ItemType:      "scroll",
		EffectType:    "grant_skill",
		EffectValue:   0,
		Price:         100,
		MaxStack:      10,
		IconKey:       "3.png",
		GrantsSkillID: &novaID,
	}
	DB.Model(&models.Item{}).Where("id = ?", novaScrollID).Count(&count)
	if count == 0 {
		DB.Create(&novaScroll)
		log.Println("[Seed] Seeded item 'Scroll of Nova'")
	}

	// 3. Seed default potions if they don't exist
	potionID := uuid.MustParse("bfd1359a-b574-45a1-9b55-adc7330a788f")
	potion := models.Item{
		ID:            potionID,
		Name:          "Health Potion",
		Description:   "Restores 50 HP",
		ItemType:      "health",
		EffectType:    "heal_hp",
		EffectValue:   50,
		Price:         10,
		MaxStack:      10,
		IconKey:       "2.png",
	}
	DB.Model(&models.Item{}).Where("id = ?", potionID).Count(&count)
	if count == 0 {
		DB.Create(&potion)
		log.Println("[Seed] Seeded item 'Health Potion'")
	}

	manaPotionID := uuid.MustParse("bfd1359a-b574-45a1-9b55-adc7330a7890")
	manaPotion := models.Item{
		ID:            manaPotionID,
		Name:          "Mana Potion",
		Description:   "Restores 30 MP",
		ItemType:      "mana",
		EffectType:    "restore_mp",
		EffectValue:   30,
		Price:         15,
		MaxStack:      10,
		IconKey:       "4.png",
	}
	DB.Model(&models.Item{}).Where("id = ?", manaPotionID).Count(&count)
	if count == 0 {
		DB.Create(&manaPotion)
		log.Println("[Seed] Seeded item 'Mana Potion'")
	}

	throwingDaggerID := uuid.MustParse("bfd1359a-b574-45a1-9b55-adc7330a7891")
	throwingDagger := models.Item{
		ID:            throwingDaggerID,
		Name:          "Throwing Dagger",
		Description:   "Inflige 28 de daño al ser arrojada.",
		ItemType:      "throwable",
		EffectType:    "damage",
		EffectValue:   28,
		Price:         8,
		MaxStack:      20,
		IconKey:       "5.png",
	}
	DB.Model(&models.Item{}).Where("id = ?", throwingDaggerID).Count(&count)
	if count == 0 {
		DB.Create(&throwingDagger)
		log.Println("[Seed] Seeded item 'Throwing Dagger'")
	}
}


