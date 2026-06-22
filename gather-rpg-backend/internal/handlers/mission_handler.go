package handlers

import (
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"gather-rpg-backend/internal/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"strconv"
	"time"
)

type MissionHandler struct {
	Service     *services.MissionService
	Translation *services.TranslationService
}

func NewMissionHandler(service *services.MissionService, translation *services.TranslationService) *MissionHandler {
	return &MissionHandler{Service: service, Translation: translation}
}

func levelToInt(l models.DifficultyLevel) int {
	switch l {
	case models.DifficultyBeginner:
		return 1
	case models.DifficultyIntermediate:
		return 2
	case models.DifficultyAdvanced:
		return 3
	default:
		return 1
	}
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

	// Fetch player's english level
	var profile models.UserLearningProfile
	playerLevel := models.DifficultyBeginner
	if err := database.DB.Where("user_id = ?", userID).First(&profile).Error; err == nil {
		playerLevel = profile.EnglishLevel
	}

	// Filter missions by player level
	filteredMissions := make([]models.Mission, 0)
	for _, m := range missions {
		if levelToInt(m.Difficulty) <= levelToInt(playerLevel) {
			filteredMissions = append(filteredMissions, m)
		}
	}
	missions = filteredMissions

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
		Tasks         []TaskWithStatus `json:"tasks"`
		OverallStatus string           `json:"status"`
	}

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

	// Fetch player's english level
	var profile models.UserLearningProfile
	playerLevel := models.DifficultyBeginner
	if err := database.DB.Where("user_id = ?", userID).First(&profile).Error; err == nil {
		playerLevel = profile.EnglishLevel
	}

	// Filter missions by player level
	filteredMissions := make([]models.Mission, 0)
	for _, m := range missions {
		if levelToInt(m.Difficulty) <= levelToInt(playerLevel) {
			filteredMissions = append(filteredMissions, m)
		}
	}
	missions = filteredMissions

	type MissionSummary struct {
		ID                uint   `json:"id"`
		Title             string `json:"title"`
		Description       string `json:"description"`
		Objective         string `json:"objective"`
		Status            string `json:"status"`
		SceneKey          string `json:"scene_key"`
		PlayerInstruction string `json:"player_instruction"`
	}

	type NPCMissionHub struct {
		NPCName          string           `json:"npc_name"`
		NPCType          string           `json:"npc_type"`
		Greeting         string           `json:"greeting"`
		IsMerchant       bool             `json:"is_merchant"`
		Shop             *models.Shop     `json:"shop"`
		Missions         []MissionSummary `json:"missions"`
		NPCTaskCompleted bool             `json:"npc_task_completed"`
	}

	missionSummaries := make([]MissionSummary, 0)
	for _, m := range missions {
		// Only show active missions
		if m.Status != "active" {
			continue
		}

		progress, _ := h.Service.GetProgressReadOnly(userID, m.ID, nil)
		tasks, _ := h.Service.GetTasks(m.ID)

		var completedMap map[string]bool
		if progress != nil && progress.TasksCompleted != nil {
			json.Unmarshal(progress.TasksCompleted, &completedMap)
		}
		if completedMap == nil {
			completedMap = make(map[string]bool)
		}

		currentInstruction := m.DescriptionEn

		// If NPC is not a master, prioritize finding a task or role SPECIFIC to this NPC
		if tmpl.NPCDefinition.Type != models.NPCTypeMaster {
			// 1. Try to find a specific role for this NPC/Mission
			role, _ := h.Service.Repo.GetMissionRole(tmpl.ID, m.ID)
			if role != nil && role.TaskDescription != "" {
				currentInstruction = role.TaskDescription
			}

			// 2. Try to find the most relevant task for this NPC (incomplete prioritized, then any)
			var npcTasks []models.MissionTask
			for _, t := range tasks {
				if t.TargetNPCTemplateID != nil && *t.TargetNPCTemplateID == tmpl.ID {
					npcTasks = append(npcTasks, t)
				}
			}

			if len(npcTasks) > 0 {
				// Use first incomplete task for this NPC, otherwise use the last task they had
				foundIncomplete := false
				for _, nt := range npcTasks {
					if !completedMap[fmt.Sprint(nt.ID)] {
						currentInstruction = nt.DescriptionEn
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
					for _, t := range tasks {
						if !completedMap[fmt.Sprint(t.ID)] {
							currentInstruction = t.DescriptionEn
							fellBack = true
							break
						}
					}
					if !fellBack {
						currentInstruction = npcTasks[len(npcTasks)-1].DescriptionEn
					}
				}
			}
		} else {
			// If NPC is a Quest Master, show the first GLOBAL incomplete task
			for _, t := range tasks {
				if !completedMap[fmt.Sprint(t.ID)] {
					currentInstruction = t.DescriptionEn
					break
				}
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
			mcopy := m
			mt := h.Translation.GetMissionTranslation(&mcopy, userLang)
			title, descr, objective = mt.Title, mt.Description, mt.Objective

			// The instruction is usually a task description; translate it via its task.
			// If it came from a role/mission fallback, use the translated description.
			instruction = mt.Description
			for _, t := range tasks {
				if currentInstruction == t.DescriptionEn {
					tcopy := t
					instruction = h.Translation.GetTaskTranslation(&tcopy, userLang).Description
					break
				}
			}
		}

		missionSummaries = append(missionSummaries, MissionSummary{
			ID:                m.ID,
			Title:             title,
			Description:       descr,
			Objective:         objective,
			Status:            summaryStatus,
			SceneKey:          m.SceneKey,
			PlayerInstruction: instruction,
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

		progress, _ := h.Service.GetProgressReadOnly(userID, m.ID, nil)
		if progress != nil && progress.Status == models.StatusCompleted {
			isMissionCompletedForPlayer = true
			continue
		}

		tasks, _ := h.Service.GetTasks(m.ID)
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

	return c.JSON(NPCMissionHub{
		NPCName:          tmpl.NPCDefinition.Name,
		NPCType:          string(tmpl.NPCDefinition.Type),
		Greeting:         greeting,
		IsMerchant:       tmpl.NPCDefinition.ShopID != nil,
		Shop:             shopPtr,
		Missions:         missionSummaries,
		NPCTaskCompleted: isTaskCompletedForPlayer,
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

	var roomID *uuid.UUID
	if rstr := c.Query("room_id"); rstr != "" {
		if rid, perr := uuid.Parse(rstr); perr == nil {
			roomID = &rid
		}
	}

	progress, err := h.Service.AcceptMission(userID, uint(mID), roomID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "accepted", "progress": progress})
}
