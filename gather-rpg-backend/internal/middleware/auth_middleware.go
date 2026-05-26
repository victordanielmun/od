package middleware

import (
	"log"
	"strings"
	"time"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

func Protected(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var tokenString string
		
		// Check Header
		authHeader := c.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}
		
		// Check Query (for WS)
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		if tokenString == "" {
			log.Println("[AuthMiddleware] Missing token")
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Missing token"})
		}

		claims, err := utils.ParseToken(tokenString)
		if err != nil {
			log.Printf("[AuthMiddleware] Invalid token: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Invalid token"})
		}

		c.Locals("user_id", claims["user_id"])
		c.Locals("username", claims["username"])
		c.Locals("role", claims["role"])

		// Proactively update last active time of their whatsapp contact in database (non-blocking)
		if userIDStr, ok := claims["user_id"].(string); ok && userIDStr != "" {
			go func(uid string) {
				now := time.Now()
				err := database.DB.Model(&models.WhatsAppContact{}).Where("user_id = ?", uid).Update("last_active_at", &now).Error
				if err != nil {
					// Ignore GORM record not found errors as not all users have registered a WhatsApp contact yet
					if logErr := err.Error(); !strings.Contains(logErr, "record not found") {
						log.Printf("[AuthMiddleware] Warning: Failed to update last_active_at for user %s: %v", uid, err)
					}
				}
			}(userIDStr)
		}

		return c.Next()
	}
}
