package handlers

import (
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"os"
	"path/filepath"

	"github.com/gofiber/fiber/v2"
)

func (h *AdminHandler) ListItems(c *fiber.Ctx) error {
	var items []models.Item
	if err := database.DB.Order("created_at desc").Find(&items).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(items)
}

func (h *AdminHandler) CreateItem(c *fiber.Ctx) error {
	var item models.Item
	if err := c.BodyParser(&item); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if err := database.DB.Create(&item).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(item)
}

func (h *AdminHandler) UpdateItem(c *fiber.Ctx) error {
	id := c.Params("id")
	var item models.Item
	if err := database.DB.First(&item, "id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Item not found"})
	}
	if err := c.BodyParser(&item); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if err := database.DB.Save(&item).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(item)
}

func (h *AdminHandler) DeleteItem(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(400).JSON(fiber.Map{"error": "id is required"})
	}
	if err := database.DB.Delete(&models.Item{}, "id = ?", id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *AdminHandler) ListSkills(c *fiber.Ctx) error {
	var skills []models.Skill
	if err := database.DB.Order("name asc").Find(&skills).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(skills)
}

func (h *AdminHandler) CreateSkill(c *fiber.Ctx) error {
	var skill models.Skill
	if err := c.BodyParser(&skill); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if err := database.DB.Create(&skill).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(skill)
}

func (h *AdminHandler) UpdateSkill(c *fiber.Ctx) error {
	id := c.Params("id")
	var skill models.Skill
	if err := database.DB.First(&skill, "id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Skill not found"})
	}
	if err := c.BodyParser(&skill); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if err := database.DB.Save(&skill).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(skill)
}

func (h *AdminHandler) DeleteSkill(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(400).JSON(fiber.Map{"error": "id is required"})
	}
	if err := database.DB.Delete(&models.Skill{}, "id = ?", id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

func (h *AdminHandler) ListItemSprites(c *fiber.Ctx) error {
	// Candidate paths based on common execution contexts
	candidates := []string{
		filepath.Join("..", "gather-rpg-frontend", "public", "Items", "sprites"),
		filepath.Join("gather-rpg-frontend", "public", "Items", "sprites"),
		filepath.Join("..", "..", "gather-rpg-frontend", "public", "Items", "sprites"),
	}

	var spritesDir string
	for _, path := range candidates {
		fmt.Printf("[AdminHandler] Checking sprites candidate: %s\n", path)
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			spritesDir = path
			fmt.Printf("[AdminHandler] FOUND sprites directory: %s\n", spritesDir)
			break
		}
	}

	if spritesDir == "" {
		return c.Status(500).JSON(fiber.Map{
			"error":         "Sprites directory not found",
			"checked_paths": candidates,
		})
	}

	files, err := os.ReadDir(spritesDir)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read sprites directory: " + err.Error()})
	}

	var sprites []string
	for _, file := range files {
		if !file.IsDir() && (filepath.Ext(file.Name()) == ".png" || filepath.Ext(file.Name()) == ".jpg") {
			// Frontend expects the full filename (with extension) for the secondary load process
			sprites = append(sprites, file.Name())
		}
	}

	return c.JSON(sprites)
}
