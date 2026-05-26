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
	"encoding/csv"
	"strings"
	"io"
	"github.com/lib/pq"
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
	// Sync NPC Templates
	if err := h.NPCService.SyncTemplatesFromMap(req.SceneKey, req.WallsJSON); err != nil {
		fmt.Printf("[AdminHandler] WARNING: Failed to sync NPC templates: %v\n", err)
	}

	// NEW: Sync Enemies from walls_json to MapData
	updatedMapData, err := h.syncMapEnemies(req.WallsJSON, mapDataStr)
	if err == nil {
		mapDataStr = updatedMapData
		database.DB.Model(&existing).Update("map_data", mapDataStr)
	}

	// Sync Pickups
	if err := h.syncMapPickups(req.SceneKey, req.WallsJSON); err != nil {
		fmt.Printf("[AdminHandler] WARNING: Failed to sync pickups: %v\n", err)
	}

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
	var mapDataStr string
	if req.MapData != nil {
		// Ensure it's stored as string
		if str, ok := req.MapData.(string); ok {
			mapDataStr = str
			mapConfig.MapData = str
		} else {
			// Marshal
			importJson, _ := json.Marshal(req.MapData)
			mapDataStr = string(importJson)
			mapConfig.MapData = mapDataStr
		}
	} else {
		mapDataStr = mapConfig.MapData
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
		updates["map_data"] = mapDataStr
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
	wallsJSON := mapConfig.WallsJSON
	if wallsJSON != "" {
		if err := h.NPCService.SyncTemplatesFromMap(mapConfig.SceneKey, wallsJSON); err != nil {
			fmt.Printf("[AdminHandler] WARNING: Failed to sync NPC templates: %v\n", err)
		}
		if err := h.syncMapPickups(mapConfig.SceneKey, wallsJSON); err != nil {
			fmt.Printf("[AdminHandler] WARNING: Failed to sync pickups: %v\n", err)
		}

		// NEW: Sync Enemies from walls_json to MapData
		updatedMapData, err := h.syncMapEnemies(wallsJSON, mapDataStr)
		if err == nil {
			mapDataStr = updatedMapData
			database.DB.Model(&mapConfig).Update("map_data", mapDataStr)
		}
	}

	return c.JSON(mapConfig)
}

// ListMapConfigs retrieves a list of all map configurations (lightweight).
// GET /admin/maps
func (h *AdminHandler) ListMapConfigs(c *fiber.Ctx) error {
	var maps []models.MapConfig
	// Lightweight list: Exclude walls_json (large) but include map_data for editor width/height settings
	if err := database.DB.Select("id", "scene_key", "is_public", "max_users", "map_data", "updated_by", "created_at", "updated_at").Find(&maps).Error; err != nil {
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
		return c.Status(500).JSON(fiber.Map{"error": "Invalid request"})
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

func (h *AdminHandler) syncMapEnemies(wallsJSON string, currentMapDataJSON string) (string, error) {
	type enemySpawnData struct {
		X       float64 `json:"x"`
		Y       float64 `json:"y"`
		NPCID   string  `json:"npcId"`
		WaveNum int     `json:"waveNum"`
		HP      int     `json:"hp"`
		Speed   float64 `json:"speed"`
		Damage  int     `json:"damage"`
		AttackRate int  `json:"attackRate"`
	}
	type wallsConfig struct {
		EnemySpawns []enemySpawnData `json:"enemySpawns"`
	}

	var wCfg wallsConfig
	if err := json.Unmarshal([]byte(wallsJSON), &wCfg); err != nil {
		return "", err
	}

	var mData models.MapData
	if currentMapDataJSON != "" {
		_ = json.Unmarshal([]byte(currentMapDataJSON), &mData)
	}

	// Convert editor spawns to model spawns
	var spawns []models.EnemySpawn
	for _, s := range wCfg.EnemySpawns {
		spriteID := "1" // Default
		
		// Attempt to look up the template to get the actual sprite/asset ID
		var tmpl models.NPCTemplate
		// Check if NPCID is a numeric ID (uint)
		if id, err := strconv.Atoi(s.NPCID); err == nil {
			if err := database.DB.Preload("NPCDefinition").Where("id = ?", id).First(&tmpl).Error; err == nil {
				spriteID = tmpl.NPCDefinition.Sprite
			}
		} else {
			// If not a number, it might be a UUID string or something else
			fmt.Printf("[AdminHandler] WARNING: NPCID %s is not numeric, using default sprite '1'\n", s.NPCID)
		}

		spawns = append(spawns, models.EnemySpawn{
			NPCID:    s.NPCID,
			SpawnX:   s.X,
			SpawnY:   s.Y,
			WaveNum:  s.WaveNum,
			HP:       s.HP,
			Speed:    s.Speed,
			Damage:   s.Damage,
			AttackRate: s.AttackRate,
			EnemyID:  uuid.New(), 
			SpriteID: spriteID,
		})
	}

	mData.Enemies = spawns
	
	updatedBytes, err := json.Marshal(mData)
	if err != nil {
		return currentMapDataJSON, err
	}

	fmt.Printf("[AdminHandler] syncMapEnemies: Synced %d enemies to MapData\n", len(spawns))
	return string(updatedBytes), nil
}

// --- Learning Challenge Admin CRUD ---

// ListChallenges retrieves all learning challenges.
// GET /admin/challenges
func (h *AdminHandler) ListChallenges(c *fiber.Ctx) error {
	var challenges []models.LearningChallenge
	if err := database.DB.Order("created_at desc").Find(&challenges).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(challenges)
}

// CreateChallenge creates a new learning challenge.
// POST /admin/challenges
func (h *AdminHandler) CreateChallenge(c *fiber.Ctx) error {
	var challenge models.LearningChallenge
	if err := c.BodyParser(&challenge); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if challenge.ID == uuid.Nil {
		challenge.ID = uuid.New()
	}

	if err := database.DB.Create(&challenge).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(challenge)
}

// UpdateChallenge updates an existing challenge.
// PUT /admin/challenges/:id
func (h *AdminHandler) UpdateChallenge(c *fiber.Ctx) error {
	id := c.Params("id")
	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid UUID"})
	}

	var challenge models.LearningChallenge
	if err := database.DB.First(&challenge, "id = ?", uid).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Challenge not found"})
	}

	if err := c.BodyParser(&challenge); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	challenge.ID = uid

	if err := database.DB.Save(&challenge).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(challenge)
}

// DeleteChallenge deletes a challenge by ID.
// DELETE /admin/challenges/:id
func (h *AdminHandler) DeleteChallenge(c *fiber.Ctx) error {
	id := c.Params("id")
	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid UUID"})
	}

	if err := database.DB.Delete(&models.LearningChallenge{}, "id = ?", uid).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ImportChallenges imports challenges from a CSV or JSON file.
// POST /admin/challenges/import
func (h *AdminHandler) ImportChallenges(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to get upload file: " + err.Error()})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to open upload file: " + err.Error()})
	}
	defer file.Close()

	ext := filepath.Ext(fileHeader.Filename)
	var challengesToImport []models.LearningChallenge
	var parseErrors []map[string]interface{}

	if strings.ToLower(ext) == ".json" {
		byteValue, err := io.ReadAll(file)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read JSON file: " + err.Error()})
		}

		type JSONChallenge struct {
			ID               string   `json:"id"`
			Type             string   `json:"type"`
			Question         string   `json:"question"`
			Option1          string   `json:"option_1"`
			Option2          string   `json:"option_2"`
			Option3          string   `json:"option_3"`
			CorrectOption    int      `json:"correct_option"`
			ExplanationES    string   `json:"explanation_es"`
			QuestionES       string   `json:"question_es"`
			Tags             []string `json:"tags"`
			Difficulty       string   `json:"difficulty"`
			LanguageLearning string   `json:"language_learning"`
			Phonetic         string   `json:"phonetic"`
			RequiresAudio    interface{} `json:"requires_audio"` // can be bool or string
			AudioURL         string   `json:"audio_url"`
		}

		var tempChallenges []JSONChallenge
		if err := json.Unmarshal(byteValue, &tempChallenges); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to parse JSON file: " + err.Error()})
		}

		for idx, tc := range tempChallenges {
			rowNum := idx + 1
			
			// Map and validate
			cType := models.ChallengeType(strings.ToLower(strings.TrimSpace(tc.Type)))
			if cType != models.ChallengeTypeVocabulary && cType != models.ChallengeTypeGrammar &&
				cType != models.ChallengeTypePronunciation && cType != models.ChallengeTypeListening {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  fmt.Sprintf("Invalid challenge type '%s'. Must be vocabulary, grammar, pronunciation, or listening", tc.Type),
				})
				continue
			}

			diff := models.DifficultyLevel(strings.ToLower(strings.TrimSpace(tc.Difficulty)))
			if diff == "" {
				diff = models.DifficultyBeginner
			} else if diff != models.DifficultyBeginner && diff != models.DifficultyIntermediate && diff != models.DifficultyAdvanced {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  fmt.Sprintf("Invalid difficulty '%s'. Must be beginner, intermediate, or advanced", tc.Difficulty),
				})
				continue
			}

			lang := strings.TrimSpace(tc.LanguageLearning)
			if lang == "" {
				lang = "english"
			}

			reqAudio := false
			if tc.RequiresAudio != nil {
				switch v := tc.RequiresAudio.(type) {
				case bool:
					reqAudio = v
				case string:
					reqAudio = strings.ToLower(v) == "true" || v == "1" || strings.ToLower(v) == "yes"
				case float64:
					reqAudio = v == 1
				}
			}

			// Validate option presence depending on type
			option1 := strings.TrimSpace(tc.Option1)
			option2 := strings.TrimSpace(tc.Option2)
			option3 := strings.TrimSpace(tc.Option3)

			if strings.TrimSpace(tc.Question) == "" {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  "Question text is required",
				})
				continue
			}

			if option1 == "" {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  "Option 1 is required",
				})
				continue
			}

			if cType != models.ChallengeTypePronunciation {
				if option2 == "" || option3 == "" {
					parseErrors = append(parseErrors, map[string]interface{}{
						"record": rowNum,
						"error":  "Option 2 and Option 3 are required for vocabulary, grammar, and listening types",
					})
					continue
				}
				if tc.CorrectOption < 1 || tc.CorrectOption > 3 {
					parseErrors = append(parseErrors, map[string]interface{}{
						"record": rowNum,
						"error":  "Correct option must be 1, 2, or 3",
					})
					continue
				}
			} else {
				// Pronunciation cards default to 1 correct option
				if tc.CorrectOption == 0 {
					tc.CorrectOption = 1
				}
			}

			var challengeID uuid.UUID
			if tc.ID != "" {
				if parsedUUID, err := uuid.Parse(tc.ID); err == nil {
					challengeID = parsedUUID
				} else {
					challengeID = uuid.New()
				}
			} else {
				challengeID = uuid.New()
			}

			tagsArr := pq.StringArray{}
			for _, tag := range tc.Tags {
				tTrim := strings.ToLower(strings.TrimSpace(tag))
				if tTrim != "" {
					tagsArr = append(tagsArr, tTrim)
				}
			}

			challengesToImport = append(challengesToImport, models.LearningChallenge{
				ID:               challengeID,
				Type:             cType,
				Question:         strings.TrimSpace(tc.Question),
				Option1:          option1,
				Option2:          option2,
				Option3:          option3,
				CorrectOption:    tc.CorrectOption,
				ExplanationES:    strings.TrimSpace(tc.ExplanationES),
				QuestionES:       strings.TrimSpace(tc.QuestionES),
				Tags:             tagsArr,
				Difficulty:       diff,
				LanguageLearning: lang,
				Phonetic:         strings.TrimSpace(tc.Phonetic),
				RequiresAudio:    reqAudio,
				AudioURL:         strings.TrimSpace(tc.AudioURL),
			})
		}
	} else if strings.ToLower(ext) == ".csv" {
		reader := csv.NewReader(file)
		records, err := reader.ReadAll()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to parse CSV file: " + err.Error()})
		}

		if len(records) < 2 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "CSV file must contain a header row and at least one data row"})
		}

		headers := records[0]
		headerMap := make(map[string]int)
		for idx, h := range headers {
			normalized := strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(h), "_", ""), " ", ""))
			headerMap[normalized] = idx
		}

		// Helper function to get value by name safely
		getVal := func(row []string, key string) string {
			if colIdx, ok := headerMap[key]; ok && colIdx < len(row) {
				return strings.TrimSpace(row[colIdx])
			}
			return ""
		}

		for idx, row := range records[1:] {
			rowNum := idx + 2 // 1-indexed plus header row offset
			
			// Map values
			tType := getVal(row, "type")
			qText := getVal(row, "question")
			qES := getVal(row, "questiones")
			opt1 := getVal(row, "option1")
			opt2 := getVal(row, "option2")
			opt3 := getVal(row, "option3")
			corrOptStr := getVal(row, "correctoption")
			explES := getVal(row, "explanationes")
			tagsStr := getVal(row, "tags")
			diffStr := getVal(row, "difficulty")
			langStr := getVal(row, "languagelearning")
			phonStr := getVal(row, "phonetic")
			reqAudStr := getVal(row, "requiresaudio")
			audURL := getVal(row, "audiourl")
			idStr := getVal(row, "id")

			if qText == "" {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  "Question text is required",
				})
				continue
			}

			cType := models.ChallengeType(strings.ToLower(tType))
			if cType != models.ChallengeTypeVocabulary && cType != models.ChallengeTypeGrammar &&
				cType != models.ChallengeTypePronunciation && cType != models.ChallengeTypeListening {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  fmt.Sprintf("Invalid challenge type '%s'. Must be vocabulary, grammar, pronunciation, or listening", tType),
				})
				continue
			}

			diff := models.DifficultyLevel(strings.ToLower(diffStr))
			if diff == "" {
				diff = models.DifficultyBeginner
			} else if diff != models.DifficultyBeginner && diff != models.DifficultyIntermediate && diff != models.DifficultyAdvanced {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  fmt.Sprintf("Invalid difficulty '%s'. Must be beginner, intermediate, or advanced", diffStr),
				})
				continue
			}

			lang := langStr
			if lang == "" {
				lang = "english"
			}

			corrOpt := 0
			if corrOptStr != "" {
				corrOpt, _ = strconv.Atoi(corrOptStr)
			}

			reqAudio := strings.ToLower(reqAudStr) == "true" || reqAudStr == "1" || strings.ToLower(reqAudStr) == "yes"

			if opt1 == "" {
				parseErrors = append(parseErrors, map[string]interface{}{
					"record": rowNum,
					"error":  "Option 1 is required",
				})
				continue
			}

			if cType != models.ChallengeTypePronunciation {
				if opt2 == "" || opt3 == "" {
					parseErrors = append(parseErrors, map[string]interface{}{
						"record": rowNum,
						"error":  "Option 2 and Option 3 are required for vocabulary, grammar, and listening types",
					})
					continue
				}
				if corrOpt < 1 || corrOpt > 3 {
					parseErrors = append(parseErrors, map[string]interface{}{
						"record": rowNum,
						"error":  "Correct option must be 1, 2, or 3",
					})
					continue
				}
			} else {
				if corrOpt == 0 {
					corrOpt = 1
				}
			}

			var challengeID uuid.UUID
			if idStr != "" {
				if parsedUUID, err := uuid.Parse(idStr); err == nil {
					challengeID = parsedUUID
				} else {
					challengeID = uuid.New()
				}
			} else {
				challengeID = uuid.New()
			}

			var tagsArr pq.StringArray
			if tagsStr != "" {
				parts := strings.Split(tagsStr, ",")
				for _, part := range parts {
					tTrim := strings.ToLower(strings.TrimSpace(part))
					if tTrim != "" {
						tagsArr = append(tagsArr, tTrim)
					}
				}
			}

			challengesToImport = append(challengesToImport, models.LearningChallenge{
				ID:               challengeID,
				Type:             cType,
				Question:         qText,
				Option1:          opt1,
				Option2:          opt2,
				Option3:          opt3,
				CorrectOption:    corrOpt,
				ExplanationES:    explES,
				QuestionES:       qES,
				Tags:             tagsArr,
				Difficulty:       diff,
				LanguageLearning: lang,
				Phonetic:         phonStr,
				RequiresAudio:    reqAudio,
				AudioURL:         audURL,
			})
		}
	} else {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Unsupported file format. Please upload a .csv or .json file"})
	}

	// Persist the valid challenges in database
	importedCount := 0
	for _, challenge := range challengesToImport {
		// Use upsert behavior by checking if the record already exists, or just create it
		var existing models.LearningChallenge
		dbResult := database.DB.Where("id = ?", challenge.ID).First(&existing)
		if dbResult.Error == nil {
			// Update
			if err := database.DB.Save(&challenge).Error; err != nil {
				parseErrors = append(parseErrors, map[string]interface{}{
					"question": challenge.Question,
					"error":    "Failed to update database record: " + err.Error(),
				})
			} else {
				importedCount++
			}
		} else {
			// Create
			if err := database.DB.Create(&challenge).Error; err != nil {
				parseErrors = append(parseErrors, map[string]interface{}{
					"question": challenge.Question,
					"error":    "Failed to insert database record: " + err.Error(),
				})
			} else {
				importedCount++
			}
		}
	}

	return c.JSON(fiber.Map{
		"success":  len(parseErrors) == 0,
		"imported": importedCount,
		"failed":   len(parseErrors),
		"errors":   parseErrors,
	})
}
