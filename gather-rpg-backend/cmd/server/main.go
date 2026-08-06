package main

import (
	"log"
	"time"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/handlers"
	"gather-rpg-backend/internal/middleware"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/repository"
	"gather-rpg-backend/internal/services"
	"gather-rpg-backend/internal/utils"
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

	// Wire the JWT signing secret from config. Without this the token secret stays
	// at its hardcoded "secret" default, which is public in the source — anyone could
	// forge a token for any user_id/role (including admin). Fail fast in production if
	// it wasn't overridden.
	if cfg.Env == "production" && cfg.JWTSecret == "secret" {
		log.Fatal("JWT_SECRET must be set to a strong, non-default value in production")
	}
	utils.SecretKey = []byte(cfg.JWTSecret)

	// Database
	database.ConnectPostgres(cfg)
	database.ConnectRedis(cfg)

	// Schema setup (enums + AutoMigrate). Skipped when AUTO_MIGRATE=false: against a
	// remote DB the introspection AutoMigrate runs takes minutes, so once the schema
	// is stable you can start fast and only re-enable it after pulling schema changes.
	// Cambios de esquema por DDL directo. Va FUERA del if de AutoMigrate a
	// propósito: son sentencias idempotentes que Postgres resuelve en milisegundos
	// (sin la introspección del esquema entero que hace AutoMigrate y que contra la
	// BD remota tarda minutos), así que pueden correr en todos los arranques.
	// Es el sitio donde añadir un cambio de esquema que deba aplicarse solo.
	database.EnsureFastSchema()

	if !cfg.AutoMigrate {
		log.Println("AUTO_MIGRATE=false → skipping enum sync + AutoMigrate (fast startup)")
	} else {
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
			&models.DirectMessage{},
			&models.MapConfig{},
			// ── English Learning System ──────────────────────────────────────
			&models.LearningChallenge{},
			&models.ChallengeTranslation{},
			&models.UserChallengeAttempt{},
			&models.UserLearningProfile{},
			// ── NPC AI & Mission System (v2) ──────────────────────────────────
			&models.Shop{},
			&models.NPCDefinition{},
			&models.NPCTemplate{},
			&models.NPCDialogueCache{},
			// ── Mundos (agrupación de misiones + examen final) ───────────────
			&models.World{},
			&models.WorldTranslation{},
			&models.PlayerWorldMastery{},
			&models.Mission{},
			&models.MissionTranslation{},
			&models.MissionTask{},
			&models.TaskTranslation{},
			&models.NPCMissionRole{},
			&models.NPCRoomInstance{},
			&models.Conversation{},
			&models.ConversationMessage{},
			&models.PlayerMissionProgress{},
			&models.PlayerLearningStats{},
			&models.MapPickup{},
			&models.MapPickupClaim{},
			&models.PlayerNPCGift{},
			&models.UserBlock{},  // bloqueos entre usuarios (moderación)
			&models.AIPlayer{},   // jugadores con IA (bots de charla); DDL manual en ai_players_schema.sql
			// ── Membership / Billing (Stripe) ────────────────────────────────
			&models.Subscription{},
			&models.InfoTranslation{}, // cache de traducción de letreros de info (por hash de texto)
			// ── WhatsApp Integration System ──────────────────────────────────
			&models.WhatsAppContact{},
			&models.WhatsAppConversation{},
			&models.WhatsAppMessage{},
			&models.WhatsAppReminder{},
			&models.WAConversationPhrase{},
			&models.Motivation{},
			&models.UserMotivationHistory{},
		); err != nil {
			log.Fatalf("Failed to migrate database: %v", err)
		}
	}

	// Los seeds estáticos ya NO corren en el arranque. Ejecútalos a mano una vez
	// con `go run ./cmd/seed` (admin, retos, motivaciones, skills/items, etc.).

	// Repositories & Services
	userRepo := repository.NewUserRepository()
	authService := services.NewAuthService(userRepo)
	friendService := services.NewFriendService(userRepo)

	roomRepo := repository.NewRoomRepository()
	roomService := services.NewRoomService(roomRepo)
	presenceService := services.NewPresenceService(userRepo)
	movementService := services.NewMovementService()
	peerService := services.NewPeerService(movementService)
	combatService := services.NewCombatService(database.DB)

	learningRepo := repository.NewLearningRepository()
	learningService := services.NewLearningService(learningRepo)

	// NPC & Mission System (v2)
	inventoryRepo := repository.NewInventoryRepository()
	npcRepo := repository.NewNPCRepository()
	missionRepo := repository.NewMissionRepository()
	npcService := services.NewNPCService(npcRepo, missionRepo)
	missionService := services.NewMissionService(missionRepo, inventoryRepo)
	subscriptionService := services.NewSubscriptionService(cfg)

	// Mundos: agrupan misiones y definen de qué pool salen las Ninja Cards.
	worldRepo := repository.NewWorldRepository()
	worldService := services.NewWorldService(worldRepo)

	// AI Factory
	var aiApiKey, aiModel string
	switch cfg.AIProvider {
	case "openai":
		aiApiKey = cfg.OpenAIAPIKey
		aiModel = cfg.OpenAIModel
	case "mistral":
		aiApiKey = cfg.MistralAPIKey
		aiModel = cfg.MistralModel
	default: // deepseek
		aiApiKey = cfg.DeepSeekAPIKey
		aiModel = cfg.DeepSeekModel
	}

	llmClient, err := services.NewLLMClient(cfg.AIProvider, aiApiKey, aiModel)
	if err != nil {
		log.Fatalf("Failed to initialize AI Client: %v", err)
	}

	translationService := services.NewTranslationService(llmClient)
	dialogueService := services.NewDialogueService(npcRepo, missionRepo, missionService, llmClient, translationService)
	// Jugadores con IA (bots de charla del lobby). Camino propio, sin relación con
	// el pipeline de NPC/misiones que resuelve dialogueService.
	aiPlayerService := services.NewAIPlayerService(llmClient)

	// TTS Service & Handler
	ttsService := services.NewTTSService(cfg.PiperExePath, cfg.PiperModelsDir, cfg.PiperCacheDir, cfg.TTSCacheTTLDays, cfg.TTSCacheMaxMB)
	ttsHandler := handlers.NewTTSHandler(ttsService)

	// WebSocket Hub
	hub := gameWS.NewHub(presenceService, roomService, movementService, peerService, combatService, missionService, learningService)
	// Acota las Ninja Cards al mundo/examen del jugador. Opcional por diseño: si
	// falta, el combate cae al pool global de siempre.
	hub.WorldService = worldService
	hub.AIPlayerService = aiPlayerService
	go hub.Run()

	// Handlers
	wsHandler := handlers.NewWSHandler(hub)
	authHandler := handlers.NewAuthHandler(authService)
	roomHandler := handlers.NewRoomHandler(roomService)
	adminHandler := handlers.NewAdminHandler(npcService)
	adminAIPlayerHandler := handlers.NewAdminAIPlayerHandler(aiPlayerService)
	friendHandler := handlers.NewFriendHandler(friendService, hub)
	learningHandler := handlers.NewLearningHandler(learningService, translationService)
	dialogueHandler := handlers.NewDialogueHandler(dialogueService, hub)
	missionHandler := handlers.NewMissionHandler(missionService, translationService, hub, subscriptionService, worldService)
	npcHandler := handlers.NewNPCHandler(npcService, llmClient)
	missionAdminHandler := handlers.NewMissionAdminHandler(missionService, translationService, cfg.PrecacheLangs)
	blockHandler := handlers.NewBlockHandler(hub)
	paymentHandler := handlers.NewPaymentHandler(subscriptionService, cfg)
	worldHandler := handlers.NewWorldHandler(worldService, translationService)

	// Warm mission/task translations for the configured player languages in the
	// background, so the first dialogue open (especially a quest master with many
	// missions) doesn't pay the per-mission LLM translation cost.
	go translationService.WarmAllActiveMissions(cfg.PrecacheLangs)
	go translationService.WarmAllWorlds(cfg.PrecacheLangs)

	// Warm the map-config cache so teleports/map entries serve from memory and never
	// wait on the remote DB (a transient stall there made one map load take ~20s).
	go handlers.WarmMapConfigCache()

	// Membership renewals: Wompi has no native subscriptions, so we charge each due
	// payment source ourselves. A daily tick is enough since periods are in days;
	// the first pass runs shortly after boot to catch anything already overdue.
	go func() {
		time.Sleep(1 * time.Minute)
		subscriptionService.ChargeDueSubscriptions()
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			subscriptionService.ChargeDueSubscriptions()
		}
	}()
	inventoryService := services.NewInventoryService(inventoryRepo)
	inventoryHandler := handlers.NewInventoryHandler(inventoryService)
	shopHandler := handlers.NewShopHandler(inventoryService)
	pickupHandler := handlers.NewMapPickupHandler(inventoryService)
	infoArtHandler := handlers.NewInfoArtHandler()
	infoTranslateHandler := handlers.NewInfoTranslateHandler(translationService)
	whatsAppService := services.NewWhatsAppService(cfg)
	whatsAppPhraseService := services.NewWAPhraseService(llmClient)
	whatsAppQueueService := services.NewWhatsAppQueueService(whatsAppService)
	whatsAppQueueService.StartWorker()
	whatsAppSchedulerService := services.NewWhatsAppSchedulerService(whatsAppQueueService, whatsAppPhraseService)
	whatsAppSchedulerService.Start()

	whatsAppHandler := handlers.NewWhatsAppHandler(whatsAppService, whatsAppPhraseService, translationService)
	// App with customized config (50MB body limit for large map JSONs)
	app := fiber.New(fiber.Config{
		BodyLimit: 50 * 1024 * 1024,
	})
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
	auth.Put("/guest/upgrade", middleware.Protected(cfg), authHandler.UpgradeGuest)
	auth.Post("/companion", middleware.Protected(cfg), authHandler.SetCompanion)
	auth.Post("/terms", middleware.Protected(cfg), authHandler.AcceptTerms)
	auth.Put("/sprite", middleware.Protected(cfg), authHandler.SetSprite)
	auth.Put("/native-language", middleware.Protected(cfg), authHandler.SetNativeLanguage)

	// Room Routes
	rooms := app.Group("/rooms", middleware.Protected(cfg))
	rooms.Get("/", roomHandler.GetPublicRooms)
	rooms.Post("/", roomHandler.CreateRoom)
	rooms.Get("/:id", roomHandler.GetRoom)
	rooms.Get("/:id/npcs", npcHandler.GetRoomNPCs)

	// NPC Guides Routes
	app.Get("/npcs/guides", middleware.Protected(cfg), npcHandler.GetGuides)

	// Arte de letreros de info (PÚBLICO: el <img> lo carga sin auth). El markdown del
	// letrero referencia /api/info-art/<archivo>.
	app.Get("/info-art/:file", infoArtHandler.ServeInfoArt)

	// Traducción de letreros de info al idioma nativo del jugador (cacheada por hash).
	app.Post("/info-translate", middleware.Protected(cfg), infoTranslateHandler.TranslateInfo)

	// Friend Routes
	friends := app.Group("/friends", middleware.Protected(cfg))
	friends.Get("/", friendHandler.ListFriends)
	friends.Get("/:id/messages", friendHandler.GetConversation)
	friends.Delete("/:id", friendHandler.RemoveFriend)
	friends.Get("/requests", friendHandler.ListRequests)
	friends.Post("/requests", friendHandler.SendRequest)
	friends.Post("/requests/:id/accept", friendHandler.AcceptRequest)
	friends.Post("/requests/:id/reject", friendHandler.RejectRequest)

	// User Blocks (moderación): bloquear/desbloquear usuarios con motivo
	blocks := app.Group("/blocks", middleware.Protected(cfg))
	blocks.Get("/", blockHandler.ListMyBlocks)
	blocks.Post("/", blockHandler.CreateBlock)
	blocks.Delete("/:userId", blockHandler.DeleteBlock)

	// Admin Routes
	admin := app.Group("/admin", middleware.Protected(cfg), middleware.AdminOnly())
	// Moderación: registro de bloqueos + acciones sobre cuentas
	admin.Get("/blocks", blockHandler.AdminListBlocks)
	admin.Put("/users/:id/active", blockHandler.AdminSetUserActive)
	admin.Post("/users/:id/notify", blockHandler.AdminNotifyUser)
	admin.Get("/maps", adminHandler.ListMapConfigs)
	admin.Post("/maps", adminHandler.SaveMapConfig)
	admin.Put("/maps/:id", adminHandler.UpdateMapConfig)
	admin.Delete("/maps/:id", adminHandler.DeleteMapConfig)
	admin.Post("/npcs", npcHandler.CreateNPCTemplate)
	admin.Put("/npcs/:id", npcHandler.UpdateNPCTemplate)
	admin.Delete("/npcs/:id", npcHandler.DeleteNPCTemplate)
	admin.Get("/npc-templates", npcHandler.GetAllTemplates)
	admin.Get("/npc-instances", npcHandler.GetTemplatesByScene)
	admin.Get("/npc-definitions/:id/templates", npcHandler.GetTemplatesByDefinition)
	admin.Put("/npc-templates/:id/missions", npcHandler.UpdateTemplateMissions)
	admin.Patch("/npc-templates/:id/instructions", npcHandler.PatchTemplateInstructions)
	admin.Get("/npc-definitions", npcHandler.GetNPCDefinitions)
	admin.Post("/npc-definitions", npcHandler.CreateNPCDefinition)
	admin.Put("/npc-definitions/:id", npcHandler.UpdateNPCDefinition)
	admin.Delete("/npc-definitions/:id", npcHandler.DeleteNPCDefinition)
	admin.Post("/ai-test", npcHandler.TestAI)
	admin.Get("/voices", ttsHandler.ListVoices)

	// Challenge Admin Routes
	admin.Get("/challenges", adminHandler.ListChallenges)
	admin.Post("/challenges", adminHandler.CreateChallenge)
	admin.Put("/challenges/:id", adminHandler.UpdateChallenge)
	admin.Delete("/challenges/:id", adminHandler.DeleteChallenge)
	admin.Post("/challenges/import", adminHandler.ImportChallenges)
	// Etiquetado masivo: arma el pool (temático o de examen) de un mundo de una vez.
	admin.Post("/challenges/bulk-tags", adminHandler.BulkTagChallenges)

	// Item & Shop Admin Routes
	admin.Get("/items", adminHandler.ListItems)
	admin.Get("/skills", adminHandler.ListSkills)
	admin.Post("/skills", adminHandler.CreateSkill)
	admin.Put("/skills/:id", adminHandler.UpdateSkill)
	admin.Delete("/skills/:id", adminHandler.DeleteSkill)
	// Jugadores con IA (bots de charla). CRUD propio: no comparte nada con el de
	// NPCs porque son entidades distintas.
	admin.Get("/ai-players", adminAIPlayerHandler.List)
	admin.Post("/ai-players", adminAIPlayerHandler.Create)
	admin.Post("/ai-players/seed-defaults", adminAIPlayerHandler.SeedDefaults)
	admin.Put("/ai-players/:id", adminAIPlayerHandler.Update)
	admin.Delete("/ai-players/:id", adminAIPlayerHandler.Delete)

	admin.Get("/enemies", adminHandler.ListEnemies)
	admin.Post("/enemies", adminHandler.CreateEnemy)
	admin.Put("/enemies/:id", adminHandler.UpdateEnemy)
	admin.Delete("/enemies/:id", adminHandler.DeleteEnemy)
	admin.Get("/item-sprites", adminHandler.ListItemSprites)

	// Arte de letreros de info (admin: subir / listar / borrar).
	admin.Get("/info-art", infoArtHandler.ListInfoArt)
	admin.Post("/info-art", infoArtHandler.UploadInfoArt)
	admin.Delete("/info-art/:file", infoArtHandler.DeleteInfoArt)
	admin.Post("/items", adminHandler.CreateItem)
	admin.Put("/items/:id", adminHandler.UpdateItem)
	admin.Delete("/items/:id", adminHandler.DeleteItem)
	admin.Get("/shops", adminHandler.ListShops)
	admin.Post("/shops", adminHandler.CreateShop)
	admin.Put("/shops/:id", adminHandler.UpdateShop)
	admin.Delete("/shops/:id", adminHandler.DeleteShop)

	// World Admin Routes (mundos: agrupan misiones y definen el pool de cards)
	admin.Get("/worlds", worldHandler.ListWorlds)
	admin.Post("/worlds", worldHandler.CreateWorld)
	admin.Put("/worlds/:id", worldHandler.UpdateWorld)
	admin.Delete("/worlds/:id", worldHandler.DeleteWorld)
	admin.Get("/worlds/:id/missions", worldHandler.GetWorldMissions)
	admin.Put("/worlds/:id/missions", worldHandler.SetWorldMissions)
	admin.Get("/worlds/:id/pool-health", worldHandler.GetPoolHealth)
	// Galería de imágenes disponibles (public/worlds del frontend), para elegir
	// la del mundo igual que se elige el sprite de un NPC o un ítem.
	admin.Get("/world-images", worldHandler.ListWorldImages)

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

	// WhatsApp Admin Routes
	admin.Get("/whatsapp/instances", whatsAppHandler.FetchInstances)
	admin.Delete("/whatsapp/instances/:name", whatsAppHandler.DeleteInstance)
	admin.Get("/whatsapp/global/qr", whatsAppHandler.GetGlobalQR)
	admin.Get("/whatsapp/global/status", whatsAppHandler.GetGlobalStatus)

	// Map config read (accessible to all authenticated users)
	app.Get("/maps/config", middleware.Protected(cfg), adminHandler.GetMapConfig)

	// Player Stats route
	app.Get("/player/stats", middleware.Protected(cfg), authHandler.GetPlayerStats)

	// Learning Routes
	learning := app.Group("/learning")
	learning.Get("/challenges/random", learningHandler.GetRandomChallenge)
	learning.Get("/challenges/metadata", learningHandler.GetChallengeMetadata)
	learning.Get("/leaderboard", learningHandler.GetLeaderboard)

	// Protected Learning Routes within the same group if possible, or just register individually
	learning.Post("/attempts", middleware.Protected(cfg), learningHandler.RecordAttempt)
	learning.Get("/profile", middleware.Protected(cfg), learningHandler.GetMyProfile)
	learning.Put("/profile/level", middleware.Protected(cfg), learningHandler.SetEnglishLevel)

	// NPC Dialogue Routes
	npc := app.Group("/npc", middleware.Protected(cfg))
	npc.Post("/dialogue", dialogueHandler.ProcessInput)

	// TTS Routes
	app.Post("/tts/generate", middleware.Protected(cfg), ttsHandler.Generate)
	app.Get("/tts/audio/:cache_key", ttsHandler.GetAudio)

	// World Routes (catálogo del jugador; todos abiertos, sin desbloqueo secuencial)
	worlds := app.Group("/worlds", middleware.Protected(cfg))
	worlds.Get("/", worldHandler.GetWorlds)
	worlds.Get("/:id/missions", worldHandler.GetWorldMissions)
	worlds.Get("/:id/mastery", worldHandler.GetWorldMastery)

	// El arte de mundos y mapas NO se sirve desde aquí: vive en public/worlds/ del
	// frontend y viaja con su build. La BD solo guarda el nombre del archivo.

	// Mission Routes
	missions := app.Group("/missions", middleware.Protected(cfg))
	missions.Get("/scene/:key", missionHandler.GetMissionsByScene)
	missions.Get("/npc/:id", missionHandler.GetMissionsByNPC)
	missions.Get("/:id/validate", missionHandler.ValidateMissionCompletion)
	missions.Post("/:id/accept", missionHandler.AcceptMission)
	missions.Post("/karaoke/complete", missionHandler.CompleteKaraoke)

	// Inventory Routes
	inventory := app.Group("/inventory", middleware.Protected(cfg))
	inventory.Get("/", inventoryHandler.GetInventory)
	inventory.Post("/test-add", inventoryHandler.AddTestItem)
	inventory.Post("/pickup/:id", pickupHandler.Pickup)
	inventory.Get("/pickups/:scene", pickupHandler.GetPickups)
	inventory.Post("/pickups/:scene/reset", pickupHandler.ResetPickups)
	inventory.Post("/use/:id", inventoryHandler.UseItem)

	// Shop Routes
	shop := app.Group("/shop", middleware.Protected(cfg))
	shop.Post("/buy", shopHandler.BuyItem)
	shop.Get("/npc/:id/items", shopHandler.GetNPCItems)

	// Billing / Membership (Wompi). The webhook is PUBLIC (Wompi calls it) and
	// verifies its own checksum; the rest require an authenticated user.
	app.Post("/billing/webhook", paymentHandler.Webhook)
	billing := app.Group("/billing", middleware.Protected(cfg))
	billing.Get("/config", paymentHandler.Config)     // public key + acceptance tokens + price
	billing.Post("/subscribe", paymentHandler.Subscribe) // register card + first charge
	billing.Post("/cancel", paymentHandler.Cancel)
	billing.Get("/status", paymentHandler.Status)

	// WhatsApp Public Webhook Route (no auth required for third party)
	app.Post("/whatsapp/webhook", whatsAppHandler.ReceiveWebhook)

	// WhatsApp Protected Routes
	whatsapp := app.Group("/whatsapp", middleware.Protected(cfg))
	whatsapp.Get("/qr", whatsAppHandler.GetQR)
	whatsapp.Get("/status", whatsAppHandler.GetStatus)
	whatsapp.Get("/contact", whatsAppHandler.GetContact)
	whatsapp.Post("/contact", whatsAppHandler.CreateOrUpdateContact)
	whatsapp.Get("/global/phone", whatsAppHandler.GetGlobalPhone)

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
