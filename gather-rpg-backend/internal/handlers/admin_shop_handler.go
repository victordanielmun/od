package handlers

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func (h *AdminHandler) ListShops(c *fiber.Ctx) error {
	var shops []models.Shop
	if err := database.DB.Preload("Items").Order("created_at desc").Find(&shops).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(shops)
}

func (h *AdminHandler) CreateShop(c *fiber.Ctx) error {
	type Request struct {
		Name        string      `json:"name"`
		Description string      `json:"description"`
		ItemIDs     []uuid.UUID `json:"item_ids"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	shop := models.Shop{
		Name:        req.Name,
		Description: req.Description,
	}

	if err := database.DB.Create(&shop).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Invalid request"})
	}

	if len(req.ItemIDs) > 0 {
		var items []models.Item
		database.DB.Find(&items, "id IN ?", req.ItemIDs)
		if err := database.DB.Model(&shop).Association("Items").Replace(items); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to set shop items"})
		}
	}

	return c.Status(201).JSON(shop)
}

func (h *AdminHandler) UpdateShop(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var shop models.Shop
	if err := database.DB.First(&shop, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Shop not found"})
	}

	type Request struct {
		Name        string      `json:"name"`
		Description string      `json:"description"`
		ItemIDs     []uuid.UUID `json:"item_ids"`
	}
	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	shop.Name = req.Name
	shop.Description = req.Description
	if err := database.DB.Save(&shop).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Update items association
	var items []models.Item
	if len(req.ItemIDs) > 0 {
		database.DB.Find(&items, "id IN ?", req.ItemIDs)
	}
	if err := database.DB.Model(&shop).Association("Items").Replace(items); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update shop items"})
	}

	return c.JSON(shop)
}

func (h *AdminHandler) DeleteShop(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	if err := database.DB.Delete(&models.Shop{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
