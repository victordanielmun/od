package services

import (
	"errors"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InventoryService struct {
	Repo *repository.InventoryRepository
}

func NewInventoryService(repo *repository.InventoryRepository) *InventoryService {
	return &InventoryService{Repo: repo}
}

func (s *InventoryService) GetPlayerInventory(userID uuid.UUID) ([]models.Inventory, error) {
	var stats models.PlayerStats
	// 1. Resolve UserID to PlayerID (PlayerStats.ID)
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// If no stats, return empty inventory (but logically shouldn't happen after our fixes)
			return []models.Inventory{}, nil
		}
		return nil, err
	}
	return s.Repo.GetInventoryByPlayerID(stats.ID)
}

func (s *InventoryService) AddItem(playerID uuid.UUID, itemID uuid.UUID, quantity int) error {
	inv := &models.Inventory{
		PlayerID: playerID,
		ItemID:   itemID,
		Quantity: quantity,
	}
	return s.Repo.AddItemToInventory(inv)
}

func (s *InventoryService) AddItemByName(userID uuid.UUID, itemName string, quantity int) error {
	var stats models.PlayerStats
	// 1. Resolve UserID to PlayerID
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return err
	}
	
	item, err := s.Repo.GetItemByName(itemName)
	if err != nil {
		return err
	}
	return s.AddItem(stats.ID, item.ID, quantity)
}

func (s *InventoryService) UseItem(userID uuid.UUID, inventoryID uuid.UUID) error {
	var stats models.PlayerStats
	// 1. Resolve UserID to PlayerID
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		return err
	}

	// 2. Fetch inventory entry with the associated Item preloaded
	var inv models.Inventory
	if err := database.DB.Preload("Item").First(&inv, "id = ? AND player_id = ?", inventoryID, stats.ID).Error; err != nil {
		return err
	}

	if inv.Quantity <= 0 {
		return errors.New("cantidad insuficiente")
	}

	// 3. Process effect based on Item
	switch inv.Item.EffectType {
	case "grant_skill":
		if inv.Item.GrantsSkillID == nil {
			return errors.New("el item no especifica qué habilidad otorgar")
		}

		// Check if the skill exists
		var skill models.Skill
		if err := database.DB.First(&skill, "id = ?", *inv.Item.GrantsSkillID).Error; err != nil {
			return errors.New("la habilidad asociada no existe")
		}

		// Check if skill is already unlocked
		var count int64
		database.DB.Model(&models.PlayerSkill{}).Where("player_id = ? AND skill_id = ?", stats.ID, *inv.Item.GrantsSkillID).Count(&count)
		if count > 0 {
			return errors.New("habilidad ya desbloqueada")
		}

		// Unlock the skill
		playerSkill := models.PlayerSkill{
			PlayerID:   stats.ID,
			SkillID:    *inv.Item.GrantsSkillID,
			UnlockedAt: time.Now(),
		}
		if err := database.DB.Create(&playerSkill).Error; err != nil {
			return err
		}

	case "heal_hp":
		stats.HPCurrent += inv.Item.EffectValue
		if stats.HPCurrent > stats.HPMax {
			stats.HPCurrent = stats.HPMax
		}
		if err := database.DB.Save(&stats).Error; err != nil {
			return err
		}

	case "restore_mp":
		stats.MPCurrent += inv.Item.EffectValue
		if stats.MPCurrent > stats.MPMax {
			stats.MPCurrent = stats.MPMax
		}
		if err := database.DB.Save(&stats).Error; err != nil {
			return err
		}

	default:
		// Otros efectos no implementados o ninguno
	}

	// 4. Consume item
	if inv.Quantity <= 1 {
		return database.DB.Delete(&inv).Error
	} else {
		inv.Quantity -= 1
		return database.DB.Save(&inv).Error
	}
}
