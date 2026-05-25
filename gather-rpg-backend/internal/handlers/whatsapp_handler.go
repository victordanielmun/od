package handlers

import (
	"errors"
	"fmt"
	"log"

	"time"

	"gather-rpg-backend/internal/database"
	"gather-rpg-backend/internal/models"
	"gather-rpg-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type WhatsAppHandler struct {
	WhatsAppService *services.WhatsAppService
}

func NewWhatsAppHandler(whatsAppService *services.WhatsAppService) *WhatsAppHandler {
	return &WhatsAppHandler{WhatsAppService: whatsAppService}
}

// GetQR ensures the WhatsApp instance is created and retrieves the connection QR code/status
func (h *WhatsAppHandler) GetQR(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	// Instance name based on authenticated user ID
	instanceName := fmt.Sprintf("user_%s", userIDStr)

	// Step 1: Force delete existing instance if any to guarantee a fresh QR code
	_, _ = h.WhatsAppService.DeleteInstance(instanceName)

	// Step 2: Create instance and get QR code directly from the creation response
	createRes, err := h.WhatsAppService.CreateInstance(instanceName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Step 3: Wait a bit for Baileys to connect and generate the QR code, then fetch it
	time.Sleep(3 * time.Second)
	var qrRes map[string]interface{}
	var qrErr error
	for i := 0; i < 4; i++ {
		qrRes, qrErr = h.WhatsAppService.GetConnectQR(instanceName)
		if qrErr == nil {
			if _, exists := qrRes["base64"]; exists {
				break
			}
		}
		time.Sleep(1500 * time.Millisecond)
	}

	if qrErr != nil || qrRes == nil {
		return c.JSON(createRes)
	}

	return c.JSON(qrRes)
}

// GetStatus gets the current connection status of the user's WhatsApp instance
func (h *WhatsAppHandler) GetStatus(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	instanceName := fmt.Sprintf("user_%s", userIDStr)

	statusRes, err := h.WhatsAppService.GetConnectionState(instanceName)
	if err != nil {
		log.Printf("[WhatsAppHandler] Error fetching connection state for %s: %v", instanceName, err)
		return c.JSON(fiber.Map{
			"status": "close",
			"state":  "close",
			"instance": fiber.Map{
				"state": "close",
			},
		})
	}

	return c.JSON(statusRes)
}

// FetchInstances retrieves all active WhatsApp instances
func (h *WhatsAppHandler) FetchInstances(c *fiber.Ctx) error {
	instances, err := h.WhatsAppService.FetchInstances()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(instances)
}

// DeleteInstance removes an instance by name
func (h *WhatsAppHandler) DeleteInstance(c *fiber.Ctx) error {
	instanceName := c.Params("name")
	if instanceName == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing instance name parameter"})
	}

	result, err := h.WhatsAppService.DeleteInstance(instanceName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// GetGlobalQR ensures the global admin instance is created and retrieves its connection QR code
func (h *WhatsAppHandler) GetGlobalQR(c *fiber.Ctx) error {
	instanceName := "admin_global"

	// Step 1: Force delete existing instance if any to guarantee a fresh QR code
	_, _ = h.WhatsAppService.DeleteInstance(instanceName)

	// Step 2: Create instance and get QR code directly from the creation response
	createRes, err := h.WhatsAppService.CreateInstance(instanceName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Step 3: Wait a bit for Baileys to connect and generate the QR code, then fetch it
	time.Sleep(3 * time.Second)
	var qrRes map[string]interface{}
	var qrErr error
	for i := 0; i < 4; i++ {
		qrRes, qrErr = h.WhatsAppService.GetConnectQR(instanceName)
		if qrErr == nil {
			if _, exists := qrRes["base64"]; exists {
				break
			}
		}
		time.Sleep(1500 * time.Millisecond)
	}

	if qrErr != nil || qrRes == nil {
		return c.JSON(createRes)
	}

	return c.JSON(qrRes)
}

// GetGlobalStatus gets the current connection status of the global admin instance
func (h *WhatsAppHandler) GetGlobalStatus(c *fiber.Ctx) error {
	instanceName := "admin_global"

	statusRes, err := h.WhatsAppService.GetConnectionState(instanceName)
	if err != nil {
		log.Printf("[WhatsAppHandler] Error fetching connection state for global: %v", err)
		return c.JSON(fiber.Map{
			"status": "close",
			"state":  "close",
			"instance": fiber.Map{
				"state": "close",
			},
		})
	}

	return c.JSON(statusRes)
}

// CreateOrUpdateContact upserts the WhatsApp contact details for the authenticated user
func (h *WhatsAppHandler) CreateOrUpdateContact(c *fiber.Ctx) error {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	var req struct {
		PhoneNumber          string `json:"phone_number"`
		WhatsAppName         string `json:"whatsapp_name"`
		NotificationsEnabled *bool  `json:"notifications_enabled"`
		Timezone             string `json:"timezone"`
		PreferredHourStart   *int16 `json:"preferred_hour_start"`
		PreferredHourEnd     *int16 `json:"preferred_hour_end"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.PhoneNumber == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Phone number is required"})
	}

	// Fetch existing contact or create a new one
	var contact models.WhatsAppContact
	err = database.DB.Where("user_id = ?", userID).First(&contact).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			contact = models.WhatsAppContact{
				ID:     uuid.New(),
				UserID: userID,
			}
		} else {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
	}

	contact.PhoneNumber = req.PhoneNumber
	if req.WhatsAppName != "" {
		contact.WhatsAppName = req.WhatsAppName
	}
	if req.NotificationsEnabled != nil {
		contact.NotificationsEnabled = *req.NotificationsEnabled
	}
	if req.Timezone != "" {
		contact.Timezone = req.Timezone
	} else if contact.Timezone == "" {
		contact.Timezone = "America/Bogota"
	}
	if req.PreferredHourStart != nil {
		contact.PreferredHourStart = *req.PreferredHourStart
	} else if contact.PreferredHourStart == 0 {
		contact.PreferredHourStart = 8
	}
	if req.PreferredHourEnd != nil {
		contact.PreferredHourEnd = *req.PreferredHourEnd
	} else if contact.PreferredHourEnd == 0 {
		contact.PreferredHourEnd = 21
	}

	if err := database.DB.Save(&contact).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(contact)
}
