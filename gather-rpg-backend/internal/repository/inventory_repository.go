package repository

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InventoryRepository struct{}

func NewInventoryRepository() *InventoryRepository {
	return &InventoryRepository{}
}

func (r *InventoryRepository) GetInventoryByPlayerID(playerID uuid.UUID) ([]models.Inventory, error) {
	var inventory []models.Inventory
	// Preload Item to get details like Name, IconKey, etc.
	err := database.DB.Where("player_id = ?", playerID).Preload("Item").Find(&inventory).Error
	return inventory, err
}

func (r *InventoryRepository) AddItemToInventory(inv *models.Inventory) error {
	var existing models.Inventory
	err := database.DB.Where("player_id = ? AND item_id = ?", inv.PlayerID, inv.ItemID).First(&existing).Error
	
	if err == gorm.ErrRecordNotFound {
		return database.DB.Create(inv).Error
	} else if err != nil {
		return err
	}

	existing.Quantity += inv.Quantity
	return database.DB.Save(&existing).Error
}

func (r *InventoryRepository) RemoveItemFromInventory(playerID uuid.UUID, itemID uuid.UUID, quantity int) error {
	var existing models.Inventory
	err := database.DB.Where("player_id = ? AND item_id = ?", playerID, itemID).First(&existing).Error
	if err != nil {
		return err
	}

	if existing.Quantity <= quantity {
		return database.DB.Delete(&existing).Error
	}

	existing.Quantity -= quantity
	return database.DB.Save(&existing).Error
}

func (r *InventoryRepository) GetItemByName(name string) (*models.Item, error) {
	var item models.Item
	err := database.DB.Where("name ILIKE ?", name).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}
