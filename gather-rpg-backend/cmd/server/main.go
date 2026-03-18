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

	// WebSocket Hub
	hub := gameWS.NewHub(presenceService, roomService, movementService, peerService, combatService)
	go hub.Run()

	// Handlers
	wsHandler := handlers.NewWSHandler(hub)
	authHandler := handlers.NewAuthHandler(authService)
	roomHandler := handlers.NewRoomHandler(roomService)
	adminHandler := handlers.NewAdminHandler()
	friendHandler := handlers.NewFriendHandler(friendService, hub)
	learningHandler := handlers.NewLearningHandler(learningService)

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

	// Map config read (accessible to all authenticated users)
	app.Get("/maps/config", middleware.Protected(cfg), adminHandler.GetMapConfig)

	// Learning Routes
	learning := app.Group("/learning")
	learning.Get("/challenges/random", learningHandler.GetRandomChallenge)
	learning.Get("/challenges/metadata", learningHandler.GetChallengeMetadata)
	
	// Protected Learning Routes within the same group if possible, or just register individually
	learning.Post("/attempts", middleware.Protected(cfg), learningHandler.RecordAttempt)
	learning.Get("/profile", middleware.Protected(cfg), learningHandler.GetMyProfile)

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
