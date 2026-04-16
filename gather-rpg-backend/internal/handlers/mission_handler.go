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
		ID          uint   `json:"id"`
		Description string `json:"description"`
		IsCompleted bool   `json:"is_completed"`
	}

	type MissionWithStatus struct {
		ID             uint             `json:"id"`
		Title          string           `json:"title"`
		DescriptionEn  string           `json:"description_en"`
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

		taskStatuses := make([]TaskWithStatus, 0)
		for _, t := range tasks {
			taskStatuses = append(taskStatuses, TaskWithStatus{
				ID:          t.ID,
				Description: t.DescriptionEn,
				IsCompleted: completedMap[fmt.Sprint(t.ID)],
			})
		}

		result = append(result, MissionWithStatus{
			ID:            m.ID,
			Title:         m.Title,
			DescriptionEn: m.DescriptionEn,
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

	missions, err := h.Service.GetNPCMissions(tmplID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Get player ID from context
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.JSON(missions)
	}
	userID, _ := uuid.Parse(userIDStr)

	type MissionSummary struct {
		ID          uint   `json:"id"`
		Title       string `json:"title"`
		Description string `json:"description"`
		Status      string `json:"status"`
	}

	type NPCMissionHub struct {
		NPCName    string           `json:"npc_name"`
		IsMerchant bool             `json:"is_merchant"`
		Shop       *models.Shop     `json:"shop"`
		Missions   []MissionSummary `json:"missions"`
	}

	// Fetch NPC info to check for Shop
	var tmpl models.NPCTemplate
	if err := database.DB.Preload("NPCDefinition.Shop.Items").First(&tmpl, tmplID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "NPC Template not found"})
	}

	missionSummaries := make([]MissionSummary, 0)
	for _, m := range missions {
		progress, _ := h.Service.GetProgress(userID, m.ID)
		missionSummaries = append(missionSummaries, MissionSummary{
			ID:          m.ID,
			Title:       m.Title,
			Description: m.DescriptionEn,
			Status:      string(progress.Status),
		})
	}

	var shopPtr *models.Shop
	if tmpl.NPCDefinition.ShopID != nil {
		shopPtr = &tmpl.NPCDefinition.Shop
	}

	return c.JSON(NPCMissionHub{
		NPCName:    tmpl.NPCDefinition.Name,
		IsMerchant: tmpl.NPCDefinition.ShopID != nil,
		Shop:       shopPtr,
		Missions:   missionSummaries,
	})
}
