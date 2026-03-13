package middleware

import (
	"github.com/gofiber/fiber/v2"
)

// AdminOnly checks that the authenticated user has the "admin" role.
// Must be placed AFTER the Protected() middleware in the chain.
func AdminOnly() fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, _ := c.Locals("role").(string)
		if role != "admin" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Admin access required",
			})
		}
		return c.Next()
	}
}
