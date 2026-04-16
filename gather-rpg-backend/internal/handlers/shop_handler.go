package handlers

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ShopHandler struct {
	InventoryService *services.InventoryService
}

func NewShopHandler(invService *services.InventoryService) *ShopHandler {
	return &ShopHandler{InventoryService: invService}
}

func (h *ShopHandler) GetNPCItems(c *fiber.Ctx) error {
	npcID := c.Params("id")
	var npc models.NPCDefinition
	if err := database.DB.Preload("Shop.Items").First(&npc, "id = ?", npcID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "NPC not found"})
	}
	
	if npc.ShopID == nil {
		return c.JSON([]models.Item{})
	}
	
	return c.JSON(npc.Shop)
}

func (h *ShopHandler) BuyItem(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, _ := uuid.Parse(userIDStr)

	type Request struct {
		ItemID   uuid.UUID `json:"item_id"`
		Quantity int       `json:"quantity"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Quantity <= 0 {
		req.Quantity = 1
	}

	// 1. Get Item details
	var item models.Item
	if err := database.DB.First(&item, "id = ?", req.ItemID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Item not found"})
	}

	totalCost := item.Price * req.Quantity

	// 2. Get Player Stats
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

	// 3. Check Gold
	if stats.Gold < totalCost {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Not enough gold"})
	}

	// 4. Update Gold and Add to Inventory (Transaction)
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		stats.Gold -= totalCost
		if err := tx.Save(&stats).Error; err != nil {
			return err
		}

		inv := &models.Inventory{
			PlayerID: stats.ID,
			ItemID:   item.ID,
			Quantity: req.Quantity,
		}
		// We use the Repo logic via Service (or directly here for simplicity in transaction)
		// Better to use the Repo in a clean way, but let's implement the logic
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

	return c.JSON(fiber.Map{
		"status": "success", 
		"gold": stats.Gold,
		"player_stats": stats,
	})
}
