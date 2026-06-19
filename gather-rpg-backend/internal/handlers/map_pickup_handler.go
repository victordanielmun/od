package handlers

import (
	"time"

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

// resolvePlayerStats returns the PlayerStats row for the authenticated user,
// creating a default one for legacy users that predate the stats system.
func resolvePlayerStats(c *fiber.Ctx) (*models.PlayerStats, error) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "Invalid user id")
	}

	var stats models.PlayerStats
	if err := database.DB.First(&stats, "user_id = ?", userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			stats = models.PlayerStats{
				UserID:    userID,
				Gold:      100,
				HPCurrent: 100,
				MPCurrent: 50,
			}
			if err := database.DB.Create(&stats).Error; err != nil {
				return nil, fiber.NewError(fiber.StatusInternalServerError, "Failed to initialize player stats")
			}
		} else {
			return nil, fiber.NewError(fiber.StatusInternalServerError, "Database error fetching player stats")
		}
	}
	return &stats, nil
}

// GetPickups returns the pickup templates for a scene that the requesting player
// has NOT yet claimed in their current attempt. Pickups are per-player: another
// user opening the same scene gets their own full set, and claims are wiped on
// (re)entry via ResetPickups so items reappear on retry.
func (h *MapPickupHandler) GetPickups(c *fiber.Ctx) error {
	sceneKey := c.Params("scene")

	stats, err := resolvePlayerStats(c)
	if err != nil {
		return err
	}

	// Pickup IDs already claimed by this player in this scene/attempt.
	var claimedIDs []uuid.UUID
	if err := database.DB.Model(&models.MapPickupClaim{}).
		Where("player_id = ? AND scene_key = ?", stats.ID, sceneKey).
		Pluck("pickup_id", &claimedIDs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	query := database.DB.Where("scene_key = ?", sceneKey).Preload("Item")
	if len(claimedIDs) > 0 {
		query = query.Where("id NOT IN ?", claimedIDs)
	}

	var pickups []models.MapPickup
	if err := query.Find(&pickups).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(pickups)
}

// ResetPickups clears the requesting player's claims for a scene, making every
// pickup available again. Called on (re)entry to a scene/mission instance so a
// retry (or death + retry) restores the items, mirroring how combat enemies are
// regenerated per room entry.
func (h *MapPickupHandler) ResetPickups(c *fiber.Ctx) error {
	sceneKey := c.Params("scene")

	stats, err := resolvePlayerStats(c)
	if err != nil {
		return err
	}

	if err := database.DB.
		Where("player_id = ? AND scene_key = ?", stats.ID, sceneKey).
		Delete(&models.MapPickupClaim{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "success"})
}

// Pickup records a per-player claim on a pickup template and adds the item to
// the player's inventory. The same template can be claimed by different players
// (each gets their own copy) but only once per player per attempt.
func (h *MapPickupHandler) Pickup(c *fiber.Ctx) error {
	stats, err := resolvePlayerStats(c)
	if err != nil {
		return err
	}

	pickupID, perr := uuid.Parse(c.Params("id"))
	if perr != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid pickup ID"})
	}

	var pickup models.MapPickup
	if err := database.DB.First(&pickup, "id = ?", pickupID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Pickup not found"})
	}

	// Already claimed by THIS player in THIS scene?
	var existingClaim models.MapPickupClaim
	err = database.DB.Where("player_id = ? AND pickup_id = ?", stats.ID, pickup.ID).First(&existingClaim).Error
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Already picked up"})
	}
	if err != gorm.ErrRecordNotFound {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Transaction: record the claim and grant the item.
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		claim := &models.MapPickupClaim{
			PlayerID:  stats.ID,
			SceneKey:  pickup.SceneKey,
			PickupID:  pickup.ID,
			ClaimedAt: time.Now(),
		}
		if err := tx.Create(claim).Error; err != nil {
			return err
		}

		var existing models.Inventory
		err := tx.Where("player_id = ? AND item_id = ?", stats.ID, pickup.ItemID).First(&existing).Error
		if err == nil {
			existing.Quantity += pickup.Quantity
			return tx.Save(&existing).Error
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		return tx.Create(&models.Inventory{
			PlayerID: stats.ID,
			ItemID:   pickup.ItemID,
			Quantity: pickup.Quantity,
		}).Error
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "success"})
}
