package repository

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
)

type NPCRepository struct{}

func NewNPCRepository() *NPCRepository {
	return &NPCRepository{}
}

// -- Definitions --

func (r *NPCRepository) CreateDefinition(def *models.NPCDefinition) error {
	return database.DB.Create(def).Error
}

func (r *NPCRepository) GetDefinitionByID(id uint) (*models.NPCDefinition, error) {
	var def models.NPCDefinition
	if err := database.DB.First(&def, id).Error; err != nil {
		return nil, err
	}
	return &def, nil
}

// -- Templates --

func (r *NPCRepository) CreateTemplate(tmpl *models.NPCTemplate) error {
	return database.DB.Create(tmpl).Error
}

func (r *NPCRepository) GetTemplatesByScene(sceneKey string) ([]models.NPCTemplate, error) {
	var tmpls []models.NPCTemplate
	if err := database.DB.Preload("NPCDefinition").Where("scene_key = ?", sceneKey).Find(&tmpls).Error; err != nil {
		return nil, err
	}
	return tmpls, nil
}

func (r *NPCRepository) GetTemplateByID(id uint) (*models.NPCTemplate, error) {
	var tmpl models.NPCTemplate
	if err := database.DB.Preload("NPCDefinition").First(&tmpl, id).Error; err != nil {
		return nil, err
	}
	return &tmpl, nil
}

// -- Room Instances --

func (r *NPCRepository) CreateRoomInstance(instance *models.NPCRoomInstance) error {
	return database.DB.Create(instance).Error
}

func (r *NPCRepository) GetRoomInstance(roomID uuid.UUID, tmplID uint) (*models.NPCRoomInstance, error) {
	var instance models.NPCRoomInstance
	if err := database.DB.Preload("NPCTemplate.NPCDefinition").Where("room_id = ? AND npc_template_id = ?", roomID, tmplID).First(&instance).Error; err != nil {
		return nil, err
	}
	return &instance, nil
}

func (r *NPCRepository) GetRoomInstancesByRoom(roomID uuid.UUID) ([]models.NPCRoomInstance, error) {
	var instances []models.NPCRoomInstance
	if err := database.DB.Preload("NPCTemplate.NPCDefinition").Where("room_id = ?", roomID).Find(&instances).Error; err != nil {
		return nil, err
	}
	return instances, nil
}

func (r *NPCRepository) UpdateRoomInstance(instance *models.NPCRoomInstance) error {
	return database.DB.Save(instance).Error
}

func (r *NPCRepository) UpdateTemplate(tmpl *models.NPCTemplate) error {
	return database.DB.Save(tmpl).Error
}

func (r *NPCRepository) DeleteTemplate(id uint) error {
	return database.DB.Delete(&models.NPCTemplate{}, id).Error
}

func (r *NPCRepository) GetAllDefinitions() ([]models.NPCDefinition, error) {
	var definitions []models.NPCDefinition
	if err := database.DB.Find(&definitions).Error; err != nil {
		return nil, err
	}
	return definitions, nil
}

func (r *NPCRepository) UpdateDefinition(def *models.NPCDefinition) error {
	// Use Model().Updates() to only update provided fields and avoid zero-value enum issues
	return database.DB.Model(def).Updates(def).Error
}

func (r *NPCRepository) DeleteDefinition(id uint) error {
	return database.DB.Delete(&models.NPCDefinition{}, id).Error
}
