package services

import (
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"log"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

type NPCService struct {
	Repo        *repository.NPCRepository
	MissionRepo *repository.MissionRepository
}

func NewNPCService(repo *repository.NPCRepository, missionRepo *repository.MissionRepository) *NPCService {
	return &NPCService{Repo: repo, MissionRepo: missionRepo}
}

// EnsureRoomInstances checks if the NPCs for a scene have been instantiated in the room.
// If not, it creates them from the templates.
func (s *NPCService) EnsureRoomInstances(roomID uuid.UUID, sceneKey string) ([]models.NPCRoomInstance, error) {
	// 1. Get ALL existing instances for this room
	allInstances, err := s.Repo.GetRoomInstancesByRoom(roomID)
	if err != nil {
		return nil, err
	}

	// 2. Get templates for THIS specific scene
	templates, err := s.Repo.GetTemplatesByScene(sceneKey)
	if err != nil {
		return nil, err
	}

	// 3. Map to keep track of what's already instantiated
	instanceMap := make(map[uint]bool)
	for _, inst := range allInstances {
		instanceMap[inst.NPCTemplateID] = true
	}

	// 4. Compare and create missing instances ONLY for the templates in this scene
	for _, tmpl := range templates {
		if _, exists := instanceMap[tmpl.ID]; !exists {
			initialState := tmpl.DefaultState
			if initialState == "" {
				initialState = models.NPCStateIdle
			}
			newInst := &models.NPCRoomInstance{
				RoomID:        roomID,
				NPCTemplateID: tmpl.ID,
				CurrentState:  initialState,
			}
			if err := s.Repo.CreateRoomInstance(newInst); err != nil {
				return nil, err
			}
			// Preload the template info for the returned list
			newInst.NPCTemplate = tmpl
			allInstances = append(allInstances, *newInst)
		}
	}

	// 5. CRITICAL FIX: Filter allInstances to only return those belonging to the CURRENT sceneKey
	// Previously, we were returning instances from other scenes if they were in the same room.
	filteredInstances := make([]models.NPCRoomInstance, 0)
	for _, inst := range allInstances {
		// Preload template if missing (GORM sometimes doesn't if it was already in allInstances)
		if inst.NPCTemplate.ID == 0 || inst.NPCTemplate.NPCDefinition.ID == 0 {
			// More efficient: GORM auto-preload is better handled in the repository, 
			// but here we filter by the pre-loaded template's scene_key.
			var fullTmpl models.NPCTemplate
			if err := database.DB.Preload("NPCDefinition").First(&fullTmpl, inst.NPCTemplateID).Error; err == nil {
				inst.NPCTemplate = fullTmpl
			}
		}

		if inst.NPCTemplate.SceneKey == sceneKey {
			filteredInstances = append(filteredInstances, inst)
		}
	}

	return filteredInstances, nil
}

func (s *NPCService) GetRoomInstance(roomID uuid.UUID, tmplID uint) (*models.NPCRoomInstance, error) {
	return s.Repo.GetRoomInstance(roomID, tmplID)
}

func (s *NPCService) UpdateNPCState(roomID uuid.UUID, tmplID uint, state models.NPCState) error {
	instance, err := s.Repo.GetRoomInstance(roomID, tmplID)
	if err != nil {
		return err
	}
	instance.CurrentState = state
	return s.Repo.UpdateRoomInstance(instance)
}

func (s *NPCService) MarkTaskCompleted(roomID uuid.UUID, tmplID uint) error {
	instance, err := s.Repo.GetRoomInstance(roomID, tmplID)
	if err != nil {
		return err
	}
	instance.TaskCompleted = true
	return s.Repo.UpdateRoomInstance(instance)
}

func (s *NPCService) CreateNPCTemplate(tmpl *models.NPCTemplate) error {
	return s.Repo.CreateTemplate(tmpl)
}

func (s *NPCService) UpdateNPCTemplate(tmpl *models.NPCTemplate) error {
	return s.Repo.UpdateTemplate(tmpl)
}

func (s *NPCService) DeleteNPCTemplate(id uint) error {
	// Check if this template is referenced by any mission tasks
	var taskCount int64
	if err := database.DB.Model(&models.MissionTask{}).Where("target_npc_template_id = ?", id).Count(&taskCount).Error; err == nil && taskCount > 0 {
		var task models.MissionTask
		if err := database.DB.Where("target_npc_template_id = ?", id).First(&task).Error; err == nil {
			var mission models.Mission
			if err := database.DB.First(&mission, task.MissionID).Error; err == nil {
				return fmt.Errorf("no se puede eliminar el NPC de la escena porque está asignado a la tarea '%s' de la misión '%s'", task.DescriptionEn, mission.Title)
			}
		}
		return fmt.Errorf("no se puede eliminar el NPC de la escena porque está asignado a una tarea de misión")
	}

	// Clean up related instances and roles before deleting the template to bypass constraint violations
	if err := database.DB.Where("npc_template_id = ?", id).Delete(&models.NPCRoomInstance{}).Error; err != nil {
		return err
	}
	if err := database.DB.Where("npc_template_id = ?", id).Delete(&models.NPCMissionRole{}).Error; err != nil {
		return err
	}

	return s.Repo.DeleteTemplate(id)
}

func (s *NPCService) GetAllTemplates() ([]models.NPCTemplate, error) {
	return s.Repo.GetAllTemplates()
}

func (s *NPCService) GetTemplatesByScene(sceneKey string) ([]models.NPCTemplate, error) {
	return s.Repo.GetTemplatesByScene(sceneKey)
}

func (s *NPCService) GetTemplatesByDefinition(defID uint) ([]models.NPCTemplate, error) {
	return s.Repo.GetTemplatesByDefinition(defID)
}

func (s *NPCService) UpdateTemplateMissions(tmplID uint, missionIDs []uint, role string, instructions string, successMsg string, greeting string) error {
	// 1. Update Template metadata
	var tmpl models.NPCTemplate
	if err := database.DB.First(&tmpl, tmplID).Error; err == nil {
		tmpl.Instructions = instructions
		tmpl.SuccessMessage = successMsg
		tmpl.Greeting = greeting
		database.DB.Save(&tmpl)
	}

	// 2. Sync Missions
	s.syncMissionsForTemplate(tmplID, missionIDs, role)
	return nil
}

// PatchTemplateInstructions updates ONLY instructions, success_message and greeting,
// preserving any existing mission role assignments.
func (s *NPCService) PatchTemplateInstructions(tmplID uint, instructions string, successMsg string, greeting string) error {
	return database.DB.Model(&models.NPCTemplate{}).Where("id = ?", tmplID).Updates(map[string]interface{}{
		"instructions":   instructions,
		"success_message": successMsg,
		"greeting":        greeting,
	}).Error
}

func (s *NPCService) GetNPCDefinitions() ([]models.NPCDefinition, error) {
	return s.Repo.GetAllDefinitions()
}

func (s *NPCService) CreateNPCDefinition(def *models.NPCDefinition) error {
	return s.Repo.CreateDefinition(def)
}

func (s *NPCService) UpdateNPCDefinition(def *models.NPCDefinition) error {
	return s.Repo.UpdateDefinition(def)
}

func (s *NPCService) DeleteNPCDefinition(id uint) error {
	// 1. Check if there are templates associated with this definition
	var templates []models.NPCTemplate
	if err := database.DB.Where("npc_definition_id = ?", id).Find(&templates).Error; err == nil && len(templates) > 0 {
		scenes := make(map[string]bool)
		var activeSceneList []string
		for _, t := range templates {
			var mapCount int64
			// Check if map config exists for this scene
			if err := database.DB.Model(&models.MapConfig{}).Where("scene_key = ?", t.SceneKey).Count(&mapCount).Error; err == nil && mapCount > 0 {
				if !scenes[t.SceneKey] {
					scenes[t.SceneKey] = true
					activeSceneList = append(activeSceneList, t.SceneKey)
				}
			} else {
				// Clean up orphaned templates (map is deleted)
				database.DB.Delete(&t)
			}
		}
		if len(activeSceneList) > 0 {
			return fmt.Errorf("no se puede eliminar la definición de NPC porque está colocada en los mapas: %s. Elimínala de los mapas primero", strings.Join(activeSceneList, ", "))
		}
	}

	// 2. Check if there are player gifts associated with this definition
	var giftCount int64
	if err := database.DB.Model(&models.PlayerNPCGift{}).Where("npc_definition_id = ?", id).Count(&giftCount).Error; err == nil && giftCount > 0 {
		return fmt.Errorf("no se puede eliminar la definición de NPC porque tiene historial de regalos asociados con jugadores")
	}

	return s.Repo.DeleteDefinition(id)
}

// SyncTemplatesFromMap parses the walls JSON and ensures NPCTemplates exist for each npcZone.
func (s *NPCService) SyncTemplatesFromMap(sceneKey string, wallsJSON string) error {
	type mapObject struct {
		X            int      `json:"x"`
		Y            int      `json:"y"`
		DefinitionID string   `json:"definitionId"`
		Role         string   `json:"role"`
		MissionID    string   `json:"missionId"`
		MissionIDs   []string `json:"missionIds"`
		TemplateID   string   `json:"templateId"`
		State        string   `json:"state"`
		Facing       string   `json:"facing"`
	}
	type mapConfig struct {
		NPCZones []mapObject `json:"npcZones"`
	}

	var config mapConfig
	if err := json.Unmarshal([]byte(wallsJSON), &config); err != nil {
		log.Printf("[NPCService] Error unmarshaling walls_json: %v", err)
		return err
	}

	log.Printf("[NPCService] Syncing Map '%s'. Found %d NPC zones.", sceneKey, len(config.NPCZones))

	// 1. Get current templates for this scene
	existing, err := s.Repo.GetTemplatesByScene(sceneKey)
	if err != nil {
		return err
	}

	// 2. Track which templates were matched to avoid deletion
	matchedTemplateIDs := make(map[uint]bool)

	for _, zone := range config.NPCZones {
		defID, _ := strconv.ParseUint(zone.DefinitionID, 10, 32)
		if defID == 0 {
			log.Printf("[NPCService] Skipping zone with missing definitionId")
			continue
		}

		// 0. Fetch definition to check Role
		var def models.NPCDefinition
		if err := database.DB.First(&def, defID).Error; err != nil {
			log.Printf("[NPCService] CRITICAL: Skipping sync for unknown NPC definition ID: %d", defID)
			continue
		}
		
		log.Printf("[NPCService] Processing Zone for NPC: %s (ID: %d) at [%d, %d] with state '%s'", def.Name, def.ID, zone.X, zone.Y, zone.State)

		roleStr := zone.Role
		if def.Type == models.NPCTypeQuest && roleStr == "" {
			roleStr = string(models.NPCRoleTask)
		}

		tID := uint(0)
		if zone.TemplateID != "" {
			tid, _ := strconv.ParseUint(zone.TemplateID, 10, 32)
			tID = uint(tid)
		}

		// Find if there's an existing template
		var foundTmpl *models.NPCTemplate
		
		// 1. Try exact ID match
		if tID > 0 {
			for i := range existing {
				if existing[i].ID == tID && !matchedTemplateIDs[existing[i].ID] {
					foundTmpl = &existing[i]
					break
				}
			}
		}

		// 2. Fallback: match by definition
		if foundTmpl == nil {
			for i := range existing {
				if existing[i].NPCDefinitionID == uint(defID) && !matchedTemplateIDs[existing[i].ID] {
					foundTmpl = &existing[i]
					break
				}
			}
		}

		var finalTmplID uint
		if foundTmpl != nil {
			// Update
			foundTmpl.PositionX = zone.X
			foundTmpl.PositionY = zone.Y
			if zone.State != "" {
				foundTmpl.DefaultState = models.NPCState(zone.State)
			}
			if zone.Facing != "" {
				foundTmpl.FacingDirection = zone.Facing
			}
			s.Repo.UpdateTemplate(foundTmpl)
			matchedTemplateIDs[foundTmpl.ID] = true
			finalTmplID = foundTmpl.ID
		} else {
			// Create
			initialState := models.NPCState(zone.State)
			if initialState == "" {
				initialState = models.NPCStateIdle
			}
			facing := zone.Facing
			if facing == "" {
				facing = "right"
			}
			newTmpl := &models.NPCTemplate{
				SceneKey:        sceneKey,
				NPCDefinitionID: uint(defID),
				PositionX:       zone.X,
				PositionY:       zone.Y,
				DefaultState:    initialState,
				FacingDirection: facing,
			}
			if err := s.Repo.CreateTemplate(newTmpl); err == nil {
				matchedTemplateIDs[newTmpl.ID] = true
				finalTmplID = newTmpl.ID
			}
		}

		// SYNC MISSIONS (v2): Handle plural missionIds and orphan cleanup
		if finalTmplID > 0 && def.Type == models.NPCTypeQuest {
			// Collect all missions for this zone
			targetMissions := make([]uint, 0)
			
			// 1. Support plural missionIds (handle both string and numeric via struct)
			for _, midStr := range zone.MissionIDs {
				mid, _ := strconv.ParseUint(midStr, 10, 32)
				if mid > 0 {
					targetMissions = append(targetMissions, uint(mid))
				}
			}
			
			// 2. Backward compatibility: single missionId
			if zone.MissionID != "" {
				mid, _ := strconv.ParseUint(zone.MissionID, 10, 32)
				if mid > 0 {
					exists := false
					for _, m := range targetMissions {
						if m == uint(mid) {
							exists = true
							break
						}
					}
					if !exists {
						targetMissions = append(targetMissions, uint(mid))
					}
				}
			}

			// Sync the list to database
			s.syncMissionsForTemplate(finalTmplID, targetMissions, roleStr)
		}
	}

	// 3. Delete orphans
	for _, tmpl := range existing {
		if !matchedTemplateIDs[tmpl.ID] {
			s.Repo.DeleteTemplate(tmpl.ID)
		}
	}

	return nil
}

func (s *NPCService) syncMissionsForTemplate(templateID uint, missionIDs []uint, role string) {
	log.Printf("[NPCService] Cleaning and Syncing Missions for Tmpl=%d: Count=%d", templateID, len(missionIDs))
	
	// 1. Delete ALL existing roles for this template (Reset)
	database.DB.Where("npc_template_id = ?", templateID).Delete(&models.NPCMissionRole{})
	
	// 2. Insert new ones
	for _, mID := range missionIDs {
		newRole := &models.NPCMissionRole{
			NPCTemplateID: templateID,
			MissionID:     mID,
			Role:          models.NPCRole(role),
		}
		s.MissionRepo.CreateOrUpdateMissionRole(newRole)
	}
}

func (s *NPCService) syncMissionRole(templateID uint, missionID uint, role string) {
	s.syncMissionsForTemplate(templateID, []uint{missionID}, role)
}
