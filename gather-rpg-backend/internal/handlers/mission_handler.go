package handlers

import (
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"
	"strconv"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type MissionHandler struct {
	Service *services.MissionService
}

func NewMissionHandler(service *services.MissionService) *MissionHandler {
	return &MissionHandler{Service: service}
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

	type TaskWithStatus struct {
		ID            uint   `json:"id"`
		Description   string `json:"description"`
		IsCompleted   bool   `json:"is_completed"`
		KillsDone     int    `json:"kills_done"`
		RequiredKills int    `json:"required_kills"`
	}

	type MissionWithStatus struct {
		ID             uint             `json:"id"`
		Title          string           `json:"title"`
		DescriptionEn  string           `json:"description_en"`
		ObjectiveEn    string           `json:"objective_en"`
		Tasks          []TaskWithStatus `json:"tasks"`
		OverallStatus  string           `json:"status"`
	}

	result := make([]MissionWithStatus, 0)
	for _, m := range missions {
		tasks, _ := h.Service.GetTasks(m.ID)
		progress, _ := h.Service.GetProgress(userID, m.ID)
		
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

			taskStatuses = append(taskStatuses, TaskWithStatus{
				ID:            t.ID,
				Description:   t.DescriptionEn,
				IsCompleted:   completedMap[fmt.Sprint(t.ID)],
				KillsDone:     killsDone,
				RequiredKills: reqKills,
			})
		}

		result = append(result, MissionWithStatus{
			ID:            m.ID,
			Title:         m.Title,
			DescriptionEn: m.DescriptionEn,
			ObjectiveEn:   m.ObjectiveEn,
			OverallStatus: string(progress.Status),
			Tasks:         taskStatuses,
		})
	}

	return c.JSON(result)
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
		NPCName    string           `json:"npc_name"`
		NPCType    string           `json:"npc_type"`
		Greeting   string           `json:"greeting"`
		IsMerchant bool             `json:"is_merchant"`
		Shop       *models.Shop     `json:"shop"`
		Missions   []MissionSummary `json:"missions"`
	}

	missionSummaries := make([]MissionSummary, 0)
	for _, m := range missions {
		// Only show active missions
		if m.Status != "active" {
			continue
		}
		
		progress, _ := h.Service.GetProgress(userID, m.ID)
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
					currentInstruction = npcTasks[len(npcTasks)-1].DescriptionEn
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

		missionSummaries = append(missionSummaries, MissionSummary{
			ID:                m.ID,
			Title:             m.Title,
			Description:       m.DescriptionEn,
			Objective:         m.ObjectiveEn,
			Status:            string(progress.Status),
			SceneKey:          m.SceneKey,
			PlayerInstruction: currentInstruction,
		})
	}

	var shopPtr *models.Shop
	if tmpl.NPCDefinition.ShopID != nil {
		shopPtr = &tmpl.NPCDefinition.Shop
	}

	greeting := tmpl.NPCDefinition.Greeting
	if tmpl.Greeting != "" {
		greeting = tmpl.Greeting
	}

	return c.JSON(NPCMissionHub{
		NPCName:    tmpl.NPCDefinition.Name,
		NPCType:    string(tmpl.NPCDefinition.Type),
		Greeting:   greeting,
		IsMerchant: tmpl.NPCDefinition.ShopID != nil,
		Shop:       shopPtr,
		Missions:   missionSummaries,
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
