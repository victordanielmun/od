package services

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"

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
