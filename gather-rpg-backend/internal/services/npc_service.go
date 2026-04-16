package services

import (
	"encoding/json"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"log"
	"strconv"

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
	// 1. Get existing instances
	instances, err := s.Repo.GetRoomInstancesByRoom(roomID)
	if err != nil {
		return nil, err
	}

	// 2. Get templates for this scene
	templates, err := s.Repo.GetTemplatesByScene(sceneKey)
	if err != nil {
		return nil, err
	}

	// 3. Compare and create missing instances
	instanceMap := make(map[uint]bool)
	for _, inst := range instances {
		instanceMap[inst.NPCTemplateID] = true
	}

	for _, tmpl := range templates {
		if _, exists := instanceMap[tmpl.ID]; !exists {
			newInst := &models.NPCRoomInstance{
				RoomID:        roomID,
				NPCTemplateID: tmpl.ID,
				CurrentState:  models.NPCStateIdle,
			}
			if err := s.Repo.CreateRoomInstance(newInst); err != nil {
				return nil, err
			}
			// Preload the template info for the returned list
			newInst.NPCTemplate = tmpl
			instances = append(instances, *newInst)
		}
	}

	return instances, nil
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
	return s.Repo.DeleteTemplate(id)
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
	return s.Repo.DeleteDefinition(id)
}

// SyncTemplatesFromMap parses the walls JSON and ensures NPCTemplates exist for each npcZone.
func (s *NPCService) SyncTemplatesFromMap(sceneKey string, wallsJSON string) error {
	type mapObject struct {
		X            int    `json:"x"`
		Y            int    `json:"y"`
		DefinitionID string `json:"definitionId"`
		Role         string `json:"role"`
		MissionID    string `json:"missionId"`
		TemplateID   string `json:"templateId"`
	}
	type mapConfig struct {
		NPCZones []mapObject `json:"npcZones"`
	}

	var config mapConfig
	if err := json.Unmarshal([]byte(wallsJSON), &config); err != nil {
		return err
	}

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
			continue
		}

		// 0. Fetch definition to check Role
		var def models.NPCDefinition
		if err := database.DB.First(&def, defID).Error; err != nil {
			log.Printf("[NPCService] Skipping sync for unknown NPC definition: %d", defID)
			continue
		}
		
		missionID := uint(0)
		if zone.MissionID != "" && def.Type == models.NPCTypeQuest {
			mid, _ := strconv.ParseUint(zone.MissionID, 10, 32)
			missionID = uint(mid)
		}

		roleStr := ""
		if def.Type == models.NPCTypeQuest {
			roleStr = zone.Role
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

			if foundTmpl != nil {
				// Update
				foundTmpl.PositionX = zone.X
				foundTmpl.PositionY = zone.Y
				s.Repo.UpdateTemplate(foundTmpl)
				matchedTemplateIDs[foundTmpl.ID] = true
				
				// Sync Mission Role if provided AND NPC is Quest Giver
				if missionID > 0 || roleStr != "" {
					s.syncMissionRole(foundTmpl.ID, missionID, roleStr)
				}
			} else {
				// Create
				newTmpl := &models.NPCTemplate{
					SceneKey:        sceneKey,
					NPCDefinitionID: uint(defID),
					PositionX:       zone.X,
					PositionY:       zone.Y,
				}
				if err := s.Repo.CreateTemplate(newTmpl); err == nil {
					matchedTemplateIDs[newTmpl.ID] = true
					if missionID > 0 || roleStr != "" {
						s.syncMissionRole(newTmpl.ID, missionID, roleStr)
					}
				}
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

func (s *NPCService) syncMissionRole(templateID uint, missionID uint, role string) {
	log.Printf("[NPCService] Syncing Mission Role: Tmpl=%d, Mission=%d, Role=%s", templateID, missionID, role)
	
	newRole := &models.NPCMissionRole{
		NPCTemplateID: templateID,
		MissionID:     missionID,
		Role:          models.NPCRole(role),
	}
	
	if err := s.MissionRepo.CreateOrUpdateMissionRole(newRole); err != nil {
		log.Printf("[NPCService] Error syncing mission role: %v", err)
	}
}
