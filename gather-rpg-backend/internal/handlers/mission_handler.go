package handlers

import (
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"gather-rpg-backend/internal/utils"
	"gather-rpg-backend/internal/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"strconv"
	"time"
)

type MissionHandler struct {
	Service     *services.MissionService
	Translation *services.TranslationService
	Hub         *websocket.Hub
	Sub         *services.SubscriptionService
	// Worlds alimenta el primer nivel del tablero del maestro (catálogo de mundos).
	// Opcional: si es nil el tablero cae a la lista plana de misiones de siempre.
	Worlds *services.WorldService
}

func NewMissionHandler(service *services.MissionService, translation *services.TranslationService, hub *websocket.Hub, sub *services.SubscriptionService, worlds *services.WorldService) *MissionHandler {
	return &MissionHandler{Service: service, Translation: translation, Hub: hub, Sub: sub, Worlds: worlds}
}

func (h *MissionHandler) GetMissionsByScene(c *fiber.Ctx) error {
	sceneKey := c.Params("key")
	missions, err := h.Service.GetMissionsForScene(sceneKey)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Get player ID from context
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.JSON(missions)
	}
	userID, _ := uuid.Parse(userIDStr)

	// Native language for quest-log localization (helper text only; English stays canonical).
	userLang := h.Translation.UserLang(userIDStr)

	// NOTE: difficulty is informative only — we surface it as a label so players can
	// explore and recognize which missions are more advanced. We intentionally do NOT
	// filter/hide missions by the player's level: a level is a poor proxy for what
	// someone can actually do, so all active missions stay visible.

	type TaskWithStatus struct {
		ID            uint   `json:"id"`
		Description   string `json:"description"`    // native-language helper (falls back to English)
		DescriptionEn string `json:"description_en"` // English canonical, always
		Type          string `json:"type"`
		IsCompleted   bool   `json:"is_completed"`
		KillsDone     int    `json:"kills_done"`
		RequiredKills int    `json:"required_kills"`
		NPCID         *uint  `json:"npc_id"`
	}

	type MissionWithStatus struct {
		ID            uint             `json:"id"`
		Title         string           `json:"title"`
		Description   string           `json:"description"`    // native-language helper (falls back to English)
		DescriptionEn string           `json:"description_en"` // English canonical, always
		ObjectiveEn   string           `json:"objective_en"`
		SceneKey      string           `json:"scene_key"`
		Mode          string           `json:"mode"`
		Difficulty    string           `json:"difficulty"` // informative label only (beginner/intermediate/advanced)
		IsPremium     bool             `json:"is_premium"` // mission requires membership
		Locked        bool             `json:"locked"`     // premium AND this player is not a member
		Tasks         []TaskWithStatus `json:"tasks"`
		OverallStatus string           `json:"status"`
	}

	// Resolve membership once for this request so premium missions can be flagged
	// as locked for non-members (informative; accept is enforced server-side).
	isPremiumUser := h.Sub != nil && h.Sub.IsUserPremium(userID)

	result := make([]MissionWithStatus, 0)
	for _, m := range missions {
		tasks, _ := h.Service.GetTasks(m.ID)
		// Progreso room-agnostic: hay una sola fila por (player, mission), scoped
		// implícitamente por la escena de la misión.
		progress, _ := h.Service.GetProgressReadOnly(userID, m.ID, nil)

		var completedMap map[string]bool
		if progress != nil && progress.TasksCompleted != nil {
			json.Unmarshal(progress.TasksCompleted, &completedMap)
		}
		if completedMap == nil {
			completedMap = make(map[string]bool)
		}

		var killCounts map[string]int
		if progress != nil && progress.KillCounts != nil {
			json.Unmarshal(progress.KillCounts, &killCounts)
		}
		if killCounts == nil {
			killCounts = make(map[string]int)
		}

		taskStatuses := make([]TaskWithStatus, 0)
		for _, t := range tasks {
			killsDone := killCounts[fmt.Sprint(t.ID)]
			reqKills := t.RequiredKills
			if reqKills == 0 {
				if t.Type == models.TaskTypeDefeatEnemy || t.Type == models.TaskTypeKillAll || t.Type == models.TaskTypeKillBoss {
					reqKills = 1
				}
			}

			taskDesc := t.DescriptionEn
			if !utils.IsEnglish(userLang) {
				tcopy := t
				taskDesc = h.Translation.GetTaskTranslation(&tcopy, userLang).Description
			}

			taskStatuses = append(taskStatuses, TaskWithStatus{
				ID:            t.ID,
				Description:   taskDesc,        // native (or English when userLang == en)
				DescriptionEn: t.DescriptionEn, // English canonical, never overwritten
				Type:          string(t.Type),
				IsCompleted:   completedMap[fmt.Sprint(t.ID)],
				KillsDone:     killsDone,
				RequiredKills: reqKills,
				NPCID:         t.TargetNPCTemplateID,
			})
		}

		// Calcular status general de forma segura (progress puede ser nil si misión nunca inició)
		overallStatus := "not_started"
		if progress != nil {
			overallStatus = string(progress.Status)
		}

		// Localize the mission's player-facing text (cached per language). English stays
		// in *_en; the native translation goes in `description`. The client picks per its
		// UI language toggle.
		title, descrNative := m.Title, m.DescriptionEn
		if !utils.IsEnglish(userLang) {
			mcopy := m
			mt := h.Translation.GetMissionTranslation(&mcopy, userLang)
			title, descrNative = mt.Title, mt.Description
		}

		result = append(result, MissionWithStatus{
			ID:            m.ID,
			Title:         title,
			Description:   descrNative,    // native (or English when userLang == en)
			DescriptionEn: m.DescriptionEn, // English canonical, never overwritten
			ObjectiveEn:   m.ObjectiveEn,
			SceneKey:      m.SceneKey,
			Mode:          string(m.Mode),
			Difficulty:    string(m.Difficulty),
			IsPremium:     m.IsPremium,
			Locked:        m.IsPremium && !isPremiumUser,
			OverallStatus: overallStatus,
			Tasks:         taskStatuses,
		})
	}

	return c.JSON(result)
}

func timeNowMillis() int64 {
	return time.Now().UnixMilli()
}
func (h *MissionHandler) GetMissionsByNPC(c *fiber.Ctx) error {
	tmplIDStr := c.Params("id")
	uID, _ := strconv.ParseUint(tmplIDStr, 10, 32)
	tmplID := uint(uID)

	// Fetch NPC info to check for Type and Shop
	var tmpl models.NPCTemplate
	if err := database.DB.Preload("NPCDefinition.Shop.Items").First(&tmpl, tmplID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "NPC Template not found"})
	}

	var missions []models.Mission
	var err error

	// LOGIC: If NPC is a quest_master (Portal), show ALL active missions.
	// Otherwise, show only missions specifically linked to this NPC.
	if tmpl.NPCDefinition.Type == models.NPCTypeMaster {
		missions, err = h.Service.GetAllMissions()
	} else {
		missions, err = h.Service.GetNPCMissions(tmplID)
	}

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Get player ID from context
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, _ := uuid.Parse(userIDStr)

	// Native language for localization (helper text only; English stays canonical).
	userLang := h.Translation.UserLang(userIDStr)

	// NOTE: difficulty is informative only — surfaced as a label so players can explore
	// and recognize which missions are more advanced. We intentionally do NOT filter/hide
	// missions by the player's level (see GetMissionsByScene for the rationale).

	// ── Batch preload (avoid N+1 against a possibly-remote DB) ──────────────────
	// The loops below need each active mission's tasks, the player's progress, and
	// (for non-English players) cached translations. Fetching these per-mission meant
	// ~4 round-trips × N missions (≈5s for a quest master with many missions on a
	// remote DB). We load them all up front in a handful of queries and look them up
	// from maps instead.
	activeMissionIDs := make([]uint, 0, len(missions))
	for _, m := range missions {
		if m.Status == "active" {
			activeMissionIDs = append(activeMissionIDs, m.ID)
		}
	}

	// Tasks grouped by mission (one query).
	tasksByMission := make(map[uint][]models.MissionTask)
	if len(activeMissionIDs) > 0 {
		var allTasks []models.MissionTask
		database.DB.Where("mission_id IN ?", activeMissionIDs).Order("\"order\" ASC").Find(&allTasks)
		for _, t := range allTasks {
			tasksByMission[t.MissionID] = append(tasksByMission[t.MissionID], t)
		}
	}

	// Player progress per mission (one query). Resolve the internal player id first.
	progressByMission := make(map[uint]*models.PlayerMissionProgress)
	var pstats models.PlayerStats
	if perr := database.DB.Select("id").First(&pstats, "user_id = ?", userID).Error; perr == nil && len(activeMissionIDs) > 0 {
		var progresses []models.PlayerMissionProgress
		database.DB.Where("player_id = ? AND mission_id IN ?", pstats.ID, activeMissionIDs).Find(&progresses)
		for i := range progresses {
			progressByMission[progresses[i].MissionID] = &progresses[i]
		}
	}

	// Cached translations (non-English only): mission + task, keyed by id. The warmer
	// pre-populates these, so this is normally 2 reads instead of 2×N find-or-creates.
	missionTrByID := make(map[uint]models.MissionTranslation)
	taskTrByID := make(map[uint]models.TaskTranslation)
	if !utils.IsEnglish(userLang) && len(activeMissionIDs) > 0 {
		var mtrs []models.MissionTranslation
		database.DB.Where("mission_id IN ? AND lang = ?", activeMissionIDs, userLang).Find(&mtrs)
		for _, tr := range mtrs {
			missionTrByID[tr.MissionID] = tr
		}
		var taskIDs []uint
		for _, ts := range tasksByMission {
			for _, t := range ts {
				taskIDs = append(taskIDs, t.ID)
			}
		}
		if len(taskIDs) > 0 {
			var ttrs []models.TaskTranslation
			database.DB.Where("task_id IN ? AND lang = ?", taskIDs, userLang).Find(&ttrs)
			for _, tr := range ttrs {
				taskTrByID[tr.TaskID] = tr
			}
		}
	}

	// Membership resolved once for this request (see GetMissionsByScene).
	isPremiumUser := h.Sub != nil && h.Sub.IsUserPremium(userID)

	type MissionSummary struct {
		ID                    uint            `json:"id"`
		Title                 string          `json:"title"`
		Description           string          `json:"description"`
		Objective             string          `json:"objective"`
		Status                string          `json:"status"`
		SceneKey              string          `json:"scene_key"`
		Difficulty            string          `json:"difficulty"` // informative label only
		Type                  string          `json:"mission_type"`
		IsPremium             bool            `json:"is_premium"`
		Locked                bool            `json:"locked"`
		PlayerInstruction     string          `json:"player_instruction"`
		CurrentTaskID         uint            `json:"current_task_id"`
		CurrentTaskType       string          `json:"current_task_type"`
		PronunciationMinScore int             `json:"pronunciation_min_score"`
		KaraokeLines          json.RawMessage `json:"karaoke_lines,omitempty"`
		// Agrupación en mundos. WorldID nil = misión suelta: sigue siendo jugable y
		// aparece en su propio grupo del tablero, no desaparece.
		WorldID *uint `json:"world_id"`
		// IsFinal marca el examen del mundo (el mapa que valida lo aprendido).
		IsFinal bool `json:"is_final"`
		// MapImage es el PNG del mapa de esta misión, para la tarjeta del tablero.
		MapImage string `json:"map_image"`
	}

	type NPCMissionHub struct {
		NPCName          string           `json:"npc_name"`
		NPCType          string           `json:"npc_type"`
		Greeting         string           `json:"greeting"`
		IsMerchant       bool             `json:"is_merchant"`
		Shop             *models.Shop     `json:"shop"`
		Missions         []MissionSummary `json:"missions"`
		NPCTaskCompleted bool             `json:"npc_task_completed"`
		// Worlds es el primer nivel del tablero del maestro de misiones: el jugador
		// elige mundo y luego misión. Va vacío para NPCs que no son maestros.
		Worlds []WorldSummary `json:"worlds"`
	}

	// PNG de cada mapa involucrado, en una sola query (la tarjeta de misión lo usa).
	mapImages := map[string]string{}
	{
		sceneKeys := make([]string, 0, len(missions))
		seen := map[string]bool{}
		for _, m := range missions {
			if m.SceneKey != "" && !seen[m.SceneKey] {
				seen[m.SceneKey] = true
				sceneKeys = append(sceneKeys, m.SceneKey)
			}
		}
		if len(sceneKeys) > 0 {
			var cfgs []models.MapConfig
			database.DB.Select("scene_key", "preview_image").
				Where("scene_key IN ? AND preview_image <> ''", sceneKeys).Find(&cfgs)
			for _, cfg := range cfgs {
				mapImages[cfg.SceneKey] = cfg.PreviewImage
			}
		}
	}

	missionSummaries := make([]MissionSummary, 0)
	for _, m := range missions {
		// Only show active missions
		if m.Status != "active" {
			continue
		}

		progress := progressByMission[m.ID]
		tasks := tasksByMission[m.ID]

		var completedMap map[string]bool
		if progress != nil && progress.TasksCompleted != nil {
			json.Unmarshal(progress.TasksCompleted, &completedMap)
		}
		if completedMap == nil {
			completedMap = make(map[string]bool)
		}

		currentInstruction := m.DescriptionEn
		// currentTask mirrors the task whose instruction we surface, so the client can
		// branch on its type (e.g. open the karaoke flow) and read its config.
		var currentTask *models.MissionTask

		// If NPC is not a master, prioritize finding a task or role SPECIFIC to this NPC
		if tmpl.NPCDefinition.Type != models.NPCTypeMaster {
			// 1. Try to find a specific role for this NPC/Mission
			role, _ := h.Service.Repo.GetMissionRole(tmpl.ID, m.ID)
			if role != nil && role.TaskDescription != "" {
				currentInstruction = role.TaskDescription
			}

			// 2. Try to find the most relevant task for this NPC (incomplete prioritized, then any)
			var npcTasks []models.MissionTask
			for i := range tasks {
				if tasks[i].TargetNPCTemplateID != nil && *tasks[i].TargetNPCTemplateID == tmpl.ID {
					npcTasks = append(npcTasks, tasks[i])
				}
			}

			if len(npcTasks) > 0 {
				// Use first incomplete task for this NPC, otherwise use the last task they had
				foundIncomplete := false
				for i := range npcTasks {
					if !completedMap[fmt.Sprint(npcTasks[i].ID)] {
						currentInstruction = npcTasks[i].DescriptionEn
						currentTask = &npcTasks[i]
						foundIncomplete = true
						break
					}
				}
				if !foundIncomplete {
					// This NPC's own tasks are all complete. Surfacing the completed task as
					// the "current task" contradicts the map tracker (which shows it struck
					// through). Fall back to the mission's next globally-incomplete task so the
					// dialogue stays consistent with progress; only if everything is done keep
					// this NPC's last task.
					fellBack := false
					for i := range tasks {
						if !completedMap[fmt.Sprint(tasks[i].ID)] {
							currentInstruction = tasks[i].DescriptionEn
							currentTask = &tasks[i]
							fellBack = true
							break
						}
					}
					if !fellBack {
						currentInstruction = npcTasks[len(npcTasks)-1].DescriptionEn
						currentTask = &npcTasks[len(npcTasks)-1]
					}
				}
			}
		} else {
			// If NPC is a Quest Master, show the first GLOBAL incomplete task
			for i := range tasks {
				if !completedMap[fmt.Sprint(tasks[i].ID)] {
					currentInstruction = tasks[i].DescriptionEn
					currentTask = &tasks[i]
					break
				}
			}
		}

		// Surface the current task's type/config so the client can route to the right
		// interaction (karaoke lines are only attached for karaoke tasks).
		var currentTaskID uint
		var currentTaskType string
		var currentMinScore int
		var karaokeLines json.RawMessage
		if currentTask != nil {
			currentTaskID = currentTask.ID
			currentTaskType = string(currentTask.Type)
			currentMinScore = currentTask.PronunciationMinScore
			if currentTask.Type == models.TaskTypeKaraoke {
				karaokeLines = currentTask.KaraokeLines
			}
		}

		// progress may be nil if GetProgress failed (e.g. missing PlayerStats);
		// fall back to "not_started" instead of dereferencing nil.
		summaryStatus := "not_started"
		if progress != nil {
			summaryStatus = string(progress.Status)
		}

		// Localize mission text + the surfaced instruction (cached per language).
		title, descr, objective := m.Title, m.DescriptionEn, m.ObjectiveEn
		instruction := currentInstruction
		if !utils.IsEnglish(userLang) {
			// Use the preloaded translation; fall back to generate-on-miss (rare once
			// the warmer has run) so correctness never depends on the cache being warm.
			var mt *models.MissionTranslation
			if cached, ok := missionTrByID[m.ID]; ok {
				c := cached
				mt = &c
			} else {
				mcopy := m
				mt = h.Translation.GetMissionTranslation(&mcopy, userLang)
			}
			title, descr, objective = mt.Title, mt.Description, mt.Objective

			// The instruction is usually a task description; translate it via its task.
			// If it came from a role/mission fallback, use the translated description.
			instruction = mt.Description
			for _, t := range tasks {
				if currentInstruction == t.DescriptionEn {
					if ctr, ok := taskTrByID[t.ID]; ok {
						instruction = ctr.Description
					} else {
						tcopy := t
						instruction = h.Translation.GetTaskTranslation(&tcopy, userLang).Description
					}
					break
				}
			}
		}

		missionSummaries = append(missionSummaries, MissionSummary{
			ID:                    m.ID,
			Title:                 title,
			Description:           descr,
			Objective:             objective,
			Status:                summaryStatus,
			SceneKey:              m.SceneKey,
			Difficulty:            string(m.Difficulty),
			Type:                  string(m.Type),
			IsPremium:             m.IsPremium,
			Locked:                m.IsPremium && !isPremiumUser,
			PlayerInstruction:     instruction,
			CurrentTaskID:         currentTaskID,
			CurrentTaskType:       currentTaskType,
			PronunciationMinScore: currentMinScore,
			KaraokeLines:          karaokeLines,
			WorldID:               m.WorldID,
			IsFinal:               m.IsFinal,
			MapImage:              mapImages[m.SceneKey],
		})
	}

	hasNPCMissions := false
	isMissionCompletedForPlayer := false
	hasNPCActiveTasks := false
	allNPCActiveTasksCompleted := true

	for _, m := range missions {
		if m.Status != "active" {
			continue
		}
		hasNPCMissions = true

		progress := progressByMission[m.ID]
		if progress != nil && progress.Status == models.StatusCompleted {
			isMissionCompletedForPlayer = true
			continue
		}

		tasks := tasksByMission[m.ID]
		var completedMap map[string]bool
		if progress != nil && progress.TasksCompleted != nil {
			json.Unmarshal(progress.TasksCompleted, &completedMap)
		}

		for _, t := range tasks {
			if t.TargetNPCTemplateID != nil && *t.TargetNPCTemplateID == tmpl.ID {
				hasNPCActiveTasks = true
				if completedMap == nil || !completedMap[fmt.Sprint(t.ID)] {
					allNPCActiveTasksCompleted = false
				}
			}
		}
	}

	isTaskCompletedForPlayer := false
	if hasNPCMissions {
		if isMissionCompletedForPlayer {
			isTaskCompletedForPlayer = true
		} else if hasNPCActiveTasks && allNPCActiveTasksCompleted {
			isTaskCompletedForPlayer = true
		}
	}

	greeting := tmpl.NPCDefinition.Greeting
	if tmpl.Greeting != "" {
		greeting = tmpl.Greeting
	}

	// Per-player gating: show the NPC's success message only if THIS player has
	// completed the task. We ignore any shared room-instance flag so players sharing
	// the room during an individual mission don't see each other's completion.
	if isTaskCompletedForPlayer {
		if tmpl.SuccessMessage != "" {
			greeting = tmpl.SuccessMessage
		}
	}

	var shopPtr *models.Shop
	if tmpl.NPCDefinition.ShopID != nil {
		shopPtr = &tmpl.NPCDefinition.Shop
	}

	// El maestro de misiones muestra primero el catálogo de mundos y luego las
	// misiones de cada uno. Para el resto de NPCs va vacío y el cliente sigue
	// pintando su lista de siempre.
	var worldCards []WorldSummary
	if tmpl.NPCDefinition.Type == models.NPCTypeMaster && h.Worlds != nil {
		worldCards = BuildWorldCatalog(h.Worlds, h.Translation, userID, userLang)
	}

	return c.JSON(NPCMissionHub{
		NPCName:          tmpl.NPCDefinition.Name,
		NPCType:          string(tmpl.NPCDefinition.Type),
		Greeting:         greeting,
		IsMerchant:       tmpl.NPCDefinition.ShopID != nil,
		Shop:             shopPtr,
		Missions:         missionSummaries,
		NPCTaskCompleted: isTaskCompletedForPlayer,
		Worlds:           worldCards,
	})
}

func (h *MissionHandler) ValidateMissionCompletion(c *fiber.Ctx) error {
	missionIDStr := c.Params("id")
	mID, err := strconv.ParseUint(missionIDStr, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Mission ID"})
	}
	missionID := uint(mID)

	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, _ := uuid.Parse(userIDStr)

	completed, mission, err := h.Service.IsMissionFullyCompleted(userID, missionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"completed": completed,
		"mission":   mission,
	})
}

// AcceptMission explicitly starts a mission for the player, optionally scoped to
// the room instance (room_id query param). Progress is no longer auto-created on
// view, so the client must call this to begin tracking a mission.
func (h *MissionHandler) AcceptMission(c *fiber.Ctx) error {
	missionIDStr := c.Params("id")
	mID, err := strconv.ParseUint(missionIDStr, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Mission ID"})
	}

	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, _ := uuid.Parse(userIDStr)

	// Premium gate: a premium mission can only be accepted by an active member.
	// This is the authoritative check; the `locked` flag in the listings is only a
	// UI hint. 402 Payment Required signals the client to show the upsell.
	var mission models.Mission
	if err := database.DB.Select("id", "is_premium").First(&mission, "id = ?", uint(mID)).Error; err == nil {
		if mission.IsPremium && (h.Sub == nil || !h.Sub.IsUserPremium(userID)) {
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{"error": "premium_required"})
		}
	}

	var roomID *uuid.UUID
	if rstr := c.Query("room_id"); rstr != "" {
		if rid, perr := uuid.Parse(rstr); perr == nil {
			roomID = &rid
		}
	}

	progress, advanceGold, err := h.Service.AcceptMission(userID, uint(mID), roomID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	resp := fiber.Map{"status": "accepted", "progress": progress, "advance_gold": advanceGold}
	// When an advance was just paid, return the player's refreshed stats so the
	// client can update the gold HUD without a separate fetch.
	if advanceGold > 0 && progress != nil {
		var stats models.PlayerStats
		if err := database.DB.First(&stats, "id = ?", progress.PlayerID).Error; err == nil {
			resp["player_stats"] = stats
		}
	}

	return c.JSON(resp)
}

// KaraokeCompleteRequest is the body for POST /missions/karaoke/complete. The
// client performs the per-line pronunciation scoring (via the voice backend) and
// submits the resulting average so the server can deterministically decide
// completion against the task's minimum.
type KaraokeCompleteRequest struct {
	MissionID  uint       `json:"mission_id"`
	TaskID     uint       `json:"task_id"`
	RoomID     *uuid.UUID `json:"room_id"`
	AvgScore   float32    `json:"avg_score"`
	LineScores []float32  `json:"line_scores"`
}

// CompleteKaraoke deterministically completes a karaoke task when the player's
// average score meets the task threshold. Mirrors DialogueHandler's WS broadcast
// so other players in the room see the mission-completed overlay.
func (h *MissionHandler) CompleteKaraoke(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	var req KaraokeCompleteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	completed, newlyDone, mission, err := h.Service.CompleteKaraoke(userID, req.MissionID, req.TaskID, req.AvgScore)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	if newlyDone && h.Hub != nil && req.RoomID != nil {
		payload := models.MissionCompletedBroadcast{
			MissionID: req.MissionID,
			RoomID:    req.RoomID.String(),
		}
		if mission != nil {
			payload.Title = mission.Title
			payload.DescriptionEn = mission.DescriptionEn
			payload.RewardGold = mission.RewardGold
		}
		h.Hub.BroadcastToRoom(req.RoomID.String(), &models.WSMessage{
			Type:    websocket.MsgMissionCompleted,
			Payload: payload,
		})
	}

	return c.JSON(fiber.Map{
		"task_completed":          completed,
		"mission_newly_completed": newlyDone,
		"mission_details":         mission,
	})
}
