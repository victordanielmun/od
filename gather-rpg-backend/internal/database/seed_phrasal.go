package database

import (
	"log"

	"gather-rpg-backend/internal/models"
)

// SeedPhrasalVerbChallenges siembra retos de phrasal verbs para las ninja cards.
//
// Se registran como type=vocabulary (NO grammar) a propósito: getChallengeForClient
// pide primero retos de tipo "vocabulary" y solo cae a otros tipos como fallback,
// así que los phrasal verbs entran en el pool primario de las cards.
//
// Formato: frase con hueco + 3 opciones, donde los distractores son phrasal verbs
// de la MISMA partícula (up/out/down/...) para forzar discriminación real.
//
// Es idempotente y está pensada para correrse UNA sola vez a mano (ver cmd/seedphrasal),
// NO en cada arranque del servidor. Salta los retos cuya (question, type) ya existe.
func SeedPhrasalVerbChallenges() {
	pv := func(q, qes string, o1, o2, o3 string, correct int, expEs string, diff models.DifficultyLevel, particle string) models.LearningChallenge {
		return models.LearningChallenge{
			Type:             models.ChallengeTypeVocabulary,
			Question:         q,
			QuestionES:       qes,
			Option1:          o1,
			Option2:          o2,
			Option3:          o3,
			CorrectOption:    correct,
			ExplanationES:    expEs,
			Tags:             []string{"phrasal-verb", particle},
			Difficulty:       diff,
			LanguageLearning: "english",
			RequiresAudio:    false,
		}
	}

	challenges := []models.LearningChallenge{
		// ---- BLOQUE 1: UP ----
		pv("Don't _____ — keep going!", "No te _____ — ¡sigue adelante!",
			"give up", "look up", "show up", 1,
			"'Give up' = rendirse. Toro siempre quiere hacerlo; Freshpudder no lo deja.", models.DifficultyBeginner, "up"),
		pv("I don't know that word, let me _____ it _____.", "No sé esa palabra, déjame _____.",
			"wake up", "look it up", "end up", 2,
			"'Look up' = buscar (en un diccionario), no mirar hacia arriba.", models.DifficultyBeginner, "up"),
		pv("Mochi never _____ on time.", "Mochi nunca _____ a tiempo.",
			"shows up", "gives up", "looks up", 1,
			"'Show up' = aparecer / llegar.", models.DifficultyBeginner, "up"),
		pv("It's late — time to _____!", "Es tarde — ¡hora de _____!",
			"end up", "wake up", "look up", 2,
			"'Wake up' = despertarse. (Y 'awake' = despierto, no 'woken up'.)", models.DifficultyBeginner, "up"),
		pv("We always _____ lost.", "Siempre _____ perdidos.",
			"end up", "give up", "show up", 1,
			"'End up' = terminar siendo / acabar en algún lugar.", models.DifficultyIntermediate, "up"),

		// ---- BLOQUE 2: OUT ----
		pv("I just _____ that 'actually' isn't 'actualmente'!", "¡Acabo de _____ que 'actually' no es 'actualmente'!",
			"found out", "ran out", "worked out", 1,
			"'Find out' = descubrir / enterarse.", models.DifficultyIntermediate, "out"),
		pv("We _____ snacks!", "¡Nos _____ snacks!",
			"figured out", "ran out of", "freaked out", 2,
			"'Run out of' = quedarse sin algo.", models.DifficultyIntermediate, "out"),
		pv("I can't _____ phrasal verbs!", "¡No puedo _____ los phrasal verbs!",
			"figure out", "hang out", "work out", 1,
			"'Figure out' = descifrar / entender.", models.DifficultyIntermediate, "out"),
		pv("Don't _____ — I haven't finished the sentence!", "No te _____ — ¡no terminé la frase!",
			"hang out", "freak out", "find out", 2,
			"'Freak out' = perder la cabeza / asustarse. El deporte favorito de Toro.", models.DifficultyIntermediate, "out"),
		pv("Would you like to _____ this weekend?", "¿Te gustaría _____ este fin de semana?",
			"hang out", "run out", "freak out", 1,
			"'Hang out' = pasar el rato. No es colgarse de nada, Freshpudder.", models.DifficultyIntermediate, "out"),

		// ---- BLOQUE 3: DOWN ----
		pv("Toro, please _____!", "Toro, por favor _____!",
			"let down", "calm down", "break down", 2,
			"'Calm down' = calmarse. 'THIS IS MY CALM FACE.'", models.DifficultyBeginner, "down"),
		pv("You _____ me _____ when you said 'I am agree'.", "Me _____ cuando dijiste 'I am agree'.",
			"let / down", "write / down", "cut / down", 1,
			"'Let down' = decepcionar.", models.DifficultyIntermediate, "down"),
		pv("_____ the new words in your notebook.", "_____ las palabras nuevas en tu cuaderno.",
			"Slow down", "Write down", "Break down", 2,
			"'Write down' = anotar. En el cuaderno, no en el suelo.", models.DifficultyBeginner, "down"),
		pv("You're talking too fast — _____!", "Hablas muy rápido — ¡_____!",
			"slow down", "let down", "write down", 1,
			"'Slow down' = bajar la velocidad / calmarse.", models.DifficultyBeginner, "down"),
		pv("I'm trying to _____ on drama.", "Estoy intentando _____ el drama.",
			"break down", "cut down", "calm down", 2,
			"'Cut down (on)' = reducir. Protto empieza... la próxima semana.", models.DifficultyIntermediate, "down"),

		// ---- BLOQUE 4: ON / OFF ----
		pv("It's over. Just _____.", "Se acabó. Solo _____.",
			"hold on", "move on", "go on", 2,
			"'Move on' = seguir adelante / pasar página.", models.DifficultyIntermediate, "on"),
		pv("_____ a second, I'm not ready!", "_____ un segundo, ¡no estoy listo!",
			"Hold on", "Take off", "Get off", 1,
			"'Hold on' = espera. No te agarres a la pared, Toro.", models.DifficultyBeginner, "on"),
		pv("That's interesting — _____!", "Qué interesante — ¡_____!",
			"go on", "turn off", "get off", 1,
			"'Go on' = continúa / sigue hablando.", models.DifficultyBeginner, "on"),
		pv("Please _____ your phone during the lesson.", "Por favor _____ el teléfono durante la clase.",
			"take off", "turn off", "move on", 2,
			"'Turn off' = apagar. Solo el teléfono, Freshpudder, no las luces.", models.DifficultyBeginner, "off"),
		pv("The plane is about to _____.", "El avión está a punto de _____.",
			"take off", "get off", "hold on", 1,
			"'Take off' = despegar (o quitarse ropa). No, no estamos volando aún.", models.DifficultyIntermediate, "off"),
		pv("_____ your phone and pay attention!", "_____ del teléfono y ¡presta atención!",
			"Get off", "Turn off", "Take off", 1,
			"'Get off' = bajarse de / dejar de usar.", models.DifficultyIntermediate, "off"),

		// ---- BLOQUE 5: IN / INTO ----
		pv("Fine, FINE, I _____!", "Bien, ¡BIEN, _____!",
			"check in", "give in", "fit in", 2,
			"'Give in' = ceder / rendirse ante la presión. Tardó 8 segundos.", models.DifficultyIntermediate, "in"),
		pv("Let me _____ at the hotel first.", "Déjame _____ en el hotel primero.",
			"check in", "fit in", "run into", 1,
			"'Check in' = registrarse (también: ver cómo está alguien).", models.DifficultyIntermediate, "in"),
		pv("I don't _____ with this group.", "No _____ con este grupo.",
			"fit in", "give in", "look into", 1,
			"'Fit in' = encajar.", models.DifficultyIntermediate, "in"),
		pv("I _____ Lyra at the market today!", "¡Me _____ a Lyra en el mercado hoy!",
			"looked into", "ran into", "turned into", 2,
			"'Run into' = encontrarse por casualidad. No fue un accidente, Freshpudder.", models.DifficultyIntermediate, "into"),
		pv("I'll _____ it and get back to you.", "Lo _____ y te aviso.",
			"look into", "run into", "turn into", 1,
			"'Look into' = investigar. No mires DENTRO de la caja, Toro.", models.DifficultyIntermediate, "into"),
		pv("Practice will _____ you _____ a confident speaker.", "La práctica te _____ en alguien que habla con confianza.",
			"run / into", "turn / into", "look / into", 2,
			"'Turn into' = convertirse en.", models.DifficultyIntermediate, "into"),
	}

	seededCount := 0
	for _, chal := range challenges {
		var count int64
		DB.Model(&models.LearningChallenge{}).
			Where("question = ? AND type = ?", chal.Question, chal.Type).Count(&count)
		if count > 0 {
			continue
		}
		if err := DB.Create(&chal).Error; err != nil {
			log.Printf("[Seed] Failed to create phrasal-verb challenge '%s': %v", chal.Question, err)
			continue
		}
		seededCount++
	}
	if seededCount > 0 {
		log.Printf("[Seed] ✅ Seeded %d new phrasal-verb challenges", seededCount)
	} else {
		log.Println("[Seed] All phrasal-verb challenges already exist, skipping")
	}
}
