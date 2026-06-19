package repository

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MissionRepository struct{}

func NewMissionRepository() *MissionRepository {
	return &MissionRepository{}
}

// -- Missions --

func (r *MissionRepository) CreateMission(mission *models.Mission) error {
	return database.DB.Create(mission).Error
}

func (r *MissionRepository) GetMissionByID(id uint) (*models.Mission, error) {
	var mission models.Mission
	if err := database.DB.First(&mission, id).Error; err != nil {
		return nil, err
	}
	return &mission, nil
}

func (r *MissionRepository) GetMissionsByScene(sceneKey string) ([]models.Mission, error) {
	var missions []models.Mission
	if err := database.DB.Where("scene_key = ?", sceneKey).Find(&missions).Error; err != nil {
		return nil, err
	}
	return missions, nil
}

func (r *MissionRepository) GetAllMissions() ([]models.Mission, error) {
	var missions []models.Mission
	if err := database.DB.Find(&missions).Error; err != nil {
		return nil, err
	}
	return missions, nil
}

func (r *MissionRepository) UpdateMission(mission *models.Mission) error {
	return database.DB.Save(mission).Error
}

func (r *MissionRepository) DeleteMission(id uint) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		// Delete roles
		if err := tx.Where("mission_id = ?", id).Delete(&models.NPCMissionRole{}).Error; err != nil {
			return err
		}
		// Delete tasks
		if err := tx.Where("mission_id = ?", id).Delete(&models.MissionTask{}).Error; err != nil {
			return err
		}
		// Delete mission
		return tx.Delete(&models.Mission{}, id).Error
	})
}

// -- Tasks --

func (r *MissionRepository) CreateTask(task *models.MissionTask) error {
	return database.DB.Create(task).Error
}

func (r *MissionRepository) GetTasksByMission(missionID uint) ([]models.MissionTask, error) {
	var tasks []models.MissionTask
	if err := database.DB.Where("mission_id = ?", missionID).Order("\"order\" ASC").Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

func (r *MissionRepository) UpdateTask(task *models.MissionTask) error {
	return database.DB.Save(task).Error
}

func (r *MissionRepository) DeleteTask(id uint) error {
	return database.DB.Delete(&models.MissionTask{}, id).Error
}

// -- NPC Mission Roles --

func (r *MissionRepository) GetMissionRole(tmplID uint, missionID uint) (*models.NPCMissionRole, error) {
	var role models.NPCMissionRole
	if err := database.DB.Where("npc_template_id = ? AND mission_id = ?", tmplID, missionID).First(&role).Error; err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *MissionRepository) CreateOrUpdateMissionRole(role *models.NPCMissionRole) error {
	var existing models.NPCMissionRole
	result := database.DB.Where("npc_template_id = ? AND mission_id = ?", role.NPCTemplateID, role.MissionID).First(&existing)
	if result.Error != nil {
		return database.DB.Create(role).Error
	}
	role.ID = existing.ID
	return database.DB.Save(role).Error
}

func (r *MissionRepository) GetRolesByMission(missionID uint) ([]models.NPCMissionRole, error) {
	var roles []models.NPCMissionRole
	if err := database.DB.Where("mission_id = ?", missionID).Find(&roles).Error; err != nil {
		return nil, err
	}
	return roles, nil
}

func (r *MissionRepository) GetMissionsByTemplate(tmplID uint) ([]models.Mission, error) {
	var missions []models.Mission
	// Search for missions where the NPC has a role OR is a target of a task
	err := database.DB.Table("missions").
		Joins("LEFT JOIN npc_mission_roles ON npc_mission_roles.mission_id = missions.id").
		Joins("LEFT JOIN mission_tasks ON mission_tasks.mission_id = missions.id").
		Where("(npc_mission_roles.npc_template_id = ? OR mission_tasks.target_npc_template_id = ?) AND missions.status = 'active'", tmplID, tmplID).
		Distinct("missions.*").
		Find(&missions).Error
	if err != nil {
		return nil, err
	}
	return missions, nil
}

// -- Conversations & Messages --

func (r *MissionRepository) CreateConversation(conv *models.Conversation) error {
	return database.DB.Create(conv).Error
}

func (r *MissionRepository) GetConversation(playerID uuid.UUID, instanceID uint, missionID *uint) (*models.Conversation, error) {
	var conv models.Conversation
	query := database.DB.Where("player_id = ? AND npc_instance_id = ?", playerID, instanceID)
	if missionID != nil {
		query = query.Where("mission_id = ?", *missionID)
	} else {
		query = query.Where("mission_id IS NULL")
	}
	if err := query.Order("created_at DESC").First(&conv).Error; err != nil {
		return nil, err
	}
	return &conv, nil
}

func (r *MissionRepository) AddMessage(msg *models.ConversationMessage) error {
	return database.DB.Create(msg).Error
}

func (r *MissionRepository) GetMessages(convID uint, limit int) ([]models.ConversationMessage, error) {
	var msgs []models.ConversationMessage
	if err := database.DB.Where("conversation_id = ?", convID).Order("created_at DESC").Limit(limit).Find(&msgs).Error; err != nil {
		return nil, err
	}
	// Reverse to get chronological order if needed, but the caller can handle it
	return msgs, nil
}

// -- Player Progress & Stats --

func (r *MissionRepository) GetPlayerProgress(playerID uuid.UUID, missionID uint) (*models.PlayerMissionProgress, error) {
	var progress models.PlayerMissionProgress
	if err := database.DB.Where("player_id = ? AND mission_id = ?", playerID, missionID).First(&progress).Error; err != nil {
		return nil, err
	}
	return &progress, nil
}

// GetPlayerProgressInRoom looks up progress scoped to a specific room instance.
// When roomID is nil it falls back to any progress for (player, mission).
func (r *MissionRepository) GetPlayerProgressInRoom(playerID uuid.UUID, missionID uint, roomID *uuid.UUID) (*models.PlayerMissionProgress, error) {
	q := database.DB.Where("player_id = ? AND mission_id = ?", playerID, missionID)
	if roomID != nil {
		q = q.Where("room_id = ?", *roomID)
	}
	var progress models.PlayerMissionProgress
	if err := q.First(&progress).Error; err != nil {
		return nil, err
	}
	return &progress, nil
}

func (r *MissionRepository) CreateOrUpdateProgress(progress *models.PlayerMissionProgress) error {
	return database.DB.Save(progress).Error
}

func (r *MissionRepository) GetPlayerLearningStats(playerID uuid.UUID) (*models.PlayerLearningStats, error) {
	var stats models.PlayerLearningStats
	if err := database.DB.Where("player_id = ?", playerID).First(&stats).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil // Not found is fine, we'll initialize it in service
		}
		return nil, err
	}
	return &stats, nil
}

func (r *MissionRepository) UpdatePlayerLearningStats(stats *models.PlayerLearningStats) error {
	return database.DB.Save(stats).Error
}
