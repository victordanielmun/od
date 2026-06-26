package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/utils"
)

// TranslationService produces and caches the native-language helper text for learning
// challenges. English is canonical (challenge.Question / options); the native layer is
// generated lazily once per (challenge, language) via the LLM and stored in
// ChallengeTranslation for free reuse. This is what lets the game support "any native
// language -> English" without pre-seeding every language by hand.
type TranslationService struct {
	AIClient LLMClient
}

func NewTranslationService(aiClient LLMClient) *TranslationService {
	return &TranslationService{AIClient: aiClient}
}

// GetChallengeTranslation returns the helper text for a challenge in the given language.
// For English it returns the canonical question with no explanation (immersion). For any
// other language it returns a cached row, backfills Spanish from the legacy ES columns,
// or generates a fresh translation via the LLM. Failures degrade to empty helper text so
// the caller can still serve the English challenge.
func (s *TranslationService) GetChallengeTranslation(ch *models.LearningChallenge, lang string) *models.ChallengeTranslation {
	lang = utils.NormalizeLang(lang)

	// English is the language being learned: no native helper needed.
	if utils.IsEnglish(lang) {
		return &models.ChallengeTranslation{ChallengeID: ch.ID, Lang: "en", QuestionNative: ch.Question}
	}

	// Cache hit.
	var existing models.ChallengeTranslation
	if err := database.DB.Where("challenge_id = ? AND lang = ?", ch.ID, lang).First(&existing).Error; err == nil {
		return &existing
	}

	// Backfill from the legacy Spanish columns so existing seed data is reused for free.
	if lang == "es" && (ch.ExplanationES != "" || ch.QuestionES != "") {
		tr := &models.ChallengeTranslation{
			ChallengeID:       ch.ID,
			Lang:              "es",
			QuestionNative:    ch.QuestionES,
			ExplanationNative: ch.ExplanationES,
		}
		s.persist(tr)
		return tr
	}

	// Generate via LLM.
	tr, err := s.generate(ch, lang)
	if err != nil {
		fmt.Printf("[TranslationService] generate failed for challenge %s lang %s: %v\n", ch.ID, lang, err)
		// Degrade gracefully: empty helper, English challenge still usable.
		return &models.ChallengeTranslation{ChallengeID: ch.ID, Lang: lang}
	}
	s.persist(tr)
	return tr
}

// persist best-effort caches a translation row. On unique-conflict (a concurrent request
// generated the same row) it silently re-reads the winner.
func (s *TranslationService) persist(tr *models.ChallengeTranslation) {
	if err := database.DB.Create(tr).Error; err != nil {
		var winner models.ChallengeTranslation
		if e := database.DB.Where("challenge_id = ? AND lang = ?", tr.ChallengeID, tr.Lang).First(&winner).Error; e == nil {
			*tr = winner
		}
	}
}

func (s *TranslationService) generate(ch *models.LearningChallenge, lang string) (*models.ChallengeTranslation, error) {
	if s.AIClient == nil {
		return nil, fmt.Errorf("no AI client configured")
	}

	langName := utils.LanguageName(lang)
	correctText := optionText(ch, ch.CorrectOption)

	systemPrompt := fmt.Sprintf(`You are a translator for an English-learning RPG. The player's native language is %s.
You are given an English multiple-choice question, its options, and the correct answer.
Produce helper text in %s ONLY (never English) so a %s speaker learning English can understand.
Respond with STRICT JSON and nothing else:
{
  "question_native": "the question translated/explained in %s",
  "explanation_native": "a short explanation in %s of why the correct answer is correct"
}`, langName, langName, langName, langName, langName)

	userPrompt := fmt.Sprintf(`English question: %s
Options: 1) %s  2) %s  3) %s
Correct option: %d (%s)`,
		ch.Question, ch.Option1, ch.Option2, ch.Option3, ch.CorrectOption, correctText)

	raw, err := s.AIClient.SendPrompt(systemPrompt, userPrompt)
	if err != nil {
		return nil, err
	}

	var parsed struct {
		QuestionNative    string `json:"question_native"`
		ExplanationNative string `json:"explanation_native"`
	}
	if err := json.Unmarshal([]byte(extractJSON(raw)), &parsed); err != nil {
		return nil, fmt.Errorf("parse translation JSON: %w (raw: %s)", err, raw)
	}

	return &models.ChallengeTranslation{
		ChallengeID:       ch.ID,
		Lang:              lang,
		QuestionNative:    strings.TrimSpace(parsed.QuestionNative),
		ExplanationNative: strings.TrimSpace(parsed.ExplanationNative),
	}, nil
}

// UserLang resolves a user's stored native language (ISO-639-1), defaulting to "en"
// when the user is unknown or has no preference. Shared by handlers that need to localize.
func (s *TranslationService) UserLang(userIDStr string) string {
	if userIDStr == "" {
		return "en"
	}
	var u models.User
	if err := database.DB.Select("native_language").First(&u, "id = ?", userIDStr).Error; err != nil {
		return "en"
	}
	return utils.NormalizeLang(u.NativeLanguage)
}

// GetMissionTranslation returns a mission's player-facing text in the given language,
// cached per (mission, lang). English returns the canonical fields unchanged.
func (s *TranslationService) GetMissionTranslation(m *models.Mission, lang string) *models.MissionTranslation {
	lang = utils.NormalizeLang(lang)
	if utils.IsEnglish(lang) {
		return &models.MissionTranslation{MissionID: m.ID, Lang: "en", Title: m.Title, Description: m.DescriptionEn, Objective: m.ObjectiveEn}
	}

	var existing models.MissionTranslation
	if err := database.DB.Where("mission_id = ? AND lang = ?", m.ID, lang).First(&existing).Error; err == nil {
		return &existing
	}

	tr, err := s.generateMission(m, lang)
	if err != nil {
		fmt.Printf("[TranslationService] mission translate failed (%d/%s): %v\n", m.ID, lang, err)
		return &models.MissionTranslation{MissionID: m.ID, Lang: lang, Title: m.Title, Description: m.DescriptionEn, Objective: m.ObjectiveEn}
	}
	if err := database.DB.Create(tr).Error; err != nil {
		var winner models.MissionTranslation
		if e := database.DB.Where("mission_id = ? AND lang = ?", m.ID, lang).First(&winner).Error; e == nil {
			return &winner
		}
	}
	return tr
}

func (s *TranslationService) generateMission(m *models.Mission, lang string) (*models.MissionTranslation, error) {
	if s.AIClient == nil {
		return nil, fmt.Errorf("no AI client configured")
	}
	langName := utils.LanguageName(lang)

	systemPrompt := fmt.Sprintf(`You translate quest text for an English-learning RPG into %s.
Translate naturally for a player who speaks %s. Respond with STRICT JSON only:
{"title": "...", "description": "...", "objective": "..."}`, langName, langName)

	userPrompt := fmt.Sprintf("Title: %s\nDescription: %s\nObjective: %s", m.Title, m.DescriptionEn, m.ObjectiveEn)

	raw, err := s.AIClient.SendPrompt(systemPrompt, userPrompt)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Objective   string `json:"objective"`
	}
	if err := json.Unmarshal([]byte(extractJSON(raw)), &parsed); err != nil {
		return nil, fmt.Errorf("parse mission JSON: %w (raw: %s)", err, raw)
	}
	return &models.MissionTranslation{
		MissionID:   m.ID,
		Lang:        lang,
		Title:       strings.TrimSpace(parsed.Title),
		Description: strings.TrimSpace(parsed.Description),
		Objective:   strings.TrimSpace(parsed.Objective),
	}, nil
}

// GetTaskTranslation returns a task's description in the given language, cached per
// (task, lang). The English-only learning targets on the task are never translated.
func (s *TranslationService) GetTaskTranslation(t *models.MissionTask, lang string) *models.TaskTranslation {
	lang = utils.NormalizeLang(lang)
	if utils.IsEnglish(lang) {
		return &models.TaskTranslation{TaskID: t.ID, Lang: "en", Description: t.DescriptionEn}
	}

	var existing models.TaskTranslation
	if err := database.DB.Where("task_id = ? AND lang = ?", t.ID, lang).First(&existing).Error; err == nil {
		return &existing
	}

	desc, err := s.translateText(t.DescriptionEn, lang)
	if err != nil {
		fmt.Printf("[TranslationService] task translate failed (%d/%s): %v\n", t.ID, lang, err)
		return &models.TaskTranslation{TaskID: t.ID, Lang: lang, Description: t.DescriptionEn}
	}
	tr := &models.TaskTranslation{TaskID: t.ID, Lang: lang, Description: desc}
	if err := database.DB.Create(tr).Error; err != nil {
		var winner models.TaskTranslation
		if e := database.DB.Where("task_id = ? AND lang = ?", t.ID, lang).First(&winner).Error; e == nil {
			return &winner
		}
	}
	return tr
}

// translateText is a small helper for single-string fields (e.g. a task description).
func (s *TranslationService) translateText(text, lang string) (string, error) {
	if strings.TrimSpace(text) == "" {
		return "", nil
	}
	if s.AIClient == nil {
		return "", fmt.Errorf("no AI client configured")
	}
	langName := utils.LanguageName(lang)
	systemPrompt := fmt.Sprintf("Translate the user's text into %s for a player learning English. Reply with the translation only, no quotes, no extra words.", langName)
	out, err := s.AIClient.SendPrompt(systemPrompt, text)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// hashText devuelve el SHA-256 hex del texto (clave de cache de letreros de info).
func hashText(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

// TranslateInfo traduce (y cachea) el contenido markdown de un letrero de info al idioma
// dado. Inglés es canónico → devuelve el texto tal cual. Cache por (hash, lang): si ya
// existe lo reutiliza (cached=true); si no, traduce vía LLM preservando el markdown y lo
// persiste. Ante fallo del LLM degrada al texto original (cached=false).
func (s *TranslationService) TranslateInfo(text, lang string) (string, bool, error) {
	lang = utils.NormalizeLang(lang)
	if utils.IsEnglish(lang) || strings.TrimSpace(text) == "" {
		return text, false, nil
	}
	hash := hashText(text)

	var existing models.InfoTranslation
	if err := database.DB.Where("source_hash = ? AND lang = ?", hash, lang).First(&existing).Error; err == nil {
		return existing.TranslatedText, true, nil // ya existe → cache hit
	}

	translated, err := s.translateMarkdown(text, lang)
	if err != nil {
		return text, false, err // degrada al inglés
	}
	row := &models.InfoTranslation{SourceHash: hash, Lang: lang, SourceText: text, TranslatedText: translated}
	if err := database.DB.Create(row).Error; err != nil {
		// Carrera: otro request creó la fila primero → devolver el ganador.
		var winner models.InfoTranslation
		if e := database.DB.Where("source_hash = ? AND lang = ?", hash, lang).First(&winner).Error; e == nil {
			return winner.TranslatedText, true, nil
		}
	}
	return translated, false, nil
}

// translateMarkdown traduce conservando la sintaxis markdown (encabezados, **negrita**,
// imágenes ![](url)) y SIN tocar las URLs.
func (s *TranslationService) translateMarkdown(text, lang string) (string, error) {
	if s.AIClient == nil {
		return "", fmt.Errorf("no AI client configured")
	}
	langName := utils.LanguageName(lang)
	systemPrompt := fmt.Sprintf(`You translate in-game info-board text into %s for a player who speaks %s.
The text is Markdown. Rules:
- Translate ONLY the human-readable prose.
- Keep ALL Markdown syntax intact: headings (#), bold (**), italics (*), and line breaks.
- Do NOT translate or modify any URL. Keep image/link syntax like ![alt](url) and (url) exactly; you MAY translate the alt text.
- No explanations, no quotes. Reply with the translated Markdown only.`, langName, langName)
	out, err := s.AIClient.SendPrompt(systemPrompt, text)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

func optionText(ch *models.LearningChallenge, opt int) string {
	switch opt {
	case 1:
		return ch.Option1
	case 2:
		return ch.Option2
	case 3:
		return ch.Option3
	default:
		return ""
	}
}

// extractJSON pulls the first {...} block out of an LLM response that may be wrapped in
// markdown fences or prose.
func extractJSON(raw string) string {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start >= 0 && end > start {
		return raw[start : end+1]
	}
	return raw
}
