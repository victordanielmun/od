package handlers

import (
	"encoding/json"
	"fmt"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"log"
	"strconv"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// mapConfigCache serves map configs from memory. They are small (a few KB) and change
// only when an admin edits a map, but they're read on every teleport/map entry — over
// a remote DB a transient stall there made a single map load take ~20s. Reads hit
// memory; writes (save/update/delete) invalidate the affected scene so the next read
// refreshes from the DB.
var mapConfigCache sync.Map // scene_key(string) -> models.MapConfig

func invalidateMapConfigCache(sceneKey string) {
	if sceneKey != "" {
		mapConfigCache.Delete(sceneKey)
	}
}

// WarmMapConfigCache loads every map config into memory at startup so even the FIRST
// teleport/map entry is served from cache and never waits on the remote DB. Cheap: a
// handful of small rows. Safe to run in a goroutine.
func WarmMapConfigCache() {
	var cfgs []models.MapConfig
	if err := database.DB.Find(&cfgs).Error; err != nil {
		fmt.Printf("[MapConfigCache] warm failed: %v\n", err)
		return
	}
	for i := range cfgs {
		mapConfigCache.Store(cfgs[i].SceneKey, cfgs[i])
	}
	fmt.Printf("[MapConfigCache] Warmed %d map configs.\n", len(cfgs))
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
		existing.MapData = mapDataStr
	}

	// Sync Pickups
	if err := h.syncMapPickups(req.SceneKey, req.WallsJSON); err != nil {
		fmt.Printf("[AdminHandler] WARNING: Failed to sync pickups: %v\n", err)
	}

	invalidateMapConfigCache(req.SceneKey)
	return c.JSON(existing)
}

// GetMapConfig retrieves the wall configuration for a scene.
// GET /maps/config?scene_key=lobby
func (h *AdminHandler) GetMapConfig(c *fiber.Ctx) error {
	sceneKey := c.Query("scene_key")
	if sceneKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "scene_key query param is required"})
	}

	if cached, ok := mapConfigCache.Load(sceneKey); ok {
		return c.JSON(cached.(models.MapConfig))
	}

	var cfg models.MapConfig
	if err := database.DB.Where("scene_key = ?", sceneKey).First(&cfg).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Map config not found for scene: " + sceneKey})
	}

	mapConfigCache.Store(sceneKey, cfg)
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
		// PreviewImage: nombre del PNG del mapa (subido a /admin/world-art). Se
		// muestra en el catálogo de mundos y en la lista de mapas del admin.
		PreviewImage *string `json:"preview_image"`
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
	if req.PreviewImage != nil {
		updates["preview_image"] = *req.PreviewImage
	}

	if err := database.DB.Model(&mapConfig).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Re-fetch to return full updated record
	database.DB.First(&mapConfig, uid)
	invalidateMapConfigCache(mapConfig.SceneKey)

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
			mapConfig.MapData = mapDataStr
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
	invalidateMapConfigCache(sceneKey)

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
		X                float64 `json:"x"`
		Y                float64 `json:"y"`
		NPCID            string  `json:"npcId"`
		WaveNum          int     `json:"waveNum"`
		HP               int     `json:"hp"`
		Speed            float64 `json:"speed"`
		Damage           int     `json:"damage"`
		AttackRate       int     `json:"attackRate"`
		Type             string  `json:"type"`
		ProjectileSprite string  `json:"projectileSprite"`
		ManaMax          int     `json:"manaMax"`
		ManaRegen        int     `json:"manaRegen"`
		HPRegen          int     `json:"hpRegen"`
		CardFailHealPct  int     `json:"cardFailHealPct"`
	}
	type wallsConfig struct {
		EnemySpawns []enemySpawnData `json:"enemySpawns"`
	}

	var wCfg wallsConfig
	if err := json.Unmarshal([]byte(wallsJSON), &wCfg); err != nil {
		return "", err
	}

	// Preserve every existing map_data field and only replace the enemies key.
	// This avoids losing editor metadata like defaultSpawnX/defaultSpawnY/bgmTrack.
	mData := make(map[string]json.RawMessage)
	if currentMapDataJSON != "" {
		if err := json.Unmarshal([]byte(currentMapDataJSON), &mData); err != nil {
			mData = make(map[string]json.RawMessage)
		}
	}

	// Convert editor spawns to model spawns
	var spawns []models.EnemySpawn
	for _, s := range wCfg.EnemySpawns {
		spriteID := "1" // Default

		// Attempt to look up the template to get the actual sprite/asset ID
		var tmpl models.NPCTemplate
		// Check if NPCID is a valid UUID (which matches an Enemy ID)
		if enemyUUID, err := uuid.Parse(s.NPCID); err == nil {
			var enemy models.Enemy
			if err := database.DB.Where("id = ?", enemyUUID).First(&enemy).Error; err == nil {
				spriteID = enemy.SpriteKey
			} else {
				fmt.Printf("[AdminHandler] WARNING: Enemy not found for UUID %s, using default sprite '1'\n", s.NPCID)
			}
		} else if id, err := strconv.Atoi(s.NPCID); err == nil {
			// Check if NPCID is a numeric ID (uint) - legacy fallback
			if err := database.DB.Preload("NPCDefinition").Where("id = ?", id).First(&tmpl).Error; err == nil {
				spriteID = tmpl.NPCDefinition.Sprite
			}
		} else {
			// If not a number nor a UUID, it might be something else
			fmt.Printf("[AdminHandler] WARNING: NPCID %s is not numeric nor a valid UUID, using default sprite '1'\n", s.NPCID)
		}

		spawns = append(spawns, models.EnemySpawn{
			NPCID:            s.NPCID,
			SpawnX:           s.X,
			SpawnY:           s.Y,
			WaveNum:          s.WaveNum,
			HP:               s.HP,
			Speed:            s.Speed,
			Damage:           s.Damage,
			AttackRate:       s.AttackRate,
			Type:             s.Type,
			ProjectileSprite: s.ProjectileSprite,
			ManaMax:          s.ManaMax,
			ManaRegen:        s.ManaRegen,
			HPRegen:          s.HPRegen,
			CardFailHealPct:  s.CardFailHealPct,
			EnemyID:          uuid.New(),
			SpriteID:         spriteID,
		})
	}

	enemyBytes, err := json.Marshal(spawns)
	if err != nil {
		return currentMapDataJSON, err
	}
	mData["enemies"] = enemyBytes

	updatedBytes, err := json.Marshal(mData)
	if err != nil {
		return currentMapDataJSON, err
	}

	fmt.Printf("[AdminHandler] syncMapEnemies: Synced %d enemies to MapData\n", len(spawns))
	return string(updatedBytes), nil
}
