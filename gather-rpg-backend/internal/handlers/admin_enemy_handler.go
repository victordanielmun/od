package handlers

import (
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func (h *AdminHandler) ListEnemies(c *fiber.Ctx) error {
	var enemies []models.Enemy
	if err := database.DB.Order("created_at desc").Find(&enemies).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(enemies)
}

func (h *AdminHandler) CreateEnemy(c *fiber.Ctx) error {
	var enemy models.Enemy
	if err := c.BodyParser(&enemy); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := database.DB.Create(&enemy).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(enemy)
}

func (h *AdminHandler) UpdateEnemy(c *fiber.Ctx) error {
	id := c.Params("id")
	var enemy models.Enemy
	if err := database.DB.First(&enemy, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Enemy not found"})
	}
	if err := c.BodyParser(&enemy); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := database.DB.Save(&enemy).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(enemy)
}

func (h *AdminHandler) DeleteEnemy(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := database.DB.Delete(&models.Enemy{}, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
