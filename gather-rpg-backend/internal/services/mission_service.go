package services

import (
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"time"

	"github.com/google/uuid"
)

type MissionService struct {
	Repo    *repository.MissionRepository
	InvRepo *repository.InventoryRepository
}

func NewMissionService(repo *repository.MissionRepository, invRepo *repository.InventoryRepository) *MissionService {
	return &MissionService{Repo: repo, InvRepo: invRepo}
}

func (s *MissionService) GetMissionsForScene(sceneKey string) ([]models.Mission, error) {
	return s.Repo.GetMissionsByScene(sceneKey)
}

func (s *MissionService) GetNPCMissions(tmplID uint) ([]models.Mission, error) {
	return s.Repo.GetMissionsByTemplate(tmplID)
}

func (s *MissionService) GetAllMissions() ([]models.Mission, error) {
	return s.Repo.GetAllMissions()
}

func (s *MissionService) CreateMission(mission *models.Mission) error {
	return s.Repo.CreateMission(mission)
}

func (s *MissionService) UpdateMission(mission *models.Mission) error {
	return s.Repo.UpdateMission(mission)
}

func (s *MissionService) DeleteMission(id uint) error {
	return s.Repo.DeleteMission(id)
}

func (s *MissionService) GetTasks(missionID uint) ([]models.MissionTask, error) {
	return s.Repo.GetTasksByMission(missionID)
}

func (s *MissionService) CreateTask(task *models.MissionTask) error {
	return s.Repo.CreateTask(task)
}

func (s *MissionService) UpdateTask(task *models.MissionTask) error {
	return s.Repo.UpdateTask(task)
}

func (s *MissionService) DeleteTask(id uint) error {
	return s.Repo.DeleteTask(id)
}

func (s *MissionService) GetRoles(missionID uint) ([]models.NPCMissionRole, error) {
	return s.Repo.GetRolesByMission(missionID)
}

func (s *MissionService) GetProgress(userID uuid.UUID, missionID uint) (*models.PlayerMissionProgress, error) {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return nil, fmt.Errorf("Player stats not found: %w", err)
	}
	playerID := stats.ID

	progress, err := s.Repo.GetPlayerProgress(playerID, missionID)
	if err != nil {
		// If not found, create a new one
		newProgress := &models.PlayerMissionProgress{
			PlayerID:       playerID,
			MissionID:      missionID,
			Status:         models.StatusNotStarted,
			TasksCompleted: []byte("{}"),
			StartedAt:      time.Now(),
		}
		if err := s.Repo.CreateOrUpdateProgress(newProgress); err != nil {
			return nil, err
		}
		return newProgress, nil
	}
	return progress, nil
}

// CheckTaskCondition evaluates if the player meets the requirements for a specific task.
func (s *MissionService) CheckTaskCondition(userID uuid.UUID, task *models.MissionTask, roomID uuid.UUID) (bool, string, error) {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return false, "Player stats not found", nil
	}
	playerID := stats.ID

	switch task.Type {
	case models.TaskTypeBringItem, models.TaskTypeFindItem, models.TaskTypeCollectItems:
		return s.checkBringItem(playerID, task.RequiredItem)
	case models.TaskTypeDefeatEnemy, models.TaskTypeKillBoss, models.TaskTypeKillAll:
		return s.checkDefeatEnemy(playerID, task.RequiredEnemy)
	case models.TaskTypeTalkToNPC:
		return s.checkTalkToNPC(playerID, task.TargetNPCTemplateID, task.MissionID)
	case models.TaskTypeDeliverMsg, models.TaskTypePronunciation:
		// AI-validated tasks are always 'true' on the backend side, 
		// they depend on the AI response flag to actually trigger UpdateTaskProgress.
		return true, "", nil
	}
	return false, "Unknown task type", nil
}

func (s *MissionService) checkBringItem(playerID uuid.UUID, itemName string) (bool, string, error) {
	if itemName == "" {
		return true, "", nil
	}

	var count int64
	// Search in inventories, joining with items table to match by name
	err := database.DB.Table("inventories").
		Joins("JOIN items ON items.id = inventories.item_id").
		Where("inventories.player_id = ? AND items.name ILIKE ?", playerID, itemName).
		Count(&count).Error

	if err != nil {
		return false, "", err
	}

	if count > 0 {
		return true, "I see you have the item!", nil
	}
	return false, "You don't have the required item yet.", nil
}

func (s *MissionService) checkDefeatEnemy(playerID uuid.UUID, enemyName string) (bool, string, error) {
	// Placeholder: In a real RPG, we'd have a 'killed_enemies' table or mission state.
	// For now, let's assume it's true if the player has any record in a mock table (future proofing).
	return false, "The enemies are still lurking around.", nil
}

func (s *MissionService) checkTalkToNPC(playerID uuid.UUID, targetTmplID *uint, missionID uint) (bool, string, error) {
	if targetTmplID == nil {
		return true, "", nil
	}

	var count int64
	// Check if there's any conversation with the target NPC for this mission
	err := database.DB.Table("conversations").
		Joins("JOIN npc_room_instances ON npc_room_instances.id = conversations.npc_instance_id").
		Where("conversations.player_id = ? AND npc_room_instances.npc_template_id = ? AND conversations.mission_id = ?", playerID, *targetTmplID, missionID).
		Count(&count).Error

	if err != nil {
		return false, "", err
	}

	if count > 0 {
		return true, "Ah, I see you've already spoken with them.", nil
	}
	return false, "You should go talk to our friend first.", nil
}

// UpdateTaskProgress marks a specific task as completed in the player's progress.
// Returns (isNewlyCompleted, error)
func (s *MissionService) UpdateTaskProgress(userID uuid.UUID, missionID uint, taskID uint, isCompleted bool) (bool, error) {
	progress, err := s.GetProgress(userID, missionID)
	if err != nil {
		return false, err
	}
	wasCompleted := progress.Status == models.StatusCompleted
	playerID := progress.PlayerID

	var tasks map[string]bool
	if err := json.Unmarshal(progress.TasksCompleted, &tasks); err != nil {
		tasks = make(map[string]bool)
	}

	tasks[fmt.Sprint(taskID)] = isCompleted
	
	// Item Consumption: If the task requires an item and is being completed, consume it
	if isCompleted {
		var task models.MissionTask
		if err := database.DB.First(&task, taskID).Error; err == nil {
			if (task.Type == models.TaskTypeBringItem || task.Type == models.TaskTypeFindItem || task.Type == models.TaskTypeCollectItems) && task.RequiredItem != "" {
				item, err := s.InvRepo.GetItemByName(task.RequiredItem)
				if err == nil {
					// Consume 1 unit (default for now)
					s.InvRepo.RemoveItemFromInventory(playerID, item.ID, 1)
					fmt.Printf("[MissionService] Consumed item '%s' for task %d completion\n", task.RequiredItem, taskID)
				}
			}
		}
	}

	updatedJSON, _ := json.Marshal(tasks)
	progress.TasksCompleted = updatedJSON
	progress.Status = models.StatusInProgress

	// Check if all tasks are completed
	allTasks, _ := s.GetTasks(missionID)
	allDone := true
	for _, t := range allTasks {
		if !tasks[fmt.Sprint(t.ID)] {
			allDone = false
			break
		}
	}

	if allDone {
		progress.Status = models.StatusCompleted
		now := time.Now()
		progress.CompletedAt = &now

		// Deliver Rewards
		var mission models.Mission
		if err := database.DB.First(&mission, missionID).Error; err == nil {
			// 1. Add Gold
			var stats models.PlayerStats
			if err := database.DB.First(&stats, "id = ?", playerID).Error; err == nil {
				stats.Gold += mission.RewardGold
				stats.Experience += mission.RewardXP
				database.DB.Save(&stats)
				fmt.Printf("[MissionService] Delivered %d Gold and %d XP to player %s for mission %d\n", mission.RewardGold, mission.RewardXP, playerID, missionID)
			}

			// 2. Add Item
			if mission.RewardItemID != nil && mission.RewardQuantity > 0 {
				inv := &models.Inventory{
					PlayerID: playerID,
					ItemID:   *mission.RewardItemID,
					Quantity: mission.RewardQuantity,
				}
				var existing models.Inventory
				err := database.DB.Where("player_id = ? AND item_id = ?", inv.PlayerID, inv.ItemID).First(&existing).Error
				if err == nil {
					existing.Quantity += inv.Quantity
					database.DB.Save(&existing)
				} else {
					database.DB.Create(inv)
				}
				fmt.Printf("[MissionService] Delivered %d of item %s to player %s for mission %d\n", mission.RewardQuantity, mission.RewardItemID, playerID, missionID)
			}
		}
	}

	isNewlyCompleted := !wasCompleted && allDone
	return isNewlyCompleted, s.Repo.CreateOrUpdateProgress(progress)
}

func (s *MissionService) IsMissionFullyCompleted(userID uuid.UUID, missionID uint) (bool, *models.Mission, error) {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return false, nil, fmt.Errorf("Player stats not found: %w", err)
	}
	playerID := stats.ID

	progress, err := s.Repo.GetPlayerProgress(playerID, missionID)
	if err != nil {
		return false, nil, err
	}

	if progress.Status != models.StatusCompleted {
		return false, nil, nil
	}

	mission, err := s.Repo.GetMissionByID(missionID)
	if err != nil {
		return true, nil, err
	}

	return true, mission, nil
}
func (s *MissionService) UpdateKillProgress(userID uuid.UUID, enemyTemplateID uuid.UUID, roomID string) error {
	// 1. Get all active missions for this user
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return err
	}
	playerID := stats.ID

	var progresses []models.PlayerMissionProgress
	database.DB.Where("player_id = ? AND status = ?", playerID, models.StatusInProgress).Find(&progresses)

	for _, p := range progresses {
		tasks, _ := s.GetTasks(p.MissionID)
		changed := false

		var tasksCompleted map[string]bool
		if err := json.Unmarshal(p.TasksCompleted, &tasksCompleted); err != nil {
			tasksCompleted = make(map[string]bool)
		}

		for _, t := range tasks {
			if tasksCompleted[fmt.Sprint(t.ID)] {
				continue
			}

			if t.Type == models.TaskTypeKillAll {
				// We need to check if the room is cleared. 
				// This information is in the Room object in the Hub.
				// Since MissionService doesn't have the Hub, we might need to pass a flag or the Hub itself.
				// For now, let's assume if this is called, we check if room is "clean" via a specialized query or logic.
				// Simplified: KillAll is fulfilled if this was the last enemy.
			} else if t.Type == models.TaskTypeDefeatEnemy || t.Type == models.TaskTypeKillBoss {
				// Check if enemyTemplateID matches RequiredEnemy (if it's a name, we might need to fetch the name)
				var enemy models.Enemy
				if err := database.DB.First(&enemy, "id = ?", enemyTemplateID).Error; err == nil {
					if enemy.Name == t.RequiredEnemy || t.RequiredEnemy == "" {
						tasksCompleted[fmt.Sprint(t.ID)] = true
						changed = true
					}
				}
			}
		}

		if changed {
			updatedJSON, _ := json.Marshal(tasksCompleted)
			p.TasksCompleted = updatedJSON
			s.UpdateTaskProgress(userID, p.MissionID, 0, false) // Trigger the "all tasks done" check inside
		}
	}

	return nil
}

func (s *MissionService) UpdateKillAllProgress(userID uuid.UUID, roomID string) error {
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return err
	}
	playerID := stats.ID

	var progresses []models.PlayerMissionProgress
	database.DB.Where("player_id = ? AND status = ?", playerID, models.StatusInProgress).Find(&progresses)

	for _, p := range progresses {
		tasks, _ := s.GetTasks(p.MissionID)
		changed := false

		var tasksCompleted map[string]bool
		if err := json.Unmarshal(p.TasksCompleted, &tasksCompleted); err != nil {
			tasksCompleted = make(map[string]bool)
		}

		for _, t := range tasks {
			if tasksCompleted[fmt.Sprint(t.ID)] {
				continue
			}

			if t.Type == models.TaskTypeKillAll {
				tasksCompleted[fmt.Sprint(t.ID)] = true
				changed = true
			}
		}

		if changed {
			updatedJSON, _ := json.Marshal(tasksCompleted)
			p.TasksCompleted = updatedJSON
			s.UpdateTaskProgress(userID, p.MissionID, 0, false)
		}
	}
	return nil
}
