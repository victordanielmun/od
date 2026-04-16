package main

import (
	"log"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/handlers"
	"gather-rpg-backend/internal/middleware"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"gather-rpg-backend/internal/services"
	gameWS "gather-rpg-backend/internal/websocket"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/adaptor"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	cfg := config.LoadConfig()

	// Database
	database.ConnectPostgres(cfg)
	database.ConnectRedis(cfg)

	// Ensure database enums are updated before migration
	database.EnsureEnumValues()

	// Auto-migrate
	if err := database.DB.AutoMigrate(
		&models.User{},
		&models.Room{},
		&models.PlayerStats{},
		&models.Enemy{},
		&models.Skill{},
		&models.Item{},
		&models.Inventory{},
		&models.PlayerSkill{},
		&models.FriendRequest{},
		&models.Friendship{},
		&models.MapConfig{},
		// ── English Learning System ──────────────────────────────────────
		&models.LearningChallenge{},
		&models.UserChallengeAttempt{},
		&models.UserLearningProfile{},
		// ── NPC AI & Mission System (v2) ──────────────────────────────────
		&models.Shop{},
		&models.NPCDefinition{},
		&models.NPCTemplate{},
		&models.Mission{},
		&models.MissionTask{},
		&models.NPCMissionRole{},
		&models.NPCRoomInstance{},
		&models.Conversation{},
		&models.ConversationMessage{},
		&models.PlayerMissionProgress{},
		&models.PlayerLearningStats{},
		&models.MapPickup{},
		&models.PlayerNPCGift{},
	); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Seed static data
	database.SeedAdminUser()
	database.SeedLearningChallenges()

	// Repositories & Services
	userRepo := repository.NewUserRepository()
	authService := services.NewAuthService(userRepo)
	friendService := services.NewFriendService(userRepo)

	roomRepo := repository.NewRoomRepository()
	roomService := services.NewRoomService(roomRepo)
	presenceService := services.NewPresenceService(userRepo)
	movementService := services.NewMovementService()
	peerService := services.NewPeerService(movementService)
	combatService := services.NewCombatService(database.DB, database.RedisClient)

	learningRepo := repository.NewLearningRepository()
	learningService := services.NewLearningService(learningRepo)

	// NPC & Mission System (v2)
	inventoryRepo := repository.NewInventoryRepository()
	npcRepo := repository.NewNPCRepository()
	missionRepo := repository.NewMissionRepository()
	npcService := services.NewNPCService(npcRepo, missionRepo)
	missionService := services.NewMissionService(missionRepo, inventoryRepo)
	deepSeekClient := services.NewDeepSeekClient(cfg.DeepSeekAPIKey, cfg.DeepSeekModel)
	dialogueService := services.NewDialogueService(npcRepo, missionRepo, missionService, deepSeekClient)

	// WebSocket Hub
	hub := gameWS.NewHub(presenceService, roomService, movementService, peerService, combatService)
	go hub.Run()

	// Handlers
	wsHandler := handlers.NewWSHandler(hub)
	authHandler := handlers.NewAuthHandler(authService)
	roomHandler := handlers.NewRoomHandler(roomService)
	adminHandler := handlers.NewAdminHandler(npcService)
	friendHandler := handlers.NewFriendHandler(friendService, hub)
	learningHandler := handlers.NewLearningHandler(learningService)
	dialogueHandler := handlers.NewDialogueHandler(dialogueService)
	missionHandler := handlers.NewMissionHandler(missionService)
	npcHandler := handlers.NewNPCHandler(npcService, deepSeekClient)
	missionAdminHandler := handlers.NewMissionAdminHandler(missionService)
	inventoryService := services.NewInventoryService(inventoryRepo)
	inventoryHandler := handlers.NewInventoryHandler(inventoryService)
	shopHandler := handlers.NewShopHandler(inventoryService)
	pickupHandler := handlers.NewMapPickupHandler(inventoryService)

	// App
	app := fiber.New()
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	// Routes
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Get("/metrics", adaptor.HTTPHandler(promhttp.Handler()))

	// Auth Routes
	auth := app.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/guest", authHandler.GuestLogin)

	// Room Routes
	rooms := app.Group("/rooms", middleware.Protected(cfg))
	rooms.Get("/", roomHandler.GetPublicRooms)
	rooms.Post("/", roomHandler.CreateRoom)
	rooms.Get("/:id", roomHandler.GetRoom)
	rooms.Get("/:id/npcs", npcHandler.GetRoomNPCs)

	// Friend Routes
	friends := app.Group("/friends", middleware.Protected(cfg))
	friends.Get("/", friendHandler.ListFriends)
	friends.Delete("/:id", friendHandler.RemoveFriend)
	friends.Get("/requests", friendHandler.ListRequests)
	friends.Post("/requests", friendHandler.SendRequest)
	friends.Post("/requests/:id/accept", friendHandler.AcceptRequest)
	friends.Post("/requests/:id/reject", friendHandler.RejectRequest)

	// Admin Routes
	admin := app.Group("/admin", middleware.Protected(cfg), middleware.AdminOnly())
	admin.Get("/maps", adminHandler.ListMapConfigs)
	admin.Post("/maps", adminHandler.SaveMapConfig)
	admin.Put("/maps/:id", adminHandler.UpdateMapConfig)
	admin.Post("/npcs", npcHandler.CreateNPCTemplate)
	admin.Put("/npcs/:id", npcHandler.UpdateNPCTemplate)
	admin.Delete("/npcs/:id", npcHandler.DeleteNPCTemplate)
	admin.Get("/npc-definitions", npcHandler.GetNPCDefinitions)
	admin.Post("/npc-definitions", npcHandler.CreateNPCDefinition)
	admin.Put("/npc-definitions/:id", npcHandler.UpdateNPCDefinition)
	admin.Delete("/npc-definitions/:id", npcHandler.DeleteNPCDefinition)
	admin.Post("/ai-test", npcHandler.TestAI)
	
	// Item & Shop Admin Routes
	admin.Get("/items", adminHandler.ListItems)
	admin.Get("/enemies", adminHandler.ListEnemies)
	admin.Get("/item-sprites", adminHandler.ListItemSprites)
	admin.Post("/items", adminHandler.CreateItem)
	admin.Put("/items/:id", adminHandler.UpdateItem)
	admin.Delete("/items/:id", adminHandler.DeleteItem)
	admin.Get("/shops", adminHandler.ListShops)
	admin.Post("/shops", adminHandler.CreateShop)
	admin.Put("/shops/:id", adminHandler.UpdateShop)
	admin.Delete("/shops/:id", adminHandler.DeleteShop)

	// Mission Admin Routes
	admin.Get("/missions", missionAdminHandler.ListMissions)
	admin.Post("/missions", missionAdminHandler.CreateMission)
	admin.Put("/missions/:id", missionAdminHandler.UpdateMission)
	admin.Delete("/missions/:id", missionAdminHandler.DeleteMission)
	admin.Get("/missions/:id/tasks", missionAdminHandler.ListTasks)
	admin.Post("/missions/:id/tasks", missionAdminHandler.CreateTask)
	admin.Put("/tasks/:id", missionAdminHandler.UpdateTask)
	admin.Delete("/tasks/:id", missionAdminHandler.DeleteTask)
	admin.Get("/missions/:id/roles", missionAdminHandler.ListRoles)

	// Map config read (accessible to all authenticated users)
	app.Get("/maps/config", middleware.Protected(cfg), adminHandler.GetMapConfig)

	// Learning Routes
	learning := app.Group("/learning")
	learning.Get("/challenges/random", learningHandler.GetRandomChallenge)
	learning.Get("/challenges/metadata", learningHandler.GetChallengeMetadata)
	
	// Protected Learning Routes within the same group if possible, or just register individually
	learning.Post("/attempts", middleware.Protected(cfg), learningHandler.RecordAttempt)
	learning.Get("/profile", middleware.Protected(cfg), learningHandler.GetMyProfile)

	// NPC Dialogue Routes
	npc := app.Group("/npc", middleware.Protected(cfg))
	npc.Post("/dialogue", dialogueHandler.ProcessInput)

	// Mission Routes
	missions := app.Group("/missions", middleware.Protected(cfg))
	missions.Get("/scene/:key", missionHandler.GetMissionsByScene)
	missions.Get("/npc/:id", missionHandler.GetMissionsByNPC)

	// Inventory Routes
	inventory := app.Group("/inventory", middleware.Protected(cfg))
	inventory.Get("/", inventoryHandler.GetInventory)
	inventory.Post("/test-add", inventoryHandler.AddTestItem)
	inventory.Post("/pickup/:id", pickupHandler.Pickup)
	inventory.Get("/pickups/:scene", pickupHandler.GetPickups)

	// Shop Routes
	shop := app.Group("/shop", middleware.Protected(cfg))
	shop.Post("/buy", shopHandler.BuyItem)
	shop.Get("/npc/:id/items", shopHandler.GetNPCItems)

	// WS Route
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// Apply Auth Middleware specifically for WS
	app.Get("/ws", middleware.Protected(cfg), websocket.New(func(c *websocket.Conn) {
		wsHandler.HandleWS(c)
	}))

	log.Fatal(app.Listen(":" + cfg.ServerPort))
}
