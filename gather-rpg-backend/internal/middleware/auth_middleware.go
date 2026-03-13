package middleware

import (
	"log"
	"strings"

	"gather-rpg-backend/internal/config"
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
		return c.Next()
	}
}
