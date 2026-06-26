package middleware

import (
	"log"
	"strings"
	"sync"
	"time"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

// lastActiveUpdate throttles the per-request "last_active_at" write so we don't
// hammer the (possibly remote) DB with a slow UPDATE on EVERY authenticated
// request. We only refresh a user's timestamp at most once per interval.
var lastActiveUpdate sync.Map // user_id(string) -> time.Time

const lastActiveThrottle = 2 * time.Minute

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

		// Proactively update last active time of their whatsapp contact (non-blocking
		// AND throttled): at most once per `lastActiveThrottle` per user, so a burst
		// of requests doesn't flood a remote DB with slow UPDATEs and starve the pool.
		if userIDStr, ok := claims["user_id"].(string); ok && userIDStr != "" {
			now := time.Now()
			last, seen := lastActiveUpdate.Load(userIDStr)
			if !seen || now.Sub(last.(time.Time)) >= lastActiveThrottle {
				lastActiveUpdate.Store(userIDStr, now)
				go func(uid string, ts time.Time) {
					err := database.DB.Model(&models.WhatsAppContact{}).Where("user_id = ?", uid).Update("last_active_at", &ts).Error
					if err != nil {
						// Ignore GORM record not found errors as not all users have registered a WhatsApp contact yet
						if logErr := err.Error(); !strings.Contains(logErr, "record not found") {
							log.Printf("[AuthMiddleware] Warning: Failed to update last_active_at for user %s: %v", uid, err)
						}
					}
				}(userIDStr, now)
			}
		}

		return c.Next()
	}
}
