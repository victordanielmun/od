package handlers

import (
	"encoding/json"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AdminHandler struct{}

func NewAdminHandler() *AdminHandler {
	return &AdminHandler{}
}

// SaveMapConfig upserts the wall configuration for a scene.
// POST /admin/maps
// Body: { "scene_key": "lobby", "walls_json": "[{\"x\":400,\"y\":600,...}]", "map_data": "{\"width\":2000,\"height\":2000}" }
func (h *AdminHandler) SaveMapConfig(c *fiber.Ctx) error {
	type request struct {
		SceneKey  string      `json:"scene_key"`
		WallsJSON string      `json:"walls_json"`
		MapData   interface{} `json:"map_data"` // Can be string or object
		IsPublic  *bool       `json:"is_public"`
		MaxUsers  *int        `json:"max_users"`
	}

	var req request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.SceneKey == "" || req.WallsJSON == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "scene_key and walls_json are required"})
	}

	userID, _ := c.Locals("user_id").(string)
	parsedUID, _ := uuid.Parse(userID)

	var mapDataStr string
	if req.MapData != nil {
		if str, ok := req.MapData.(string); ok {
			mapDataStr = str
		} else {
			importJson, _ := json.Marshal(req.MapData)
			mapDataStr = string(importJson)
		}
	}

	var existing models.MapConfig
	result := database.DB.Where("scene_key = ?", req.SceneKey).First(&existing)

	if result.Error != nil {
		// Create new
		cfg := models.MapConfig{
			SceneKey:  req.SceneKey,
			WallsJSON: req.WallsJSON,
			MapData:   mapDataStr,
			UpdatedBy: parsedUID,
		}
		if req.IsPublic != nil {
			cfg.IsPublic = *req.IsPublic
		}
		if req.MaxUsers != nil {
			cfg.MaxUsers = *req.MaxUsers
		}
		if err := database.DB.Create(&cfg).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusCreated).JSON(cfg)
	}

	// Update existing — use explicit map so GORM writes is_public=false and max_users=0 correctly.
	// database.DB.Save(&existing) would silently skip zero-value fields.
	updates := map[string]interface{}{
		"walls_json": req.WallsJSON,
		"updated_by": parsedUID,
	}
	if mapDataStr != "" {
		updates["map_data"] = mapDataStr
	}
	if req.IsPublic != nil {
		updates["is_public"] = *req.IsPublic
	}
	if req.MaxUsers != nil {
		updates["max_users"] = *req.MaxUsers
	}
	if err := database.DB.Model(&existing).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Re-fetch to return the updated record
	database.DB.Where("scene_key = ?", req.SceneKey).First(&existing)
	return c.JSON(existing)
}

// GetMapConfig retrieves the wall configuration for a scene.
// GET /maps/config?scene_key=lobby
func (h *AdminHandler) GetMapConfig(c *fiber.Ctx) error {
	sceneKey := c.Query("scene_key")
	if sceneKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "scene_key query param is required"})
	}

	var cfg models.MapConfig
	if err := database.DB.Where("scene_key = ?", sceneKey).First(&cfg).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Map config not found for scene: " + sceneKey})
	}

	return c.JSON(cfg)
}

// UpdateMapConfig updates the configuration for a scene by ID.
// PUT /admin/maps/:id
func (h *AdminHandler) UpdateMapConfig(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	type request struct {
		SceneKey  string      `json:"scene_key"`
		MapData   interface{} `json:"map_data"` // Can be string or object
		WallsJSON string      `json:"walls_json"`
		IsPublic  *bool       `json:"is_public"`
		MaxUsers  *int        `json:"max_users"`
	}

	var req request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid UUID"})
	}

	var mapConfig models.MapConfig
	if err := database.DB.First(&mapConfig, uid).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Map not found"})
	}

	// Update fields if present
	if req.SceneKey != "" {
		mapConfig.SceneKey = req.SceneKey
	}
	if req.WallsJSON != "" {
		mapConfig.WallsJSON = req.WallsJSON
	}
	if req.MapData != nil {
		// Ensure it's stored as string
		if str, ok := req.MapData.(string); ok {
			mapConfig.MapData = str
		} else {
			// Marshal
			importJson, _ := json.Marshal(req.MapData)
			mapConfig.MapData = string(importJson)
		}
	}
	if req.IsPublic != nil {
		mapConfig.IsPublic = *req.IsPublic
	}
	if req.MaxUsers != nil {
		mapConfig.MaxUsers = *req.MaxUsers
	}

	userID, _ := c.Locals("user_id").(string)
	parsedUpdater, _ := uuid.Parse(userID)

	// Build explicit update map so GORM writes zero-values (is_public=false, max_users=0)
	updates := map[string]interface{}{
		"updated_by": parsedUpdater,
	}
	if req.SceneKey != "" {
		updates["scene_key"] = req.SceneKey
	}
	if req.WallsJSON != "" {
		updates["walls_json"] = req.WallsJSON
	}
	if req.MapData != nil {
		if str, ok := req.MapData.(string); ok {
			updates["map_data"] = str
		} else {
			importJson, _ := json.Marshal(req.MapData)
			updates["map_data"] = string(importJson)
		}
	}
	if req.IsPublic != nil {
		updates["is_public"] = *req.IsPublic
	}
	if req.MaxUsers != nil {
		updates["max_users"] = *req.MaxUsers
	}

	if err := database.DB.Model(&mapConfig).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Re-fetch to return full updated record
	database.DB.First(&mapConfig, uid)
	return c.JSON(mapConfig)
}

// ListMapConfigs retrieves a list of all map configurations (lightweight).
// GET /admin/maps
func (h *AdminHandler) ListMapConfigs(c *fiber.Ctx) error {
	var maps []models.MapConfig
	// Return map_data so frontend can see width/height, but omit walls_json to keep response lightweight
	if err := database.DB.Omit("walls_json").Find(&maps).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(maps)
}
