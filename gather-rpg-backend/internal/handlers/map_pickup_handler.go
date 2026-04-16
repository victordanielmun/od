package handlers

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MapPickupHandler struct {
	InventoryService *services.InventoryService
}

func NewMapPickupHandler(invService *services.InventoryService) *MapPickupHandler {
	return &MapPickupHandler{InventoryService: invService}
}

func (h *MapPickupHandler) GetPickups(c *fiber.Ctx) error {
	sceneKey := c.Params("scene")
	var pickups []models.MapPickup
	err := database.DB.Where("scene_key = ? AND is_picked_up = false", sceneKey).Preload("Item").Find(&pickups).Error
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(pickups)
}

func (h *MapPickupHandler) Pickup(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, _ := uuid.Parse(userIDStr)

	pickupIDStr := c.Params("id")
	pickupID, err := uuid.Parse(pickupIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid pickup ID"})
	}

	// 1. Get Pickup
	var pickup models.MapPickup
	if err := database.DB.First(&pickup, "id = ?", pickupID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pickup not found"})
	}

	if pickup.IsPickedUp {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Already picked up"})
	}

	// 2. Get Player Stats (to get actual Player record ID)
	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create default stats for legacy users
			stats = models.PlayerStats{
				UserID: userID,
				Gold:   100,
			}
			if err := database.DB.Create(&stats).Error; err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to initialize player stats"})
			}
		} else {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database error fetching player stats"})
		}
	}

	// 3. Transaction: Mark as picked up and Add to inventory
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		pickup.IsPickedUp = true
		if err := tx.Save(&pickup).Error; err != nil {
			return err
		}

		inv := &models.Inventory{
			PlayerID: stats.ID,
			ItemID:   pickup.ItemID,
			Quantity: pickup.Quantity,
		}
		
		var existing models.Inventory
		err := tx.Where("player_id = ? AND item_id = ?", inv.PlayerID, inv.ItemID).First(&existing).Error
		if err == nil {
			existing.Quantity += inv.Quantity
			return tx.Save(&existing).Error
		}
		return tx.Create(inv).Error
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "success"})
}
