package handlers

import (
	"log"

	"gather-rpg-backend/internal/config"
	"gather-rpg-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type PaymentHandler struct {
	Sub *services.SubscriptionService
	Cfg *config.Config
}

func NewPaymentHandler(sub *services.SubscriptionService, cfg *config.Config) *PaymentHandler {
	return &PaymentHandler{Sub: sub, Cfg: cfg}
}

func userIDFromCtx(c *fiber.Ctx) (uuid.UUID, bool) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return uuid.Nil, false
	}
	uid, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, false
	}
	return uid, true
}

// Config returns the public Wompi data the checkout page needs to tokenize a card
// (public key + acceptance tokens) and show the price.
func (h *PaymentHandler) Config(c *fiber.Ctx) error {
	cfg, err := h.Sub.GetPublicConfig()
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(cfg)
}

// SubscribeRequest carries the card token the frontend obtained from Wompi
// (POST /v1/tokens/cards with the public key), so the PAN never reaches us.
type SubscribeRequest struct {
	CardToken string `json:"card_token"`
}

// Subscribe registers the card and issues the first membership charge.
func (h *PaymentHandler) Subscribe(c *fiber.Ctx) error {
	uid, ok := userIDFromCtx(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	var req SubscribeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	sub, err := h.Sub.Subscribe(uid, req.CardToken)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"status":     sub.Status,
		"is_premium": sub.IsActive(),
	})
}

// Cancel flags the subscription to stop renewing at period end.
func (h *PaymentHandler) Cancel(c *fiber.Ctx) error {
	uid, ok := userIDFromCtx(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	if err := h.Sub.CancelSubscription(uid); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "canceled"})
}

// Status returns the user's current membership state for the client.
func (h *PaymentHandler) Status(c *fiber.Ctx) error {
	uid, ok := userIDFromCtx(c)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	sub, err := h.Sub.GetSubscription(uid)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	resp := fiber.Map{
		"is_premium": sub.IsActive(),
		"status":     "none",
		"tier":       "free",
	}
	if sub != nil {
		resp["status"] = sub.Status
		resp["tier"] = sub.Tier
		resp["current_period_end"] = sub.CurrentPeriodEnd
		resp["cancel_at_period_end"] = sub.CancelAtPeriodEnd
	}
	return c.JSON(resp)
}

// Webhook receives Wompi events. It must run WITHOUT auth and verify the checksum
// over the raw body before trusting anything.
func (h *PaymentHandler) Webhook(c *fiber.Ctx) error {
	ev, err := h.Sub.VerifyAndParseEvent(c.Body())
	if err != nil {
		log.Printf("[Wompi] webhook verification failed: %v", err)
		return c.SendStatus(fiber.StatusBadRequest)
	}
	if err := h.Sub.ApplyTransactionEvent(ev); err != nil {
		log.Printf("[Wompi] apply event failed: %v", err)
		// Still 200 so Wompi doesn't retry indefinitely on our internal error.
	}
	return c.SendStatus(fiber.StatusOK)
}
