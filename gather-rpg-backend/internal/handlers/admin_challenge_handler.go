package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"io"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// ListChallenges retrieves all learning challenges.
// GET /admin/challenges
func (h *AdminHandler) ListChallenges(c *fiber.Ctx) error {
	var challenges []models.LearningChallenge
	if err := database.DB.Order("created_at desc").Find(&challenges).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(challenges)
}

// CreateChallenge creates a new learning challenge.
// POST /admin/challenges
func (h *AdminHandler) CreateChallenge(c *fiber.Ctx) error {
	var challenge models.LearningChallenge
	if err := c.BodyParser(&challenge); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if challenge.ID == uuid.Nil {
		challenge.ID = uuid.New()
	}

	if err := database.DB.Create(&challenge).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(challenge)
}

// UpdateChallenge updates an existing challenge.
// PUT /admin/challenges/:id
func (h *AdminHandler) UpdateChallenge(c *fiber.Ctx) error {
	id := c.Params("id")
	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid UUID"})
	}

	var challenge models.LearningChallenge
	if err := database.DB.First(&challenge, "id = ?", uid).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Challenge not found"})
	}

	if err := c.BodyParser(&challenge); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	challenge.ID = uid

	if err := database.DB.Save(&challenge).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(challenge)
}

// DeleteChallenge deletes a challenge by ID.
// DELETE /admin/challenges/:id
func (h *AdminHandler) DeleteChallenge(c *fiber.Ctx) error {
	id := c.Params("id")
	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid UUID"})
	}

	if err := database.DB.Delete(&models.LearningChallenge{}, "id = ?", uid).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ImportChallenges imports challenges from a CSV or JSON file.
// POST /admin/challenges/import
func (h *AdminHandler) ImportChallenges(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to get upload file: " + err.Error()})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to open upload file: " + err.Error()})
	}
	defer file.Close()

	ext := filepath.Ext(fileHeader.Filename)
	var challengesToImport []models.LearningChallenge
	var parseErrors []map[string]interface{}

	if strings.ToLower(ext) == ".json" {
		byteValue, err := io.ReadAll(file)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read JSON file: " + err.Error()})
		}

		type JSONChallenge struct {
			ID               string      `json:"id"`
			Type             string      `json:"type"`
			Question         string      `json:"question"`
			Option1          string      `json:"option_1"`
			Option2          string      `json:"option_2"`
			Option3          string      `json:"option_3"`
			CorrectOption    int         `json:"correct_option"`
			ExplanationES    string      `json:"explanation_es"`
			QuestionES       string      `json:"question_es"`
			Tags             []string    `json:"tags"`
			Difficulty       string      `json:"difficulty"`
			LanguageLearning string      `json:"language_learning"`
			Phonetic         string      `json:"phonetic"`
			RequiresAudio    interface{} `json:"requires_audio"` // can be bool or string
			AudioURL         string      `json:"audio_url"`
		}

		var tempChallenges []JSONChallenge
		if err := json.Unmarshal(byteValue, &tempChallenges); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to parse JSON file: " + err.Error()})
		}

		for idx, tc := range tempChallenges {
			rowNum := idx + 1

			// Map and validate
			cType := models.ChallengeType(strings.ToLower(strings.TrimSpace(tc.Type)))
			if cType != models.ChallengeTypeVocabulary && cType != models.ChallengeTypeGrammar &&
				cType != models.ChallengeTypePronunciation && cType != models.ChallengeTypeListening {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  fmt.Sprintf("Invalid challenge type '%s'. Must be vocabulary, grammar, pronunciation, or listening", tc.Type),
				})
				continue
			}

			diff := models.DifficultyLevel(strings.ToLower(strings.TrimSpace(tc.Difficulty)))
			if diff == "" {
				diff = models.DifficultyBeginner
			} else if diff != models.DifficultyBeginner && diff != models.DifficultyIntermediate && diff != models.DifficultyAdvanced {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  fmt.Sprintf("Invalid difficulty '%s'. Must be beginner, intermediate, or advanced", tc.Difficulty),
				})
				continue
			}

			lang := strings.TrimSpace(tc.LanguageLearning)
			if lang == "" {
				lang = "english"
			}

			reqAudio := false
			if tc.RequiresAudio != nil {
				switch v := tc.RequiresAudio.(type) {
				case bool:
					reqAudio = v
				case string:
					reqAudio = strings.ToLower(v) == "true" || v == "1" || strings.ToLower(v) == "yes"
				case float64:
					reqAudio = v == 1
				}
			}

			// Validate option presence depending on type
			option1 := strings.TrimSpace(tc.Option1)
			option2 := strings.TrimSpace(tc.Option2)
			option3 := strings.TrimSpace(tc.Option3)

			if strings.TrimSpace(tc.Question) == "" {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  "Question text is required",
				})
				continue
			}

			if option1 == "" {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  "Option 1 is required",
				})
				continue
			}

			if cType != models.ChallengeTypePronunciation {
				if option2 == "" || option3 == "" {
					parseErrors = append(parseErrors, map[string]interface{}{
						"record": rowNum,
						"error":  "Option 2 and Option 3 are required for vocabulary, grammar, and listening types",
					})
					continue
				}
				if tc.CorrectOption < 1 || tc.CorrectOption > 3 {
					parseErrors = append(parseErrors, map[string]interface{}{
						"record": rowNum,
						"error":  "Correct option must be 1, 2, or 3",
					})
					continue
				}
			} else {
				// Pronunciation cards default to 1 correct option
				if tc.CorrectOption == 0 {
					tc.CorrectOption = 1
				}
			}

			var challengeID uuid.UUID
			if tc.ID != "" {
				if parsedUUID, err := uuid.Parse(tc.ID); err == nil {
					challengeID = parsedUUID
				} else {
					challengeID = uuid.New()
				}
			} else {
				challengeID = uuid.New()
			}

			tagsArr := pq.StringArray{}
			for _, tag := range tc.Tags {
				tTrim := strings.ToLower(strings.TrimSpace(tag))
				if tTrim != "" {
					tagsArr = append(tagsArr, tTrim)
				}
			}

			challengesToImport = append(challengesToImport, models.LearningChallenge{
				ID:               challengeID,
				Type:             cType,
				Question:         strings.TrimSpace(tc.Question),
				Option1:          option1,
				Option2:          option2,
				Option3:          option3,
				CorrectOption:    tc.CorrectOption,
				ExplanationES:    strings.TrimSpace(tc.ExplanationES),
				QuestionES:       strings.TrimSpace(tc.QuestionES),
				Tags:             tagsArr,
				Difficulty:       diff,
				LanguageLearning: lang,
				Phonetic:         strings.TrimSpace(tc.Phonetic),
				RequiresAudio:    reqAudio,
				AudioURL:         strings.TrimSpace(tc.AudioURL),
			})
		}
	} else if strings.ToLower(ext) == ".csv" {
		reader := csv.NewReader(file)
		records, err := reader.ReadAll()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to parse CSV file: " + err.Error()})
		}

		if len(records) < 2 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "CSV file must contain a header row and at least one data row"})
		}

		headers := records[0]
		headerMap := make(map[string]int)
		for idx, h := range headers {
			normalized := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(h), "_", ""), " ", ""))
			headerMap[normalized] = idx
		}

		// Helper function to get value by name safely
		getVal := func(row []string, key string) string {
			if colIdx, ok := headerMap[key]; ok && colIdx < len(row) {
				return strings.TrimSpace(row[colIdx])
			}
			return ""
		}

		for idx, row := range records[1:] {
			rowNum := idx + 2 // 1-indexed plus header row offset

			// Map values
			tType := getVal(row, "type")
			qText := getVal(row, "question")
			qES := getVal(row, "questiones")
			opt1 := getVal(row, "option1")
			opt2 := getVal(row, "option2")
			opt3 := getVal(row, "option3")
			corrOptStr := getVal(row, "correctoption")
			explES := getVal(row, "explanationes")
			tagsStr := getVal(row, "tags")
			diffStr := getVal(row, "difficulty")
			langStr := getVal(row, "languagelearning")
			phonStr := getVal(row, "phonetic")
			reqAudStr := getVal(row, "requiresaudio")
			audURL := getVal(row, "audiourl")
			idStr := getVal(row, "id")

			if qText == "" {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  "Question text is required",
				})
				continue
			}

			cType := models.ChallengeType(strings.ToLower(tType))
			if cType != models.ChallengeTypeVocabulary && cType != models.ChallengeTypeGrammar &&
				cType != models.ChallengeTypePronunciation && cType != models.ChallengeTypeListening {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  fmt.Sprintf("Invalid challenge type '%s'. Must be vocabulary, grammar, pronunciation, or listening", tType),
				})
				continue
			}

			diff := models.DifficultyLevel(strings.ToLower(diffStr))
			if diff == "" {
				diff = models.DifficultyBeginner
			} else if diff != models.DifficultyBeginner && diff != models.DifficultyIntermediate && diff != models.DifficultyAdvanced {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  fmt.Sprintf("Invalid difficulty '%s'. Must be beginner, intermediate, or advanced", diffStr),
				})
				continue
			}

			lang := langStr
			if lang == "" {
				lang = "english"
			}

			corrOpt := 0
			if corrOptStr != "" {
				corrOpt, _ = strconv.Atoi(corrOptStr)
			}

			reqAudio := strings.ToLower(reqAudStr) == "true" || reqAudStr == "1" || strings.ToLower(reqAudStr) == "yes"

			if opt1 == "" {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  "Option 1 is required",
				})
				continue
			}

			if cType != models.ChallengeTypePronunciation {
				if opt2 == "" || opt3 == "" {
					parseErrors = append(parseErrors, map[string]interface{}{
						"record": rowNum,
						"error":  "Option 2 and Option 3 are required for vocabulary, grammar, and listening types",
					})
					continue
				}
				if corrOpt < 1 || corrOpt > 3 {
					parseErrors = append(parseErrors, map[string]interface{}{
						"record": rowNum,
						"error":  "Correct option must be 1, 2, or 3",
					})
					continue
				}
			} else {
				if corrOpt == 0 {
					corrOpt = 1
				}
			}

			var challengeID uuid.UUID
			if idStr != "" {
				if parsedUUID, err := uuid.Parse(idStr); err == nil {
					challengeID = parsedUUID
				} else {
					challengeID = uuid.New()
				}
			} else {
				challengeID = uuid.New()
			}

			var tagsArr pq.StringArray
			if tagsStr != "" {
				parts := strings.Split(tagsStr, ",")
				for _, part := range parts {
					tTrim := strings.ToLower(strings.TrimSpace(part))
					if tTrim != "" {
						tagsArr = append(tagsArr, tTrim)
					}
				}
			}

			challengesToImport = append(challengesToImport, models.LearningChallenge{
				ID:               challengeID,
				Type:             cType,
				Question:         qText,
				Option1:          opt1,
				Option2:          opt2,
				Option3:          opt3,
				CorrectOption:    corrOpt,
				ExplanationES:    explES,
				QuestionES:       qES,
				Tags:             tagsArr,
				Difficulty:       diff,
				LanguageLearning: lang,
				Phonetic:         phonStr,
				RequiresAudio:    reqAudio,
				AudioURL:         audURL,
			})
		}
	} else {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported file format. Please upload a .csv or .json file"})
	}

	// Persist the valid challenges in database
	importedCount := 0
	for _, challenge := range challengesToImport {
		// Use upsert behavior by checking if the record already exists, or just create it
		var existing models.LearningChallenge
		dbResult := database.DB.Where("id = ?", challenge.ID).First(&existing)
		if dbResult.Error == nil {
			// Update
			if err := database.DB.Save(&challenge).Error; err != nil {
				parseErrors = append(parseErrors, map[string]interface{}{
					"question": challenge.Question,
					"error":    "Failed to update database record: " + err.Error(),
				})
			} else {
				importedCount++
			}
		} else {
			// Create
			if err := database.DB.Create(&challenge).Error; err != nil {
				parseErrors = append(parseErrors, map[string]interface{}{
					"question": challenge.Question,
					"error":    "Failed to insert database record: " + err.Error(),
				})
			} else {
				importedCount++
			}
		}
	}

	return c.JSON(fiber.Map{
		"success":  len(parseErrors) == 0,
		"imported": importedCount,
		"failed":   len(parseErrors),
		"errors":   parseErrors,
	})
}
