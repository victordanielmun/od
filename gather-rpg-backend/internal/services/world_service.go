package services

import (
	"fmt"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"

	"github.com/google/uuid"
)

type WorldService struct {
	Repo *repository.WorldRepository
}

func NewWorldService(repo *repository.WorldRepository) *WorldService {
	return &WorldService{Repo: repo}
}

// ── CRUD passthrough ────────────────────────────────────────────────────────

func (s *WorldService) ListWorlds(includeInactive bool) ([]models.World, error) {
	return s.Repo.ListWorlds(includeInactive)
}
func (s *WorldService) GetWorld(id uint) (*models.World, error) { return s.Repo.GetWorldByID(id) }
func (s *WorldService) CreateWorld(w *models.World) error       { return s.Repo.CreateWorld(w) }
func (s *WorldService) UpdateWorld(w *models.World) error       { return s.Repo.UpdateWorld(w) }
func (s *WorldService) DeleteWorld(id uint) error               { return s.Repo.DeleteWorld(id) }
func (s *WorldService) MissionsOfWorld(id uint) ([]models.Mission, error) {
	return s.Repo.MissionsOfWorld(id)
}
func (s *WorldService) LooseMissions() ([]models.Mission, error) { return s.Repo.LooseMissions() }
func (s *WorldService) SetWorldMissions(worldID uint, missionIDs []uint, finalID uint) error {
	return s.Repo.SetWorldMissions(worldID, missionIDs, finalID)
}
func (s *WorldService) PoolHealth(w *models.World) repository.PoolHealth {
	return s.Repo.PoolHealth(w)
}
func (s *WorldService) MasteryMap(playerID uuid.UUID) map[uint]*models.PlayerWorldMastery {
	return s.Repo.GetMasteryMap(playerID)
}

// ── Combat context resolution ───────────────────────────────────────────────

// CardContext is what the combat engine needs to pick a Ninja Card: which world
// the player is currently learning in, and whether this map is that world's exam.
type CardContext struct {
	World *models.World // nil = no world resolved; use the legacy global pool
	// IsExam is true when the player is in the world's FINAL mission map. Cards
	// then come exclusively from World.ExamTag — that is what makes the map a
	// test instead of practice.
	IsExam bool
	// MissionTags is a per-mission override of the world's normal pool.
	MissionTags []string
}

// ResolveContext figures out the learning context for ONE player in a scene.
//
// Resolution is per-player, not per-room, because a public room can hold players
// on different missions and each Ninja Card is issued individually.
//
//	accepted mission in this scene → its world (final mission wins) →
//	otherwise the scene's world when unambiguous → otherwise nil
//
// A nil World is a normal outcome (loose missions, lobby, unmapped scenes) and
// makes the caller fall back to today's global behaviour.
func (s *WorldService) ResolveContext(userID uuid.UUID, sceneKey string) CardContext {
	var ctx CardContext
	if sceneKey == "" || database.DB == nil {
		return ctx
	}

	playerID, err := s.resolvePlayerID(userID)
	if err == nil && playerID != uuid.Nil {
		// Missions the player has actually accepted and is playing in this scene.
		var missions []models.Mission
		database.DB.Model(&models.Mission{}).
			// Explicit select: without it the join's columns bleed into the scan
			// and p.id overwrites missions.id.
			Select("missions.*").
			Joins("JOIN player_mission_progresses p ON p.mission_id = missions.id").
			Where("p.player_id = ? AND p.status = ? AND missions.scene_key = ? AND missions.world_id IS NOT NULL",
				playerID, string(models.StatusInProgress), sceneKey).
			Order("missions.is_final DESC"). // the exam wins over a normal mission
			Find(&missions)

		if len(missions) > 0 {
			m := missions[0]
			if w, wErr := s.Repo.GetWorldByID(*m.WorldID); wErr == nil && w != nil {
				ctx.World = w
				ctx.IsExam = m.IsFinal
				ctx.MissionTags = []string(m.ChallengeTags)
				return ctx
			}
		}
	}

	// No accepted mission here: fall back to the scene's world, but only when the
	// scene maps to exactly one world (see GetWorldBySceneKey).
	if w, wErr := s.Repo.GetWorldBySceneKey(sceneKey); wErr == nil && w != nil {
		ctx.World = w
		ctx.IsExam = s.Repo.IsFinalMissionScene(w.ID, sceneKey)
	}
	return ctx
}

// BuildPools returns the pools to try IN ORDER for this context. Each one is
// narrower than the next, so an empty or badly tagged pool degrades gracefully
// instead of failing the card. The caller appends its own legacy fallbacks.
func (s *WorldService) BuildPools(ctx CardContext, playerLevel string) []repository.ChallengePool {
	if ctx.World == nil {
		return nil
	}
	w := ctx.World

	// EXAM: the tag is the curation. No type/difficulty narrowing on top of it —
	// that could empty a pool the admin deliberately assembled.
	if ctx.IsExam {
		if w.ExamTag == "" {
			// Misconfigured world: it has a final map but no exam pool. Say so
			// loudly, because silently serving random questions would look like
			// a working exam while testing nothing.
			fmt.Printf("[WorldService] WARN: world %q (id=%d) has a final mission but no exam_tag — cards fall back to the generic pool\n", w.Key, w.ID)
			return nil
		}
		return []repository.ChallengePool{{Tags: []string{w.ExamTag}}}
	}

	// NORMAL mission: the mission's own tags override the world's, if set.
	tags := []string(w.ChallengeTags)
	if len(ctx.MissionTags) > 0 {
		tags = ctx.MissionTags
	}
	if len(tags) == 0 {
		return nil
	}

	types := []string(w.ChallengeTypes)
	difficulty := string(w.Difficulty)
	if difficulty == "" {
		difficulty = playerLevel
	}

	// Widen step by step: the world's difficulty is the intent, but a thin
	// catalog must not leave the player without a card.
	return []repository.ChallengePool{
		{Tags: tags, Types: types, Difficulty: difficulty},
		{Tags: tags, Types: types},
		{Tags: tags},
	}
}

// RecordExamOutcome persists one exam run for a player. `passed` is true only
// when the world's boss actually went down — that is the whole pass condition.
func (s *WorldService) RecordExamOutcome(userID uuid.UUID, worldID uint, tagStats map[string]models.TagStat, passed bool) {
	playerID, err := s.resolvePlayerID(userID)
	if err != nil || playerID == uuid.Nil {
		return
	}

	ok, total := 0, 0
	for _, st := range tagStats {
		ok += st.OK
		total += st.Total
	}
	score := 0
	if total > 0 {
		score = ok * 100 / total
	}

	if err := s.Repo.RecordExamAttempt(playerID, worldID, score, tagStats, passed); err != nil {
		fmt.Printf("[WorldService] WARN: failed to record exam attempt (player=%s world=%d): %v\n", playerID, worldID, err)
		return
	}
	fmt.Printf("[WorldService] Exam recorded: player=%s world=%d score=%d%% (%d/%d) passed=%v\n", playerID, worldID, score, ok, total, passed)
}

// GetMastery returns the player's record for a world, or nil when never attempted.
func (s *WorldService) GetMastery(userID uuid.UUID, worldID uint) *models.PlayerWorldMastery {
	playerID, err := s.resolvePlayerID(userID)
	if err != nil {
		return nil
	}
	m, err := s.Repo.GetMastery(playerID, worldID)
	if err != nil {
		return nil
	}
	return m
}

// MasteryMapForUser is MasteryMap keyed by the auth user id instead of the
// internal player id (what handlers have on hand).
func (s *WorldService) MasteryMapForUser(userID uuid.UUID) map[uint]*models.PlayerWorldMastery {
	playerID, err := s.resolvePlayerID(userID)
	if err != nil {
		return map[uint]*models.PlayerWorldMastery{}
	}
	return s.Repo.GetMasteryMap(playerID)
}

// resolvePlayerID maps an auth user id to the internal player_stats id, the key
// used by every progress table (mirrors MissionService.resolvePlayerID).
func (s *WorldService) resolvePlayerID(userID uuid.UUID) (uuid.UUID, error) {
	var stats models.PlayerStats
	if err := database.DB.Select("id").First(&stats, "user_id = ?", userID).Error; err != nil {
		return uuid.Nil, err
	}
	return stats.ID, nil
}
