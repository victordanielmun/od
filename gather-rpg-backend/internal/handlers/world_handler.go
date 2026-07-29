package handlers

import (
	"encoding/json"
	"strconv"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"gather-rpg-backend/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type WorldHandler struct {
	Service     *services.WorldService
	Translation *services.TranslationService
}

func NewWorldHandler(service *services.WorldService, translation *services.TranslationService) *WorldHandler {
	return &WorldHandler{Service: service, Translation: translation}
}

// ── Player-facing ───────────────────────────────────────────────────────────

// WorldSummary is one card in the player's world catalog.
type WorldSummary struct {
	ID          uint   `json:"id"`
	Key         string `json:"key"`
	Name        string `json:"name"`        // native language (falls back to English)
	NameEn      string `json:"name_en"`     // English canonical
	Description string `json:"description"` // native language
	Difficulty  string `json:"difficulty"`
	CoverImage  string `json:"cover_image"`
	Order       int    `json:"order"`
	// MissionCount / CompletedCount drive the "3/7" progress label. They are
	// informative: no world or mission is ever locked behind them.
	MissionCount   int  `json:"mission_count"`
	CompletedCount int  `json:"completed_count"`
	HasExam        bool `json:"has_exam"`
	// Exam record. Passed means the world's boss went down at least once.
	Passed       bool           `json:"passed"`
	BestScore    int            `json:"best_score"`
	LastScore    int            `json:"last_score"`
	ExamAttempts int            `json:"exam_attempts"`
	WeakTags     map[string]int `json:"weak_tags,omitempty"` // tag → % correcto
}

// GetWorlds — GET /worlds. Catálogo para el jugador: mundos activos + su registro
// de examen. Todos abiertos: no hay orden obligatorio ni desbloqueo.
func (h *WorldHandler) GetWorlds(c *fiber.Ctx) error {
	userIDStr, _ := c.Locals("user_id").(string)
	userID, _ := uuid.Parse(userIDStr)
	userLang := h.Translation.UserLang(userIDStr)

	return c.JSON(BuildWorldCatalog(h.Service, h.Translation, userID, userLang))
}

// BuildWorldCatalog arma las tarjetas de mundo para un jugador. Lo comparten el
// endpoint /worlds y el tablero del maestro de misiones, para que ambos muestren
// exactamente el mismo catálogo.
func BuildWorldCatalog(svc *services.WorldService, tr *services.TranslationService, userID uuid.UUID, userLang string) []WorldSummary {
	worlds, err := svc.ListWorlds(false)
	if err != nil {
		return []WorldSummary{}
	}
	mastery := svc.MasteryMapForUser(userID)

	// Conteo de misiones y de completadas por mundo, en dos queries (no N+1).
	missionCounts := map[uint]int{}
	completedCounts := map[uint]int{}
	type row struct {
		WorldID uint
		N       int
	}
	var counts []row
	database.DB.Model(&models.Mission{}).
		Select("world_id, count(*) AS n").
		Where("world_id IS NOT NULL AND status = ?", "active").
		Group("world_id").Scan(&counts)
	for _, r := range counts {
		missionCounts[r.WorldID] = r.N
	}

	if playerID := resolvePlayerIDForUser(userID); playerID != uuid.Nil {
		var done []row
		database.DB.Model(&models.Mission{}).
			Select("missions.world_id AS world_id, count(*) AS n").
			Joins("JOIN player_mission_progresses p ON p.mission_id = missions.id").
			Where("missions.world_id IS NOT NULL AND p.player_id = ? AND p.status = ?", playerID, string(models.StatusCompleted)).
			Group("missions.world_id").Scan(&done)
		for _, r := range done {
			completedCounts[r.WorldID] = r.N
		}
	}

	// Portada derivada: un mundo sin cover_image propio hereda el arte del mapa de
	// su misión FINAL (el examen es lo que mejor representa al mundo) y, si no
	// tiene final, el de su primera misión. Así basta con una imagen por mapa y no
	// hay que producir arte extra por mundo; cover_image queda como override.
	derivedCover := map[uint]string{}
	{
		type row struct {
			WorldID uint
			Image   string
		}
		var rows []row
		database.DB.Model(&models.Mission{}).
			Select("missions.world_id AS world_id, map_configs.preview_image AS image").
			Joins("JOIN map_configs ON map_configs.scene_key = missions.scene_key").
			Where("missions.world_id IS NOT NULL AND map_configs.preview_image <> '' AND missions.status = ?", "active").
			// is_final primero: gana el mapa del examen sobre el resto.
			Order("missions.world_id, missions.is_final DESC, missions.order_in_world ASC, missions.id ASC").
			Scan(&rows)
		for _, r := range rows {
			if _, seen := derivedCover[r.WorldID]; !seen {
				derivedCover[r.WorldID] = r.Image
			}
		}
	}

	out := make([]WorldSummary, 0, len(worlds))
	for i := range worlds {
		w := &worlds[i]

		name, descr := w.Name, w.DescriptionEn
		if !utils.IsEnglish(userLang) && tr != nil {
			wt := tr.GetWorldTranslation(w, userLang)
			name, descr = wt.Name, wt.Description
		}

		cover := w.CoverImage
		if cover == "" {
			cover = derivedCover[w.ID]
		}

		s := WorldSummary{
			ID:             w.ID,
			Key:            w.Key,
			Name:           name,
			NameEn:         w.Name,
			Description:    descr,
			Difficulty:     string(w.Difficulty),
			CoverImage:     cover,
			Order:          w.Order,
			MissionCount:   missionCounts[w.ID],
			CompletedCount: completedCounts[w.ID],
			HasExam:        w.ExamTag != "",
		}
		if m := mastery[w.ID]; m != nil {
			s.Passed = m.PassedAt != nil
			s.BestScore = m.BestScore
			s.LastScore = m.LastScore
			s.ExamAttempts = m.ExamAttempts
			s.WeakTags = weakTagPercentages(m)
		}
		out = append(out, s)
	}

	return out
}

// GetWorldMastery — GET /worlds/:id/mastery. Diagnóstico del último examen:
// qué temas domina y cuáles debe repasar.
func (h *WorldHandler) GetWorldMastery(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid world id"})
	}
	userIDStr, _ := c.Locals("user_id").(string)
	userID, _ := uuid.Parse(userIDStr)

	world, err := h.Service.GetWorld(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "world not found"})
	}

	m := h.Service.GetMastery(userID, uint(id))
	if m == nil {
		// Nunca lo intentó: no es un error, es un estado válido del catálogo.
		return c.JSON(fiber.Map{
			"world_id": id, "attempted": false, "passed": false,
			"review_tags": []string{}, "practice_tags": []string(world.ChallengeTags),
		})
	}

	pct := weakTagPercentages(m)
	// "Repasar" = temas por debajo del 70% de aciertos en el examen.
	review := make([]string, 0)
	for tag, p := range pct {
		if p < 70 {
			review = append(review, tag)
		}
	}

	return c.JSON(fiber.Map{
		"world_id":      id,
		"attempted":     true,
		"passed":        m.PassedAt != nil,
		"passed_at":     m.PassedAt,
		"best_score":    m.BestScore,
		"last_score":    m.LastScore,
		"exam_attempts": m.ExamAttempts,
		"tag_scores":    pct,
		"review_tags":   review,
		"practice_tags": []string(world.ChallengeTags),
	})
}

// ── Admin ───────────────────────────────────────────────────────────────────

type worldPayload struct {
	Key            string   `json:"key"`
	Name           string   `json:"name"`
	DescriptionEn  string   `json:"description_en"`
	Order          int      `json:"order"`
	ChallengeTags  []string `json:"challenge_tags"`
	ChallengeTypes []string `json:"challenge_types"`
	ExamTag        string   `json:"exam_tag"`
	Difficulty     string   `json:"difficulty"`
	CoverImage     string   `json:"cover_image"`
	Status         string   `json:"status"`
}

func (p *worldPayload) applyTo(w *models.World) {
	w.Key = p.Key
	w.Name = p.Name
	w.DescriptionEn = p.DescriptionEn
	w.Order = p.Order
	w.ChallengeTags = pq.StringArray(p.ChallengeTags)
	w.ChallengeTypes = pq.StringArray(p.ChallengeTypes)
	w.ExamTag = p.ExamTag
	if p.Difficulty != "" {
		w.Difficulty = models.DifficultyLevel(p.Difficulty)
	}
	w.CoverImage = p.CoverImage
	if p.Status != "" {
		w.Status = p.Status
	}
}

// ListWorlds — GET /admin/worlds. Incluye inactivos y la salud de cada pool.
func (h *WorldHandler) ListWorlds(c *fiber.Ctx) error {
	worlds, err := h.Service.ListWorlds(true)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	type adminWorld struct {
		models.World
		PoolHealth  interface{} `json:"pool_health"`
		MissionIDs  []uint      `json:"mission_ids"`
		FinalMissID uint        `json:"final_mission_id"`
	}
	out := make([]adminWorld, 0, len(worlds))
	for i := range worlds {
		w := worlds[i]
		missions, _ := h.Service.MissionsOfWorld(w.ID)
		ids := make([]uint, 0, len(missions))
		var finalID uint
		for _, m := range missions {
			ids = append(ids, m.ID)
			if m.IsFinal {
				finalID = m.ID
			}
		}
		out = append(out, adminWorld{
			World:       w,
			PoolHealth:  h.Service.PoolHealth(&w),
			MissionIDs:  ids,
			FinalMissID: finalID,
		})
	}
	return c.JSON(out)
}

func (h *WorldHandler) CreateWorld(c *fiber.Ctx) error {
	var p worldPayload
	if err := c.BodyParser(&p); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if p.Key == "" || p.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "key y name son obligatorios"})
	}
	w := models.World{Difficulty: models.DifficultyBeginner, Status: "active"}
	p.applyTo(&w)
	if err := h.Service.CreateWorld(&w); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(w)
}

func (h *WorldHandler) UpdateWorld(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid world id"})
	}
	w, err := h.Service.GetWorld(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "world not found"})
	}
	var p worldPayload
	if err := c.BodyParser(&p); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	textChanged := p.Name != w.Name || p.DescriptionEn != w.DescriptionEn

	p.applyTo(w)
	if err := h.Service.UpdateWorld(w); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	// El texto de cara al jugador cambió → tirar la caché de traducciones para que
	// se regenere, igual que se hace al editar una misión.
	if textChanged && h.Translation != nil {
		h.Translation.InvalidateWorldTranslations(w.ID)
	}
	return c.JSON(w)
}

func (h *WorldHandler) DeleteWorld(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid world id"})
	}
	if err := h.Service.DeleteWorld(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if h.Translation != nil {
		h.Translation.InvalidateWorldTranslations(uint(id))
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// GetWorldMissions — GET /admin/worlds/:id/missions y GET /worlds/:id/missions.
// id = 0 devuelve las misiones sueltas (sin mundo), que siguen siendo jugables.
func (h *WorldHandler) GetWorldMissions(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid world id"})
	}
	var missions []models.Mission
	if id == 0 {
		missions, err = h.Service.LooseMissions()
	} else {
		missions, err = h.Service.MissionsOfWorld(uint(id))
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(missions)
}

// SetWorldMissions — PUT /admin/worlds/:id/missions. Reemplaza el conjunto de
// misiones del mundo y marca UNA como final (el examen).
func (h *WorldHandler) SetWorldMissions(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid world id"})
	}
	var body struct {
		MissionIDs      []uint `json:"mission_ids"`
		FinalMissionID  uint   `json:"final_mission_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	// La final tiene que estar en el conjunto, si no quedaría un examen huérfano.
	if body.FinalMissionID != 0 {
		found := false
		for _, mid := range body.MissionIDs {
			if mid == body.FinalMissionID {
				found = true
				break
			}
		}
		if !found {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "la misión final debe estar entre las misiones del mundo"})
		}
	}
	if err := h.Service.SetWorldMissions(uint(id), body.MissionIDs, body.FinalMissionID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// GetPoolHealth — GET /admin/worlds/:id/pool-health. Un pool de examen en 0 es el
// fallo silencioso a evitar: el examen caería al pool global y dejaría de evaluar.
func (h *WorldHandler) GetPoolHealth(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid world id"})
	}
	w, err := h.Service.GetWorld(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "world not found"})
	}
	return c.JSON(h.Service.PoolHealth(w))
}

// ── helpers ─────────────────────────────────────────────────────────────────

// weakTagPercentages turns the stored {tag: {ok,total}} into {tag: percent}.
func weakTagPercentages(m *models.PlayerWorldMastery) map[string]int {
	stats := map[string]models.TagStat{}
	if len(m.WeakTags) > 0 {
		_ = json.Unmarshal(m.WeakTags, &stats)
	}
	out := make(map[string]int, len(stats))
	for tag, st := range stats {
		if st.Total > 0 {
			out[tag] = st.OK * 100 / st.Total
		}
	}
	return out
}

// resolvePlayerIDForUser maps an auth user id to the internal player_stats id.
func resolvePlayerIDForUser(userID uuid.UUID) uuid.UUID {
	if userID == uuid.Nil || database.DB == nil {
		return uuid.Nil
	}
	var stats models.PlayerStats
	if err := database.DB.Select("id").First(&stats, "user_id = ?", userID).Error; err != nil {
		return uuid.Nil
	}
	return stats.ID
}
