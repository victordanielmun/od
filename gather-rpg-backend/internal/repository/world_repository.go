package repository

import (
	"encoding/json"
	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type WorldRepository struct{}

func NewWorldRepository() *WorldRepository {
	return &WorldRepository{}
}

// ── Worlds CRUD ─────────────────────────────────────────────────────────────

// ListWorlds returns worlds ordered by their presentation order. Order never
// gates access — it only decides where a world sits in the catalog.
func (r *WorldRepository) ListWorlds(includeInactive bool) ([]models.World, error) {
	var worlds []models.World
	q := database.DB.Order(`"order" ASC, id ASC`)
	if !includeInactive {
		q = q.Where("status = ?", "active")
	}
	err := q.Find(&worlds).Error
	return worlds, err
}

func (r *WorldRepository) GetWorldByID(id uint) (*models.World, error) {
	var w models.World
	if err := database.DB.First(&w, id).Error; err != nil {
		return nil, err
	}
	return &w, nil
}

func (r *WorldRepository) CreateWorld(w *models.World) error {
	return database.DB.Create(w).Error
}

func (r *WorldRepository) UpdateWorld(w *models.World) error {
	return database.DB.Save(w).Error
}

// DeleteWorld removes the world and unlinks its missions (world_id → NULL), so
// they fall back to the "loose missions" bucket instead of disappearing.
func (r *WorldRepository) DeleteWorld(id uint) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Mission{}).Where("world_id = ?", id).
			Updates(map[string]interface{}{"world_id": nil, "is_final": false}).Error; err != nil {
			return err
		}
		return tx.Delete(&models.World{}, id).Error
	})
}

// ── Mission ↔ world linking ─────────────────────────────────────────────────

func (r *WorldRepository) MissionsOfWorld(worldID uint) ([]models.Mission, error) {
	var missions []models.Mission
	err := database.DB.Where("world_id = ?", worldID).
		Order("order_in_world ASC, id ASC").Find(&missions).Error
	return missions, err
}

// LooseMissions returns active missions not assigned to any world. They keep
// their own bucket in the quest board so nothing authored before worlds existed
// silently disappears from the game.
func (r *WorldRepository) LooseMissions() ([]models.Mission, error) {
	var missions []models.Mission
	err := database.DB.Where("world_id IS NULL AND status = ?", "active").
		Order("id ASC").Find(&missions).Error
	return missions, err
}

// SetWorldMissions replaces the world's mission set in one transaction and marks
// exactly one of them as the final (exam) mission. finalMissionID = 0 leaves the
// world without an exam. Missions dropped from the set are unlinked, not deleted.
func (r *WorldRepository) SetWorldMissions(worldID uint, missionIDs []uint, finalMissionID uint) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		// Unlink everything currently pointing here; we re-link below. Clearing
		// is_final first is what lets the partial unique index (one final per
		// world) tolerate moving the flag between missions in a single call.
		if err := tx.Model(&models.Mission{}).Where("world_id = ?", worldID).
			Updates(map[string]interface{}{"world_id": nil, "is_final": false}).Error; err != nil {
			return err
		}
		if len(missionIDs) == 0 {
			return nil
		}
		for i, mid := range missionIDs {
			if err := tx.Model(&models.Mission{}).Where("id = ?", mid).
				Updates(map[string]interface{}{
					"world_id":       worldID,
					"order_in_world": i,
					"is_final":       mid == finalMissionID && finalMissionID != 0,
				}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// ── World resolution (used by the combat card engine) ───────────────────────

// GetWorldForMission returns the world a mission belongs to, or nil when the
// mission is loose. A nil world is normal, not an error.
func (r *WorldRepository) GetWorldForMission(missionID uint) (*models.World, error) {
	var m models.Mission
	if err := database.DB.Select("id", "world_id").First(&m, missionID).Error; err != nil {
		return nil, err
	}
	if m.WorldID == nil {
		return nil, nil
	}
	return r.GetWorldByID(*m.WorldID)
}

// GetWorldBySceneKey resolves a scene to its world, but ONLY when the mapping is
// unambiguous: if the scene hosts missions from two different worlds (or none),
// it returns nil so the caller falls back to the global challenge pool rather
// than guessing a curriculum for the player.
func (r *WorldRepository) GetWorldBySceneKey(sceneKey string) (*models.World, error) {
	if sceneKey == "" {
		return nil, nil
	}
	var ids []uint
	if err := database.DB.Model(&models.Mission{}).
		Where("scene_key = ? AND world_id IS NOT NULL", sceneKey).
		Distinct().Pluck("world_id", &ids).Error; err != nil {
		return nil, err
	}
	if len(ids) != 1 {
		return nil, nil
	}
	return r.GetWorldByID(ids[0])
}

// IsFinalMissionScene reports whether the scene hosts the world's exam mission.
// Used when the player wanders into the final map without an accepted mission.
func (r *WorldRepository) IsFinalMissionScene(worldID uint, sceneKey string) bool {
	var count int64
	database.DB.Model(&models.Mission{}).
		Where("world_id = ? AND scene_key = ? AND is_final = true", worldID, sceneKey).
		Count(&count)
	return count > 0
}

// GetActiveExamTags returns every non-empty exam tag in use. The learning
// metadata endpoint subtracts these so an internal routing tag (e.g.
// "final_mision_1") never shows up as a practice category for players.
func (r *WorldRepository) GetActiveExamTags() []string {
	var tags []string
	database.DB.Model(&models.World{}).
		Where("exam_tag <> ''").Distinct().Pluck("exam_tag", &tags)
	return tags
}

// ── Pool health ─────────────────────────────────────────────────────────────

type PoolHealth struct {
	WorldID       uint     `json:"world_id"`
	ExamTag       string   `json:"exam_tag"`
	ExamCount     int64    `json:"exam_count"`
	NormalCount   int64    `json:"normal_count"`
	ChallengeTags []string `json:"challenge_tags"`
}

// PoolHealth counts how many challenges back a world's pools. An exam pool of 0
// is the silent failure mode we must surface: the exam would fall back to random
// global questions and stop being an exam at all.
func (r *WorldRepository) PoolHealth(w *models.World) PoolHealth {
	out := PoolHealth{
		WorldID:       w.ID,
		ExamTag:       w.ExamTag,
		ChallengeTags: []string(w.ChallengeTags),
	}
	if w.ExamTag != "" {
		database.DB.Model(&models.LearningChallenge{}).
			Where("? = ANY(tags)", w.ExamTag).Count(&out.ExamCount)
	}
	if len(w.ChallengeTags) > 0 {
		database.DB.Model(&models.LearningChallenge{}).
			Where("tags && ?", w.ChallengeTags).Count(&out.NormalCount)
	}
	return out
}

// ── Player mastery ──────────────────────────────────────────────────────────

func (r *WorldRepository) GetMastery(playerID uuid.UUID, worldID uint) (*models.PlayerWorldMastery, error) {
	var m models.PlayerWorldMastery
	err := database.DB.Where("player_id = ? AND world_id = ?", playerID, worldID).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetMasteryMap returns the player's mastery for every world, keyed by world id,
// in one query (the catalog needs all of them at once).
func (r *WorldRepository) GetMasteryMap(playerID uuid.UUID) map[uint]*models.PlayerWorldMastery {
	out := make(map[uint]*models.PlayerWorldMastery)
	if playerID == uuid.Nil {
		return out
	}
	var rows []models.PlayerWorldMastery
	database.DB.Where("player_id = ?", playerID).Find(&rows)
	for i := range rows {
		out[rows[i].WorldID] = &rows[i]
	}
	return out
}

// RecordExamAttempt upserts the player's mastery row for a world after an exam
// run. `passed` stamps PassedAt (only the first time — the earliest pass is the
// one worth keeping). Scores are percentages 0-100.
func (r *WorldRepository) RecordExamAttempt(playerID uuid.UUID, worldID uint, score int, tagStats map[string]models.TagStat, passed bool) error {
	weak, err := json.Marshal(tagStats)
	if err != nil {
		weak = []byte("{}")
	}

	row := models.PlayerWorldMastery{
		PlayerID:     playerID,
		WorldID:      worldID,
		ExamAttempts: 1,
		LastScore:    score,
		BestScore:    score,
		WeakTags:     weak,
	}
	if passed {
		now := time.Now()
		row.PassedAt = &now
	}

	// Single atomic upsert: a brand-new row lands with attempt #1, an existing one
	// gets incremented in place. Two players finishing a coop exam at the same
	// instant can't clobber each other's counters this way.
	return database.DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "player_id"}, {Name: "world_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"exam_attempts": gorm.Expr("player_world_masteries.exam_attempts + 1"),
			"last_score":    score,
			"best_score":    gorm.Expr("GREATEST(player_world_masteries.best_score, ?)", score),
			"weak_tags":     string(weak),
			"updated_at":    time.Now(),
			// COALESCE keeps the FIRST pass timestamp across later replays, and
			// leaves it NULL when this attempt didn't pass either.
			"passed_at": gorm.Expr("COALESCE(player_world_masteries.passed_at, EXCLUDED.passed_at)"),
		}),
	}).Create(&row).Error
}
