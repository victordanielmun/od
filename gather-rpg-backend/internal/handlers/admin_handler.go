package handlers

import (
	"fmt"
	"encoding/json"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"strconv"
	"os"
	"path/filepath"
	"log"
)

type AdminHandler struct {
	NPCService *services.NPCService
}

func NewAdminHandler(npcService *services.NPCService) *AdminHandler {
	return &AdminHandler{NPCService: npcService}
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

	// SYNC NPCs: Parse walls_json and update templates
	if h.NPCService != nil {
		h.NPCService.SyncTemplatesFromMap(req.SceneKey, req.WallsJSON)
	}

	// SYNC Pickups
	h.syncMapPickups(req.SceneKey, req.WallsJSON)

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
	log.Printf("[AdminHandler] UpdateMapConfig received for map ID: %s", id)
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	type request struct {
		SceneKey  *string     `json:"scene_key"`
		MapData   interface{} `json:"map_data"` // Can be string or object
		WallsJSON *string     `json:"walls_json"`
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

	// Update fields if present in struct (pointers for optionality)
	if req.SceneKey != nil {
		mapConfig.SceneKey = *req.SceneKey
	}
	if req.WallsJSON != nil {
		mapConfig.WallsJSON = *req.WallsJSON
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
	if req.SceneKey != nil {
		updates["scene_key"] = *req.SceneKey
	}
	if req.WallsJSON != nil {
		updates["walls_json"] = *req.WallsJSON
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

	// SYNC NPCs: Parse walls_json and update templates
	if h.NPCService != nil {
		h.NPCService.SyncTemplatesFromMap(mapConfig.SceneKey, mapConfig.WallsJSON)
	}

	// SYNC Pickups
	h.syncMapPickups(mapConfig.SceneKey, mapConfig.WallsJSON)

	return c.JSON(mapConfig)
}

// ListMapConfigs retrieves a list of all map configurations (lightweight).
// GET /admin/maps
func (h *AdminHandler) ListMapConfigs(c *fiber.Ctx) error {
	var maps []models.MapConfig
	// Lightweight list: Exclude walls_json and map_data to save bandwidth
	if err := database.DB.Select("id", "scene_key", "is_public", "max_users", "updated_by", "created_at", "updated_at").Find(&maps).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(maps)
}

// DeleteMapConfig deletes a map configuration by ID and cleans up associated data.
// DELETE /admin/maps/:id
func (h *AdminHandler) DeleteMapConfig(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid UUID"})
	}

	// 1. Fetch map to get scene_key
	var mapConfig models.MapConfig
	if err := database.DB.First(&mapConfig, uid).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Map not found"})
	}

	sceneKey := mapConfig.SceneKey

	// 2. Delete the map configuration
	if err := database.DB.Delete(&mapConfig).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete map: " + err.Error()})
	}

	// 3. Clean up associated NPC Templates
	database.DB.Where("scene_key = ?", sceneKey).Delete(&models.NPCTemplate{})

	// 4. Clean up associated Pickups
	database.DB.Where("scene_key = ?", sceneKey).Delete(&models.MapPickup{})

	// 5. Clean up associated Missions (be careful, might affect other things)
	database.DB.Where("scene_key = ?", sceneKey).Delete(&models.Mission{})

	log.Printf("[AdminHandler] Map '%s' and its associations deleted by admin", sceneKey)

	return c.SendStatus(fiber.StatusNoContent)
}
// --- Item Admin CRUD ---

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

func (h *AdminHandler) ListEnemies(c *fiber.Ctx) error {
	var enemies []models.Enemy
	if err := database.DB.Order("created_at desc").Find(&enemies).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(enemies)
}
func (h *AdminHandler) SendStatus(c *fiber.Ctx) error {
	return c.SendStatus(204)
}

// --- Shop Admin CRUD ---

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
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if len(req.ItemIDs) > 0 {
		var items []models.Item
		database.DB.Find(&items, "id IN ?", req.ItemIDs)
		database.DB.Model(&shop).Association("Items").Replace(items)
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
	database.DB.Model(&shop).Association("Items").Replace(items)

	return c.JSON(shop)
}

func (h *AdminHandler) DeleteShop(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	if err := database.DB.Delete(&models.Shop{}, id).Error; err != nil {
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
			"error": "Sprites directory not found",
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
func (h *AdminHandler) syncMapPickups(sceneKey string, wallsJSON string) error {
	type pickupData struct {
		X        float64 `json:"x"`
		Y        float64 `json:"y"`
		ItemID   string  `json:"itemId"`
		Quantity int     `json:"quantity"`
	}
	type mapConfig struct {
		Pickups []pickupData `json:"pickups"`
	}

	var config mapConfig
	if err := json.Unmarshal([]byte(wallsJSON), &config); err != nil {
		fmt.Printf("[AdminHandler] ERROR: Unmarshaling wallsJSON failed: %v\n", err)
		return err
	}

	fmt.Printf("[AdminHandler] syncMapPickups: Found %d pickups in JSON\n", len(config.Pickups))
	for i, p := range config.Pickups {
		fmt.Printf("[AdminHandler]   #%d: ItemID=%s, Coords=(%.1f, %.1f), Qty=%d\n", i, p.ItemID, p.X, p.Y, p.Quantity)
	}

	// 1. Get current pickups for this scene
	var existing []models.MapPickup
	database.DB.Where("scene_key = ?", sceneKey).Find(&existing)

	// 2. Track which were matched
	matchedIDs := make(map[uuid.UUID]bool)

	for _, p := range config.Pickups {
		if p.ItemID == "" {
			continue
		}
		itemUUID, err := uuid.Parse(p.ItemID)
		if err != nil || itemUUID == uuid.Nil {
			fmt.Printf("[AdminHandler] WARNING: Invalid item ID format: %s\n", p.ItemID)
			continue
		}

		// Find existing at same approx coords
		var found *models.MapPickup
		for i := range existing {
			// Skip if already claimed by another pickup in this sync cycle
			if matchedIDs[existing[i].ID] {
				continue
			}

			// Must be same item type
			if existing[i].ItemID != itemUUID {
				continue
			}

			// Two-pass matching: Exact or within a larger epsilon (20px) to survive minor shifts in editor
			// Items often shift slightly when grid settings or snapping change
			distX := existing[i].X - p.X
			distY := existing[i].Y - p.Y
			if (distX > -20 && distX < 20) && (distY > -20 && distY < 20) {
				found = &existing[i]
				break
			}
		}

		if found != nil {
			// Stable match found — UPDATE instead of recreate
			fmt.Printf("[AdminHandler]   MATCH FOUND: Stabilized Pickup ID %s (Item: %s)\n", found.ID, itemUUID)
			found.X = p.X
			found.Y = p.Y
			found.Quantity = p.Quantity
			database.DB.Save(found)
			matchedIDs[found.ID] = true
		} else {
			// Create new record only if No match found
			fmt.Printf("[AdminHandler]   NEW PICKUP: Creating for item %s at (%.1f, %.1f)\n", itemUUID, p.X, p.Y)
			newPickup := models.MapPickup{
				SceneKey: sceneKey,
				ItemID:   itemUUID,
				X:        p.X,
				Y:        p.Y,
				Quantity: p.Quantity,
			}
			if err := database.DB.Create(&newPickup).Error; err == nil {
				matchedIDs[newPickup.ID] = true
			}
		}
	}

	// 3. Delete orphans (not in current JSON anymore)
	for _, p := range existing {
		if !matchedIDs[p.ID] {
			database.DB.Delete(&p)
		}
	}

	return nil
}
